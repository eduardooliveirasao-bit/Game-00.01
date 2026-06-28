const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GAME_CLASSES, LEVEL_CAP } = require('./shared/classes.js');
const LevelManager = require('./server/managers/LevelManager');
const MonsterManager = require('./server/managers/MonsterManager');
const CombatManager = require('./server/managers/CombatManager');
const LootManager = require('./server/managers/LootManager');

const PORT = process.env.PORT || 3000;
const TICK_RATE_MS = 1000;
const RESURRECT_MS = 5000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));
app.use('/shared', express.static('shared'));

const players = {};
const monsterManager = new MonsterManager();

function randomSuffix() { return Math.random().toString(36).slice(2, 6); }

function createPlayer(socket) {
  const player = {
    id: socket.id,
    nome: 'Aventureiro-' + randomSuffix(),
    classeId: null,
    nivel: 1,
    level: 1,
    xp: 0,
    xpToNext: 0,
    xpPercent: 0,
    hp: 100,
    maxHp: 100,
    mana: 0,
    maxMana: 0,
    asaNivel: 1,
    asaNome: 'Asas Iniciais',
    ouro: 0,
    power: 0,
    kills: 0,
    horda: 1,
    autoFarm: true,
    isDead: false,
    deadUntil: 0,
    cooldowns: {},
    nextAutoSkillAt: 0,
    inventario: [],
    equipados: { arma: null, anel: null, colar: null, ornamento: null },
    equipadosList: []
  };
  LevelManager.syncProgressFields(player);
  player.power = LootManager.calculatePower(player);
  return player;
}

function publicPlayer(player) {
  const inventario = (player.inventario || []).map((item) => LootManager.enrichItem({ ...item }));
  const equipados = {};
  Object.keys(player.equipados || {}).forEach((slot) => {
    equipados[slot] = player.equipados[slot] ? LootManager.enrichItem({ ...player.equipados[slot] }) : null;
  });
  return {
    id: player.id,
    nome: player.nome,
    classeId: player.classeId,
    nivel: player.nivel,
    level: player.level,
    xp: player.xp,
    xpToNext: player.xpToNext,
    xpPercent: player.xpPercent,
    hp: player.hp,
    maxHp: player.maxHp,
    mana: player.mana,
    maxMana: player.maxMana,
    asaNivel: player.asaNivel,
    asaNome: player.asaNome,
    ouro: player.ouro,
    power: player.power,
    kills: player.kills,
    horda: player.horda,
    autoFarm: player.autoFarm,
    isDead: player.isDead,
    deadUntil: player.deadUntil,
    inventario,
    equipados
  };
}

function publicPlayersList() { return Object.values(players).map(publicPlayer); }
function emitEnemyUpdate() { io.emit('enemyUpdate', monsterManager.getPublicMonster()); }
function syncPlayerPower(player) {
  LevelManager.syncProgressFields(player);
  player.power = LootManager.calculatePower(player);
}

function rewardIfEnemyDied(player, combatEvent) {
  if (!combatEvent || !combatEvent.monsterDied) return;
  const progress = CombatManager.grantKillRewards(player, combatEvent);
  const loot = LootManager.grantKillLoot(player, combatEvent.result.deadMonster);
  syncPlayerPower(player);
  io.emit('enemyDied', {
    killerId: player.id,
    killerName: player.nome,
    xpReward: combatEvent.result.xpReward,
    goldGained: loot.gold,
    loot: loot.item,
    progress,
    deadMonster: combatEvent.result.deadMonster,
    nextMonster: combatEvent.result.nextMonster,
    horda: combatEvent.result.horda,
    player: publicPlayer(player)
  });
  io.emit('playerUpdated', publicPlayer(player));
}

function monsterStrike(player, now) {
  if (!player.classeId || player.isDead) return null;
  const monster = monsterManager.getPublicMonster();
  const base = 3 + Math.floor(monster.nivel * (monster.isBoss ? 1.25 : monster.templateId === 'skeleton' ? 0.8 : 0.55));
  const defense = (GAME_CLASSES[player.classeId]?.baseStats?.defesa || 0) + LootManager.getEquippedList(player).reduce((s, item) => s + ((item.stats && item.stats.defesa) || 0), 0);
  let damage = Math.max(1, Math.floor(base - defense * 0.08));
  if (monster.special && monster.special.active) damage = Math.floor(damage * 1.25);
  if (monster.isBoss && monster.special && monster.special.rageTurns > 0) {
    damage = Math.floor(damage * 1.45);
    monster.special.rageTurns -= 1;
  }
  player.hp = Math.max(0, (player.hp || player.maxHp) - damage);
  const died = player.hp <= 0;
  if (died) {
    player.isDead = true;
    player.deadUntil = now + RESURRECT_MS;
    player.autoFarm = false;
    io.emit('playerDied', { playerId: player.id, playerName: player.nome, monsterName: monster.nome, resurrectIn: RESURRECT_MS });
  }
  return { playerId: player.id, playerName: player.nome, monsterName: monster.nome, damage, died, monsterTemplateId: monster.templateId };
}

