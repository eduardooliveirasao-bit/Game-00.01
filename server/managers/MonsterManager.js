const { MONSTERS } = require('../../shared/classes.js');

class MonsterManager {
  constructor() {
    this.horda = 1;
    this.currentMonster = this.generateMonster(1);
  }

  getTemplateForWave(horda) {
    if (horda % 10 === 0) return MONSTERS.find((m) => m.id === 'dragon');
    return horda % 2 === 0 ? MONSTERS.find((m) => m.id === 'skeleton') : MONSTERS.find((m) => m.id === 'slime');
  }

  createSpecialState(template, level) {
    if (template.id !== 'dragon') return null;
    return {
      name: 'Escudo Elemental',
      active: false,
      shieldHp: 0,
      shieldMax: 0,
      nextThresholds: [0.7, 0.35],
      triggered: 0,
      rageTurns: 0,
      level: level
    };
  }

  generateMonster(playerLevel) {
    const horda = this.horda;
    const template = this.getTemplateForWave(horda);
    const level = Math.max(1, Math.floor(playerLevel || 1) + Math.max(0, horda - 1));
    const isBoss = template.id === 'dragon';
    const hpScale = isBoss ? 9.0 : (template.id === 'skeleton' ? 2.5 : 1.65);
    const hpMax = Math.floor(template.hpBase + level * hpScale * 10);
    const xpReward = Math.floor(template.xpBase + level * (isBoss ? 18 : 8));
    const goldBase = Math.floor(template.goldBase + level * (isBoss ? 6 : 3));

    return {
      instanceId: template.id + '_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      templateId: template.id,
      nome: template.nome,
      tipo: template.tipo,
      asset: template.asset,
      horda,
      nivel: level,
      hpMax,
      hpAtual: hpMax,
      xpReward,
      goldBase,
      isBoss,
      special: this.createSpecialState(template, level)
    };
  }

  getPublicMonster() {
    return JSON.parse(JSON.stringify(this.currentMonster));
  }

  activateBossShield() {
    const m = this.currentMonster;
    if (!m.special || m.special.active) return null;
    const shieldMax = Math.floor(180 + m.nivel * 22 + m.special.triggered * 55);
    m.special.active = true;
    m.special.shieldHp = shieldMax;
    m.special.shieldMax = shieldMax;
    m.special.rageTurns = 3;
    m.special.triggered += 1;
    return { type: 'bossShield', shieldHp: shieldMax, name: m.special.name };
  }

  maybeTriggerBossThreshold() {
    const m = this.currentMonster;
    if (!m.isBoss || !m.special || !m.special.nextThresholds.length || m.special.active) return null;
    const ratio = m.hpAtual / m.hpMax;
    const next = m.special.nextThresholds[0];
    if (ratio <= next) {
      m.special.nextThresholds.shift();
      return this.activateBossShield();
    }
    return null;
  }

  takeDamage(amount, playerLevel, attackType) {
    const safe = Math.max(1, Math.floor(amount || 1));
    const m = this.currentMonster;
    const result = {
      died: false,
      damageApplied: 0,
      monster: null,
      specialTriggered: null,
      shieldBroken: false,
      resisted: false
    };

    let effectiveDamage = safe;
    if (m.isBoss && m.special && m.special.active) {
      // Skill damage is much more effective against the shield.
      effectiveDamage = attackType === 'ability' ? Math.floor(safe * 1.6) : Math.floor(safe * 0.45);
      m.special.shieldHp = Math.max(0, m.special.shieldHp - effectiveDamage);
      result.damageApplied = effectiveDamage;
      result.resisted = attackType !== 'ability';
      if (m.special.shieldHp <= 0) {
        m.special.active = false;
        m.special.shieldHp = 0;
        m.special.shieldMax = 0;
        result.shieldBroken = true;
        result.specialTriggered = { type: 'shieldBroken', name: m.special.name };
      }
      result.monster = this.getPublicMonster();
      return result;
    }

    const before = m.hpAtual;
    m.hpAtual = Math.max(0, m.hpAtual - effectiveDamage);
    result.damageApplied = Math.min(before, effectiveDamage);

    const thresholdEvent = this.maybeTriggerBossThreshold();
    if (thresholdEvent) result.specialTriggered = thresholdEvent;

    if (m.hpAtual > 0) {
      result.monster = this.getPublicMonster();
      return result;
    }

    const deadMonster = this.getPublicMonster();
    this.horda += 1;
    this.currentMonster = this.generateMonster(playerLevel);
    return {
      died: true,
      damageApplied: result.damageApplied,
      xpReward: deadMonster.xpReward,
      deadMonster,
      nextMonster: this.getPublicMonster(),
      horda: this.horda,
      specialTriggered: result.specialTriggered,
      shieldBroken: result.shieldBroken,
      resisted: result.resisted
    };
  }
}

module.exports = MonsterManager;
