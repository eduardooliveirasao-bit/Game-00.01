
const { LEVEL_CAP, XP_TABLE, WING_LEVELS, GAME_CLASSES } = require('../../shared/classes.js');

class LevelManager {
  static getXpToNext(level) {
    return level >= LEVEL_CAP ? 0 : (XP_TABLE[level] || 0);
  }

  static getWingForLevel(level) {
    let current = WING_LEVELS[0];
    for (const wing of WING_LEVELS) if (level >= wing.minLevel) current = wing;
    return current;
  }

  static calculateMaxHp(player) {
    const classe = GAME_CLASSES[player.classeId];
    if (!classe) return 100;
    const base = classe.baseStats.maxHp || 100;
    const hpBonus = (player.equipadosList || []).reduce((s, item) => s + ((item.stats && item.stats.hp) || 0), 0);
    return Math.floor(base + (player.nivel - 1) * 16 + hpBonus);
  }

  static syncProgressFields(player) {
    player.nivel = Math.max(1, Math.min(LEVEL_CAP, Math.floor(player.nivel || 1)));
    player.level = player.nivel;
    player.xp = Math.max(0, Math.floor(player.xp || 0));
    player.xpToNext = this.getXpToNext(player.nivel);
    player.xpPercent = player.nivel >= LEVEL_CAP || !player.xpToNext ? 100 : Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100));
    const wing = this.getWingForLevel(player.nivel);
    player.asaNivel = wing.nivel;
    player.asaNome = wing.nome;
    if (player.classeId) {
      const maxHp = this.calculateMaxHp(player);
      player.maxHp = maxHp;
      player.hp = Math.max(1, Math.min(player.hp || maxHp, maxHp));
    }
    return player;
  }

  static addXP(player, amount) {
    const gained = Math.max(0, Math.floor(amount || 0));
    const result = { xpGained: gained, leveledUp: false, levelsGained: 0, previousLevel: player.nivel, currentLevel: player.nivel };
    if (!gained || player.nivel >= LEVEL_CAP) {
      this.syncProgressFields(player);
      return result;
    }
    player.xp += gained;
    while (player.nivel < LEVEL_CAP) {
      const needed = this.getXpToNext(player.nivel);
      if (!needed || player.xp < needed) break;
      player.xp -= needed;
      player.nivel += 1;
      result.leveledUp = true;
      result.levelsGained += 1;
    }
    if (player.nivel >= LEVEL_CAP) {
      player.nivel = LEVEL_CAP;
      player.xp = 0;
    }
    this.syncProgressFields(player);
    player.hp = player.maxHp;
    result.currentLevel = player.nivel;
    return result;
  }
}

module.exports = LevelManager;
