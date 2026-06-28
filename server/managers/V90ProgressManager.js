const LootManager = require('./LootManager');
const LevelManager = require('./LevelManager');

const MASTERIES = {
  blade: { id:'blade', nome:'Maestria da Lâmina', icon:'⚔️', max:90, desc:'Aumenta ataque, crítico e poder de golpes físicos.', bonus:{ ataquePct:0.0025, critico:0.10, power:110 }, cost:(lv)=>({ aether:42+lv*18, ouro:4200+lv*900 }) },
  arcane: { id:'arcane', nome:'Maestria Arcana', icon:'🔷', max:90, desc:'Aumenta mana, dano mágico e estabilidade de skills.', bonus:{ manaPct:0.0028, ataquePct:0.0018, power:105 }, cost:(lv)=>({ aether:40+lv*17, ouro:4000+lv*880 }) },
  hunt: { id:'hunt', nome:'Maestria da Caça', icon:'🏹', max:90, desc:'Aumenta velocidade, evasão, ouro e qualidade de drop.', bonus:{ speed:0.62, evasion:0.12, goldPct:0.0014, qualityPct:0.0011, power:96 }, cost:(lv)=>({ aether:38+lv*16, ouro:3800+lv*840 }) },
  bastion: { id:'bastion', nome:'Bastião Rúnico', icon:'🛡️', max:90, desc:'Aumenta HP, defesa e resistência ao dano recebido.', bonus:{ hpPct:0.0027, defesa:0.82, damageReductionPct:0.0007, power:108 }, cost:(lv)=>({ aether:44+lv*18, ouro:4300+lv*920 }) },
  fortune: { id:'fortune', nome:'Sorte Astral', icon:'🌙', max:90, desc:'Aumenta ouro, drop, qualidade de drop e recursos meta.', bonus:{ goldPct:0.0022, dropPct:0.0018, qualityPct:0.0014, power:92 }, cost:(lv)=>({ aether:46+lv*19, ouro:4500+lv*950 }) }
};

const STANCES = {
  balanced: { id:'balanced', nome:'Postura Equilibrada', icon:'⚖️', desc:'Bônus leve geral.', bonus:{ ataquePct:0.015, hpPct:0.015, power:650 } },
  berserker: { id:'berserker', nome:'Postura Berserker', icon:'🔥', desc:'Mais dano e crítico, menos segurança.', bonus:{ ataquePct:0.055, critico:2.2, power:1800 } },
  guardian: { id:'guardian', nome:'Postura Guardião', icon:'🛡️', desc:'Mais HP, defesa e redução de dano.', bonus:{ hpPct:0.07, defesa:12, damageReductionPct:0.04, power:1650 } },
  assassin: { id:'assassin', nome:'Postura Assassina', icon:'🗡️', desc:'Mais velocidade, evasão e qualidade de drop.', bonus:{ speed:14, evasion:4.5, qualityPct:0.025, power:1450 } },
  archmage: { id:'archmage', nome:'Postura Arquimago', icon:'✦', desc:'Mais mana e dano de habilidade.', bonus:{ manaPct:0.09, ataquePct:0.035, power:1550 } }
};

