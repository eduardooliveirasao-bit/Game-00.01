const { MONSTERS } = require('../../shared/classes.js');

class MonsterManager {
  constructor() {
    this.killCount = 0;
    this.currentMonster = this.generateMonster(1);
  }

  chooseTemplate(playerLevel) {
    const available = MONSTERS.filter((monster) => playerLevel >= monster.minLevel);
    return available.length ? available[available.length - 1] : MONSTERS[0];
  }

  generateMonster(playerLevel) {
    const safeLevel = Math.max(1, Math.floor(playerLevel || 1));
    const template = this.chooseTemplate(safeLevel);
    const nextKillNumber = this.killCount + 1;
    const isBoss = nextKillNumber % 10 === 0;
    const monsterLevel = Math.max(1, safeLevel + Math.floor(Math.random() * 3));
    const hpScale = 1 + (monsterLevel * 0.22);
    const xpScale = 1 + (monsterLevel * 0.16);
    const bossMultiplier = isBoss ? 4.5 : (template.tipo === 'elite' ? 1.8 : 1);

    const hpMax = Math.floor(template.hpBase * hpScale * bossMultiplier);
    const xpReward = Math.floor(template.xpBase * xpScale * (isBoss ? 3.5 : 1));

    return {
      instanceId: `${template.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      templateId: template.id,
      nome: isBoss ? `${template.nome} Ancião` : template.nome,
      nivel: monsterLevel,
      hpMax,
      hpAtual: hpMax,
      xpReward,
      tipo: isBoss ? 'boss' : template.tipo,
      isBoss,
      killNumber: nextKillNumber
    };
  }

  getPublicMonster() {
    return { ...this.currentMonster };
  }

  takeDamage(amount, playerLevel) {
    const safeDamage = Math.max(1, Math.floor(amount || 1));
    const beforeHp = this.currentMonster.hpAtual;
    this.currentMonster.hpAtual = Math.max(0, this.currentMonster.hpAtual - safeDamage);

    const died = this.currentMonster.hpAtual <= 0;
    if (!died) {
      return {
        died: false,
        damageApplied: Math.min(beforeHp, safeDamage),
        monster: this.getPublicMonster()
      };
    }

    const deadMonster = this.getPublicMonster();
    this.killCount += 1;
    const xpReward = deadMonster.xpReward;
    this.currentMonster = this.generateMonster(playerLevel);

    return {
      died: true,
      damageApplied: Math.min(beforeHp, safeDamage),
      xpReward,
      deadMonster,
      nextMonster: this.getPublicMonster(),
      killCount: this.killCount
    };
  }
}

module.exports = MonsterManager;
