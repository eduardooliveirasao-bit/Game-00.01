const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GAME_CLASSES, LEVEL_CAP, SHOP_ITEMS } = require('./shared/classes.js');
const LevelManager = require('./server/managers/LevelManager');
const MonsterManager = require('./server/managers/MonsterManager');
const CombatManager = require('./server/managers/CombatManager');
const LootManager = require('./server/managers/LootManager');
const SaveManager = require('./server/managers/SaveManager');
const AccountManager = require('./server/managers/AccountManager');
const PetManager = require('./server/managers/PetManager');
const TalentManager = require('./server/managers/TalentManager');
const ExpeditionManager = require('./server/managers/ExpeditionManager');
const MetaProgressManager = require('./server/managers/MetaProgressManager');

const PORT = process.env.PORT || 3000;
const TICK_RATE_MS = 1000;
const RESURRECT_MS = 5000;
const SAVE_INTERVAL_MS = 15000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));
app.use('/shared', express.static('shared'));

app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'Legend Of Indle RPG V1',
    uptime: Math.floor(process.uptime()),
    online: Object.keys(players || {}).length,
    timestamp: Date.now()
  });
});

const players = {};
const monsterManager = new MonsterManager();
AccountManager.ensureDefaultGM(SaveManager, createPlayer);

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
    accountLogin: null,
    isAuthenticated: false,
    isGM: false,
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
    cashGems: 0,
    pocoes: { vida: 0, mana: 0 },
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
    mount: { id: 'lobo_cristalino', level: 1 },
    mountCollection: [{ id: 'lobo_cristalino', level: 1, active: true, unlockedAt: Date.now() }],
    achievements: [],
    bestiary: {},
    stats: { damageDealt: 0, damageTaken: 0, goldEarned: 0, bossKills: 0, deaths: 0, itemsSold: 0 },
    daily: { lastClaimDay: null, streak: 0 },
    pets: { owned: [{ id: 'fogo_fenix', level: 1 }, { id: 'luz_serafim', level: 1 }], equipped: ['fogo_fenix', 'luz_serafim'] },
    talents: {},
    expedition: { active: null, history: [] },
    missions: null,
    codex: null,
    ascension: null,
    season: null,
    extraTalentPoints: 0
  };
  LevelManager.syncProgressFields(player);
  MetaProgressManager.normalize(player);
  player.power = LootManager.calculatePower(player) + PetManager.powerBonus(player);
  return player;
}

function publicPlayer(player) {
  LootManager.syncInventoryFlags(player);
  const inventario = (player.inventario || []).map((item) => LootManager.enrichItem({ ...item }));
  const equipados = {};
  Object.keys(player.equipados || {}).forEach((slot) => {
    equipados[slot] = player.equipados[slot] ? LootManager.enrichItem({ ...player.equipados[slot] }) : null;
  });
  return {
    id: player.id,
    saveId: player.saveId,
    accountLogin: player.accountLogin || null,
    isAuthenticated: !!player.isAuthenticated,
    isGM: !!player.isGM,
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
    cashGems: player.cashGems != null ? player.cashGems : (player.gemas || 0),
    pocoes: player.pocoes || { vida: 0, mana: 0 },
    power: player.power,
    kills: player.kills,
    horda: player.horda,
    autoFarm: player.autoFarm,
    isDead: player.isDead,
    deadUntil: player.deadUntil,
    inventario,
    equipados,
    visualMods: LootManager.getVisualMods(player),
    mount: LootManager.getMount(player),
    mountCollection: LootManager.getMountCollection(player),
    mountBonus: LootManager.getMountBonus(player),
    attributes: LootManager.getCharacterAttributes(player),
    achievements: player.achievements || [],
    bestiary: player.bestiary || {},
    stats: player.stats || {},
    daily: player.daily || { lastClaimDay: null, streak: 0 },
    pets: PetManager.publicPets(player),
    talents: TalentManager.publicTalents(player),
    expedition: ExpeditionManager.publicExpedition(player),
    meta: MetaProgressManager.publicMeta(player)
  };
}

function publicPlayersList() { return Object.values(players).map(publicPlayer); }