const WARDROBE = {
  hair_shadow: { id:'hair_shadow', slot:'hair', nome:'Cabelo da Noite', icon:'🖤', desc:'Camada futura de cabelo escuro.', cost:{ skinShards:90 }, bonus:{ power:220, evasion:0.6 }, layers:{ hair:'assets/skins/common/hair_shadow.png' } },
  hair_gold: { id:'hair_gold', slot:'hair', nome:'Cabelo Solar', icon:'🌟', desc:'Camada futura de cabelo dourado.', cost:{ skinShards:110 }, bonus:{ power:280, critico:0.7 }, layers:{ hair:'assets/skins/common/hair_gold.png' } },
  armor_obsidian: { id:'armor_obsidian', slot:'outfit', nome:'Armadura Obsidiana', icon:'🛡️', desc:'Roupa/armadura dark fantasy.', cost:{ skinShards:180 }, bonus:{ defesa:6, hpPct:0.018, power:760 }, layers:{ outfit:'assets/skins/common/armor_obsidian.png' } },
  armor_silver: { id:'armor_silver', slot:'outfit', nome:'Manto de Prata Rúnica', icon:'⚜️', desc:'Traje nobre para classes mágicas.', cost:{ skinShards:180 }, bonus:{ manaPct:0.025, ataquePct:0.01, power:740 }, layers:{ outfit:'assets/skins/common/armor_silver.png' } },
  wing_abyss: { id:'wing_abyss', slot:'wing', nome:'Asas do Abismo', icon:'🪽', desc:'Asa cosmética preparada para layer back/front.', cost:{ skinShards:260, chronos:2 }, bonus:{ ataquePct:0.018, power:1250 }, layers:{ back:'assets/skins/common/wing_abyss_back.png', front:'assets/skins/common/wing_abyss_front.png' } },
  wing_celestial: { id:'wing_celestial', slot:'wing', nome:'Asas Celestiais', icon:'🪽', desc:'Asa luminosa futura.', cost:{ skinShards:260, chronos:2 }, bonus:{ hpPct:0.026, manaPct:0.026, power:1200 }, layers:{ back:'assets/skins/common/wing_celestial_back.png', front:'assets/skins/common/wing_celestial_front.png' } },
  weapon_eclipse: { id:'weapon_eclipse', slot:'weaponSkin', nome:'Arma do Eclipse', icon:'🌘', desc:'Skin de arma pronta para sobreposição.', cost:{ skinShards:220, aether:450 }, bonus:{ ataquePct:0.022, critico:1.0, power:1120 }, layers:{ weapon:'assets/skins/common/weapon_eclipse.png' } },
  aura_nightmare: { id:'aura_nightmare', slot:'aura', nome:'Aura Pesadelo', icon:'🌌', desc:'Aura escura para VFX e palco.', cost:{ skinShards:320, chronos:3 }, bonus:{ power:1650, qualityPct:0.018 }, auraColor:'#8a5cff' },
  aura_rune_gold: { id:'aura_rune_gold', slot:'aura', nome:'Aura de Ouro Rúnico', icon:'🏵️', desc:'Aura premium de runas douradas.', cost:{ skinShards:340, chronos:3 }, bonus:{ power:1800, goldPct:0.035 }, auraColor:'#ffd47a' }
};

const SOUL_CARDS = {
  sword: { id:'sword', nome:'Carta da Espada Ancestral', icon:'🃏', max:60, bonus:{ ataquePct:0.0032, power:155 }, cost:(lv)=>({ sigils:18+lv*7, ouro:5000+lv*1000 }) },
  crown: { id:'crown', nome:'Carta da Coroa Sombria', icon:'👑', max:60, bonus:{ hpPct:0.003, defesa:0.75, power:150 }, cost:(lv)=>({ sigils:18+lv*7, ouro:5000+lv*1000 }) },
  wing: { id:'wing', nome:'Carta da Asa Fênix', icon:'🔥', max:60, bonus:{ speed:0.85, evasion:0.16, power:145 }, cost:(lv)=>({ sigils:18+lv*7, ouro:5000+lv*1000 }) },
  moon: { id:'moon', nome:'Carta da Lua Profunda', icon:'🌙', max:60, bonus:{ goldPct:0.0028, dropPct:0.0022, qualityPct:0.0017, power:140 }, cost:(lv)=>({ sigils:18+lv*7, ouro:5000+lv*1000 }) }
};

