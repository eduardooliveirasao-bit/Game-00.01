const { ITEM_CATALOG, GAME_CLASSES, GEM_TYPES, MOUNTS } = require('../../shared/classes.js');

const SLOT_ORDER = ['arma', 'anel', 'colar', 'ornamento'];
const RARITY_COLORS = { comum:'#d9dde7', raro:'#55c7ff', 'épico':'#b07cff', 'lendário':'#ffcf5b', 'mítico':'#ff7fbb', boss:'#ff8f3d' };
const RARITY_RANK = ['comum','raro','épico','lendário','mítico','boss'];

const STAT_KEYS = ['ataque','defesa','critico','hp','mana'];
const DROP_RARITY_WEIGHTS = [
  { rarity:'comum', weight:560 },
  { rarity:'raro', weight:280 },
  { rarity:'épico', weight:115 },
  { rarity:'lendário', weight:38 },
  { rarity:'mítico', weight:7 }
];
const DROP_AFFIX_POOL = {
  ataque: ['Feroz','Cruel','Glorioso','Dracônico'],
  defesa: ['Sólido','Guardião','Imutável','Ancestral'],
  critico: ['Preciso','Letal','Sombrio','Celestial'],
  hp: ['Vital','Titânico','Imortal','Colossal'],
  mana: ['Arcano','Sereno','Estelar','Prismático']
};
function randInt(min,max){ return Math.floor(min + Math.random() * (max-min+1)); }
function weightedPick(rows){
  const total = rows.reduce((s,r)=>s+r.weight,0);
  let roll = Math.random()*total;
  for(const row of rows){ roll-=row.weight; if(roll<=0) return row; }
  return rows[rows.length-1];
}
function rollRarity(monster){
  const lvl = Math.max(1, (monster && monster.nivel) || 1);
  const bossBoost = monster && monster.isBoss ? 2.2 : 1;
  const rows = DROP_RARITY_WEIGHTS.map(r => ({
    rarity: r.rarity,
    weight: Math.max(1, Math.floor(r.weight * (rarityRank(r.rarity) <= 1 ? 1 : bossBoost + lvl/120)))
  }));
  return weightedPick(rows).rarity;
}
function rollQuality(rarity, monsterLevel){
  const rank = rarityRank(rarity);
  return Math.min(100, Math.max(1, Math.floor(randInt(45 + rank*7, 82 + rank*5) + Math.min(15, monsterLevel/6))));
}
function rollVariableStats(slot, rarity, monsterLevel){
  const rank = Math.max(0, rarityRank(rarity));
  const quality = rollQuality(rarity, monsterLevel);
  const keysBySlot = {
    arma: ['ataque','critico'],
    anel: ['critico','ataque','mana'],
    colar: ['hp','defesa','mana'],
    ornamento: ['defesa','hp','critico','mana']
  };
  const keys = keysBySlot[slot] || STAT_KEYS;
  const rolls = 1 + Math.min(3, Math.floor((rank + 1) / 2));
  const variableStats = { ataque:0, defesa:0, critico:0, hp:0, mana:0 };
  const affixes = [];
  for(let i=0;i<rolls;i++){
    const key = keys[randInt(0, keys.length-1)];
    const scale = (rank+1) * (quality/100) * (1 + monsterLevel/18);
    let value = key === 'hp' ? randInt(14, 30) : key === 'mana' ? randInt(8, 22) : randInt(2, 8);
    value = Math.max(1, Math.floor(value * scale));
    variableStats[key] += value;
    const names = DROP_AFFIX_POOL[key] || ['Aprimorado'];
    affixes.push({ stat:key, value, nome:names[Math.min(names.length-1, rank)] });
  }
  return { quality, variableStats, affixes };
}

