const LootManager = require('./LootManager');
const LevelManager = require('./LevelManager');

const RUNE_NODES = {
  furia: { id:'furia', nome:'Runa da Fúria', icon:'🔥', max:30, desc:'Aumenta ataque e dano.', bonusPerLevel:{ ataquePct:0.004, power:85 }, cost:(lv)=>({ essence:25+lv*12, ouro:1200+lv*420 }) },
  vitalidade: { id:'vitalidade', nome:'Runa Vital', icon:'💚', max:30, desc:'Aumenta HP e defesa.', bonusPerLevel:{ hpPct:0.005, defesa:1.6, power:80 }, cost:(lv)=>({ essence:22+lv*11, ouro:1100+lv*390 }) },
  fortuna: { id:'fortuna', nome:'Runa da Fortuna', icon:'🍀', max:25, desc:'Aumenta ouro e drop.', bonusPerLevel:{ goldPct:0.0035, dropPct:0.0025, qualityPct:0.002, power:65 }, cost:(lv)=>({ essence:30+lv*14, ouro:1500+lv*520 }) },
  agilidade: { id:'agilidade', nome:'Runa Ágil', icon:'⚡', max:25, desc:'Aumenta velocidade e evasão.', bonusPerLevel:{ speed:1.1, evasion:0.45, power:70 }, cost:(lv)=>({ essence:28+lv*13, ouro:1300+lv*470 }) }
};

const CONTRACTS = {
  slime_hunt: { id:'slime_hunt', nome:'Contrato: Slimes Verdes', icon:'🟢', target:'slime', need:30, reward:{ ouro:4200, gemas:4, essence:40, honor:12 } },
  skeleton_hunt: { id:'skeleton_hunt', nome:'Contrato: Ossos Antigos', icon:'💀', target:'skeleton', need:20, reward:{ ouro:6200, gemas:6, essence:60, honor:18 } },
  dragon_hunt: { id:'dragon_hunt', nome:'Contrato: Dragão Elemental', icon:'🐉', target:'dragon', need:2, reward:{ ouro:18000, gemas:20, essence:160, honor:55, item:'lendário' } }
};

const COSMETICS = {
  classic: { id:'classic', nome:'Clássico', icon:'✨', desc:'Visual padrão.', bonus:{ power:0 } },
  celestial: { id:'celestial', nome:'Aura Celestial', icon:'🪽', desc:'Aura azul no palco e números de dano brilhantes.', bonus:{ power:650, manaPct:0.02 } },
  draconic: { id:'draconic', nome:'Aura Dracônica', icon:'🐲', desc:'Energia laranja de boss.', bonus:{ power:900, ataquePct:0.01 } },
  emerald: { id:'emerald', nome:'Aura Esmeralda', icon:'💚', desc:'Tema verde de caçador.', bonus:{ power:520, hpPct:0.015 } }
};

const ALCHEMY = {
  elixir_power: { id:'elixir_power', nome:'Elixir de Poder', icon:'🧪', desc:'+6% ATQ por 30 min.', cost:{ essence:75, gemas:2 }, buff:{ id:'power', expiresMs:30*60*1000, bonus:{ ataquePct:0.06, power:1200 } } },
  elixir_gold: { id:'elixir_gold', nome:'Elixir Dourado', icon:'🍯', desc:'+12% ouro por 30 min.', cost:{ essence:55, gemas:1 }, buff:{ id:'gold', expiresMs:30*60*1000, bonus:{ goldPct:0.12, power:250 } } },
  elixir_drop: { id:'elixir_drop', nome:'Elixir da Sorte', icon:'🍀', desc:'+6% drop e qualidade por 30 min.', cost:{ essence:95, gemas:3 }, buff:{ id:'drop', expiresMs:30*60*1000, bonus:{ dropPct:0.06, qualityPct:0.04, power:400 } } }
};

const MILESTONES = [
  { id:'m1', nome:'Primeiro Marco V40', need:{ power:50000 }, reward:{ ouro:15000, gemas:20, essence:100 } },
  { id:'m2', nome:'Veterano do Reino', need:{ kills:500 }, reward:{ ouro:30000, gemas:35, honor:80 } },
  { id:'m3', nome:'Matador de Dragões', need:{ bosses:15 }, reward:{ ouro:65000, gemas:80, essence:350, cosmetic:'draconic' } },
  { id:'m4', nome:'Lenda V40', need:{ power:200000 }, reward:{ ouro:150000, gemas:200, essence:900, cosmetic:'celestial' } }
];

