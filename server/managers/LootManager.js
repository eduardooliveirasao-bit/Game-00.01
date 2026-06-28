const { ITEM_CATALOG, GAME_CLASSES } = require('../../shared/classes.js');

const SLOT_ORDER = ['arma', 'anel', 'colar', 'ornamento'];
const RARITY_COLORS = {
  comum: '#d9dde7',
  raro: '#55c7ff',
  'épico': '#b07cff',
  'lendário': '#ffcf5b',
  'mítico': '#ff7fbb',
  boss: '#ff8f3d'
};

const BOSS_EXCLUSIVE = {
  guerreiro: [
    { nome: 'Espada do Dragão Elemental', slot: 'arma', icon: '🐉', stats: { ataque: 72, defesa: 10, critico: 6, hp: 80, mana: 0 } },
    { nome: 'Anel da Chama Dracônica', slot: 'anel', icon: '💍', stats: { ataque: 28, defesa: 6, critico: 18, hp: 65, mana: 0 } },
    { nome: 'Colar do Coração Ígneo', slot: 'colar', icon: '📿', stats: { ataque: 22, defesa: 14, critico: 6, hp: 180, mana: 0 } },
    { nome: 'Ornamento da Escama Azul', slot: 'ornamento', icon: '✨', stats: { ataque: 18, defesa: 34, critico: 7, hp: 140, mana: 0 } }
  ],
  arqueiro: [
    { nome: 'Arco da Tempestade Dracônica', slot: 'arma', icon: '🐉', stats: { ataque: 68, defesa: 5, critico: 18, hp: 55, mana: 0 } },
    { nome: 'Anel do Olho Elemental', slot: 'anel', icon: '💍', stats: { ataque: 28, defesa: 4, critico: 24, hp: 45, mana: 0 } },
    { nome: 'Colar da Caçada Celeste', slot: 'colar', icon: '📿', stats: { ataque: 24, defesa: 10, critico: 12, hp: 140, mana: 0 } },
    { nome: 'Pena do Dragão Azul', slot: 'ornamento', icon: '✨', stats: { ataque: 20, defesa: 16, critico: 20, hp: 90, mana: 0 } }
  ],
  mago: [
    { nome: 'Cajado do Dragão Elemental', slot: 'arma', icon: '🐉', stats: { ataque: 78, defesa: 4, critico: 10, hp: 45, mana: 120 } },
    { nome: 'Anel do Núcleo Arcano', slot: 'anel', icon: '💍', stats: { ataque: 30, defesa: 5, critico: 18, hp: 55, mana: 95 } },
    { nome: 'Colar do Sopro Celestial', slot: 'colar', icon: '📿', stats: { ataque: 24, defesa: 8, critico: 7, hp: 115, mana: 140 } },
    { nome: 'Ornamento da Asa Dracônica', slot: 'ornamento', icon: '✨', stats: { ataque: 22, defesa: 16, critico: 8, hp: 100, mana: 110 } }
  ]
};

function rarityRank(rarity) {
  return ['comum', 'raro', 'épico', 'lendário', 'mítico', 'boss'].indexOf(rarity);
}

function cloneItem(base, monsterLevel) {
  return {
    id: base.id + '_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    baseId: base.id,
    classeId: base.classeId,
    nome: base.nome,
    slot: base.slot,
    raridade: base.raridade,
    cor: base.cor,
    icon: base.icon,
    requiredLevel: base.requiredLevel,
    exclusivoBoss: false,
    stats: {
      ataque: (base.stats.ataque || 0) + Math.floor(monsterLevel * 0.6),
      defesa: (base.stats.defesa || 0) + Math.floor(monsterLevel * 0.4),
      critico: (base.stats.critico || 0) + Math.floor(monsterLevel * 0.15),
      hp: (base.stats.hp || 0) + Math.floor(monsterLevel * 1.8),
      mana: (base.stats.mana || 0) + Math.floor(monsterLevel * 1.2)
    }
  };
}

function cloneBossItem(player, monster) {
  const list = BOSS_EXCLUSIVE[player.classeId] || BOSS_EXCLUSIVE.mago;
  const base = list[Math.floor(Math.random() * list.length)];
  const level = Math.max(1, monster.nivel || player.nivel || 1);
  return {
    id: 'boss_' + player.classeId + '_' + base.slot + '_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    baseId: 'boss_' + base.slot,
    classeId: player.classeId,
    nome: base.nome,
    slot: base.slot,
    raridade: 'boss',
    cor: '#ff8f3d',
    icon: base.icon,
    requiredLevel: Math.max(1, Math.floor(level * 0.65)),
    exclusivoBoss: true,
    stats: {
      ataque: base.stats.ataque + Math.floor(level * 1.1),
      defesa: base.stats.defesa + Math.floor(level * 0.6),
      critico: base.stats.critico + Math.floor(level * 0.25),
      hp: base.stats.hp + Math.floor(level * 2.4),
      mana: base.stats.mana + Math.floor(level * 2.0)
    }
  };
}

class LootManager {
  static enrichItem(item) {
    if (!item) return null;
    item.rarityColor = RARITY_COLORS[item.raridade] || '#fff';
    item.powerScore = this.scoreItem(item);
    item.sellValue = this.sellValue(item);
    return item;
  }

  static getEquippedList(player) {
    const equipados = player.equipados || {};
    return SLOT_ORDER.map((slot) => equipados[slot]).filter(Boolean).map((item) => this.enrichItem(item));
  }

