const { GAME_CLASSES } = require('../../shared/classes.js');

const RARITIES = [
  { id: 'comum', nome: 'Comum', chance: 62, power: 1, icon: '⚪' },
  { id: 'raro', nome: 'Raro', chance: 26, power: 1.45, icon: '🔵' },
  { id: 'epico', nome: 'Épico', chance: 10, power: 2.05, icon: '🟣' },
  { id: 'lendario', nome: 'Lendário', chance: 2, power: 3.2, icon: '🟡' }
];

const ITEM_NAMES = {
  arma: ['Espada de Cristal', 'Cajado Celestial', 'Arco das Runas', 'Lâmina do Cogumelo'],
  armadura: ['Peitoral Estelar', 'Manto do Arcanjo', 'Túnica de Esporos', 'Armadura de Runa'],
  anel: ['Anel de Luz', 'Selo Abissal', 'Orbe Vital', 'Fragmento Lunar'],
  asa: ['Pena Seráfica', 'Cristal de Asa', 'Pluma Divina', 'Essência Celestial']
};

function chooseRarity(isBoss) {
  const bonus = isBoss ? 10 : 0;
  const roll = Math.random() * 100;
  if (roll < RARITIES[3].chance + bonus * 0.16) return RARITIES[3];
  if (roll < RARITIES[3].chance + RARITIES[2].chance + bonus * 0.55) return RARITIES[2];
  if (roll < RARITIES[3].chance + RARITIES[2].chance + RARITIES[1].chance + bonus) return RARITIES[1];
  return RARITIES[0];
}

function chooseType() {
  const types = ['arma', 'armadura', 'anel', 'asa'];
  return types[Math.floor(Math.random() * types.length)];
}

function iconByType(type) {
  if (type === 'arma') return '⚔️';
  if (type === 'armadura') return '🛡️';
  if (type === 'anel') return '💍';
  if (type === 'asa') return '🪽';
  return '🎁';
}

class LootManager {
  static calculatePower(player) {
    const classe = GAME_CLASSES[player.classeId];
    const baseStats = classe ? classe.baseStats : { baseDano: 10, defesa: 5, critico: 5 };
    const nivel = player.nivel || 1;
    const inventoryPower = (player.inventario || []).reduce((total, item) => {
      const stats = item.stats || {};
      return total + (stats.ataque || 0) * 4 + (stats.defesa || 0) * 3 + (stats.critico || 0) * 5 + (stats.hp || 0);
    }, 0);

    return Math.floor(
      80 +
      nivel * 48 +
      (baseStats.baseDano || 0) * 8 +
      (baseStats.defesa || 0) * 5 +
      (baseStats.critico || 0) * 6 +
      inventoryPower
    );
  }

  static getDamageBonus(player) {
    return (player.inventario || []).reduce((total, item) => total + ((item.stats && item.stats.ataque) || 0), 0);
  }

  static getCritBonus(player) {
    return (player.inventario || []).reduce((total, item) => total + ((item.stats && item.stats.critico) || 0), 0);
  }

  static generateGold(monster) {
    const base = 8 + ((monster && monster.nivel) || 1) * 4;
    return Math.floor(base * ((monster && monster.isBoss) ? 5 : 1) * (0.85 + Math.random() * 0.4));
  }

  static maybeGenerateItem(player, monster) {
    const isBoss = !!(monster && monster.isBoss);
    const dropChance = isBoss ? 0.85 : 0.24;
    if (Math.random() > dropChance) return null;

    const type = chooseType();
    const rarity = chooseRarity(isBoss);
    const level = Math.max(1, (monster && monster.nivel) || (player.nivel || 1));
    const names = ITEM_NAMES[type] || ['Relíquia Antiga'];
    const name = names[Math.floor(Math.random() * names.length)];
    const scale = rarity.power;

    const item = {
      id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nome: `${rarity.nome} ${name}`,
      tipo: type,
      raridade: rarity.id,
      icone: iconByType(type),
      nivel,
      stats: {
        ataque: Math.max(1, Math.floor((level * 1.5 + 4) * scale)),
        defesa: type === 'armadura' ? Math.max(1, Math.floor((level + 3) * scale)) : 0,
        critico: type === 'anel' ? Math.max(1, Math.floor(1 + level * 0.1 * scale)) : 0,
        hp: type === 'asa' ? Math.max(5, Math.floor((level * 3 + 10) * scale)) : 0
      }
    };

    return item;
  }

  static grantKillLoot(player, monster) {
    const gold = this.generateGold(monster);
    const item = this.maybeGenerateItem(player, monster);

    player.ouro = Math.max(0, (player.ouro || 0) + gold);
    player.kills = (player.kills || 0) + 1;
    player.fase = Math.floor((player.kills || 0) / 10) + 1;

    if (item) {
      player.inventario = player.inventario || [];
      player.inventario.push(item);
      player.inventario = player.inventario.slice(-24);
    }

    player.power = this.calculatePower(player);

    return { gold, item, power: player.power, kills: player.kills, fase: player.fase };
  }
}

module.exports = LootManager;
