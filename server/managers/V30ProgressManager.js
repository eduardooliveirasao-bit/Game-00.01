const LootManager = require('./LootManager');
const LevelManager = require('./LevelManager');

const TITLES = {
  novato_celeste: { id:'novato_celeste', nome:'Novato Celeste', icon:'✨', desc:'Primeiro passo no Reino do Céu.', req:'Login no V30', bonus:{ power:120, hpPct:0.01 } },
  cacador_100: { id:'cacador_100', nome:'Caçador de Elite', icon:'⚔️', desc:'Derrote 100 monstros.', req:'100 abates', bonus:{ ataquePct:0.025, power:350 } },
  mestre_dragao: { id:'mestre_dragao', nome:'Mestre Dracônico', icon:'🐉', desc:'Derrote 5 bosses.', req:'5 bosses', bonus:{ ataquePct:0.04, critico:2, power:620 } },
  milionaria_indle: { id:'milionaria_indle', nome:'Lenda Dourada', icon:'👑', desc:'Alcance 50.000 de poder.', req:'50k poder', bonus:{ goldPct:0.05, dropPct:0.01, power:900 } }
};

const RESEARCH = {
  ataque_arcano: { id:'ataque_arcano', nome:'Ataque Arcano', icon:'🔥', max:20, desc:'Aumenta dano geral.', bonusPerLevel:{ ataquePct:0.006, power:90 }, cost:(lv)=>({ ouro:900+lv*520, gemas: lv>=8?1+Math.floor(lv/5):0 }) },
  couraca_vital: { id:'couraca_vital', nome:'Couraça Vital', icon:'🛡️', max:20, desc:'Aumenta HP e defesa.', bonusPerLevel:{ hpPct:0.008, defesa:2, power:80 }, cost:(lv)=>({ ouro:850+lv*480, gemas: lv>=8?1+Math.floor(lv/6):0 }) },
  sorte_cosmica: { id:'sorte_cosmica', nome:'Sorte Cósmica', icon:'🍀', max:15, desc:'Melhora ouro, drop e qualidade de item.', bonusPerLevel:{ goldPct:0.006, dropPct:0.004, qualityPct:0.003, power:70 }, cost:(lv)=>({ ouro:1100+lv*680, gemas: lv>=5?1+Math.floor(lv/4):0 }) },
  pressa_indle: { id:'pressa_indle', nome:'Pressa Indle', icon:'⚡', max:15, desc:'Aumenta velocidade e evasão.', bonusPerLevel:{ speed:1.4, evasion:0.55, power:75 }, cost:(lv)=>({ ouro:950+lv*610, gemas: lv>=6?1+Math.floor(lv/5):0 }) }
};

const SEASON_REWARDS = [
  { tier:1, xp:80, reward:{ ouro:1200, gemas:3 } },
  { tier:2, xp:220, reward:{ ouro:2600, gemas:6 } },
  { tier:3, xp:520, reward:{ ouro:5200, gemas:10, item:'raro' } },
  { tier:4, xp:1050, reward:{ ouro:9000, gemas:18, item:'lendário' } },
  { tier:5, xp:1900, reward:{ ouro:15000, gemas:30, title:'novato_celeste' } },
  { tier:6, xp:3200, reward:{ ouro:26000, gemas:45, item:'lendário', dust:2 } }
];

const REDEEM_CODES = {
  LAUNCHV30: { ouro:12000, gemas:40, desc:'Pacote de lançamento V30' },
  INDLEVIP: { ouro:30000, gemas:80, item:'lendário', desc:'Pacote VIP de teste' },
  GMEVENT: { ouro:50000, gemas:150, dust:5, desc:'Evento especial GM' }
};

function addBonus(target, bonus, mult = 1) {
  if (!bonus) return target;
  for (const [k,v] of Object.entries(bonus)) target[k] = (target[k] || 0) + v * mult;
  return target;
}