  static scoreItem(item) {
    const s = item.stats || {};
    return Math.floor((s.ataque || 0) * 6 + (s.defesa || 0) * 4 + (s.critico || 0) * 7 + (s.hp || 0) * 0.55 + (s.mana || 0) * 0.3 + Math.max(0, rarityRank(item.raridade)) * 22 + (item.exclusivoBoss ? 120 : 0));
  }

  static sellValue(item) {
    const rank = Math.max(0, rarityRank(item.raridade));
    return Math.max(8, Math.floor(this.scoreItem(item) * (0.35 + rank * 0.08)));
  }

  static calculatePower(player) {
    const classe = GAME_CLASSES[player.classeId] || { baseStats: { baseDano: 10, defesa: 5, critico: 5, mana: 0 } };
    const base = classe.baseStats;
    const gear = this.getEquippedList(player).reduce((sum, item) => sum + this.scoreItem(item), 0);
    return Math.floor(120 + player.nivel * 52 + base.baseDano * 8 + base.defesa * 5 + base.critico * 5 + Math.floor((base.mana || 0) * 0.2) + gear);
  }

  static getDamageBonus(player) { return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.ataque) || 0), 0); }
  static getCritBonus(player) { return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.critico) || 0), 0); }
  static getHpBonus(player) { return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.hp) || 0), 0); }
  static getManaBonus(player) { return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.mana) || 0), 0); }

  static chooseDrop(player, monster) {
    if (monster && monster.isBoss) return this.enrichItem(cloneBossItem(player, monster));
    const catalog = ITEM_CATALOG[player.classeId] || [];
    if (!catalog.length) return null;
    const maxLevel = Math.max(1, (monster && monster.nivel) || player.nivel || 1) + 6;
    const eligible = catalog.filter((item) => item.requiredLevel <= maxLevel);
    const pool = eligible.length ? eligible : catalog;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return this.enrichItem(cloneItem(chosen, maxLevel));
  }

  static maybeDropItem(player, monster) {
    if (monster && monster.isBoss) return this.chooseDrop(player, monster);
    const rate = monster && monster.templateId === 'skeleton' ? 0.65 : 0.42;
    if (Math.random() > rate) return null;
    return this.chooseDrop(player, monster);
  }

  static grantKillLoot(player, monster) {
    const goldBase = (monster && monster.goldBase) || 10;
    const gold = Math.floor(goldBase + (monster.nivel || 1) * 4 + (monster.isBoss ? 150 : 0));
    const item = this.maybeDropItem(player, monster);
    player.ouro = (player.ouro || 0) + gold;
    player.kills = (player.kills || 0) + 1;
    player.horda = monster && monster.horda ? monster.horda + 1 : ((player.horda || 1) + 1);
    player.inventario = player.inventario || [];
    if (item) {
      player.inventario.unshift(item);
      player.inventario = player.inventario.slice(0, 100);
    }
    player.equipadosList = this.getEquippedList(player);
    player.power = this.calculatePower(player);
    return { gold, item, power: player.power };
  }

  static equipItem(player, itemId) {
    player.inventario = player.inventario || [];
    player.equipados = player.equipados || { arma: null, anel: null, colar: null, ornamento: null };
    const idx = player.inventario.findIndex((item) => item.id === itemId);
    if (idx < 0) return { ok: false, reason: 'Item não encontrado na bolsa.' };
    const item = this.enrichItem(player.inventario[idx]);
    if (item.classeId !== player.classeId) return { ok: false, reason: 'Este item não pertence à sua classe.' };
    if ((player.nivel || 1) < (item.requiredLevel || 1)) return { ok: false, reason: 'Nível insuficiente para equipar o item.' };
    const current = player.equipados[item.slot];
    if (current) player.inventario.push(this.enrichItem(current));
    player.equipados[item.slot] = item;
    player.inventario.splice(idx, 1);
    player.equipadosList = this.getEquippedList(player);
    player.power = this.calculatePower(player);
    return { ok: true, item };
  }

  static unequipSlot(player, slot) {
    player.equipados = player.equipados || { arma: null, anel: null, colar: null, ornamento: null };
    const item = player.equipados[slot];
    if (!item) return { ok: false, reason: 'Nenhum item equipado neste slot.' };
    player.inventario = player.inventario || [];
    player.inventario.unshift(this.enrichItem(item));
    player.inventario = player.inventario.slice(0, 100);
    player.equipados[slot] = null;
    player.equipadosList = this.getEquippedList(player);
    player.power = this.calculatePower(player);
    return { ok: true, item };
  }

  static sellItem(player, itemId) {
    player.inventario = player.inventario || [];
    const idx = player.inventario.findIndex((item) => item.id === itemId);
    if (idx < 0) return { ok: false, reason: 'Item não encontrado na bolsa.' };
    const item = this.enrichItem(player.inventario[idx]);
    const value = this.sellValue(item);
    player.inventario.splice(idx, 1);
    player.ouro = (player.ouro || 0) + value;
    player.power = this.calculatePower(player);
    return { ok: true, item, gold: value };
  }

  static sellAll(player) {
    player.inventario = player.inventario || [];
    let gold = 0;
    const sold = player.inventario.length;
    for (const item of player.inventario) gold += this.sellValue(this.enrichItem(item));
    player.inventario = [];
    player.ouro = (player.ouro || 0) + gold;
    player.power = this.calculatePower(player);
    return { ok: true, sold, gold };
  }
}

module.exports = LootManager;
