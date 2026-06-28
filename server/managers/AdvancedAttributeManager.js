const { GAME_CLASSES } = require('../../shared/classes.js');
const LootManager = require('./LootManager');
const TalentManager = require('./TalentManager');
const PetManager = require('./PetManager');
const MetaProgressManager = require('./MetaProgressManager');
const V30ProgressManager = require('./V30ProgressManager');
const V40ProgressManager = require('./V40ProgressManager');
const V90ProgressManager = require('./V90ProgressManager');

const DEFAULT_BASE = { strength: 10, wisdom: 10, agility: 10, vitality: 10 };
const CLASS_GROWTH = {
  guerreiro: { strength: 3.3, wisdom: 0.8, agility: 1.5, vitality: 3.2 },
  mago: { strength: 0.8, wisdom: 3.6, agility: 1.3, vitality: 2.1 },
  arqueiro: { strength: 1.6, wisdom: 1.2, agility: 3.4, vitality: 2.2 }
};

function n(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function addInto(target, source) { for (const [k, v] of Object.entries(source || {})) target[k] = (target[k] || 0) + n(v); return target; }
function sumGearStats(player) {
  const sum = { ataque:0, defesa:0, critico:0, hp:0, mana:0, hit:0, dodge:0, pierce:0, tough:0, haste:0 };
  for (const item of LootManager.getEquippedList(player)) {
    const s = item.totalStats || item.stats || {};
    sum.ataque += n(s.ataque);
    sum.defesa += n(s.defesa);
    sum.critico += n(s.critico);
    sum.hp += n(s.hp);
    sum.mana += n(s.mana);
    sum.hit += n(s.hit);
    sum.dodge += n(s.dodge);
    sum.pierce += n(s.pierce);
    sum.tough += n(s.tough);
    sum.haste += n(s.haste);
    const enhance = Math.min(20, Math.max(0, Math.floor(n(item.upgradeLevel || item.enhanceLevel))));
    if (enhance > 0) {
      const bonus = enhance * 0.005; // inspirado no EnhanceLevel: +0,5% por nível, cap +20.
      sum.ataque += Math.floor(n(s.ataque) * bonus);
      sum.defesa += Math.floor(n(s.defesa) * bonus);
      sum.critico += Math.floor(n(s.critico) * bonus);
      sum.hp += Math.floor(n(s.hp) * bonus);
      sum.mana += Math.floor(n(s.mana) * bonus);
    }
  }
  return sum;
}

class AdvancedAttributeManager {
  static normalize(player) {
    player.coreStats = player.coreStats || { ...DEFAULT_BASE, free: 0, spent: 0 };
    for (const k of ['strength','wisdom','agility','vitality']) player.coreStats[k] = Math.max(1, Math.floor(n(player.coreStats[k], DEFAULT_BASE[k])));
    player.coreStats.free = Math.max(0, Math.floor(n(player.coreStats.free)));
    player.coreStats.spent = Math.max(0, Math.floor(n(player.coreStats.spent)));
    player.attributeBreakdown = player.attributeBreakdown || null;
    return player.coreStats;
  }

  static grantLevelPoints(player) {
    this.normalize(player);
    const expected = Math.max(0, ((player.nivel || 1) - 1) * 3 + Math.floor((player.kills || 0) / 250));
    const current = (player.coreStats.spent || 0) + (player.coreStats.free || 0);
    if (expected > current) player.coreStats.free += expected - current;
  }

  static addPoint(player, stat) {
    this.normalize(player); this.grantLevelPoints(player);
    if (!['strength','wisdom','agility','vitality'].includes(stat)) return { ok:false, reason:'Atributo inválido.' };
    if ((player.coreStats.free || 0) <= 0) return { ok:false, reason:'Você não possui pontos livres.' };
    player.coreStats[stat] += 1;
    player.coreStats.free -= 1;
    player.coreStats.spent += 1;
    return { ok:true, coreStats: this.publicState(player), attributes: this.calculate(player) };
  }

  static reset(player) {
    this.normalize(player);
    const total = (player.coreStats.spent || 0) + (player.coreStats.free || 0);
    player.coreStats = { ...DEFAULT_BASE, free: total, spent: 0 };
    return { ok:true, coreStats: this.publicState(player), attributes: this.calculate(player) };
  }

  static calculate(player) {
    this.normalize(player); this.grantLevelPoints(player);
    const cls = GAME_CLASSES[player.classeId] || { baseStats: { maxHp:100, mana:0, baseDano:10, defesa:5, critico:5, multiplicadorNivel:2 } };
    const base = cls.baseStats || {};
    const level = Math.max(1, player.nivel || player.level || 1);
    const growth = CLASS_GROWTH[player.classeId] || CLASS_GROWTH.guerreiro;
    const core = player.coreStats;
    const gear = sumGearStats(player);
    const mount = LootManager.getMountBonus(player);
    const pet = PetManager.getBonuses(player);
    const talent = TalentManager.getBonuses(player);
    const meta = MetaProgressManager.publicMeta(player);
    const v30 = V30ProgressManager.getBonuses(player);
    const v40 = V40ProgressManager.getBonuses(player);
    const v90 = V90ProgressManager.getBonuses(player);
    const fashion = (player.fashion && player.fashion.bonus) || {};

    const strength = Math.floor(core.strength + level * growth.strength + (fashion.strength || 0));
    const wisdom = Math.floor(core.wisdom + level * growth.wisdom + (fashion.wisdom || 0));
    const agility = Math.floor(core.agility + level * growth.agility + (fashion.agility || 0));
    const vitality = Math.floor(core.vitality + level * growth.vitality + (fashion.vitality || 0));

    const physicalBase = Math.floor((base.baseDano || 10) + strength * 2.4 + agility * 0.7 + level * (base.multiplicadorNivel || 2));
    const magicBase = Math.floor((base.baseDano || 10) + wisdom * 2.7 + agility * 0.35 + level * (base.multiplicadorNivel || 2));
    const classMain = player.classeId === 'mago' ? magicBase : physicalBase;
    const rateAttack = (talent.ataquePct || 0) + (v30.ataquePct || 0) + (v40.ataquePct || 0) + (v90.ataquePct || 0) + (pet.ataquePct || 0) + (pet.danoPct || 0) + (((meta.ascension||{}).bonuses||{}).ataquePct || 0) + (((meta.ascension||{}).artifactBonuses||{}).ataquePct || 0) + (fashion.ataquePct || 0);
    const attack = Math.floor((classMain + gear.ataque + mount.ataque + (fashion.ataque || 0)) * (1 + rateAttack));

    const defenseBase = Math.floor((base.defesa || 5) + vitality * 1.45 + strength * 0.45 + wisdom * 0.25 + level * 0.9);
    const defense = Math.floor(defenseBase + gear.defesa + mount.defesa + (talent.defesa || 0) + (v30.defesa || 0) + (v40.defesa || 0) + (v90.defesa || 0) + (fashion.defesa || 0));
    const maxHp = Math.floor(((base.maxHp || 100) + vitality * 14 + strength * 3 + level * 18 + gear.hp + mount.hp + (fashion.hp || 0)) * (1 + (talent.hpPct || 0) + (v30.hpPct || 0) + (v40.hpPct || 0) + (v90.hpPct || 0)));
    const maxMana = Math.floor(((base.mana || 0) + wisdom * 8 + level * 5 + gear.mana + (fashion.mana || 0)) * (1 + (talent.manaPct || 0) + (v30.manaPct || 0)));
    const hitValue = Math.floor(agility * 2.1 + strength * 0.5 + wisdom * 0.5 + gear.hit + (fashion.hit || 0));
    const dodgeValue = Math.floor(agility * 1.6 + gear.dodge + mount.evasao + (fashion.dodge || 0));
    const critValue = Math.floor((base.critico || 0) + agility * 0.95 + gear.critico + (talent.critico || 0) + (v30.critico || 0) + (v40.critico || 0) + (v90.critico || 0) + (pet.critico || 0) + (fashion.critico || 0));
    const critRate = clamp(5 + critValue * 0.12, 5, 85);
    const dodgeRate = clamp(2 + dodgeValue * 0.08 + (talent.evasion || 0) + (v30.evasion || 0) + (v40.evasion || 0) + (v90.evasion || 0), 2, 65);
    const pierce = Math.floor(gear.pierce + strength * 0.25 + agility * 0.25 + (fashion.pierce || 0));
    const tough = Math.floor(gear.tough + vitality * 0.35 + wisdom * 0.18 + (fashion.tough || 0));
    const haste = Math.floor(100 + agility * 0.55 + gear.haste + (talent.speed || 0) + (v30.speed || 0) + (v40.speed || 0) + (v90.speed || 0) + mount.speed * 45);
    const physicalReduceRate = clamp((defense + tough) / 5000, 0, 0.48);
    const magicReduceRate = clamp((defense + wisdom) / 5200, 0, 0.48);
    const power = this.calculatePowerFrom({ attack, defense, maxHp, maxMana, critRate, dodgeRate, pierce, tough, haste, strength, wisdom, agility, vitality });

    const result = { strength, wisdom, agility, vitality, physicalAttack: physicalBase, magicAttack: magicBase, attack, defense, maxHp, maxMana, hitValue, dodgeValue, critValue, critRate, dodgeRate, pierce, tough, haste, physicalReduceRate, magicReduceRate, power, gear, mount, core: {...core} };
    player.attributeBreakdown = result;
    player.maxHp = Math.max(1, maxHp);
    player.maxMana = Math.max(0, maxMana);
    player.hp = Math.min(player.maxHp, Math.max(0, player.hp || player.maxHp));
    player.mana = Math.min(player.maxMana, Math.max(0, player.mana || Math.floor(player.maxMana * 0.65)));
    return result;
  }

  static calculatePowerFrom(a) {
    return Math.floor(120 + a.attack * 8.6 + a.defense * 5.1 + a.maxHp * 0.62 + a.maxMana * 0.28 + a.critRate * 26 + a.dodgeRate * 18 + a.pierce * 6 + a.tough * 5 + a.haste * 1.6 + (a.strength + a.wisdom + a.agility + a.vitality) * 3.4);
  }

  static getCombatStats(player) { return this.calculate(player); }
  static powerBonus(player) { return this.calculate(player).power; }
  static publicState(player) { this.normalize(player); this.grantLevelPoints(player); return { coreStats: player.coreStats, calculated: this.calculate(player) }; }
}

module.exports = AdvancedAttributeManager;