class V30ProgressManager {
  static normalize(player) {
    player.v30 = player.v30 || {};
    player.v30.version = 30;
    player.v30.seasonXp = Math.max(0, Math.floor(player.v30.seasonXp || 0));
    player.v30.seasonClaimed = Array.isArray(player.v30.seasonClaimed) ? player.v30.seasonClaimed : [];
    player.v30.research = player.v30.research || {};
    player.v30.titles = player.v30.titles || { unlocked:['novato_celeste'], equipped:'novato_celeste' };
    player.v30.titles.unlocked = Array.isArray(player.v30.titles.unlocked) ? player.v30.titles.unlocked : ['novato_celeste'];
    if (!player.v30.titles.unlocked.includes('novato_celeste')) player.v30.titles.unlocked.push('novato_celeste');
    if (!TITLES[player.v30.titles.equipped]) player.v30.titles.equipped = player.v30.titles.unlocked[0] || 'novato_celeste';
    player.v30.tower = player.v30.tower || { floor:1, best:0, clears:0 };
    player.v30.tower.floor = Math.max(1, Math.floor(player.v30.tower.floor || 1));
    player.v30.rift = player.v30.rift || { charges:1, lastChargeAt:Date.now(), clears:0 };
    player.v30.rift.charges = Math.max(0, Math.min(5, Math.floor(player.v30.rift.charges || 0)));
    player.v30.mailbox = Array.isArray(player.v30.mailbox) ? player.v30.mailbox : [];
    player.v30.redeemedCodes = Array.isArray(player.v30.redeemedCodes) ? player.v30.redeemedCodes : [];
    player.v30.cosmetics = player.v30.cosmetics || { theme:'cristal', damageSkin:'classic' };
    this.unlockByProgress(player);
    this.ensureWelcomeMail(player);
    this.regenRiftCharge(player);
    return player.v30;
  }

  static ensureWelcomeMail(player) {
    if (player.v30.mailbox.some(m=>m.id==='v30_welcome')) return;
    player.v30.mailbox.unshift({ id:'v30_welcome', title:'Atualização V30', body:'Bem-vindo aos sistemas finais: temporada, torre, fendas, títulos e pesquisa.', reward:{ ouro:3000, gemas:10 }, claimed:false, createdAt:Date.now() });
  }

  static regenRiftCharge(player) {
    const r = player.v30.rift;
    const now = Date.now();
    const elapsed = now - (r.lastChargeAt || now);
    const gained = Math.floor(elapsed / (30 * 60 * 1000));
    if (gained > 0) {
      r.charges = Math.min(5, (r.charges || 0) + gained);
      r.lastChargeAt = now;
    }
  }

  static unlockByProgress(player) {
    const titles = player.v30.titles;
    if ((player.kills||0) >= 100 && !titles.unlocked.includes('cacador_100')) titles.unlocked.push('cacador_100');
    if (((player.stats&&player.stats.bossKills)||0) >= 5 && !titles.unlocked.includes('mestre_dragao')) titles.unlocked.push('mestre_dragao');
    if ((player.power||0) >= 50000 && !titles.unlocked.includes('milionaria_indle')) titles.unlocked.push('milionaria_indle');
  }

  static getBonuses(player) {
    this.normalize(player);
    const bonus = {};
    for (const [id,lvRaw] of Object.entries(player.v30.research || {})) {
      const def = RESEARCH[id];
      const lv = Math.max(0, Math.min(def ? def.max : 0, Math.floor(lvRaw || 0)));
      if (def && lv > 0) addBonus(bonus, def.bonusPerLevel, lv);
    }
    const equipped = TITLES[player.v30.titles.equipped];
    if (equipped) addBonus(bonus, equipped.bonus, 1);
    const tower = player.v30.tower || {};
    addBonus(bonus, { power:(tower.best||0)*45, ataquePct:(tower.best||0)*0.001, hpPct:(tower.best||0)*0.001 }, 1);
    return bonus;
  }

  static powerBonus(player) {
    const b = this.getBonuses(player);
    return Math.floor((b.power||0) + (b.ataquePct||0)*4500 + (b.hpPct||0)*3500 + (b.critico||0)*90 + (b.speed||0)*40 + (b.evasion||0)*75);
  }

  static publicState(player) {
    this.normalize(player);
    const bonuses = this.getBonuses(player);
    return {
      version:30,
      season:{ xp:player.v30.seasonXp, rewards:SEASON_REWARDS, claimed:player.v30.seasonClaimed },
      titles:{ all:Object.values(TITLES), unlocked:player.v30.titles.unlocked, equipped:player.v30.titles.equipped },
      research:{ defs:Object.values(RESEARCH).map(d=>({ id:d.id, nome:d.nome, icon:d.icon, max:d.max, desc:d.desc, bonusPerLevel:d.bonusPerLevel, nextCost:d.cost(player.v30.research[d.id]||0) })), levels:player.v30.research },
      tower:{ floor:player.v30.tower.floor, best:player.v30.tower.best||0, requiredPower:this.towerRequiredPower(player.v30.tower.floor), clears:player.v30.tower.clears||0 },
      rift:{ charges:player.v30.rift.charges, clears:player.v30.rift.clears||0, nextChargeAt:(player.v30.rift.lastChargeAt||Date.now())+30*60*1000 },
      mailbox:player.v30.mailbox.slice(0,20),
      codes:{ redeemed:player.v30.redeemedCodes },
      cosmetics:player.v30.cosmetics,
      bonuses,
      powerBonus:this.powerBonus(player)
    };
  }