function buildRanking() {
  const map = new Map();
  for (const p of Object.values(players)) {
    if (!p.classeId) continue;
    syncPlayerPower(p);
    map.set(p.saveId || p.id, publicPlayer(p));
  }
  for (const save of SaveManager.list()) {
    if (!save || !save.classeId) continue;
    const key = save.saveId || save.nome;
    if (map.has(key)) continue;
    const fake = createPlayer({ id: key });
    SaveManager.apply(fake, save);
    syncPlayerPower(fake);
    map.set(key, publicPlayer(fake));
  }
  const base = Array.from(map.values()).map((p) => ({
    nome: p.nome, classeId: p.classeId, nivel: p.nivel, power: p.power, kills: p.kills || 0, horda: p.horda || 1, bossKills: (p.stats && p.stats.bossKills) || 0, mount: p.mount, ascensionRank: (p.meta && p.meta.ascension && p.meta.ascension.rank) || 0
  }));
  return {
    level: base.slice().sort((a,b) => (b.nivel - a.nivel) || (b.power - a.power)).slice(0, 20),
    power: base.slice().sort((a,b) => (b.power - a.power) || (b.nivel - a.nivel)).slice(0, 20)
  };
}
function emitEnemyUpdate() { io.emit('enemyUpdate', monsterManager.getPublicMonster()); }

function syncPlayerPower(player) {
  MetaProgressManager.normalize(player);
  LevelManager.syncProgressFields(player);
  MetaProgressManager.normalize(player);
  player.power = LootManager.calculatePower(player) + PetManager.powerBonus(player);
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
  MetaProgressManager.progressMission(player, loot.item ? 'loot' : 'none', loot.item ? 1 : 0);
  const talentBonus = TalentManager.getBonuses(player);
  const meta = MetaProgressManager.publicMeta(player);
  const goldPctMeta = (meta.zone && meta.zone.bonus && meta.zone.bonus.goldPct || 0) + ((meta.ascension && meta.ascension.bonuses && meta.ascension.bonuses.goldPct) || 0) + ((meta.ascension && meta.ascension.artifactBonuses && meta.ascension.artifactBonuses.goldPct) || 0) + ((meta.codex && meta.codex.bonuses && meta.codex.bonuses.goldPct) || 0);
  if (goldPctMeta) { const zGold = Math.floor((loot.gold || 0) * goldPctMeta); if (zGold > 0) { player.ouro = (player.ouro || 0) + zGold; loot.gold += zGold; } }
  if (talentBonus.goldPct) {
    const extraGold = Math.floor((loot.gold || 0) * talentBonus.goldPct);
    if (extraGold > 0) {
      player.ouro = (player.ouro || 0) + extraGold;
      loot.gold += extraGold;
    }
  }
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
    autoEquipSuggestion: loot.autoEquipSuggestion,
    achievements: unlocked,
    progress,
    deadMonster: dead,
    nextMonster: combatEvent.result.nextMonster,
    horda: combatEvent.result.horda,
    player: publicPlayer(player),
    meta: MetaProgressManager.publicMeta(player)
  });
  io.emit('playerUpdated', publicPlayer(player));
}

