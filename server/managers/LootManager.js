const { ITEM_CATALOG, GAME_CLASSES, GEM_TYPES, MOUNTS } = require('../../shared/classes.js');

const SLOT_ORDER = ['arma', 'anel', 'colar', 'ornamento'];
const RARITY_COLORS = { comum:'#d9dde7', raro:'#55c7ff', 'épico':'#b07cff', 'lendário':'#ffcf5b', 'mítico':'#ff7fbb', boss:'#ff8f3d' };
const RARITY_RANK = ['comum','raro','épico','lendário','mítico','boss'];
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
  const g=gemStats(item);
  const up=Math.max(0, Math.floor(item.upgradeLevel||0));
  const mul=1 + up * 0.08;
  return {
    ataque:Math.floor(((base.ataque||0)+g.ataque)*mul + up*2),
    defesa:Math.floor(((base.defesa||0)+g.defesa)*mul + up),
    critico:Math.floor(((base.critico||0)+g.critico)*mul + Math.floor(up/2)),
    hp:Math.floor(((base.hp||0)+g.hp)*mul + up*18),
    mana:Math.floor(((base.mana||0)+g.mana)*mul + up*10)
  };
}
function cloneItem(base, monsterLevel){ const rarity=base.raridade||'comum'; const sockets=base.sockets || Math.max(1, Math.min(3, 1 + Math.floor(rarityRank(rarity)/2))); return { id:base.id+'_'+Date.now()+'_'+Math.random().toString(16).slice(2), baseId:base.id, classeId:base.classeId, nome:base.nome, slot:base.slot, raridade:rarity, cor:base.cor, icon:base.icon, asset:base.asset || `assets/items/${base.slot}_${rarity}.png`, requiredLevel:base.requiredLevel, exclusivoBoss:false, sockets, gems:[], upgradeLevel:0, locked:false, visual:base.visual||{}, equipped:false, equippedSlot:null, stats:{ ataque:(base.stats.ataque||0)+Math.floor(monsterLevel*.6), defesa:(base.stats.defesa||0)+Math.floor(monsterLevel*.4), critico:(base.stats.critico||0)+Math.floor(monsterLevel*.15), hp:(base.stats.hp||0)+Math.floor(monsterLevel*1.8), mana:(base.stats.mana||0)+Math.floor(monsterLevel*1.2) } }; }
function cloneBossItem(player, monster){ const list=BOSS_EXCLUSIVE[player.classeId]||BOSS_EXCLUSIVE.mago; const base=list[Math.floor(Math.random()*list.length)]; const level=Math.max(1, monster.nivel||player.nivel||1); return { id:'boss_'+player.classeId+'_'+base.slot+'_'+Date.now()+'_'+Math.random().toString(16).slice(2), baseId:'boss_'+base.slot, classeId:player.classeId, nome:base.nome, slot:base.slot, raridade:'boss', cor:'#ff8f3d', icon:base.icon, asset:`assets/items/${base.slot}_boss.png`, requiredLevel:Math.max(1,Math.floor(level*.65)), exclusivoBoss:true, sockets:3, gems:[], upgradeLevel:0, locked:false, equipped:false, equippedSlot:null, wingVisual:base.wingVisual||null, visual:{glow:'#ff8f3d', wing:!!base.wingVisual, tier:6}, stats:{ ataque:base.stats.ataque+Math.floor(level*1.25), defesa:base.stats.defesa+Math.floor(level*.7), critico:base.stats.critico+Math.floor(level*.16), hp:base.stats.hp+Math.floor(level*3.5), mana:base.stats.mana+Math.floor(level*2.6) } }; }