function addBonus(target, bonus, mult = 1) { if (!bonus) return target; for (const [k,v] of Object.entries(bonus)) target[k] = (target[k] || 0) + v * mult; return target; }
function todayKey(){ return new Date().toISOString().slice(0,10); }

class V40ProgressManager {
  static normalize(player) {
    player.v40 = player.v40 || {};
    const v = player.v40;
    v.version = 40;
    v.essence = Math.max(0, Math.floor(v.essence || 0));
    v.honor = Math.max(0, Math.floor(v.honor || 0));
    v.raid = v.raid || { energy:3, lastEnergyAt:Date.now(), damage:0, bestDamage:0, level:1 };
    v.guild = v.guild || { name:'Ordem Indle', level:1, contribution:0, dailyKey:null };
    v.runes = v.runes || {};
    v.arena = v.arena || { rating:1000, wins:0, losses:0, dailyKey:null, tickets:5 };
    v.contracts = v.contracts || { day:null, progress:{}, claimed:[] };
    if (v.contracts.day !== todayKey()) v.contracts = { day:todayKey(), progress:{}, claimed:[] };
    v.buffs = Array.isArray(v.buffs) ? v.buffs : [];
    v.cosmetics = v.cosmetics || { unlocked:['classic'], equipped:'classic' };
    if (!v.cosmetics.unlocked.includes('classic')) v.cosmetics.unlocked.push('classic');
    if (!COSMETICS[v.cosmetics.equipped]) v.cosmetics.equipped = 'classic';
    v.petBond = v.petBond || { level:0, xp:0 };
    v.milestones = Array.isArray(v.milestones) ? v.milestones : [];
    this.regenRaidEnergy(player);
    this.regenArenaTickets(player);
    this.cleanupBuffs(player);
    return v;
  }

  static regenRaidEnergy(player) {
    const r = player.v40.raid;
    const now = Date.now();
    const gained = Math.floor((now - (r.lastEnergyAt || now)) / (20*60*1000));
    if (gained > 0) { r.energy = Math.min(5, (r.energy||0)+gained); r.lastEnergyAt = now; }
  }
  static regenArenaTickets(player) {
    const a = player.v40.arena;
    const day = todayKey();
    if (a.dailyKey !== day) { a.dailyKey = day; a.tickets = 5; }
  }
  static cleanupBuffs(player) { const now = Date.now(); player.v40.buffs = (player.v40.buffs||[]).filter(b => !b.expiresAt || b.expiresAt > now); }

  static getBonuses(player) {
    this.normalize(player);
    const bonus = {};
    const v = player.v40;
    for (const [id,lvRaw] of Object.entries(v.runes||{})) {
      const def = RUNE_NODES[id]; if (!def) continue;
      const lv = Math.max(0, Math.min(def.max, Math.floor(lvRaw||0)));
      addBonus(bonus, def.bonusPerLevel, lv);
    }
    addBonus(bonus, { power:(v.guild.level||1)*260, ataquePct:(v.guild.level||1)*0.0012, hpPct:(v.guild.level||1)*0.001 }, 1);
    addBonus(bonus, { power:Math.floor((v.honor||0)*2.8), ataquePct:Math.min(0.07,(v.honor||0)*0.00002) }, 1);
    addBonus(bonus, { power:(v.petBond.level||0)*150, ataquePct:(v.petBond.level||0)*0.001, hpPct:(v.petBond.level||0)*0.0012 }, 1);
    const cosmetic = COSMETICS[v.cosmetics.equipped]; if (cosmetic) addBonus(bonus, cosmetic.bonus, 1);
    for (const buff of (v.buffs||[])) addBonus(bonus, buff.bonus, 1);
    return bonus;
  }

  static powerBonus(player) { const b=this.getBonuses(player); return Math.floor((b.power||0)+(b.ataquePct||0)*6000+(b.hpPct||0)*4500+(b.goldPct||0)*1100+(b.dropPct||0)*1600+(b.qualityPct||0)*1400+(b.defesa||0)*50+(b.speed||0)*35+(b.evasion||0)*70); }

