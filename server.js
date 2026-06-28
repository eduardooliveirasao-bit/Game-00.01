
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
    asaNivel: 1,
    asaNome: 'Asas Iniciais',
    ouro: 0,
    power: 0,
    kills: 0,
    horda: 1,
    autoFarm: true,
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
    asaNivel: player.asaNivel,
    asaNome: player.asaNome,
    ouro: player.ouro,
    power: player.power,
    kills: player.kills,
    horda: player.horda,
    autoFarm: player.autoFarm,
    inventario: player.inventario,
    equipados: player.equipados,
    mana: player.classeId ? (GAME_CLASSES[player.classeId].baseStats.mana || 0) : 0
  };
}

function publicPlayersList() { return Object.values(players).map(publicPlayer); }
function emitEnemyUpdate() { io.emit('enemyUpdate', monsterManager.getPublicMonster()); }

function rewardIfEnemyDied(player, combatEvent) {
  if (!combatEvent || !combatEvent.monsterDied) return;
  const progress = CombatManager.grantKillRewards(player, combatEvent);
  const loot = LootManager.grantKillLoot(player, combatEvent.result.deadMonster);
  LevelManager.syncProgressFields(player);
  player.power = LootManager.calculatePower(player);
  io.emit('enemyDied', {
    killerId: player.id,
    killerName: player.nome,
    xpReward: combatEvent.result.xpReward,
    goldGained: loot.gold,
    loot: loot.item,
    autoEquipped: loot.autoEquipped,
    progress,
    deadMonster: combatEvent.result.deadMonster,
    nextMonster: combatEvent.result.nextMonster,
    horda: combatEvent.result.horda,
    player: publicPlayer(player)
  });
  io.emit('playerUpdated', publicPlayer(player));
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
    player.mana = classe.baseStats.mana;
    player.inventario = [];
    player.equipados = { arma: null, anel: null, colar: null, ornamento: null };
    player.equipadosList = [];
    LevelManager.syncProgressFields(player);
    player.power = LootManager.calculatePower(player);
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('useAbility', (data = {}) => {
    const now = Date.now();
    const event = CombatManager.useAbility(player, data.habilidadeId, monsterManager, now);
    if (!event.ok) {
      if (event.restanteMs) socket.emit('cooldownRejected', { restanteMs: event.restanteMs });
      else socket.emit('errorMsg', event.reason);
      return;
    }
    io.emit('abilityUsed', { playerId: player.id, classeId: player.classeId, habilidadeId: event.habilidadeId, habilidadeNome: event.habilidadeNome, visual: event.visual, cooldown: event.cooldown, damage: event.damage, isCrit: event.isCrit });
    io.emit('combatTick', { attacks: [event], monster: monsterManager.getPublicMonster(), serverTime: now });
    rewardIfEnemyDied(player, event);
    emitEnemyUpdate();
  });

  socket.on('toggleAutoFarm', (data = {}) => {
    player.autoFarm = !!data.enabled;
    io.emit('playerUpdated', publicPlayer(player));
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

  for (const player of Object.values(players)) {
    if (!player.classeId || !player.autoFarm) continue;

    const basic = CombatManager.basicAttack(player, monsterManager);
    if (basic) {
      attacks.push(basic);
      rewardIfEnemyDied(player, basic);
    }

    const autoSkill = CombatManager.tryAutoAbility(player, monsterManager, now);
    if (autoSkill) {
      attacks.push(autoSkill);
      io.emit('abilityUsed', { playerId: player.id, classeId: player.classeId, habilidadeId: autoSkill.habilidadeId, habilidadeNome: autoSkill.habilidadeNome, visual: autoSkill.visual, cooldown: autoSkill.cooldown, damage: autoSkill.damage, isCrit: autoSkill.isCrit });
      rewardIfEnemyDied(player, autoSkill);
    }

    LevelManager.syncProgressFields(player);
    player.power = LootManager.calculatePower(player);
  }

  io.emit('gameState', publicPlayersList());
  io.emit('onlineCount', Object.keys(players).length);
  if (attacks.length) io.emit('combatTick', { attacks, monster: monsterManager.getPublicMonster(), serverTime: now });
  emitEnemyUpdate();
}, TICK_RATE_MS);

server.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