  static onKill(player, deadMonster, loot) {
    this.normalize(player);
    const gain = deadMonster.isBoss ? 180 : 16 + Math.floor((deadMonster.nivel||1)*0.8);
    player.v30.seasonXp += gain;
    if (deadMonster.isBoss) {
      player.v30.rift.charges = Math.min(5, (player.v30.rift.charges||0)+1);
      player.v30.mailbox.unshift({ id:'boss_'+Date.now(), title:'Eco do Dragão', body:'Você derrotou um boss e recebeu energia dimensional.', reward:{ gemas:2, ouro:700 }, claimed:false, createdAt:Date.now() });
    }
    this.unlockByProgress(player);
    return gain;
  }

  static towerRequiredPower(floor) { return Math.floor(950 + Math.pow(Math.max(1,floor), 1.72) * 520); }

  static challengeTower(player) {
    this.normalize(player);
    const floor = player.v30.tower.floor;
    const req = this.towerRequiredPower(floor);
    const power = player.power || 0;
    if (power < req) return { ok:false, reason:`Poder insuficiente para a Torre ${floor}. Requer ${req}.`, requiredPower:req, power };
    const gold = 900 + floor * 260;
    const gems = floor % 5 === 0 ? 5 : 1;
    player.ouro = (player.ouro||0)+gold;
    player.gemas = (player.gemas||0)+gems;
    player.cashGems = player.gemas;
    player.v30.seasonXp += 70 + floor * 8;
    player.v30.tower.best = Math.max(player.v30.tower.best||0, floor);
    player.v30.tower.floor = floor + 1;
    player.v30.tower.clears = (player.v30.tower.clears||0)+1;
    return { ok:true, floor, gold, gems, nextFloor:player.v30.tower.floor, requiredPower:this.towerRequiredPower(player.v30.tower.floor) };
  }

  static runRift(player) {
    this.normalize(player);
    if ((player.v30.rift.charges||0) <= 0) return { ok:false, reason:'Sem cargas de Fenda Dimensional.' };
    player.v30.rift.charges -= 1;
    const tier = 1 + Math.floor(((player.v30.tower.best||0)+(player.nivel||1))/15);
    const gold = 1400 + tier * 900 + (player.power||0)*0.03;
    const gems = 3 + Math.min(20, tier);
    const drop = LootManager.createShopDrop(player, tier >= 6 ? 'lendário' : 'raro');
    player.ouro = (player.ouro||0) + Math.floor(gold);
    player.gemas = (player.gemas||0) + gems;
    player.cashGems = player.gemas;
    if (drop) { player.inventario = player.inventario || []; player.inventario.unshift(drop); }
    player.v30.rift.clears = (player.v30.rift.clears||0)+1;
    player.v30.seasonXp += 120 + tier*25;
    return { ok:true, tier, gold:Math.floor(gold), gems, item:drop, charges:player.v30.rift.charges };
  }

  static upgradeResearch(player, id) {
    this.normalize(player);
    const def = RESEARCH[id];
    if (!def) return { ok:false, reason:'Pesquisa inválida.' };
    const lv = Math.max(0, Math.floor(player.v30.research[id]||0));
    if (lv >= def.max) return { ok:false, reason:'Pesquisa no nível máximo.' };
    const cost = def.cost(lv);
    if ((player.ouro||0) < cost.ouro) return { ok:false, reason:'Ouro insuficiente para pesquisar.' };
    if ((player.gemas||0) < cost.gemas) return { ok:false, reason:'Gemas insuficientes para pesquisar.' };
    player.ouro -= cost.ouro;
    player.gemas -= cost.gemas;
    player.cashGems = player.gemas;
    player.v30.research[id] = lv + 1;
    player.v30.seasonXp += 45 + lv*6;
    return { ok:true, id, level:lv+1, cost };
  }

  static equipTitle(player, id) {
    this.normalize(player);
    if (!TITLES[id]) return { ok:false, reason:'Título inválido.' };
    if (!player.v30.titles.unlocked.includes(id)) return { ok:false, reason:'Título ainda não desbloqueado.' };
    player.v30.titles.equipped = id;
    return { ok:true, title:TITLES[id] };
  }