function tryResurrect(player, now) {
  if (!player.isDead || now < player.deadUntil) return false;
  player.isDead = false;
  player.deadUntil = 0;
  player.hp = Math.max(1, Math.floor(player.maxHp * 0.65));
  player.mana = Math.max(0, Math.floor(player.maxMana * 0.65));
  player.autoFarm = true;
  io.emit('playerRevived', { playerId: player.id, playerName: player.nome, player: publicPlayer(player) });
  return true;
}

io.on('connection', (socket) => {
  const player = createPlayer(socket);
  players[socket.id] = player;

  socket.emit('init', { you: publicPlayer(player), players: publicPlayersList(), monster: monsterManager.getPublicMonster(), levelCap: LEVEL_CAP });
  socket.broadcast.emit('playerJoined', publicPlayer(player));
  io.emit('onlineCount', Object.keys(players).length);
  emitEnemyUpdate();

  socket.on('selectClass', (data = {}) => {
    const classe = GAME_CLASSES[data.classeId];
    if (!classe) return socket.emit('errorMsg', 'Classe inválida.');
    player.classeId = data.classeId;
    player.nome = classe.nome;
    player.inventario = [];
    player.equipados = { arma: null, anel: null, colar: null, ornamento: null };
    player.cooldowns = {};
    player.horda = 1;
    player.isDead = false;
    player.deadUntil = 0;
    LevelManager.syncProgressFields(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    player.power = LootManager.calculatePower(player);
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('useAbility', (data = {}) => {
    if (player.isDead) return socket.emit('errorMsg', 'Você está derrotado. Aguarde a ressurreição.');
    const now = Date.now();
    const event = CombatManager.useAbility(player, data.habilidadeId, monsterManager, now);
    if (!event.ok) {
      if (event.restanteMs) socket.emit('cooldownRejected', { restanteMs: event.restanteMs });
      else socket.emit('errorMsg', event.reason);
      return;
    }
    io.emit('abilityUsed', {
      playerId: player.id,
      classeId: player.classeId,
      habilidadeId: event.habilidadeId,
      habilidadeNome: event.habilidadeNome,
      visual: event.visual,
      icon: event.icon,
      cooldown: event.cooldown,
      damage: event.damage,
      isCrit: event.isCrit
    });
    io.emit('combatTick', { attacks: [event], monsterAttacks: [], monster: monsterManager.getPublicMonster(), serverTime: now });
    rewardIfEnemyDied(player, event);
    io.emit('playerUpdated', publicPlayer(player));
    emitEnemyUpdate();
  });

  socket.on('toggleAutoFarm', (data = {}) => {
    if (player.isDead && data.enabled) return socket.emit('errorMsg', 'Não é possível ativar farm enquanto estiver derrotado.');
    player.autoFarm = !!data.enabled;
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('equipItem', (data = {}) => {
    const result = LootManager.equipItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'equip', item: LootManager.enrichItem(result.item) });
  });

  socket.on('unequipItem', (data = {}) => {
    const result = LootManager.unequipSlot(player, data.slot);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'unequip', item: LootManager.enrichItem(result.item) });
  });

  socket.on('sellItem', (data = {}) => {
    const result = LootManager.sellItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'sell', item: LootManager.enrichItem(result.item), gold: result.gold });
  });

  socket.on('sellAllItems', () => {
    const result = LootManager.sellAll(player);
    syncPlayerPower(player);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'sellAll', gold: result.gold, sold: result.sold });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    io.emit('onlineCount', Object.keys(players).length);
    io.emit('gameState', publicPlayersList());
  });
});

setInterval(() => {
  const now = Date.now();
  const attacks = [];
  const monsterAttacks = [];

  for (const player of Object.values(players)) {
    if (!player.classeId) continue;
    if (tryResurrect(player, now)) syncPlayerPower(player);
    if (player.isDead) {
      io.emit('playerUpdated', publicPlayer(player));
      continue;
    }

    CombatManager.regenMana(player);

    if (player.autoFarm) {
      const basic = CombatManager.basicAttack(player, monsterManager);
      if (basic) {
        attacks.push(basic);
        rewardIfEnemyDied(player, basic);
      }

      const autoSkill = CombatManager.tryAutoAbility(player, monsterManager, now);
      if (autoSkill) {
        attacks.push(autoSkill);
        io.emit('abilityUsed', {
          playerId: player.id,
          classeId: player.classeId,
          habilidadeId: autoSkill.habilidadeId,
          habilidadeNome: autoSkill.habilidadeNome,
          visual: autoSkill.visual,
          icon: autoSkill.icon,
          cooldown: autoSkill.cooldown,
          damage: autoSkill.damage,
          isCrit: autoSkill.isCrit
        });
        rewardIfEnemyDied(player, autoSkill);
      }

      const mAttack = monsterStrike(player, now);
      if (mAttack) monsterAttacks.push(mAttack);
    }

    syncPlayerPower(player);
  }

  io.emit('gameState', publicPlayersList());
  io.emit('onlineCount', Object.keys(players).length);
  if (attacks.length || monsterAttacks.length) io.emit('combatTick', { attacks, monsterAttacks, monster: monsterManager.getPublicMonster(), serverTime: now });
  emitEnemyUpdate();
}, TICK_RATE_MS);

server.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