const BOSS_EXCLUSIVE = {
  guerreiro: [
    { nome:'Espada do Dragão Elemental', slot:'arma', icon:'🐉', stats:{ ataque:82, defesa:12, critico:8, hp:90, mana:0 } },
    { nome:'Anel da Chama Dracônica', slot:'anel', icon:'💍', stats:{ ataque:34, defesa:8, critico:20, hp:75, mana:0 } },
    { nome:'Colar do Coração Ígneo', slot:'colar', icon:'📿', stats:{ ataque:28, defesa:16, critico:8, hp:210, mana:0 } },
    { nome:'Asa Ornamental Dracônica', slot:'ornamento', icon:'🪽', stats:{ ataque:24, defesa:36, critico:9, hp:165, mana:0 }, wingVisual:{ name:'Asa Dracônica', color:'#ff8f3d', size:1.35 } }
  ],
  arqueiro: [
    { nome:'Arco da Tempestade Dracônica', slot:'arma', icon:'🐉', stats:{ ataque:78, defesa:6, critico:22, hp:65, mana:0 } },
    { nome:'Anel do Olho Elemental', slot:'anel', icon:'💍', stats:{ ataque:32, defesa:5, critico:27, hp:55, mana:0 } },
    { nome:'Colar da Caçada Celeste', slot:'colar', icon:'📿', stats:{ ataque:30, defesa:12, critico:14, hp:155, mana:0 } },
    { nome:'Pena do Dragão Azul', slot:'ornamento', icon:'🪽', stats:{ ataque:24, defesa:18, critico:24, hp:110, mana:0 }, wingVisual:{ name:'Penas do Dragão Azul', color:'#55c7ff', size:1.25 } }
  ],
  mago: [
    { nome:'Cajado do Dragão Elemental', slot:'arma', icon:'🐉', stats:{ ataque:90, defesa:6, critico:12, hp:55, mana:150 } },
    { nome:'Anel do Núcleo Arcano', slot:'anel', icon:'💍', stats:{ ataque:36, defesa:6, critico:22, hp:65, mana:115 } },
    { nome:'Colar do Sopro Celestial', slot:'colar', icon:'📿', stats:{ ataque:30, defesa:10, critico:9, hp:135, mana:170 } },
    { nome:'Asa Dracônica do Arcanjo', slot:'ornamento', icon:'🪽', stats:{ ataque:28, defesa:18, critico:10, hp:120, mana:140 }, wingVisual:{ name:'Asas Dracônicas do Arcanjo', color:'#78cfff', size:1.45 } }
  ]
};
function rarityRank(r){ const n=RARITY_RANK.indexOf(r); return n < 0 ? 0 : n; }
function gemStats(item){ const total={ataque:0,defesa:0,critico:0,hp:0,mana:0}; for(const gemId of (item.gems||[])){ const g=GEM_TYPES[gemId]; if(!g) continue; for(const k of Object.keys(total)) total[k]+=g.stats[k]||0; } return total; }
function totalStats(item){
  const base=item.stats||{};
  const fixed=item.fixedStats||{};
  const variable=item.variableStats||{};
  const g=gemStats(item);
  const up=Math.max(0, Math.floor(item.upgradeLevel||0));
  const mul=1 + up * 0.08;
  const merged={};
  for(const k of STAT_KEYS){
    merged[k]=(base[k]||0)+(fixed[k]||0)+(variable[k]||0)+(g[k]||0);
  }
  return {
    ataque:Math.floor((merged.ataque||0)*mul + up*2),
    defesa:Math.floor((merged.defesa||0)*mul + up),
    critico:Math.floor((merged.critico||0)*mul + Math.floor(up/2)),
    hp:Math.floor((merged.hp||0)*mul + up*18),
    mana:Math.floor((merged.mana||0)*mul + up*10)
  };
}
function cloneItem(base, monsterLevel, forcedRarity){
  const rarity=forcedRarity || base.raridade || 'comum';
  const roll=rollVariableStats(base.slot, rarity, monsterLevel);
  const sockets=base.sockets || Math.max(1, Math.min(3, 1 + Math.floor(rarityRank(rarity)/2)));
  const fixedStats={
    ataque:(base.stats.ataque||0)+Math.floor(monsterLevel*.6),
    defesa:(base.stats.defesa||0)+Math.floor(monsterLevel*.4),
    critico:(base.stats.critico||0)+Math.floor(monsterLevel*.15),
    hp:(base.stats.hp||0)+Math.floor(monsterLevel*1.8),
    mana:(base.stats.mana||0)+Math.floor(monsterLevel*1.2)
  };
  return {
    id:base.id+'_'+Date.now()+'_'+Math.random().toString(16).slice(2),
    baseId:base.id,
    classeId:base.classeId,
    nome:base.nome,
    slot:base.slot,
    raridade:rarity,
    cor:base.cor,
    icon:base.icon,
    asset:base.asset ? base.asset.replace(/_(comum|raro|épico|lendário|mítico)\.png$/, '_'+rarity+'.png') : `assets/items/${base.slot}_${rarity}.png`,
    requiredLevel:Math.max(1, Math.min(base.requiredLevel||1, Math.floor(monsterLevel*0.85)+1)),
    exclusivoBoss:false,
    sockets,
    gems:[],
    upgradeLevel:0,
    locked:false,
    visual:base.visual||{},
    equipped:false,
    equippedSlot:null,
    rollQuality:roll.quality,
    affixes:roll.affixes,
    fixedStats,
    variableStats:roll.variableStats,
    stats:{} 
  };
}
function cloneBossItem(player, monster){ const list=BOSS_EXCLUSIVE[player.classeId]||BOSS_EXCLUSIVE.mago; const base=list[Math.floor(Math.random()*list.length)]; const level=Math.max(1, monster.nivel||player.nivel||1); return { id:'boss_'+player.classeId+'_'+base.slot+'_'+Date.now()+'_'+Math.random().toString(16).slice(2), baseId:'boss_'+base.slot, classeId:player.classeId, nome:base.nome, slot:base.slot, raridade:'boss', cor:'#ff8f3d', icon:base.icon, asset:`assets/items/${base.slot}_boss.png`, requiredLevel:Math.max(1,Math.floor(level*.65)), exclusivoBoss:true, sockets:3, gems:[], upgradeLevel:0, locked:false, equipped:false, equippedSlot:null, wingVisual:base.wingVisual||null, visual:{glow:'#ff8f3d', wing:!!base.wingVisual, tier:6}, stats:{ ataque:base.stats.ataque+Math.floor(level*1.25), defesa:base.stats.defesa+Math.floor(level*.7), critico:base.stats.critico+Math.floor(level*.16), hp:base.stats.hp+Math.floor(level*3.5), mana:base.stats.mana+Math.floor(level*2.6) } }; }

