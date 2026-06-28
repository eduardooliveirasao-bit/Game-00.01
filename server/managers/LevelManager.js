const { LEVEL_CAP, XP_TABLE, WING_LEVELS, GAME_CLASSES } = require('../../shared/classes.js');

class LevelManager {
  static getXpToNext(level) {
    if (level >= LEVEL_CAP) return 0;
    return XP_TABLE[level] || 0;
  }

  static getWingLevel(level) {
    let current = WING_LEVELS[0];
    for (const wing of WING_LEVELS) {
      if (level >= wing.minLevel) current = wing;
    }
    return current;
  }

  static calculateMaxHp(player) {
    const classe = GAME_CLASSES[player.classeId];
    if (!classe) return player.maxHp || 100;
    const baseHp = classe.baseStats.maxHp || 100;
    return Math.floor(baseHp + ((player.nivel - 1) * 18));
  }

  static syncProgressFields(player) {
    player.nivel = Math.min(LEVEL_CAP, Math.max(1, player.nivel || 1));
    player.level = player.nivel; // alias útil para futuras integrações
    player.xp = Math.max(0, Math.floor(player.xp || 0));
    player.xpToNext = this.getXpToNext(player.nivel);
    player.xpPercent = player.nivel >= LEVEL_CAP || player.xpToNext <= 0
      ? 100
      : Math.min(100, Math.max(0, (player.xp / player.xpToNext) * 100));

    const wing = this.getWingLevel(player.nivel);
    player.asaNivel = wing.nivel;
    player.asaNome = wing.nome;

    if (player.classeId) {
      player.maxHp = this.calculateMaxHp(player);
      player.hp = Math.min(player.hp || player.maxHp, player.maxHp);
    }

    return player;
  }

  static addXP(player, amount) {
    const safeAmount = Math.max(0, Math.floor(amount || 0));
    const result = {
      xpGained: safeAmount,
      leveledUp: false,
      levelsGained: 0,
      previousLevel: player.nivel || 1,
      currentLevel: player.nivel || 1
    };

    if (safeAmount <= 0 || player.nivel >= LEVEL_CAP) {
      this.syncProgressFields(player);
      return result;
    }

    player.xp += safeAmount;

    while (player.nivel < LEVEL_CAP) {
      const xpNeeded = this.getXpToNext(player.nivel);
      if (!xpNeeded || player.xp < xpNeeded) break;

      player.xp -= xpNeeded;
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