  static claimSeasonReward(player, tier) {
    this.normalize(player);
    const reward = SEASON_REWARDS.find(r=>r.tier === Number(tier));
    if (!reward) return { ok:false, reason:'Recompensa de temporada inválida.' };
    if (player.v30.seasonClaimed.includes(reward.tier)) return { ok:false, reason:'Recompensa já coletada.' };
    if ((player.v30.seasonXp||0) < reward.xp) return { ok:false, reason:'XP de temporada insuficiente.' };
    player.v30.seasonClaimed.push(reward.tier);
    const r = reward.reward;
    player.ouro = (player.ouro||0) + (r.ouro||0);
    player.gemas = (player.gemas||0) + (r.gemas||0);
    player.cashGems = player.gemas;
    if (r.title && !player.v30.titles.unlocked.includes(r.title)) player.v30.titles.unlocked.push(r.title);
    let item = null;
    if (r.item) {
      item = LootManager.createShopDrop(player, r.item);
      if (item) { player.inventario = player.inventario || []; player.inventario.unshift(item); }
    }
    if (r.dust) { player.ascension = player.ascension || {}; player.ascension.dust = (player.ascension.dust||0)+r.dust; }
    return { ok:true, tier:reward.tier, reward:r, item };
  }

  static claimMail(player, id) {
    this.normalize(player);
    const mail = player.v30.mailbox.find(m=>m.id===id);
    if (!mail) return { ok:false, reason:'Mensagem não encontrada.' };
    if (mail.claimed) return { ok:false, reason:'Mensagem já coletada.' };
    mail.claimed = true;
    const r = mail.reward || {};
    player.ouro = (player.ouro||0)+(r.ouro||0);
    player.gemas = (player.gemas||0)+(r.gemas||0);
    player.cashGems = player.gemas;
    if (r.dust) { player.ascension = player.ascension || {}; player.ascension.dust=(player.ascension.dust||0)+r.dust; }
    return { ok:true, mail };
  }

  static claimAllMail(player) {
    this.normalize(player);
    const result = { ok:true, claimed:0, ouro:0, gemas:0, dust:0 };
    for (const mail of player.v30.mailbox) {
      if (mail.claimed) continue;
      mail.claimed = true;
      const r = mail.reward || {};
      result.claimed += 1;
      result.ouro += r.ouro||0;
      result.gemas += r.gemas||0;
      result.dust += r.dust||0;
    }
    player.ouro = (player.ouro||0)+result.ouro;
    player.gemas = (player.gemas||0)+result.gemas;
    player.cashGems = player.gemas;
    if (result.dust) { player.ascension = player.ascension || {}; player.ascension.dust=(player.ascension.dust||0)+result.dust; }
    return result;
  }

  static redeemCode(player, codeRaw) {
    this.normalize(player);
    const code = String(codeRaw||'').trim().toUpperCase();
    const r = REDEEM_CODES[code];
    if (!r) return { ok:false, reason:'Código inválido.' };
    if (player.v30.redeemedCodes.includes(code)) return { ok:false, reason:'Código já resgatado.' };
    player.v30.redeemedCodes.push(code);
    player.ouro = (player.ouro||0)+(r.ouro||0);
    player.gemas = (player.gemas||0)+(r.gemas||0);
    player.cashGems = player.gemas;
    if (r.dust) { player.ascension = player.ascension || {}; player.ascension.dust=(player.ascension.dust||0)+r.dust; }
    let item = null;
    if (r.item) { item = LootManager.createShopDrop(player, r.item); if (item) { player.inventario = player.inventario||[]; player.inventario.unshift(item); } }
    return { ok:true, code, reward:r, item };
  }

  static rerollItem(player, itemId) {
    this.normalize(player);
    const loc = LootManager.findItem(player, itemId);
    if (!loc.item) return { ok:false, reason:'Item não encontrado.' };
    const item = LootManager.enrichItem(loc.item);
    const costGold = 900 + (item.upgradeLevel||0)*180 + (item.powerScore||0)*2;
    const costGems = Math.max(1, Math.floor((item.rollQuality||50)/35));
    if ((player.ouro||0) < costGold) return { ok:false, reason:'Ouro insuficiente para reforjar.' };
    if ((player.gemas||0) < costGems) return { ok:false, reason:'Gemas insuficientes para reforjar.' };
    player.ouro -= costGold;
    player.gemas -= costGems;
    player.cashGems = player.gemas;
    const boost = 0.88 + Math.random()*0.32;
    item.rollQuality = Math.max(1, Math.min(100, Math.floor((item.rollQuality||50)*boost + Math.random()*12)));
    item.variableStats = item.variableStats || {};
    for (const key of ['ataque','defesa','critico','hp','mana']) {
      if ((item.stats && item.stats[key]) || (item.variableStats && item.variableStats[key])) item.variableStats[key] = Math.max(0, Math.floor(((item.variableStats[key]||0) + Math.max(1, (item.stats[key]||0)*0.08)) * (0.85+Math.random()*0.35)));
    }
    loc.set(item);
    LootManager.syncInventoryFlags(player);
    return { ok:true, item:LootManager.enrichItem(item), costGold, costGems };
  }
}

module.exports = V30ProgressManager;
