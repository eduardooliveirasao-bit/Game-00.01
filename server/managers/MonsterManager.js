
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

  generateMonster(playerLevel) {
    const horda = this.horda;
    const template = this.getTemplateForWave(horda);
    const level = Math.max(1, Math.floor(playerLevel || 1) + Math.max(0, horda - 1));
    const isBoss = template.id === 'dragon';
    const hpScale = isBoss ? 8.5 : (template.id === 'skeleton' ? 2.4 : 1.6);
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
      isBoss
    };
  }

  getPublicMonster() {
    return { ...this.currentMonster };
  }

  takeDamage(amount, playerLevel) {
    const safe = Math.max(1, Math.floor(amount || 1));
    const before = this.currentMonster.hpAtual;
    this.currentMonster.hpAtual = Math.max(0, this.currentMonster.hpAtual - safe);
    const damageApplied = Math.min(before, safe);
    if (this.currentMonster.hpAtual > 0) {
      return { died: false, damageApplied, monster: this.getPublicMonster() };
    }
    const deadMonster = this.getPublicMonster();
    this.horda += 1;
    this.currentMonster = this.generateMonster(playerLevel);
    return {
      died: true,
      damageApplied,
      xpReward: deadMonster.xpReward,
      deadMonster,
      nextMonster: this.getPublicMonster(),
      horda: this.horda
    };
  }
}

module.exports = MonsterManager;