  static publicState(player) {
    this.normalize(player);
    const v = player.v40;
    return {
      version:40,
      essence:v.essence,
      honor:v.honor,
      bonuses:this.getBonuses(player),
      powerBonus:this.powerBonus(player),
      raid:{ ...v.raid, bossHp:this.raidBossHp(player), nextEnergyAt:(v.raid.lastEnergyAt||Date.now())+20*60*1000 },
      guild:{ ...v.guild, nextCost:this.guildCost(v.guild.level||1) },
      runes:{ defs:Object.values(RUNE_NODES).map(d=>({ id:d.id,nome:d.nome,icon:d.icon,max:d.max,desc:d.desc,bonusPerLevel:d.bonusPerLevel,nextCost:d.cost(v.runes[d.id]||0) })), levels:v.runes },
      arena:v.arena,
      contracts:{ defs:Object.values(CONTRACTS), progress:v.contracts.progress, claimed:v.contracts.claimed, day:v.contracts.day },
      alchemy:Object.values(ALCHEMY).map(a=>({ id:a.id,nome:a.nome,icon:a.icon,desc:a.desc,cost:a.cost,buff:a.buff })),
      buffs:v.buffs,
      cosmetics:{ all:Object.values(COSMETICS), unlocked:v.cosmetics.unlocked, equipped:v.cosmetics.equipped },
      petBond:v.petBond,
      milestones:MILESTONES.map(m=>({ ...m, claimed:v.milestones.includes(m.id), ready:this.milestoneReady(player,m) }))
    };
  }

  static onKill(player, deadMonster, loot) {
    this.normalize(player);
    const v = player.v40;
    v.essence += deadMonster.isBoss ? 18 + Math.floor((deadMonster.nivel||1)/2) : 2 + Math.floor((deadMonster.nivel||1)/8);
    v.honor += deadMonster.isBoss ? 5 : 1;
    if (CONTRACTS[deadMonster.templateId + '_hunt']) {}
    for (const c of Object.values(CONTRACTS)) if (c.target === deadMonster.templateId) v.contracts.progress[c.id] = (v.contracts.progress[c.id]||0)+1;
    v.petBond.xp += deadMonster.isBoss ? 24 : 3;
    while (v.petBond.xp >= this.petBondNeed(v.petBond.level)) { v.petBond.xp -= this.petBondNeed(v.petBond.level); v.petBond.level += 1; }
    return { essence:v.essence, honor:v.honor };
  }

  static petBondNeed(level){ return 80 + level*35; }
  static raidBossHp(player){ return Math.floor(300000 + Math.pow((player.v40&&player.v40.raid&&player.v40.raid.level)||1,1.75)*65000); }
  static attackRaid(player){
    this.normalize(player); const r=player.v40.raid; if ((r.energy||0)<=0) return {ok:false,reason:'Sem energia de raid.'};
    r.energy-=1; const hp=this.raidBossHp(player); const dmg=Math.floor((player.power||1000)*(0.22+Math.random()*0.18)+((player.nivel||1)*200));
    r.damage=(r.damage||0)+dmg; r.bestDamage=Math.max(r.bestDamage||0,dmg);
    const reward={ ouro:Math.floor(dmg*0.035), gemas:Math.max(1,Math.floor(dmg/50000)), essence:Math.max(8,Math.floor(dmg/12000)), honor:Math.max(3,Math.floor(dmg/60000)) };
    let killed=false; let item=null;
    if (r.damage>=hp) { killed=true; r.level=(r.level||1)+1; r.damage=0; reward.ouro+=25000; reward.gemas+=25; reward.essence+=180; reward.honor+=80; item=LootManager.createShopDrop(player,'lendário'); if(item){player.inventario=player.inventario||[];player.inventario.unshift(item);} }
    this.grantReward(player,reward); return {ok:true,damage:dmg,reward,killed,item,raid:r};
  }

  static guildCost(level){ return { ouro: 7000 + level*4500, gemas: level>=8 ? 3+Math.floor(level/4) : 0 }; }
  static contributeGuild(player){
    this.normalize(player); const g=player.v40.guild; const cost=this.guildCost(g.level||1);
    if((player.ouro||0)<cost.ouro) return {ok:false,reason:'Ouro insuficiente para contribuir com a Ordem.'};
    if((player.gemas||0)<cost.gemas) return {ok:false,reason:'Gemas insuficientes para contribuir com a Ordem.'};
    player.ouro-=cost.ouro; player.gemas-=cost.gemas; player.cashGems=player.gemas; g.contribution=(g.contribution||0)+1;
    if(g.contribution>=3+Math.floor((g.level||1)/3)){ g.level+=1; g.contribution=0; }
    return {ok:true,guild:g,cost};
  }

  static upgradeRune(player,id){
    this.normalize(player); const def=RUNE_NODES[id]; if(!def) return {ok:false,reason:'Runa inválida.'};
    const lv=Math.max(0,Math.floor(player.v40.runes[id]||0)); if(lv>=def.max) return {ok:false,reason:'Runa no nível máximo.'};
    const cost=def.cost(lv); if((player.v40.essence||0)<cost.essence) return {ok:false,reason:'Essência insuficiente.'}; if((player.ouro||0)<cost.ouro) return {ok:false,reason:'Ouro insuficiente.'};
    player.v40.essence-=cost.essence; player.ouro-=cost.ouro; player.v40.runes[id]=lv+1; return {ok:true,id,level:lv+1,cost};
  }