function monsterStrike(player, now) {
  if (!player.classeId || player.isDead) return null;
  const monster = monsterManager.getPublicMonster();
  const base = 3 + Math.floor(monster.nivel * (monster.isBoss ? 1.25 : monster.templateId === 'skeleton' ? 0.8 : 0.55));
  const talentBonus = TalentManager.getBonuses(player);
  const metaBonus = MetaProgressManager.getArtifactBonuses(player);
  const codexBonus = MetaProgressManager.getCodexBonuses(player);
  const defense = (GAME_CLASSES[player.classeId]?.baseStats?.defesa || 0) + LootManager.getEquippedList(player).reduce((s, item) => s + ((item.stats && item.stats.defesa) || 0), 0) + (talentBonus.defesa || 0) + (metaBonus.defesa || 0) + (codexBonus.defesa || 0);
  const dodgeChance = Math.min(42, (talentBonus.evasion || 0) + ((LootManager.getCharacterAttributes(player).evasion || 0) * 0.12));
  if (Math.random() * 100 < dodgeChance) {
    return { playerId: player.id, playerName: player.nome, damage: 0, dodged: true, died: false, hp: player.hp, maxHp: player.maxHp };
  }
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


function applyAccountToPlayer(player, accountResult) {
  const save = SaveManager.load(accountResult.saveId);
  if (save) SaveManager.apply(player, save);
  player.saveId = accountResult.saveId;
  player.accountLogin = accountResult.account.login;
  player.isAuthenticated = true;
  player.isGM = !!accountResult.account.isGM;
  player.nome = accountResult.account.nick || player.nome;
  if (player.isGM) {
    player.ouro = Math.max(player.ouro || 0, 500000);
    player.gemas = Math.max(player.gemas || 0, 50000);
    player.cashGems = Math.max(player.cashGems || 0, 50000);
  } else {
    player.cashGems = player.cashGems != null ? player.cashGems : (player.gemas || 0);
  }
  MetaProgressManager.normalize(player);
  syncPlayerPower(player);
  savePlayer(player, true);
  return player;
}

function requireAuth(socket, player) {
  if (!player.isAuthenticated) {
    socket.emit('errorMsg', 'Faça login ou crie uma conta antes de jogar.');
    return false;
  }
  return true;
}

function buyShopItem(player, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { ok: false, reason: 'Item da loja inválido.' };
  const price = item.priceGems || 0;
  if ((player.gemas || 0) < price) return { ok: false, reason: 'Gemas insuficientes.' };
  player.gemas -= price;
  player.cashGems = player.gemas;

  let granted = null;
  if (item.tipo === 'potion') {
    player.pocoes = player.pocoes || { vida: 0, mana: 0 };
    if (item.effect && item.effect.hpPercent) player.pocoes.vida = (player.pocoes.vida || 0) + 1;
    if (item.effect && item.effect.manaPercent) player.pocoes.mana = (player.pocoes.mana || 0) + 1;
    granted = { tipo: 'potion', pocoes: player.pocoes };
  } else if (item.tipo === 'currency') {
    const gold = (item.effect && item.effect.ouro) || 0;
    player.ouro = (player.ouro || 0) + gold;
    granted = { tipo: 'currency', ouro: gold };
  } else if (item.tipo === 'chest') {
    const drop = LootManager.createShopDrop(player, item.rarityMin || 'raro');
    if (drop) {
      player.inventario = player.inventario || [];
      player.inventario.unshift(drop);
    }
    granted = { tipo: 'chest', item: drop };
  } else if (item.tipo === 'boss') {
    monsterManager.horda = Math.ceil((monsterManager.horda || 1) / 10) * 10;
    monsterManager.currentMonster = monsterManager.generateMonster(player.nivel || 1);
    granted = { tipo: 'boss', monster: monsterManager.getPublicMonster() };
  } else if (item.tipo === 'mount') {
    const mountId = item.id === 'montaria_dragao' ? 'dragao_mirim' : 'grifo_dourado';
    const baseLevel = item.id === 'montaria_dragao' ? 8 : 4;
    const mountResult = LootManager.unlockMount(player, mountId, baseLevel);
    granted = { tipo: 'mount', mount: mountResult.mount, collection: mountResult.collection, bonus: mountResult.bonus };
  } else if (item.tipo === 'pet') {
    const petResult = PetManager.acquire(player, item.petId);
    granted = { tipo: 'pet', pet: petResult.pet, pets: PetManager.publicPets(player) };
  }
  syncPlayerPower(player);
  return { ok: true, shopItem: item, granted };
}

function usePotion(player, type) {
  player.pocoes = player.pocoes || { vida: 0, mana: 0 };
  if (type === 'vida') {
    if ((player.pocoes.vida || 0) <= 0) return { ok: false, reason: 'Você não tem poção de vida.' };
    player.pocoes.vida -= 1;
    player.hp = Math.min(player.maxHp || 1, (player.hp || 0) + Math.floor((player.maxHp || 1) * 0.6));
    return { ok: true, type };
  }
  if (type === 'mana') {
    if ((player.pocoes.mana || 0) <= 0) return { ok: false, reason: 'Você não tem poção de mana.' };
    player.pocoes.mana -= 1;
    player.mana = Math.min(player.maxMana || 0, (player.mana || 0) + Math.floor((player.maxMana || 0) * 0.7));
    return { ok: true, type };
  }
  return { ok: false, reason: 'Poção inválida.' };
}

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function claimDailyReward(player) {
  player.daily = player.daily || { lastClaimDay: null, streak: 0 };
  const today = dayKey();
  if (player.daily.lastClaimDay === today) return { ok: false, reason: 'Recompensa diária já coletada hoje.' };
  const yesterday = dayKey(Date.now() - 86400000);
  const streak = player.daily.lastClaimDay === yesterday ? (player.daily.streak || 0) + 1 : 1;
  player.daily.lastClaimDay = today;
  player.daily.streak = Math.min(30, streak);
  const gold = 700 + player.daily.streak * 220 + (player.nivel || 1) * 35;
  const gems = 5 + Math.floor(player.daily.streak / 3);
  player.ouro = (player.ouro || 0) + gold;
  player.gemas = (player.gemas || 0) + gems;
  player.cashGems = player.gemas;
  player.pocoes = player.pocoes || { vida: 0, mana: 0 };
  player.pocoes.vida = (player.pocoes.vida || 0) + 1;
  player.pocoes.mana = (player.pocoes.mana || 0) + 1;
  return { ok: true, gold, gems, streak: player.daily.streak, potions: { vida: 1, mana: 1 } };
}

io.on('connection', (socket) => {
  const player = createPlayer(socket);
  players[socket.id] = player;

  socket.emit('init', { you: publicPlayer(player), players: publicPlayersList(), monster: monsterManager.getPublicMonster(), levelCap: LEVEL_CAP, shopItems: SHOP_ITEMS, authRequired: true });
  socket.broadcast.emit('playerJoined', publicPlayer(player));
  io.emit('onlineCount', Object.keys(players).length);
  emitEnemyUpdate();

  socket.on('registerAccount', (data = {}) => {
    const result = AccountManager.create({
      login: data.login,
      password: data.password,
      nick: data.nick,
      classeId: data.classeId,
      SaveManager,
      createPlayer
    });
    if (!result.ok) return socket.emit('authError', result.reason);
    applyAccountToPlayer(player, result);
    socket.emit('authSuccess', { mode: 'register', account: result.account, player: publicPlayer(player), gmPasswordHint: result.account.isGM ? 'GM123' : null });
    io.emit('playerUpdated', publicPlayer(player));
    io.emit('rankingUpdate', buildRanking());
  });

  socket.on('loginAccount', (data = {}) => {
    const result = AccountManager.login(data.login, data.password);
    if (!result.ok) return socket.emit('authError', result.reason);
    applyAccountToPlayer(player, result);
    socket.emit('authSuccess', { mode: 'login', account: result.account, player: publicPlayer(player) });
    io.emit('playerUpdated', publicPlayer(player));
    io.emit('rankingUpdate', buildRanking());
  });

  socket.on('changeNick', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = AccountManager.changeNick(player.accountLogin, data.nick);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    player.nome = result.account.nick;
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'nick', nick: player.nome });
  });

  socket.on('loadSave', (data = {}) => {
    const save = SaveManager.load(data.saveId);
    if (!save) {
      socket.emit('saveLoaded', { ok: false, reason: 'Save não encontrado.', saveId: player.saveId });
      savePlayer(player, true);
      return;
    }
    const offlineMs = Math.max(0, Date.now() - (save.updatedAt || Date.now()));
    SaveManager.apply(player, save);
    player.talents = player.talents || {};
    player.expedition = player.expedition || { active:null, history:[] };
    let offlineRewards = null;
    if (player.classeId && offlineMs > 60000) {
      const offlineMinutes = Math.min(240, Math.floor(offlineMs / 60000));
      const offlineKills = Math.max(1, Math.floor(offlineMinutes * 1.8));
      const offlineBonuses = TalentManager.getBonuses(player);
      const offlineGold = Math.floor(offlineKills * (12 + (player.nivel || 1) * 3) * (1 + (offlineBonuses.goldPct || 0)));
      const offlineXp = Math.floor(offlineKills * (18 + (player.nivel || 1) * 5) * (1 + (offlineBonuses.xpPct || 0)));
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
    if (!requireAuth(socket, player)) return;
    const classe = GAME_CLASSES[data.classeId];
    if (!classe) return socket.emit('errorMsg', 'Classe inválida.');
    player.classeId = data.classeId;
    // Mantém o nick escolhido na conta; troca apenas a classe.
    player.inventario = [];
    player.equipados = { arma: null, anel: null, colar: null, ornamento: null };
    player.mount = player.mount || { id: 'lobo_cristalino', level: 1 };
    player.mountCollection = player.mountCollection || [{ id: player.mount.id || 'lobo_cristalino', level: player.mount.level || 1, active: true, unlockedAt: Date.now() }];
    player.cooldowns = {};
    player.horda = Math.max(1, player.horda || 1);
    player.isDead = false;
    player.deadUntil = 0;
    LevelManager.syncProgressFields(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    MetaProgressManager.normalize(player);
  player.power = LootManager.calculatePower(player) + PetManager.powerBonus(player);
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

  socket.on('acceptEquipSuggestion', (data = {}) => {
    const result = LootManager.equipItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    const unlocked = updateAchievements(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'equipSuggestion', item: LootManager.enrichItem(result.item), achievements: unlocked });
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

  socket.on('insertGem', (data = {}) => {
    const result = LootManager.insertGem(player, data.itemId, data.gemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'gem', item: LootManager.enrichItem(result.item), gem: result.gem });
  });

  socket.on('upgradeItem', (data = {}) => {
    const result = LootManager.upgradeItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    MetaProgressManager.progressMission(player, 'forge', 1);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'upgradeItem', item: LootManager.enrichItem(result.item), costGold: result.costGold, costGems: result.costGems });
  });

  socket.on('toggleLockItem', (data = {}) => {
    const result = LootManager.toggleLockItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('inventoryAction', { type: 'lockItem', item: LootManager.enrichItem(result.item) });
  });

  socket.on('claimDailyReward', () => {
    if (!requireAuth(socket, player)) return;
    const result = claimDailyReward(player);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    const unlocked = updateAchievements(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('dailyReward', { reward: result, player: publicPlayer(player), achievements: unlocked });
  });

  socket.on('upgradeMount', () => {
    if (!requireAuth(socket, player)) return;
    const result = LootManager.upgradeMount(player);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('mountUpdated', { mount: result.mount, collection: result.collection, bonus: result.bonus, cost: result.cost });
  });

  socket.on('activateMount', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = LootManager.activateMount(player, data.mountId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('mountUpdated', { mount: result.mount, collection: result.collection, bonus: result.bonus, cost: 0 });
  });

  socket.on('upgradePet', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = PetManager.levelUp(player, data.petId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('petUpdated', result);
  });

  socket.on('acquirePet', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = PetManager.acquire(player, data.petId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('petUpdated', result);
  });

  socket.on('buyShopItem', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = buyShopItem(player, data.itemId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('shopAction', { type: 'buy', item: result.shopItem, granted: result.granted, player: publicPlayer(player) });
    if (result.granted && result.granted.monster) emitEnemyUpdate();
  });

  socket.on('usePotion', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = usePotion(player, data.type);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('shopAction', { type: 'usePotion', potionType: result.type, player: publicPlayer(player) });
  });

  socket.on('gmCommand', (data = {}) => {
    if (!player.isGM) return socket.emit('errorMsg', 'Comando GM negado.');
    const cmd = data.cmd;
    if (cmd === 'addGold') player.ouro = (player.ouro || 0) + Math.max(0, Math.floor(data.amount || 100000));
    else if (cmd === 'addGems') {
      player.gemas = (player.gemas || 0) + Math.max(0, Math.floor(data.amount || 10000));
      player.cashGems = player.gemas;
    } else if (cmd === 'addLevel') {
      player.nivel = Math.min(LEVEL_CAP, (player.nivel || 1) + Math.max(1, Math.floor(data.amount || 1)));
      player.level = player.nivel;
      LevelManager.syncProgressFields(player);
      player.hp = player.maxHp;
      player.mana = player.maxMana;
    } else if (cmd === 'boss') {
      monsterManager.horda = Math.ceil((monsterManager.horda || 1) / 10) * 10;
      monsterManager.currentMonster = monsterManager.generateMonster(player.nivel || 1);
      emitEnemyUpdate();
    } else if (cmd === 'bossItem') {
      const drop = LootManager.createShopDrop(player, 'lendário');
      if (drop) {
        drop.raridade = 'boss';
        drop.exclusivoBoss = true;
        drop.asset = `assets/items/${drop.slot}_boss.png`;
        drop.rarityColor = '#ff8f3d';
        player.inventario = player.inventario || [];
        player.inventario.unshift(drop);
      }
    } else if (cmd === 'heal') {
      player.hp = player.maxHp;
      player.mana = player.maxMana;
      player.isDead = false;
      player.autoFarm = true;
    }
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('gmResult', { ok: true, cmd, player: publicPlayer(player) });
  });

  socket.on('requestRanking', () => {
    socket.emit('rankingUpdate', buildRanking());
  });


  socket.on('upgradeTalent', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = TalentManager.upgrade(player, data.id);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('talentAction', { type: 'upgrade', result, player: publicPlayer(player) });
  });

  socket.on('resetTalents', () => {
    if (!requireAuth(socket, player)) return;
    const result = TalentManager.reset(player);
    syncPlayerPower(player);
    savePlayer(player, true);
    io.emit('playerUpdated', publicPlayer(player));
    socket.emit('talentAction', { type: 'reset', result, player: publicPlayer(player) });
  });

  socket.on('startExpedition', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = ExpeditionManager.start(player, data.id);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    savePlayer(player, true);
    socket.emit('expeditionAction', { type: 'start', result, player: publicPlayer(player) });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('claimExpedition', () => {
    if (!requireAuth(socket, player)) return;
    const result = ExpeditionManager.claim(player);
    if (result.ok) MetaProgressManager.progressMission(player, 'expedition', 1);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    socket.emit('expeditionAction', { type: 'claim', result, player: publicPlayer(player) });
    io.emit('playerUpdated', publicPlayer(player));
  });


  socket.on('claimMission', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = MetaProgressManager.claimMission(player, data.id);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    socket.emit('metaUpdated', { meta: MetaProgressManager.publicMeta(player), player: publicPlayer(player), result });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('claimAllMissions', () => {
    if (!requireAuth(socket, player)) return;
    const result = MetaProgressManager.claimAllMissions(player);
    syncPlayerPower(player);
    savePlayer(player, true);
    socket.emit('metaUpdated', { meta: MetaProgressManager.publicMeta(player), player: publicPlayer(player), result });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('claimCodex', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = MetaProgressManager.claimCodex(player, data.monsterId);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    socket.emit('metaUpdated', { meta: MetaProgressManager.publicMeta(player), player: publicPlayer(player), result });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('upgradeArtifact', (data = {}) => {
    if (!requireAuth(socket, player)) return;
    const result = MetaProgressManager.upgradeArtifact(player, data.id);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    savePlayer(player, true);
    socket.emit('metaUpdated', { meta: MetaProgressManager.publicMeta(player), player: publicPlayer(player), result });
    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('ascendPlayer', () => {
    if (!requireAuth(socket, player)) return;
    const result = MetaProgressManager.ascend(player);
    if (!result.ok) return socket.emit('errorMsg', result.reason);
    syncPlayerPower(player);
    monsterManager.horda = 1;
    monsterManager.currentMonster = monsterManager.generateMonster(player.nivel || 1);
    savePlayer(player, true);
    io.emit('enemyUpdate', monsterManager.getPublicMonster());
    socket.emit('metaUpdated', { meta: MetaProgressManager.publicMeta(player), player: publicPlayer(player), result });
    io.emit('playerUpdated', publicPlayer(player));
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
  io.emit('rankingUpdate', buildRanking());
  if (attacks.length || monsterAttacks.length) io.emit('combatTick', { attacks, monsterAttacks, monster: monsterManager.getPublicMonster(), serverTime: now });
  emitEnemyUpdate();
}, TICK_RATE_MS);


function saveAllPlayers(reason = 'shutdown') {
  for (const player of Object.values(players)) {
    try { savePlayer(player, true); } catch (err) { console.error('Falha ao salvar jogador em', reason, err); }
  }
}

process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM. Salvando jogadores antes de encerrar...');
  saveAllPlayers('SIGTERM');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});

process.on('SIGINT', () => {
  console.log('Recebido SIGINT. Salvando jogadores antes de encerrar...');
  saveAllPlayers('SIGINT');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});

server.listen(PORT, '0.0.0.0', () => console.log(`Servidor em http://0.0.0.0:${PORT}`));