class LootManager {
  static enrichItem(item){
    if(!item) return null;
    item.rarityColor=RARITY_COLORS[item.raridade]||'#fff';
    if(!item.asset) item.asset=`assets/items/${item.slot}_${item.raridade}.png`;
    item.gems=item.gems||[];
    item.affixes=item.affixes||[];
    item.fixedStats=item.fixedStats||{};
    item.variableStats=item.variableStats||{};
    item.rollQuality=item.rollQuality||50;
    item.upgradeLevel=Math.max(0, Math.floor(item.upgradeLevel||0));
    item.locked=!!item.locked;
    item.sockets=item.sockets||Math.max(1,Math.min(3,1+Math.floor(rarityRank(item.raridade)/2)));
    item.equipped=!!item.equipped;
    item.equippedSlot=item.equippedSlot||null;
    item.totalStats=totalStats(item);
    item.powerScore=this.scoreItem(item);
    item.sellValue=this.sellValue(item);
    return item;
  }
  static getEquippedList(player){ const e=player.equipados||{}; return SLOT_ORDER.map(s=>e[s]).filter(Boolean).map(i=>this.enrichItem({...i})); }
  static scoreItem(item){ const s=totalStats(item); return Math.floor((s.ataque||0)*6+(s.defesa||0)*4+(s.critico||0)*7+(s.hp||0)*.55+(s.mana||0)*.3+rarityRank(item.raridade)*20+(item.exclusivoBoss?85:0)); }
  static sellValue(item){ if(!item) return 0; const score = item.powerScore != null ? item.powerScore : this.scoreItem(item); return Math.max(10, Math.floor(score*.85 + rarityRank(item.raridade)*35 + (item.upgradeLevel||0)*45)); }
  static getVisualMods(player){ const eq=player.equipados||{}; const mods={ weaponGlow:null, aura:null, ringGlow:null, wing:null, itemTier:0 }; for(const slot of SLOT_ORDER){ const it=eq[slot]?this.enrichItem({...eq[slot]}):null; if(!it) continue; mods.itemTier=Math.max(mods.itemTier, rarityRank(it.raridade)); if(slot==='arma') mods.weaponGlow=it.rarityColor; if(slot==='anel') mods.ringGlow=it.rarityColor; if(slot==='colar') mods.aura=it.rarityColor; if(slot==='ornamento' && (it.wingVisual || (it.visual&&it.visual.wing))) mods.wing=it.wingVisual || {name:it.nome,color:it.rarityColor,size:1+rarityRank(it.raridade)*.08}; } return mods; }
  static normalizeMountCollection(player){
    player.mount = player.mount || { id:'lobo_cristalino', level:1 };
    const activeId = player.mount.id || 'lobo_cristalino';
    const list = Array.isArray(player.mountCollection) ? player.mountCollection : [];
    const byId = new Map();
    for(const row of list){ if(row && row.id && MOUNTS[row.id]) byId.set(row.id, { id:row.id, level:Math.max(1, Math.floor(row.level||1)), active:!!row.active, unlockedAt:row.unlockedAt||Date.now() }); }
    if(!byId.has(activeId) && MOUNTS[activeId]) byId.set(activeId, { id:activeId, level:Math.max(1, Math.floor(player.mount.level||1)), active:true, unlockedAt:Date.now() });
    if(!byId.has('lobo_cristalino')) byId.set('lobo_cristalino', { id:'lobo_cristalino', level:1, active:activeId==='lobo_cristalino', unlockedAt:Date.now() });
    for(const row of byId.values()) row.active = row.id === activeId;
    player.mountCollection = Array.from(byId.values());
    return player.mountCollection;
  }
  static mountSingleBonus(base, level){ return { ataque:Math.floor((base.bonus.ataque||0)*(1+level*.12)), hp:Math.floor((base.bonus.hp||0)*(1+level*.15)), power:Math.floor((base.bonus.power||0)+level*35), speed:Number(((base.bonus.speed||1)-1+level*.006).toFixed(3)), defesa:Math.floor(level*1.5+((base.bonus.hp||0)/55)), evasao:Math.floor(Math.max(0,((base.bonus.speed||1)-1)*35)+level*.25) }; }
  static getMount(player){ this.normalizeMountCollection(player); const active=(player.mountCollection||[]).find(m=>m.active)||player.mountCollection[0]||{id:'lobo_cristalino',level:1}; const base=MOUNTS[active.id]||MOUNTS.lobo_cristalino; player.mount={id:base.id,level:active.level}; return {...base, level:active.level, active:true}; }
  static getMountCollection(player){ return this.normalizeMountCollection(player).map(m=>{ const base=MOUNTS[m.id]||MOUNTS.lobo_cristalino; const level=Math.max(1,Math.floor(m.level||1)); const bonus=this.mountSingleBonus(base,level); return {...base, level, active:!!m.active, bonusCalculated:bonus}; }); }
  static getMountBonus(player){ const rows=this.getMountCollection(player); return rows.reduce((sum,m)=>{ const b=m.bonusCalculated||this.mountSingleBonus(m,m.level||1); sum.ataque+=b.ataque||0; sum.hp+=b.hp||0; sum.power+=b.power||0; sum.speed+=b.speed||0; sum.defesa+=b.defesa||0; sum.evasao+=b.evasao||0; return sum; }, {ataque:0,hp:0,power:0,speed:0,defesa:0,evasao:0}); }
  static unlockMount(player,mountId,level){ if(!MOUNTS[mountId]) return {ok:false,reason:'Montaria inválida.'}; this.normalizeMountCollection(player); const current=player.mountCollection.find(m=>m.id===mountId); if(current) current.level=Math.max(current.level||1,Math.floor(level||1)); else player.mountCollection.push({id:mountId,level:Math.max(1,Math.floor(level||1)),active:false,unlockedAt:Date.now()}); return this.activateMount(player,mountId); }
  static activateMount(player,mountId){ if(!MOUNTS[mountId]) return {ok:false,reason:'Montaria inválida.'}; this.normalizeMountCollection(player); const current=player.mountCollection.find(m=>m.id===mountId); if(!current) return {ok:false,reason:'Você ainda não possui esta montaria.'}; for(const m of player.mountCollection) m.active=m.id===mountId; player.mount={id:mountId,level:current.level||1}; player.power=this.calculatePower(player); return {ok:true,mount:this.getMount(player),collection:this.getMountCollection(player),bonus:this.getMountBonus(player)}; }
  static getCharacterAttributes(player){
    const classe=GAME_CLASSES[player.classeId]||{baseStats:{maxHp:100,mana:0,baseDano:10,defesa:5,critico:5,multiplicadorNivel:2}};
    const base=classe.baseStats; const eq=this.getEquippedList(player);
    const gear=eq.reduce((s,it)=>{ const t=totalStats(it); s.ataque+=t.ataque||0; s.defesa+=t.defesa||0; s.critico+=t.critico||0; s.hp+=t.hp||0; s.mana+=t.mana||0; return s; },{ataque:0,defesa:0,critico:0,hp:0,mana:0});
    const mb=this.getMountBonus(player); const level=player.nivel||1;
    const attack=Math.floor((base.baseDano||10)+level*(base.multiplicadorNivel||2)+gear.ataque+mb.ataque);
    const defense=Math.floor((base.defesa||5)+gear.defesa+mb.defesa+level*.8);
    const maxHp=Math.floor((base.maxHp||100)+level*16+gear.hp+mb.hp);
    const maxMana=Math.floor((base.mana||0)+level*6+gear.mana);
    const crit=Math.floor((base.critico||0)+gear.critico);
    const speed=Math.floor(100+mb.speed*100+level*.25);
    const evasion=Math.floor(2+mb.evasao+Math.min(30,speed/25));
    return {attack,defense,maxHp,maxMana,crit,speed,evasion,power:this.calculatePower(player),mountPower:mb.power,mountAttack:mb.ataque,mountHp:mb.hp,mountDefense:mb.defesa};
  }
  static calculatePower(player){ const classe=GAME_CLASSES[player.classeId]||{baseStats:{baseDano:10,defesa:5,critico:5,mana:0}}; const base=classe.baseStats; const gear=this.getEquippedList(player).reduce((s,i)=>s+this.scoreItem(i),0); const mount=this.getMountBonus(player); return Math.floor(120+player.nivel*52+base.baseDano*8+base.defesa*5+base.critico*5+Math.floor((base.mana||0)*.2)+gear+mount.power+mount.ataque*7+mount.defesa*5+mount.evasao*12); }
  static syncInventoryFlags(player){
    player.inventario=player.inventario||[];
    player.equipados=player.equipados||{arma:null,anel:null,colar:null,ornamento:null};
    for(const item of player.inventario){ item.equipped=false; item.equippedSlot=null; this.enrichItem(item); }
    for(const slot of SLOT_ORDER){
      const equipped = player.equipados[slot];
      if(!equipped) continue;
      const invItem = player.inventario.find(i=>i.id===equipped.id);
      if(invItem){
        invItem.equipped=true; invItem.equippedSlot=slot;
        player.equipados[slot]=this.enrichItem({...invItem});
      } else {
        const clone=this.enrichItem({...equipped, equipped:true, equippedSlot:slot});
        player.inventario.unshift(clone);
        player.equipados[slot]=this.enrichItem({...clone});
      }
    }
    return player;
  }
  static getDamageBonus(player){ return this.getEquippedList(player).reduce((s,i)=>s+(totalStats(i).ataque||0),0)+this.getMountBonus(player).ataque; }
  static getCritBonus(player){ return this.getEquippedList(player).reduce((s,i)=>s+(totalStats(i).critico||0),0); }
  static getHpBonus(player){ return this.getEquippedList(player).reduce((s,i)=>s+(totalStats(i).hp||0),0)+this.getMountBonus(player).hp; }
  static getManaBonus(player){ return this.getEquippedList(player).reduce((s,i)=>s+(totalStats(i).mana||0),0); }
  static chooseDrop(player, monster){
    const catalog=ITEM_CATALOG[player.classeId]||[];
    if(!catalog.length) return null;
    const maxLevel=Math.max(1,(monster&&monster.nivel)||player.nivel||1)+6;
    const eligible=catalog.filter(i=>i.requiredLevel<=maxLevel);
    const pool=eligible.length?eligible:catalog;
    const base=pool[Math.floor(Math.random()*pool.length)];
    const rarity=rollRarity(monster);
    return this.enrichItem(cloneItem(base,maxLevel,rarity));
  }
  static compareWithEquipped(player,item){
    if(!item) return null;
    this.syncInventoryFlags(player);
    const enriched=this.enrichItem({...item});
    const current=player.equipados && player.equipados[enriched.slot] ? this.enrichItem({...player.equipados[enriched.slot]}) : null;
    const currentPower=current ? this.scoreItem(current) : 0;
    const newPower=this.scoreItem(enriched);
    return {
      slot: enriched.slot,
      itemId: enriched.id,
      item: enriched,
      current,
      currentPower,
      newPower,
      delta: newPower-currentPower,
      isBetter: newPower > currentPower
    };
  }
  static maybeDropItem(player, monster){ if(monster.isBoss && Math.random()<.72) return this.enrichItem(cloneBossItem(player,monster)); const rate=monster.isBoss?1:(monster.templateId==='skeleton'? .68:.43); if(Math.random()>rate) return null; return this.chooseDrop(player,monster); }
  static grantKillLoot(player, monster){
    const gold=Math.floor(((monster&&monster.goldBase)||10)+(monster.nivel||1)*4+(monster.isBoss?100:0));
    const item=this.maybeDropItem(player,monster);
    let autoEquipSuggestion=null;
    player.ouro=(player.ouro||0)+gold;
    if(monster.isBoss) player.gemas=(player.gemas||0)+Math.max(1,Math.floor((monster.nivel||1)/10));
    player.kills=(player.kills||0)+1;
    player.horda=monster&&monster.horda?monster.horda+1:((player.horda||1)+1);
    player.inventario=player.inventario||[];
    if(item){
      player.inventario.unshift(item);
      player.inventario=player.inventario.slice(0,100);
      autoEquipSuggestion=this.compareWithEquipped(player,item);
    }
    this.syncInventoryFlags(player);
    player.equipadosList=this.getEquippedList(player);
    player.power=this.calculatePower(player);
    return {gold,item,power:player.power,autoEquipSuggestion};
  }
  static equipItem(player,itemId){
    this.syncInventoryFlags(player);
    const idx=player.inventario.findIndex(i=>i.id===itemId);
    if(idx<0) return {ok:false,reason:'Item não encontrado.'};
    const item=this.enrichItem(player.inventario[idx]);
    if(item.classeId!==player.classeId) return {ok:false,reason:'Este item não pertence à sua classe.'};
    if((player.nivel||1)<(item.requiredLevel||1)) return {ok:false,reason:'Nível insuficiente.'};
    const slot=item.slot;
    const current=player.equipados[slot];
    if(current && current.id!==item.id){
      const oldInv = player.inventario.find(i=>i.id===current.id);
      if(oldInv){ oldInv.equipped=false; oldInv.equippedSlot=null; }
    }
    player.inventario[idx].equipped=true;
    player.inventario[idx].equippedSlot=slot;
    player.equipados[slot]=this.enrichItem({...player.inventario[idx]});
    this.syncInventoryFlags(player);
    player.equipadosList=this.getEquippedList(player);
    player.power=this.calculatePower(player);
    return {ok:true,item:player.equipados[slot],previous:current};
  }
  static unequipSlot(player,slot){
    this.syncInventoryFlags(player);
    const item=player.equipados[slot];
    if(!item) return {ok:false,reason:'Nenhum item equipado neste slot.'};
    const invItem=player.inventario.find(i=>i.id===item.id);
    if(invItem){ invItem.equipped=false; invItem.equippedSlot=null; }
    player.equipados[slot]=null;
    this.syncInventoryFlags(player);
    player.equipadosList=this.getEquippedList(player);
    player.power=this.calculatePower(player);
    return {ok:true,item:invItem||item};
  }
  static equipBestFromBag(player){
    this.syncInventoryFlags(player);
    const equippedItems=[];
    for(const slot of SLOT_ORDER){
      const candidates=(player.inventario||[])
        .filter(i=>i.slot===slot&&i.classeId===player.classeId&&(player.nivel||1)>=(i.requiredLevel||1))
        .map(i=>this.enrichItem({...i}))
        .sort((a,b)=>this.scoreItem(b)-this.scoreItem(a));
      const best=candidates[0];
      const current=player.equipados&&player.equipados[slot]?this.enrichItem({...player.equipados[slot]}):null;
      if(best && (!current || this.scoreItem(best)>this.scoreItem(current))){ const res=this.equipItem(player,best.id); if(res.ok) equippedItems.push(res.item); }
    }
    return {equippedItems};
  }
  static sellItem(player,itemId){
    this.syncInventoryFlags(player);
    const idx=(player.inventario||[]).findIndex(i=>i.id===itemId);
    if(idx<0) return {ok:false,reason:'Item não encontrado.'};
    const item=this.enrichItem(player.inventario[idx]);
    if(item.equipped && item.slot && player.equipados[item.slot] && player.equipados[item.slot].id===item.id) player.equipados[item.slot]=null;
    const gold=this.sellValue(item);
    player.inventario.splice(idx,1);
    player.ouro=(player.ouro||0)+gold;
    this.syncInventoryFlags(player);
    player.power=this.calculatePower(player);
    return {ok:true,item,gold};
  }
  static sellAll(player){
    this.syncInventoryFlags(player);
    const keep=[]; let gold=0; let sold=0;
    for(const item of (player.inventario||[])){
      if(item.equipped || item.locked) { keep.push(item); continue; }
      gold+=this.sellValue(item); sold+=1;
    }
    player.inventario=keep;
    player.ouro=(player.ouro||0)+gold;
    this.syncInventoryFlags(player);
    player.power=this.calculatePower(player);
    return {ok:true,sold,gold};
  }
  static findItem(player,itemId){ this.syncInventoryFlags(player); const inv=player.inventario||[]; const idx=inv.findIndex(i=>i.id===itemId); if(idx>=0) return {item:inv[idx],location:'bag',set:(v)=>{inv[idx]=v;}}; for(const slot of SLOT_ORDER){ if(player.equipados&&player.equipados[slot]&&player.equipados[slot].id===itemId) return {item:player.equipados[slot],location:'equipped',set:(v)=>{player.equipados[slot]=v;}}; } return {item:null}; }
  static insertGem(player,itemId,gemId){ if(!GEM_TYPES[gemId]) return {ok:false,reason:'Gema inválida.'}; if((player.gemas||0)<=0) return {ok:false,reason:'Você precisa de gemas para lapidar o item.'}; const loc=this.findItem(player,itemId); if(!loc.item) return {ok:false,reason:'Item não encontrado.'}; const item=this.enrichItem(loc.item); if((item.gems||[]).length >= (item.sockets||1)) return {ok:false,reason:'Todos os encaixes já estão ocupados.'}; item.gems.push(gemId); player.gemas-=1; loc.set(item); if(item.equipped && item.slot && player.equipados && player.equipados[item.slot] && player.equipados[item.slot].id===item.id) player.equipados[item.slot]=this.enrichItem({...item}); player.power=this.calculatePower(player); return {ok:true,item,gem:GEM_TYPES[gemId],location:loc.location}; }
  static createShopDrop(player, rarityMin='raro'){
    const rank = (r)=>rarityRank(r);
    const min = rank(rarityMin);
    const catalog = ITEM_CATALOG[player.classeId] || [];
    const pool = catalog.filter(i => rank(i.raridade) >= min && (player.nivel||1) >= Math.max(1, (i.requiredLevel||1)-12));
    const chosenPool = pool.length ? pool : catalog;
    if(!chosenPool.length) return null;
    const base = chosenPool[Math.floor(Math.random()*chosenPool.length)];
    const item = cloneItem(base, Math.max(1, (player.nivel||1)+8));
    if(min >= rank('lendário') && rank(item.raridade) < rank('lendário')){
      item.raridade = Math.random() < .35 ? 'mítico' : 'lendário';
      item.asset = `assets/items/${item.slot}_${item.raridade}.png`;
      item.sockets = item.raridade === 'mítico' ? 3 : 2;
    }
    return this.enrichItem(item);
  }
  static upgradeItem(player,itemId){
    this.syncInventoryFlags(player);
    const loc=this.findItem(player,itemId);
    if(!loc.item) return {ok:false,reason:'Item não encontrado.'};
    const item=this.enrichItem(loc.item);
    const currentLevel=Math.max(0, Math.floor(item.upgradeLevel||0));
    if(currentLevel>=15) return {ok:false,reason:'Este item já está no nível máximo de melhoria.'};
    const costGold=Math.floor(220 + Math.pow(currentLevel+1, 1.65)*145 + rarityRank(item.raridade)*180);
    const costGems=currentLevel>=5 ? Math.ceil((currentLevel-4)/3) : 0;
    if((player.ouro||0)<costGold) return {ok:false,reason:'Ouro insuficiente para melhorar o item.'};
    if((player.gemas||0)<costGems) return {ok:false,reason:'Gemas insuficientes para esta melhoria.'};
    player.ouro-=costGold;
    player.gemas=(player.gemas||0)-costGems;
    item.upgradeLevel=currentLevel+1;
    loc.set(item);
    if(item.equipped && item.slot && player.equipados && player.equipados[item.slot] && player.equipados[item.slot].id===item.id) player.equipados[item.slot]=this.enrichItem({...item});
    this.syncInventoryFlags(player);
    player.power=this.calculatePower(player);
    return {ok:true,item:this.enrichItem(item),costGold,costGems};
  }
  static toggleLockItem(player,itemId){
    this.syncInventoryFlags(player);
    const loc=this.findItem(player,itemId);
    if(!loc.item) return {ok:false,reason:'Item não encontrado.'};
    const item=this.enrichItem(loc.item);
    item.locked=!item.locked;
    loc.set(item);
    if(item.equipped && item.slot && player.equipados && player.equipados[item.slot] && player.equipados[item.slot].id===item.id) player.equipados[item.slot]=this.enrichItem({...item});
    this.syncInventoryFlags(player);
    return {ok:true,item:this.enrichItem(item)};
  }
  static upgradeMount(player){ const active=this.getMount(player); const cost=150*(active.level||1); if((player.ouro||0)<cost) return {ok:false,reason:'Ouro insuficiente para treinar a montaria.'}; player.ouro-=cost; const row=(player.mountCollection||[]).find(m=>m.id===active.id); if(row) row.level=(row.level||1)+1; player.mount={id:active.id,level:(row&&row.level)||((active.level||1)+1)}; player.power=this.calculatePower(player); return {ok:true,mount:this.getMount(player),collection:this.getMountCollection(player),bonus:this.getMountBonus(player),cost}; }
}
module.exports=LootManager;