  static claimContract(player,id){
    this.normalize(player); const c=CONTRACTS[id]; if(!c) return {ok:false,reason:'Contrato inválido.'};
    if(player.v40.contracts.claimed.includes(id)) return {ok:false,reason:'Contrato já coletado.'};
    const progress=player.v40.contracts.progress[id]||0; if(progress<c.need) return {ok:false,reason:'Contrato incompleto.'};
    player.v40.contracts.claimed.push(id); this.grantReward(player,c.reward); let item=null; if(c.reward.item){ item=LootManager.createShopDrop(player,c.reward.item); if(item){player.inventario=player.inventario||[];player.inventario.unshift(item);} }
    return {ok:true,contract:c,item};
  }

  static runArena(player){
    this.normalize(player); const a=player.v40.arena; if((a.tickets||0)<=0) return {ok:false,reason:'Sem tickets de arena hoje.'};
    a.tickets-=1; const enemyPower=Math.floor((player.power||1000)*(0.82+Math.random()*0.44)); const win=(player.power||0)*(0.92+Math.random()*0.25)>=enemyPower;
    const delta=win?18+Math.floor(Math.random()*12):-(8+Math.floor(Math.random()*9)); a.rating=Math.max(600,(a.rating||1000)+delta); if(win)a.wins=(a.wins||0)+1; else a.losses=(a.losses||0)+1;
    const reward={ ouro:win?7500:2500, gemas:win?5:1, honor:win?22:6, essence:win?55:15 }; this.grantReward(player,reward); return {ok:true,win,enemyPower,delta,reward,arena:a};
  }

  static craftAlchemy(player,id){
    this.normalize(player); const a=ALCHEMY[id]; if(!a) return {ok:false,reason:'Receita inválida.'}; const c=a.cost;
    if((player.v40.essence||0)<(c.essence||0)) return {ok:false,reason:'Essência insuficiente.'}; if((player.gemas||0)<(c.gemas||0)) return {ok:false,reason:'Gemas insuficientes.'};
    player.v40.essence-=c.essence||0; player.gemas-=c.gemas||0; player.cashGems=player.gemas;
    player.v40.buffs=player.v40.buffs.filter(b=>b.id!==a.buff.id); player.v40.buffs.push({ id:a.buff.id, nome:a.nome, icon:a.icon, bonus:a.buff.bonus, expiresAt:Date.now()+a.buff.expiresMs });
    return {ok:true,alchemy:a,buffs:player.v40.buffs};
  }

  static equipCosmetic(player,id){ this.normalize(player); if(!COSMETICS[id]) return {ok:false,reason:'Cosmético inválido.'}; if(!player.v40.cosmetics.unlocked.includes(id)) return {ok:false,reason:'Cosmético bloqueado.'}; player.v40.cosmetics.equipped=id; return {ok:true,cosmetic:COSMETICS[id]}; }
  static claimMilestone(player,id){ this.normalize(player); const m=MILESTONES.find(x=>x.id===id); if(!m) return {ok:false,reason:'Marco inválido.'}; if(player.v40.milestones.includes(id)) return {ok:false,reason:'Marco já coletado.'}; if(!this.milestoneReady(player,m)) return {ok:false,reason:'Marco ainda não concluído.'}; player.v40.milestones.push(id); this.grantReward(player,m.reward); if(m.reward.cosmetic&&!player.v40.cosmetics.unlocked.includes(m.reward.cosmetic)) player.v40.cosmetics.unlocked.push(m.reward.cosmetic); return {ok:true,milestone:m}; }
  static milestoneReady(player,m){ const n=m.need||{}; if(n.power && (player.power||0)<n.power) return false; if(n.kills && (player.kills||0)<n.kills) return false; if(n.bosses && ((player.stats&&player.stats.bossKills)||0)<n.bosses) return false; return true; }
  static grantReward(player,r){ player.ouro=(player.ouro||0)+(r.ouro||0); player.gemas=(player.gemas||0)+(r.gemas||0); player.cashGems=player.gemas; player.v40.essence=(player.v40.essence||0)+(r.essence||0); player.v40.honor=(player.v40.honor||0)+(r.honor||0); }
}

module.exports = V40ProgressManager;
