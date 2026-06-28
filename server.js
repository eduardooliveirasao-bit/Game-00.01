const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GAME_CLASSES, LEVEL_CAP } = require('./shared/classes.js');
const LevelManager = require('./server/managers/LevelManager');
const MonsterManager = require('./server/managers/MonsterManager');
const CombatManager = require('./server/managers/CombatManager');
const LootManager = require('./server/managers/LootManager');
const SaveManager = require('./server/managers/SaveManager');

const PORT = process.env.PORT || 3000;
const TICK_RATE_MS = 1000;
const RESURRECT_MS = 5000;
const SAVE_INTERVAL_MS = 15000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));
app.use('/shared', express.static('shared'));

const players = {};
const monsterManager = new MonsterManager();

const ACHIEVEMENTS = [
  { id: 'primeiro_sangue', nome: 'Primeiro Sangue', desc: 'Derrote seu primeiro monstro.', check: (p) => (p.kills || 0) >= 1, reward: { ouro: 80, gemas: 1 } },
  { id: 'cacador_10', nome: 'Caçador da Floresta', desc: 'Derrote 10 monstros.', check: (p) => (p.kills || 0) >= 10, reward: { ouro: 200, gemas: 2 } },
  { id: 'cacador_50', nome: 'Máquina Idle', desc: 'Derrote 50 monstros.', check: (p) => (p.kills || 0) >= 50, reward: { ouro: 750, gemas: 5 } },
  { id: 'nivel_5', nome: 'Despertar do Herói', desc: 'Alcance o nível 5.', check: (p) => (p.nivel || 1) >= 5, reward: { ouro: 160, gemas: 2 } },
  { id: 'poder_1000', nome: 'Poder Crescente', desc: 'Alcance 1000 de poder.', check: (p) => (p.power || 0) >= 1000, reward: { ouro: 250, gemas: 3 } },
  { id: 'matador_dragao', nome: 'Matador do Dragão Elemental', desc: 'Derrote o boss Dragão Elemental.', check: (p) => (p.stats && p.stats.bossKills >= 1), reward: { ouro: 1000, gemas: 8 } },
  { id: 'reliquia_boss', nome: 'Relíquia Dracônica', desc: 'Obtenha um item exclusivo de boss.', check: (p) => (p.inventario || []).some((i) => i.exclusivoBoss) || Object.values(p.equipados || {}).some((i) => i && i.exclusivoBoss), reward: { ouro: 500, gemas: 4 } }
];

function randomSuffix() { return Math.random().toString(36).slice(2, 6); }

function createPlayer(socket) {
  const player = {
    id: socket.id,
    saveId: SaveManager.createId(),
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
    gemas: 0,
    power: 0,
    kills: 0,
    horda: 1,
    autoFarm: true,
    isDead: false,
    deadUntil: 0,
    cooldowns: {},
    nextAutoSkillAt: 0,
    lastSavedAt: 0,
    inventario: [],
    equipados: { arma: null, anel: null, colar: null, ornamento: null },
    equipadosList: [],
    achievements: [],
    bestiary: {},
    stats: { damageDealt: 0, damageTaken: 0, goldEarned: 0, bossKills: 0, deaths: 0, itemsSold: 0 }
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
    saveId: player.saveId,
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
    gemas: player.gemas || 0,
    power: player.power,
    kills: player.kills,
    horda: player.horda,
    autoFarm: player.autoFarm,
    isDead: player.isDead,
    deadUntil: player.deadUntil,
    inventario,
    equipados,
    achievements: player.achievements || [],
    bestiary: player.bestiary || {},
    stats: player.stats || {}
  };
}

function publicPlayersList() { return Object.values(players).map(publicPlayer); }
function emitEnemyUpdate() { io.emit('enemyUpdate', monsterManager.getPublicMonster()); }

function syncPlayerPower(player) {
  LevelManager.syncProgressFields(player);
  player.power = LootManager.calculatePower(player);
}

function savePlayer(player, force = false) {
  if (!player || !player.saveId) return;
  const now = Date.now();
  if (!force && now - (player.lastSavedAt || 0) < 2500) return;
  player.lastSavedAt = now;
  SaveManager.save(player);
}

function updateAchievements(player) {
  player.achievements = player.achievements || [];
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (player.achievements.includes(ach.id)) continue;
    if (ach.check(player)) {
      player.achievements.push(ach.id);
      player.ouro = (player.ouro || 0) + (ach.reward.ouro || 0);
      player.gemas = (player.gemas || 0) + (ach.reward.gemas || 0);
      unlocked.push({ id: ach.id, nome: ach.nome, desc: ach.desc, reward: ach.reward });
    }
  }
  if (unlocked.length) io.to(player.id).emit('achievementsUnlocked', unlocked);
  return unlocked;
}