const ROADMAP = [
  { id:'v44', nome:'Polimento de Login', icon:'🏰', need:{ power:10000 }, reward:{ ouro:5000, gemas:10, aether:80 }, bonus:{ power:240 } },
  { id:'v45', nome:'Combate Cinemático', icon:'💥', need:{ kills:80 }, reward:{ ouro:8000, aether:120, skinShards:20 }, bonus:{ ataquePct:0.006, power:360 } },
  { id:'v46', nome:'Base de Skins', icon:'🎭', need:{ kills:120 }, reward:{ skinShards:90, aether:90 }, bonus:{ power:420 } },
  { id:'v47', nome:'Economia Ajustada', icon:'💰', need:{ goldEarned:25000 }, reward:{ ouro:15000, gemas:12 }, bonus:{ goldPct:0.01, power:380 } },
  { id:'v48', nome:'Mochila Premium', icon:'🎒', need:{ power:35000 }, reward:{ skinShards:120 }, bonus:{ hpPct:0.006, power:520 } },
  { id:'v49', nome:'Camadas Visuais', icon:'🧥', need:{ power:50000 }, reward:{ chronos:1, skinShards:160 }, bonus:{ power:680 } },
  { id:'v50', nome:'Marco V50', icon:'🌟', need:{ bosses:5 }, reward:{ ouro:50000, gemas:40, aether:380, chronos:2 }, bonus:{ ataquePct:0.014, hpPct:0.014, power:1500 } },
  { id:'v55', nome:'Bosses Melhorados', icon:'🐲', need:{ bosses:12 }, reward:{ aether:650, sigils:120 }, bonus:{ critico:1.5, power:1900 } },
  { id:'v60', nome:'Meta Intermediário', icon:'🔮', need:{ power:150000 }, reward:{ ouro:90000, gemas:90, chronos:3 }, bonus:{ dropPct:0.018, qualityPct:0.012, power:2600 } },
  { id:'v70', nome:'Sistema de Estilo', icon:'✨', need:{ kills:1000 }, reward:{ skinShards:520, sigils:240 }, bonus:{ speed:8, evasion:2, power:4200 } },
  { id:'v80', nome:'Preparação Endgame', icon:'🌌', need:{ power:500000 }, reward:{ ouro:250000, gemas:180, aether:1600, chronos:5 }, bonus:{ ataquePct:0.028, hpPct:0.028, power:7200 } },
  { id:'v90', nome:'Ultimate Polish', icon:'👑', need:{ power:900000 }, reward:{ ouro:500000, gemas:350, aether:3200, skinShards:900, sigils:600, chronos:10 }, bonus:{ ataquePct:0.045, hpPct:0.045, goldPct:0.035, qualityPct:0.025, power:15000 } }
];

const ECHO_DUNGEONS = {
  crypt: { id:'crypt', nome:'Eco da Cripta Sombria', icon:'🕯️', minPower:25000, cost:{ echoKeys:1 }, reward:{ ouro:18000, aether:140, sigils:25, skinShards:18 }, itemChance:0.14 },
  moon: { id:'moon', nome:'Eco da Lua Quebrada', icon:'🌙', minPower:80000, cost:{ echoKeys:2 }, reward:{ ouro:52000, aether:360, sigils:80, skinShards:54 }, itemChance:0.22 },
  abyss: { id:'abyss', nome:'Eco do Abismo Final', icon:'🕳️', minPower:220000, cost:{ echoKeys:3, chronos:1 }, reward:{ ouro:140000, aether:900, sigils:180, skinShards:130 }, itemChance:0.36 }
};

