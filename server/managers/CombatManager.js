const { GAME_CLASSES } = require('../../shared/classes.js');
const LevelManager = require('./LevelManager');
const LootManager = require('./LootManager');

class CombatManager {
  static getAbility(classeId, habilidadeId) {
    const classe = GAME_CLASSES[classeId];
    if (!classe) return null;
    const abilities = classe.habilidades.concat([classe.ultimate]);
    return abilities.find((ability) => ability.id === habilidadeId) || null;
  }

  static calculateDamage(player, ability) {
    const classe = GAME_CLASSES[player.classeId];
    if (!classe) {
      return { damage: 1, isCrit: false, critChance: 0 };
    }

    const stats = classe.baseStats;
    const gearDamage = LootManager.getDamageBonus(player);
    const gearCrit = LootManager.getCritBonus(player);
    const base = stats.baseDano + gearDamage + (player.nivel * stats.multiplicadorNivel);
    const multiplier = ability && ability.danoMultiplicador ? ability.danoMultiplicador : 1;
    const critChance = Math.min(95, (stats.critico || 0) + gearCrit + ((ability && ability.bonusCritico) || 0));
    const isCrit = Math.random() * 100 < critChance;
    const critMultiplier = isCrit ? 1.75 : 1;
    const variance = 0.92 + Math.random() * 0.16;

    return {
      damage: Math.max(1, Math.floor(base * multiplier * critMultiplier * variance)),
      isCrit,
      critChance
    };
  }

  static basicAttack(player, monsterManager) {
    if (!player || !player.classeId) return null;

    const damageInfo = this.calculateDamage(player, null);
    const result = monsterManager.takeDamage(damageInfo.damage, player.nivel);

    return {
      playerId: player.id,
      playerName: player.nome,
      type: 'basic',
      damage: result.damageApplied,
      isCrit: damageInfo.isCrit,
      monsterDied: result.died,
      result
    };
  }

  static useAbility(player, habilidadeId, monsterManager, now) {
    if (!player || !player.classeId) {
      return { ok: false, reason: 'Escolha uma classe primeiro.' };
    }

    const ability = this.getAbility(player.classeId, habilidadeId);
    if (!ability) {
      return { ok: false, reason: 'Habilidade inválida.' };
    }

    player.cooldowns = player.cooldowns || {};
    const availableAt = player.cooldowns[habilidadeId] || 0;
    if (now < availableAt) {
      return {
        ok: false,
        reason: 'Habilidade em recarga.',
        restanteMs: availableAt - now
      };
    }

    player.cooldowns[habilidadeId] = now + ability.cooldown;

    const damageInfo = this.calculateDamage(player, ability);
    const result = monsterManager.takeDamage(damageInfo.damage, player.nivel);

    return {
      ok: true,
      playerId: player.id,
      classeId: player.classeId,
      habilidadeId,
      habilidadeNome: ability.nome,
      visual: ability.visual,
      cooldown: ability.cooldown,
      damage: result.damageApplied,
      isCrit: damageInfo.isCrit,
      monsterDied: result.died,
      result
    };
  }

  static grantKillRewards(player, combatResult) {
    if (!combatResult || !combatResult.result || !combatResult.result.died) return null;
    return LevelManager.addXP(player, combatResult.result.xpReward);
  }
}

module.exports = CombatManager;