function rewardIfEnemyDied(player, combatEvent) {
  if (!combatEvent || !combatEvent.monsterDied) return;
  const dead = combatEvent.result.deadMonster;
  player.bestiary = player.bestiary || {};
  player.bestiary[dead.templateId] = (player.bestiary[dead.templateId] || 0) + 1;
  player.stats = player.stats || {};
  if (dead.isBoss) player.stats.bossKills = (player.stats.bossKills || 0) + 1;

  const progress = CombatManager.grantKillRewards(player, combatEvent);
  const loot = LootManager.grantKillLoot(player, dead);
  player.stats.goldEarned = (player.stats.goldEarned || 0) + loot.gold;
  syncPlayerPower(player);
  const unlocked = updateAchievements(player);
  savePlayer(player, true);

  io.emit('enemyDied', {
    killerId: player.id,
    killerName: player.nome,
    xpReward: combatEvent.result.xpReward,
    goldGained: loot.gold,
    loot: loot.item,
    achievements: unlocked,
    progress,
    deadMonster: dead,
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
  if (monster.isBoss && monster.special && monster.special.rageTurns > 0) damage = Math.floor(damage * 1.45);

  player.hp = Math.max(0, (player.hp || player.maxHp) - damage);
  player.stats = player.stats || {};
  player.stats.damageTaken = (player.stats.damageTaken || 0) + damage;
  const died = player.hp <= 0;
  if (died) {
    player.stats.deaths = (player.stats.deaths || 0) + 1;
    player.isDead = true;
    player.deadUntil = now + RESURRECT_MS;
    player.autoFarm = false;
    io.emit('playerDied', { playerId: player.id, playerName: player.nome, monsterName: monster.nome, resurrectIn: RESURRECT_MS });
    savePlayer(player, true);
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
  savePlayer(player, true);
  return true;
}

io.on('connection', (socket) => {
  const player = createPlayer(socket);
  players[socket.id] = player;

  socket.emit('init', { you: publicPlayer(player), players: publicPlayersList(), monster: monsterManager.getPublicMonster(), levelCap: LEVEL_CAP });
  socket.broadcast.emit('playerJoined', publicPlayer(player));
  io.emit('onlineCount', Object.keys(players).length);
  emitEnemyUpdate();

  socket.on('loadSave', (data = {}) => {
    const save = SaveManager.load(data.saveId);
    if (!save) {
      socket.emit('saveLoaded', { ok: false, reason: 'Save não encontrado.', saveId: player.saveId });
      savePlayer(player, true);
      return;
    }
    const offlineMs = Math.max(0, Date.now() - (save.updatedAt || Date.now()));
    SaveManager.apply(player, save);
    let offlineRewards = null;
    if (player.classeId && offlineMs > 60000) {
      const offlineMinutes = Math.min(240, Math.floor(offlineMs / 60000));
      const offlineKills = Math.max(1, Math.floor(offlineMinutes * 1.8));
      const offlineGold = Math.floor(offlineKills * (12 + (player.nivel || 1) * 3));
      const offlineXp = Math.floor(offlineKills * (18 + (player.nivel || 1) * 5));
      player.kills = (player.kills || 0) + offlineKills;
      player.ouro = (player.ouro || 0) + offlineGold;
      player.stats = player.stats || {};
      player.stats.goldEarned = (player.stats.goldEarned || 0) + offlineGold;
      LevelManager.addXP(player, offlineXp);
      offlineRewards = { minutes: offlineMinutes, kills: offlineKills, gold: offlineGold, xp: offlineXp };
    }
    syncPlayerPower(player);
    monsterManager.horda = Math.max(monsterManager.horda || 1, player.horda || 1);
    updateAchievements(player);
    savePlayer(player, true);
    socket.emit('saveLoaded', { ok: true, saveId: player.saveId, player: publicPlayer(player), offlineRewards });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('saveNow', () => {
    savePlayer(player, true);
    socket.emit('saveStatus', { ok: true, savedAt: Date.now(), saveId: player.saveId });
  });

  socket.on('selectClass', (data = {}) => {
    const classe = GAME_CLASSES[data.classeId];
    if (!classe) return socket.emit('errorMsg', 'Classe inválida.');
    player.classeId = data.classeId;
    player.nome = classe.nome;
    player.inventario = [];
    player.equipados = { arma: null, anel: null, colar: null, ornamento: null };
    player.cooldowns = {};
    player.horda = Math.max(1, player.horda || 1);
    player.isDead = false;
    player.deadUntil = 0;
    LevelManager.syncProgressFields(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    player.power = LootManager.calculatePower(player);
    updateAchievements(player);
    savePlayer(player, true);
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
    player.stats = player.stats || {};
    player.stats.damageDealt = (player.stats.damageDealt || 0) + (event.damage || 0);
    io.emit('abilityUsed', { playerId: player.id, classeId: player.classeId, habilidadeId: event.habilidadeId, habilidadeNome: event.habilidadeNome, visual: event.visual, icon: event.icon, cooldown: event.cooldown, damage: event.damage, isCrit: event.isCrit });
    io.emit('combatTick', { attacks: [event], monsterAttacks: [], monster: monsterManager.getPublicMonster(), serverTime: now });
    rewardIfEnemyDied(player, event);
    updateAchievements(player);
    io.emit('playerUpdated', publicPlayer(player));
    savePlayer(player);
    emitEnemyUpdate();
  });

  socket.on('toggleAutoFarm', (data = {}) => {
    if (player.isDead && data.enabled) return socket.emit('errorMsg', 'Não é possível ativar farm enquanto estiver derrotado.');
    player.autoFarm = !!data.enabled;
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('equipItem', (data = {}) => {
    const result = LootManager.equipItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    const unlocked = updateAchievements(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'equip', item: LootManager.enrichItem(result.item), achievements: unlocked });
  });

  socket.on('unequipItem', (data = {}) => {
    const result = LootManager.unequipSlot(player, data.slot);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'unequip', item: LootManager.enrichItem(result.item) });
  });

  socket.on('equipBestItems', () => {
    const result = LootManager.equipBestFromBag(player);
    syncPlayerPower(player);
    const unlocked = updateAchievements(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'equipBest', equippedItems: result.equippedItems, achievements: unlocked });
  });

  socket.on('sellItem', (data = {}) => {
    const result = LootManager.sellItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    player.stats = player.stats || {};
    player.stats.itemsSold = (player.stats.itemsSold || 0) + 1;
    syncPlayerPower(player);
    updateAchievements(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'sell', item: LootManager.enrichItem(result.item), gold: result.gold });
  });

  socket.on('sellAllItems', () => {
    const result = LootManager.sellAll(player);
    player.stats = player.stats || {};
    player.stats.itemsSold = (player.stats.itemsSold || 0) + result.sold;
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'sellAll', gold: result.gold, sold: result.sold });
  });

  socket.on('disconnect', () => {
    savePlayer(player, true);
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
    if (player.isDead) { io.emit('playerUpdated', publicPlayer(player)); continue; }

    CombatManager.regenMana(player);

    if (player.autoFarm) {
      const basic = CombatManager.basicAttack(player, monsterManager);
      if (basic) {
        player.stats = player.stats || {};
        player.stats.damageDealt = (player.stats.damageDealt || 0) + (basic.damage || 0);
        attacks.push(basic);
        rewardIfEnemyDied(player, basic);
      }

      const autoSkill = CombatManager.tryAutoAbility(player, monsterManager, now);
      if (autoSkill) {
        player.stats = player.stats || {};
        player.stats.damageDealt = (player.stats.damageDealt || 0) + (autoSkill.damage || 0);
        attacks.push(autoSkill);
        io.emit('abilityUsed', { playerId: player.id, classeId: player.classeId, habilidadeId: autoSkill.habilidadeId, habilidadeNome: autoSkill.habilidadeNome, visual: autoSkill.visual, icon: autoSkill.icon, cooldown: autoSkill.cooldown, damage: autoSkill.damage, isCrit: autoSkill.isCrit });
        rewardIfEnemyDied(player, autoSkill);
      }

      const mAttack = monsterStrike(player, now);
      if (mAttack) monsterAttacks.push(mAttack);
    }

    syncPlayerPower(player);
    updateAchievements(player);
    if (now - (player.lastSavedAt || 0) > SAVE_INTERVAL_MS) savePlayer(player, true);
  }

  io.emit('gameState', publicPlayersList());
  io.emit('onlineCount', Object.keys(players).length);
  if (attacks.length || monsterAttacks.length) io.emit('combatTick', { attacks, monsterAttacks, monster: monsterManager.getPublicMonster(), serverTime: now });
  emitEnemyUpdate();
}, TICK_RATE_MS);

server.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