class LootManager {
  static enrichItem(item){
    if(!item) return null;
    item.rarityColor=RARITY_COLORS[item.raridade]||'#fff';
    if(!item.asset) item.asset=`assets/items/${item.slot}_${item.raridade}.png`;
    item.gems=item.gems||[];
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
  static getVisualMods(player){ const eq=player.equipados||{}; const mods={ weaponGlow:null, aura:null, ringGlow:null, wing:null, itemTier:0, mount:this.getMount(player) }; for(const slot of SLOT_ORDER){ const it=eq[slot]?this.enrichItem({...eq[slot]}):null; if(!it) continue; mods.itemTier=Math.max(mods.itemTier, rarityRank(it.raridade)); if(slot==='arma') mods.weaponGlow=it.rarityColor; if(slot==='anel') mods.ringGlow=it.rarityColor; if(slot==='colar') mods.aura=it.rarityColor; if(slot==='ornamento' && (it.wingVisual || (it.visual&&it.visual.wing))) mods.wing=it.wingVisual || {name:it.nome,color:it.rarityColor,size:1+rarityRank(it.raridade)*.08}; } return mods; }
  static getMount(player){ const id=(player.mount&&player.mount.id)||'lobo_cristalino'; const base=MOUNTS[id]||MOUNTS.lobo_cristalino; return {...base, level:(player.mount&&player.mount.level)||1}; }
  static getMountBonus(player){ const mount=this.getMount(player); const level=mount.level||1; return { ataque:Math.floor((mount.bonus.ataque||0)*(1+level*.12)), hp:Math.floor((mount.bonus.hp||0)*(1+level*.15)), power:(mount.bonus.power||0)+level*35 }; }
  static calculatePower(player){ const classe=GAME_CLASSES[player.classeId]||{baseStats:{baseDano:10,defesa:5,critico:5,mana:0}}; const base=classe.baseStats; const gear=this.getEquippedList(player).reduce((s,i)=>s+this.scoreItem(i),0); const mount=this.getMountBonus(player); return Math.floor(120+player.nivel*52+base.baseDano*8+base.defesa*5+base.critico*5+Math.floor((base.mana||0)*.2)+gear+mount.power); }
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
  static chooseDrop(player, monster){ const catalog=ITEM_CATALOG[player.classeId]||[]; if(!catalog.length) return null; const maxLevel=Math.max(1,(monster&&monster.nivel)||player.nivel||1)+6; const eligible=catalog.filter(i=>i.requiredLevel<=maxLevel); const pool=eligible.length?eligible:catalog; return this.enrichItem(cloneItem(pool[Math.floor(Math.random()*pool.length)],maxLevel)); }
  static maybeDropItem(player, monster){ if(monster.isBoss && Math.random()<.72) return this.enrichItem(cloneBossItem(player,monster)); const rate=monster.isBoss?1:(monster.templateId==='skeleton'? .68:.43); if(Math.random()>rate) return null; return this.chooseDrop(player,monster); }
  static grantKillLoot(player, monster){ const gold=Math.floor(((monster&&monster.goldBase)||10)+(monster.nivel||1)*4+(monster.isBoss?100:0)); const item=this.maybeDropItem(player,monster); player.ouro=(player.ouro||0)+gold; if(monster.isBoss) player.gemas=(player.gemas||0)+Math.max(1,Math.floor((monster.nivel||1)/10)); player.kills=(player.kills||0)+1; player.horda=monster&&monster.horda?monster.horda+1:((player.horda||1)+1); player.inventario=player.inventario||[]; if(item){ player.inventario.unshift(item); player.inventario=player.inventario.slice(0,100); } this.syncInventoryFlags(player); player.equipadosList=this.getEquippedList(player); player.power=this.calculatePower(player); return {gold,item,power:player.power}; }
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
  static upgradeMount(player){ player.mount=player.mount||{id:'lobo_cristalino',level:1}; const cost=150*player.mount.level; if((player.ouro||0)<cost) return {ok:false,reason:'Ouro insuficiente para treinar a montaria.'}; player.ouro-=cost; player.mount.level+=1; if(player.mount.level>=8 && player.nivel>=10) player.mount.id='grifo_dourado'; if(player.mount.level>=16 && player.nivel>=25) player.mount.id='dragao_mirim'; return {ok:true,mount:this.getMount(player),cost}; }
}
module.exports=LootManager;
