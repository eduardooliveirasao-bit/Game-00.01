const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SAVE_FILE = path.join(DATA_DIR, 'saves.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SAVE_FILE)) fs.writeFileSync(SAVE_FILE, '{}', 'utf8');
}

function readAll() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8') || '{}');
  } catch (err) {
    return {};
  }
}

function writeAll(data) {
  ensureStore();
  const tmp = SAVE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, SAVE_FILE);
}

function sanitizePlayer(player) {
  return {
    saveId: player.saveId,
    nome: player.nome,
    classeId: player.classeId,
    nivel: player.nivel,
    level: player.level,
    xp: player.xp,
    hp: player.hp,
    maxHp: player.maxHp,
    mana: player.mana,
    maxMana: player.maxMana,
    ouro: player.ouro,
    gemas: player.gemas || 0,
    cashGems: player.cashGems != null ? player.cashGems : (player.gemas || 0),
    pocoes: player.pocoes || { vida: 0, mana: 0 },
    accountLogin: player.accountLogin || null,
    isGM: !!player.isGM,
    kills: player.kills,
    horda: player.horda,
    autoFarm: player.autoFarm,
    inventario: player.inventario || [],
    equipados: player.equipados || { arma: null, anel: null, colar: null, ornamento: null },
    achievements: player.achievements || [],
    bestiary: player.bestiary || {},
    stats: player.stats || {},
    mount: player.mount || { id: 'lobo_cristalino', level: 1 },
    mountCollection: player.mountCollection || [{ id: (player.mount && player.mount.id) || 'lobo_cristalino', level: (player.mount && player.mount.level) || 1, active: true, unlockedAt: Date.now() }],
    pets: player.pets || { owned: [], equipped: [] },
    talents: player.talents || {},
    expedition: player.expedition || { active:null, history:[] },
    missions: player.missions || null,
    codex: player.codex || null,
    ascension: player.ascension || null,
    season: player.season || null,
    v30: player.v30 || null,
    v40: player.v40 || null,
    v90: player.v90 || null,
    extraTalentPoints: player.extraTalentPoints || 0,
    coreStats: player.coreStats || null,
    bag: player.bag || null,
    fashion: player.fashion || null,
    world: player.world || null,
    attributeBreakdown: player.attributeBreakdown || null,
    v2: player.v2 || null,
    updatedAt: Date.now()
  };
}

class SaveManager {
  static createId() {
    return crypto.randomBytes(16).toString('hex');
  }

  static load(saveId) {
    if (!saveId || typeof saveId !== 'string') return null;
    const saves = readAll();
    return saves[saveId] || null;
  }

  static save(player) {
    if (!player || !player.saveId) return false;
    const saves = readAll();
    saves[player.saveId] = sanitizePlayer(player);
    writeAll(saves);
    return true;
  }

  static list() {
    return Object.values(readAll());
  }

  static apply(player, save) {
    if (!player || !save) return player;
    const keepSocketId = player.id;
    Object.assign(player, {
      saveId: save.saveId || player.saveId,
      nome: save.nome || player.nome,
      classeId: save.classeId || player.classeId,
      nivel: save.nivel || 1,
      level: save.level || save.nivel || 1,
      xp: save.xp || 0,
      hp: save.hp || 100,
      maxHp: save.maxHp || 100,
      mana: save.mana || 0,
      maxMana: save.maxMana || 0,
      ouro: save.ouro || 0,
      gemas: save.gemas || 0,
      cashGems: save.cashGems != null ? save.cashGems : (save.gemas || 0),
      pocoes: save.pocoes || { vida: 0, mana: 0 },
      accountLogin: save.accountLogin || null,
      isGM: !!save.isGM,
      kills: save.kills || 0,
      horda: save.horda || 1,
      autoFarm: save.autoFarm !== false,
      inventario: save.inventario || [],
      equipados: save.equipados || { arma: null, anel: null, colar: null, ornamento: null },
      achievements: save.achievements || [],
      bestiary: save.bestiary || {},
      stats: save.stats || {},
      mount: save.mount || { id: 'lobo_cristalino', level: 1 },
      mountCollection: save.mountCollection || [{ id: (save.mount && save.mount.id) || 'lobo_cristalino', level: (save.mount && save.mount.level) || 1, active: true, unlockedAt: Date.now() }],
      pets: save.pets || { owned: [], equipped: [] },
      talents: save.talents || {},
      expedition: save.expedition || { active:null, history:[] },
      missions: save.missions || null,
      codex: save.codex || null,
      ascension: save.ascension || null,
      season: save.season || null,
      v30: save.v30 || null,
      v40: save.v40 || null,
      v90: save.v90 || null,
      extraTalentPoints: save.extraTalentPoints || 0,
      coreStats: save.coreStats || { strength:10, wisdom:10, agility:10, vitality:10, free:0, spent:0 },
      bag: save.bag || { capacity:56, slots:[] },
      fashion: save.fashion || { owned:['armadura_ferro_runa'], equipped:{ outfit:'armadura_ferro_runa' }, fragments:0, bonus:{} },
      world: save.world || { zoneId:'floresta_cristalina', unlocked:['floresta_cristalina'], routeHistory:[], enteredAt:Date.now(), clientConfig:{} },
      attributeBreakdown: save.attributeBreakdown || null,
      v2: save.v2 || null
    });
    player.id = keepSocketId;
    player.isDead = false;
    player.deadUntil = 0;
    return player;
  }
}

module.exports = SaveManager;