function addBonus(target, bonus, mult = 1) {
  if (!bonus) return target;
  for (const [k, v] of Object.entries(bonus)) target[k] = (target[k] || 0) + v * mult;
  return target;
}
function clampInt(n, min, max) { return Math.max(min, Math.min(max, Math.floor(n || 0))); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function affordResources(player, cost) {
  const v = player.v90 || {};
  if ((player.ouro || 0) < (cost.ouro || 0)) return 'Ouro insuficiente.';
  if ((player.gemas || 0) < (cost.gemas || 0)) return 'Gemas insuficientes.';
  if ((v.aether || 0) < (cost.aether || 0)) return 'Éter insuficiente.';
  if ((v.skinShards || 0) < (cost.skinShards || 0)) return 'Fragmentos de skin insuficientes.';
  if ((v.chronos || 0) < (cost.chronos || 0)) return 'Cronos insuficiente.';
  if ((v.sigils || 0) < (cost.sigils || 0)) return 'Sigilos insuficientes.';
  if ((v.echoKeys || 0) < (cost.echoKeys || 0)) return 'Chaves de Eco insuficientes.';
  return null;
}
function spendResources(player, cost) {
  player.ouro = (player.ouro || 0) - (cost.ouro || 0);
  player.gemas = (player.gemas || 0) - (cost.gemas || 0);
  player.cashGems = player.gemas;
  const v = player.v90;
  v.aether -= cost.aether || 0;
  v.skinShards -= cost.skinShards || 0;
  v.chronos -= cost.chronos || 0;
  v.sigils -= cost.sigils || 0;
  v.echoKeys -= cost.echoKeys || 0;
}
function grantReward(player, reward) {
  reward = reward || {};
  const v = player.v90;
  player.ouro = (player.ouro || 0) + (reward.ouro || reward.gold || 0);
  player.gemas = (player.gemas || 0) + (reward.gemas || reward.gems || 0);
  player.cashGems = player.gemas;
  v.aether = (v.aether || 0) + (reward.aether || 0);
  v.skinShards = (v.skinShards || 0) + (reward.skinShards || 0);
  v.chronos = (v.chronos || 0) + (reward.chronos || 0);
  v.sigils = (v.sigils || 0) + (reward.sigils || 0);
  v.echoKeys = (v.echoKeys || 0) + (reward.echoKeys || 0);
}

class V90ProgressManager {
  static normalize(player) {
    player.v90 = player.v90 || {};
    const v = player.v90;
    v.version = 90;
    v.aether = clampInt(v.aether, 0, 999999999);
    v.skinShards = clampInt(v.skinShards, 0, 999999999);
    v.chronos = clampInt(v.chronos, 0, 999999999);
    v.sigils = clampInt(v.sigils, 0, 999999999);
    v.echoKeys = clampInt(v.echoKeys, 0, 999999999);
    v.masteries = v.masteries || {};
    v.soulCards = v.soulCards || {};
    v.stance = STANCES[v.stance] ? v.stance : 'balanced';
    v.wardrobe = v.wardrobe || { unlocked:['classic'], equipped:{} };
    v.wardrobe.unlocked = Array.isArray(v.wardrobe.unlocked) ? v.wardrobe.unlocked : ['classic'];
    v.wardrobe.equipped = v.wardrobe.equipped || {};
    v.roadmap = Array.isArray(v.roadmap) ? v.roadmap : [];
    v.echoes = v.echoes || { day:null, runs:0, best:null };
    const day = todayKey();
    if (v.echoes.day !== day) { v.echoes.day = day; v.echoes.runs = 0; }
    v.tactic = v.tactic || { mode:'balanced', potionAtHp:35, focus:'auto', skillBias:'auto' };
    v.combo = v.combo || { count:0, best:0, lastAt:0 };
    v.unlocks = v.unlocks || { foundersChest:false };
    v.battleLedger = v.battleLedger || { damage:0, crits:0, dodges:0, echoes:0, styleScore:0 };
    return v;
  }

  static getBonuses(player) {
    this.normalize(player);
    const v = player.v90;
    const bonus = {};
    for (const [id, lvRaw] of Object.entries(v.masteries || {})) {
      const def = MASTERIES[id]; if (!def) continue;
      addBonus(bonus, def.bonus, Math.min(def.max, Math.max(0, lvRaw || 0)));
    }
    for (const [id, lvRaw] of Object.entries(v.soulCards || {})) {
      const def = SOUL_CARDS[id]; if (!def) continue;
      addBonus(bonus, def.bonus, Math.min(def.max, Math.max(0, lvRaw || 0)));
    }
    addBonus(bonus, (STANCES[v.stance] || STANCES.balanced).bonus, 1);
    for (const equippedId of Object.values(v.wardrobe.equipped || {})) {
      const w = WARDROBE[equippedId]; if (w) addBonus(bonus, w.bonus, 1);
    }
    for (const node of ROADMAP) if ((v.roadmap || []).includes(node.id)) addBonus(bonus, node.bonus, 1);
    const comboBonus = Math.min(0.035, (v.combo && v.combo.count || 0) * 0.0004);
    if (comboBonus) addBonus(bonus, { ataquePct:comboBonus, speed:comboBonus*110, power:Math.floor(comboBonus*42000) }, 1);
    return bonus;
  }

  static powerBonus(player) {
    const b = this.getBonuses(player);
    return Math.floor((b.power||0) + (b.ataquePct||0)*90000 + (b.hpPct||0)*72000 + (b.manaPct||0)*38000 + (b.goldPct||0)*18000 + (b.dropPct||0)*24000 + (b.qualityPct||0)*26000 + (b.damageReductionPct||0)*75000 + (b.defesa||0)*70 + (b.speed||0)*55 + (b.evasion||0)*110 + (b.critico||0)*180);
  }

  static publicState(player) {
    this.normalize(player);
    const v = player.v90;
    const wardrobeAll = Object.values(WARDROBE).map(w => ({ ...w, unlocked:v.wardrobe.unlocked.includes(w.id), equipped:Object.values(v.wardrobe.equipped||{}).includes(w.id) }));
    return {
      version:90,
      resources:{ aether:v.aether, skinShards:v.skinShards, chronos:v.chronos, sigils:v.sigils, echoKeys:v.echoKeys },
      bonuses:this.getBonuses(player),
      powerBonus:this.powerBonus(player),
      masteries:{ defs:Object.values(MASTERIES).map(d=>({ id:d.id,nome:d.nome,icon:d.icon,max:d.max,desc:d.desc,bonus:d.bonus,nextCost:d.cost(v.masteries[d.id]||0) })), levels:v.masteries },
      stances:Object.values(STANCES).map(s=>({ ...s, active:v.stance===s.id })),
      wardrobe:{ all:wardrobeAll, unlocked:v.wardrobe.unlocked, equipped:v.wardrobe.equipped, layers:this.visualLayers(player), auraColor:this.auraColor(player) },
      soulCards:{ defs:Object.values(SOUL_CARDS).map(d=>({ id:d.id,nome:d.nome,icon:d.icon,max:d.max,bonus:d.bonus,nextCost:d.cost(v.soulCards[d.id]||0) })), levels:v.soulCards },
      roadmap:ROADMAP.map(r=>({ ...r, claimed:v.roadmap.includes(r.id), ready:this.roadmapReady(player,r) })),
      echoes:{ ...v.echoes, defs:Object.values(ECHO_DUNGEONS) },
      tactic:v.tactic,
      combo:v.combo,
      battleLedger:v.battleLedger,
      unlocks:v.unlocks
    };
  }

  static visualLayers(player) {
    this.normalize(player);
    const layers = {};
    for (const id of Object.values(player.v90.wardrobe.equipped || {})) {
      const w = WARDROBE[id];
      if (w && w.layers) Object.assign(layers, w.layers);
    }
    return layers;
  }
  static auraColor(player) {
    this.normalize(player);
    const auraId = player.v90.wardrobe.equipped && player.v90.wardrobe.equipped.aura;
    return (WARDROBE[auraId] && WARDROBE[auraId].auraColor) || null;
  }

  static onDamageDealt(player, amount, opts = {}) {
    this.normalize(player);
    const v = player.v90;
    v.battleLedger.damage += Math.max(0, Math.floor(amount || 0));
    if (opts.crit) v.battleLedger.crits += 1;
    v.battleLedger.styleScore += Math.floor(Math.sqrt(Math.max(0, amount || 0))) + (opts.crit ? 12 : 3);
  }

  static onDodge(player) { this.normalize(player); player.v90.battleLedger.dodges += 1; }

  static onKill(player, deadMonster, loot) {
    this.normalize(player);
    const v = player.v90;
    const now = Date.now();
    if (now - (v.combo.lastAt || 0) < 9000) v.combo.count = Math.min(999, (v.combo.count || 0) + 1);
    else v.combo.count = 1;
    v.combo.lastAt = now;
    v.combo.best = Math.max(v.combo.best || 0, v.combo.count || 0);

    const lvl = deadMonster.nivel || 1;
    const reward = {
      aether: deadMonster.isBoss ? 65 + Math.floor(lvl * 2.2) : 5 + Math.floor(lvl / 3),
      sigils: deadMonster.isBoss ? 14 + Math.floor(lvl / 4) : (Math.random() < 0.22 ? 1 + Math.floor(lvl / 18) : 0),
      skinShards: deadMonster.isBoss ? 12 + Math.floor(lvl / 7) : (Math.random() < 0.10 ? 1 : 0),
      echoKeys: deadMonster.isBoss && Math.random() < 0.38 ? 1 : 0,
      chronos: deadMonster.isBoss && Math.random() < 0.08 ? 1 : 0
    };
    const fortune = this.getBonuses(player);
    if (fortune.dropPct) reward.skinShards += Math.random() < Math.min(0.25, fortune.dropPct) ? 1 : 0;
    grantReward(player, reward);
    return { reward, combo:v.combo, resources:{ aether:v.aether, skinShards:v.skinShards, chronos:v.chronos, sigils:v.sigils, echoKeys:v.echoKeys } };
  }

  static upgradeMastery(player, id) {
    this.normalize(player);
    const def = MASTERIES[id]; if (!def) return { ok:false, reason:'Maestria inválida.' };
    const lv = clampInt(player.v90.masteries[id], 0, def.max);
    if (lv >= def.max) return { ok:false, reason:'Maestria no nível máximo.' };
    const cost = def.cost(lv);
    const reason = affordResources(player, cost); if (reason) return { ok:false, reason };
    spendResources(player, cost);
    player.v90.masteries[id] = lv + 1;
    return { ok:true, id, level:lv+1, cost };
  }

  static selectStance(player, id) {
    this.normalize(player);
    if (!STANCES[id]) return { ok:false, reason:'Postura inválida.' };
    player.v90.stance = id;
    return { ok:true, stance:STANCES[id] };
  }

  static unlockWardrobe(player, id) {
    this.normalize(player);
    const w = WARDROBE[id]; if (!w) return { ok:false, reason:'Visual inválido.' };
    if (player.v90.wardrobe.unlocked.includes(id)) return { ok:false, reason:'Visual já desbloqueado.' };
    const reason = affordResources(player, w.cost || {}); if (reason) return { ok:false, reason };
    spendResources(player, w.cost || {});
    player.v90.wardrobe.unlocked.push(id);
    return { ok:true, item:w };
  }

  static equipWardrobe(player, id) {
    this.normalize(player);
    const w = WARDROBE[id]; if (!w) return { ok:false, reason:'Visual inválido.' };
    if (!player.v90.wardrobe.unlocked.includes(id)) return { ok:false, reason:'Visual bloqueado.' };
    player.v90.wardrobe.equipped[w.slot] = id;
    return { ok:true, item:w, layers:this.visualLayers(player), auraColor:this.auraColor(player) };
  }

  static upgradeSoulCard(player, id) {
    this.normalize(player);
    const def = SOUL_CARDS[id]; if (!def) return { ok:false, reason:'Carta inválida.' };
    const lv = clampInt(player.v90.soulCards[id], 0, def.max);
    if (lv >= def.max) return { ok:false, reason:'Carta no nível máximo.' };
    const cost = def.cost(lv);
    const reason = affordResources(player, cost); if (reason) return { ok:false, reason };
    spendResources(player, cost);
    player.v90.soulCards[id] = lv + 1;
    return { ok:true, id, level:lv+1, cost };
  }

  static roadmapReady(player, node) {
    const n = node.need || {};
    if (n.power && (player.power || 0) < n.power) return false;
    if (n.kills && (player.kills || 0) < n.kills) return false;
    if (n.bosses && ((player.stats && player.stats.bossKills) || 0) < n.bosses) return false;
    if (n.goldEarned && ((player.stats && player.stats.goldEarned) || 0) < n.goldEarned) return false;
    return true;
  }

  static claimRoadmap(player, id) {
    this.normalize(player);
    const node = ROADMAP.find(r => r.id === id); if (!node) return { ok:false, reason:'Marco inválido.' };
    if (player.v90.roadmap.includes(id)) return { ok:false, reason:'Marco já coletado.' };
    if (!this.roadmapReady(player, node)) return { ok:false, reason:'Marco ainda não está pronto.' };
    player.v90.roadmap.push(id);
    grantReward(player, node.reward);
    return { ok:true, node };
  }

  static runEcho(player, id) {
    this.normalize(player);
    const d = ECHO_DUNGEONS[id]; if (!d) return { ok:false, reason:'Eco inválido.' };
    if ((player.power || 0) < d.minPower) return { ok:false, reason:'Poder insuficiente para esse Eco.' };
    if ((player.v90.echoes.runs || 0) >= 8) return { ok:false, reason:'Limite diário de Ecos atingido.' };
    const reason = affordResources(player, d.cost); if (reason) return { ok:false, reason };
    spendResources(player, d.cost);
    const reward = { ...d.reward };
    const perf = Math.max(1, Math.floor((player.power || 1000) / d.minPower));
    reward.ouro = Math.floor(reward.ouro * Math.min(3.5, 0.85 + perf * 0.10));
    reward.aether = Math.floor(reward.aether * Math.min(3, 0.90 + perf * 0.08));
    grantReward(player, reward);
    player.v90.echoes.runs += 1;
    player.v90.echoes.best = player.v90.echoes.best || { id:d.id, score:0 };
    const score = Math.floor((player.power || 0) * (0.08 + Math.random() * 0.05));
    if (score > (player.v90.echoes.best.score || 0)) player.v90.echoes.best = { id:d.id, score };
    player.v90.battleLedger.echoes += 1;
    let item = null;
    if (Math.random() < d.itemChance) {
      item = LootManager.createShopDrop(player, id === 'abyss' ? 'lendário' : id === 'moon' ? 'épico' : 'raro');
      if (item) { player.inventario = player.inventario || []; player.inventario.unshift(item); }
    }
    return { ok:true, dungeon:d, reward, item, score };
  }

  static setTactic(player, patch = {}) {
    this.normalize(player);
    const v = player.v90;
    if (['balanced','aggressive','safe','loot','boss'].includes(patch.mode)) v.tactic.mode = patch.mode;
    if (['auto','basic','skill','boss'].includes(patch.skillBias)) v.tactic.skillBias = patch.skillBias;
    if (['auto','xp','gold','drop','boss'].includes(patch.focus)) v.tactic.focus = patch.focus;
    if (patch.potionAtHp != null) v.tactic.potionAtHp = Math.max(5, Math.min(90, Math.floor(patch.potionAtHp)));
    return { ok:true, tactic:v.tactic };
  }

  static claimFoundersChest(player) {
    this.normalize(player);
    if (player.v90.unlocks.foundersChest) return { ok:false, reason:'Baú V90 já coletado.' };
    player.v90.unlocks.foundersChest = true;
    const reward = { ouro:90000, gemas:90, aether:900, skinShards:220, sigils:180, echoKeys:5, chronos:2 };
    grantReward(player, reward);
    return { ok:true, reward };
  }
}

module.exports = V90ProgressManager;
