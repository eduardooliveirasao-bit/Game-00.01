const { GAME_CLASSES } = require('../../shared/classes.js');
const LevelManager = require('./LevelManager');
const LootManager = require('./LootManager');
const PetManager = require('./PetManager');
const TalentManager = require('./TalentManager');
const MetaProgressManager = require('./MetaProgressManager');
const V30ProgressManager = require('./V30ProgressManager');
const V40ProgressManager = require('./V40ProgressManager');

class CombatManager {
  static getClass(player) {
    return GAME_CLASSES[player.classeId] || null;
  }

  static getAbilityList(classeId) {
    const classe = GAME_CLASSES[classeId];
    return classe ? classe.habilidades : [];
  }

  static getAbility(classeId, habilidadeId) {
    return this.getAbilityList(classeId).find((h) => h.id === habilidadeId) || null;
  }

  static calculateDamage(player, ability) {
    const classe = this.getClass(player);
    if (!classe) return { damage: 1, isCrit: false };
    const stats = classe.baseStats;
    const gearDamage = LootManager.getDamageBonus(player);
    const gearCrit = LootManager.getCritBonus(player);
    const petBonus = PetManager.getBonuses(player);
    const talentBonus = TalentManager.getBonuses(player);
    const v30Bonus = V30ProgressManager.getBonuses(player);
    const v40Bonus = V40ProgressManager.getBonuses(player);
    const meta = MetaProgressManager.publicMeta(player);
    const metaAtk = ((meta.ascension&&meta.ascension.bonuses&&meta.ascension.bonuses.ataquePct)||0)+((meta.ascension&&meta.ascension.artifactBonuses&&meta.ascension.artifactBonuses.ataquePct)||0)+((meta.codex&&meta.codex.bonuses&&meta.codex.bonuses.ataquePct)||0);
    const base = (stats.baseDano + gearDamage + player.nivel * stats.multiplicadorNivel) * (1 + (petBonus.ataquePct || 0) + (petBonus.danoPct || 0) + (talentBonus.ataquePct || 0) + (v30Bonus.ataquePct || 0) + (v40Bonus.ataquePct || 0) + metaAtk);
    const multiplier = ability ? ability.danoMultiplicador : 1;
    const critChance = Math.min(95, (stats.critico || 0) + gearCrit + (petBonus.critico || 0) + (talentBonus.critico || 0) + (v30Bonus.critico || 0) + (v40Bonus.critico || 0) + ((ability && ability.bonusCritico) || 0));
    const isCrit = Math.random() * 100 < critChance;
    const variance = 0.92 + Math.random() * 0.18;
    const critMul = isCrit ? 1.75 : 1;
    return { damage: Math.max(1, Math.floor(base * multiplier * variance * critMul)), isCrit };
  }

  static basicAttack(player, monsterManager) {
    if (!player || !player.classeId) return null;
    const damageInfo = this.calculateDamage(player, null);
    const result = monsterManager.takeDamage(damageInfo.damage, player.nivel, 'basic');
    return { type: 'basic', playerId: player.id, playerName: player.nome, classeId: player.classeId, damage: result.damageApplied, isCrit: damageInfo.isCrit, monsterDied: result.died, result };
  }

  static useAbility(player, habilidadeId, monsterManager, now) {
    if (!player || !player.classeId) return { ok: false, reason: 'Escolha uma classe primeiro.' };
    const ability = this.getAbility(player.classeId, habilidadeId);
    if (!ability) return { ok: false, reason: 'Habilidade inválida.' };
    player.cooldowns = player.cooldowns || {};
    const availableAt = player.cooldowns[habilidadeId] || 0;
    if (now < availableAt) return { ok: false, reason: 'Habilidade em recarga.', restanteMs: availableAt - now };
    const manaCost = ability.manaCost || 0;
    if ((player.mana || 0) < manaCost) return { ok: false, reason: 'Mana insuficiente.' };

    player.cooldowns[habilidadeId] = now + ability.cooldown;
    player.mana = Math.max(0, (player.mana || 0) - manaCost);

    const damageInfo = this.calculateDamage(player, ability);
    const result = monsterManager.takeDamage(damageInfo.damage, player.nivel, 'ability');
    LevelManager.syncProgressFields(player);

    return {
      ok: true,
      type: 'ability',
      playerId: player.id,
      playerName: player.nome,
      classeId: player.classeId,
      habilidadeId: ability.id,
      habilidadeNome: ability.nome,
      visual: ability.visual,
      icon: ability.icon,
      cooldown: ability.cooldown,
      damage: result.damageApplied,
      isCrit: damageInfo.isCrit,
      manaCost,
      monsterDied: result.died,
      result
    };
  }

  static tryAutoAbility(player, monsterManager, now) {
    if (!player.autoFarm || !player.classeId) return null;
    player.nextAutoSkillAt = player.nextAutoSkillAt || 0;
    if (now < player.nextAutoSkillAt) return null;
    const abilities = this.getAbilityList(player.classeId);
    for (const ability of abilities) {
      const availableAt = (player.cooldowns && player.cooldowns[ability.id]) || 0;
      if (now >= availableAt && (player.mana || 0) >= (ability.manaCost || 0)) {
        const result = this.useAbility(player, ability.id, monsterManager, now);
        if (result.ok) {
          player.nextAutoSkillAt = now + 3500;
          return result;
        }
      }
    }
    return null;
  }

  static regenMana(player) {
    if (!player || !player.classeId) return;
    const classe = this.getClass(player);
    const regen = Math.max(4, Math.floor((classe.baseStats.mana || 0) * 0.035));
    player.mana = Math.min(player.maxMana || regen, (player.mana || 0) + regen);
    LevelManager.syncProgressFields(player);
  }

  static grantKillRewards(player, combatEvent) {
    if (!combatEvent || !combatEvent.result || !combatEvent.result.died) return null;
    { const meta = MetaProgressManager.publicMeta(player); const zoneXp=(meta.zone&&meta.zone.bonus&&meta.zone.bonus.xpPct)||0; const metaXp=((meta.ascension&&meta.ascension.bonuses&&meta.ascension.bonuses.xpPct)||0)+((meta.ascension&&meta.ascension.artifactBonuses&&meta.ascension.artifactBonuses.xpPct)||0); return LevelManager.addXP(player, Math.floor(combatEvent.result.xpReward * (1 + (TalentManager.getBonuses(player).xpPct || 0) + (V30ProgressManager.getBonuses(player).xpPct || 0) + (V40ProgressManager.getBonuses(player).xpPct || 0) + zoneXp + metaXp))); }
  }
}

module.exports = CombatManager;
