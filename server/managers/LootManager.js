
const { ITEM_CATALOG, GAME_CLASSES } = require('../../shared/classes.js');

const SLOT_ORDER = ['arma', 'anel', 'colar', 'ornamento'];
const RARITY_COLORS = {
  comum: '#d9dde7',
  raro: '#6cc4ff',
  'épico': '#be88ff',
  'lendário': '#ffd56b',
  'mítico': '#ff8cab'
};

function rarityRank(rarity) {
  return ['comum', 'raro', 'épico', 'lendário', 'mítico'].indexOf(rarity);
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
    powerScore: 0,
    stats: {
      ataque: (base.stats.ataque || 0) + Math.floor(monsterLevel * 0.6),
      defesa: (base.stats.defesa || 0) + Math.floor(monsterLevel * 0.4),
      critico: (base.stats.critico || 0) + Math.floor(monsterLevel * 0.15),
      hp: (base.stats.hp || 0) + Math.floor(monsterLevel * 1.8),
      mana: (base.stats.mana || 0) + Math.floor(monsterLevel * 0.7)
    }
  };
}

class LootManager {
  static getEquippedList(player) {
    const equipados = player.equipados || {};
    return SLOT_ORDER.map((slot) => equipados[slot]).filter(Boolean);
  }

  static scoreItem(item) {
    const s = item.stats || {};
    return Math.floor((s.ataque || 0) * 6 + (s.defesa || 0) * 4 + (s.critico || 0) * 7 + (s.hp || 0) * 0.5 + (s.mana || 0) * 0.2 + rarityRank(item.raridade) * 18);
  }

  static calculatePower(player) {
    const classe = GAME_CLASSES[player.classeId] || { baseStats: { baseDano: 10, defesa: 5, critico: 5 } };
    const base = classe.baseStats;
    const gear = this.getEquippedList(player).reduce((sum, item) => sum + this.scoreItem(item), 0);
    return Math.floor(120 + player.nivel * 52 + base.baseDano * 8 + base.defesa * 5 + base.critico * 5 + gear);
  }

  static getDamageBonus(player) {
    return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.ataque) || 0), 0);
  }

  static getCritBonus(player) {
    return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.critico) || 0), 0);
  }

  static getHpBonus(player) {
    return this.getEquippedList(player).reduce((sum, item) => sum + ((item.stats && item.stats.hp) || 0), 0);
  }

  static chooseDrop(player, monster) {
    const catalog = ITEM_CATALOG[player.classeId] || [];
    if (!catalog.length) return null;
    const maxLevel = Math.max(1, (monster && monster.nivel) || player.nivel || 1) + 6;
    const eligible = catalog.filter((item) => item.requiredLevel <= maxLevel);
    const bag = eligible.length ? eligible : catalog;
    const chosen = bag[Math.floor(Math.random() * bag.length)];
    const rolled = cloneItem(chosen, maxLevel);
    rolled.powerScore = this.scoreItem(rolled);
    rolled.rarityColor = RARITY_COLORS[rolled.raridade] || '#fff';
    return rolled;
  }

  static maybeDropItem(player, monster) {
    const rate = monster.isBoss ? 1 : (monster.templateId === 'skeleton' ? 0.65 : 0.4);
    if (Math.random() > rate) return null;
    return this.chooseDrop(player, monster);
  }

  static autoEquip(player, item) {
    if (!item) return false;
    player.equipados = player.equipados || { arma: null, anel: null, colar: null, ornamento: null };
    const current = player.equipados[item.slot];
    if (!current || this.scoreItem(item) > this.scoreItem(current)) {
      player.equipados[item.slot] = item;
      return true;
    }
    return false;
  }

  static grantKillLoot(player, monster) {
    const goldBase = (monster && monster.goldBase) || 10;
    const gold = Math.floor(goldBase + (monster.nivel || 1) * 4 + (monster.isBoss ? 90 : 0));
    const item = this.maybeDropItem(player, monster);
    player.ouro = (player.ouro || 0) + gold;
    player.kills = (player.kills || 0) + 1;
    player.horda = (player.horda || 1) + 1;
    player.inventario = player.inventario || [];
    let autoEquipped = false;
    if (item) {
      autoEquipped = this.autoEquip(player, item);
      item.autoEquipped = autoEquipped;
      player.inventario.unshift(item);
      player.inventario = player.inventario.slice(0, 60);
    }
    player.equipadosList = this.getEquippedList(player);
    player.power = this.calculatePower(player);
    return { gold, item, autoEquipped, power: player.power };
  }
}

module.exports = LootManager;
