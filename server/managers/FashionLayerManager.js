const SETS = {
  cabelo_prata: { id:'cabelo_prata', nome:'Cabelo Prata Rúnico', layer:'hair', icon:'🧝', bonus:{ wisdom:2, agility:1 } },
  cabelo_sombra: { id:'cabelo_sombra', nome:'Cabelo da Sombra', layer:'hair', icon:'🖤', bonus:{ agility:3 } },
  armadura_ferro_runa: { id:'armadura_ferro_runa', nome:'Armadura de Ferro Rúnico', layer:'outfit', icon:'🛡️', bonus:{ defesa:18, hp:90, vitality:2 } },
  traje_arcano: { id:'traje_arcano', nome:'Traje Arcano Azul', layer:'outfit', icon:'🔷', bonus:{ ataquePct:0.03, mana:120, wisdom:3 } },
  espada_lua: { id:'espada_lua', nome:'Lâmina da Lua Partida', layer:'weapon', icon:'🌙', bonus:{ ataque:32, critico:3, strength:2 } },
  arco_esmeralda: { id:'arco_esmeralda', nome:'Arco Esmeralda', layer:'weapon', icon:'🏹', bonus:{ ataque:24, critico:6, agility:2 } },
  cajado_estelar: { id:'cajado_estelar', nome:'Cajado Estelar', layer:'weapon', icon:'✨', bonus:{ ataque:28, mana:150, wisdom:2 } },
  asas_crepusculo: { id:'asas_crepusculo', nome:'Asas do Crepúsculo', layer:'wingsBack', icon:'🪽', bonus:{ hp:160, dodge:5, power:240 } },
  aura_abissal: { id:'aura_abissal', nome:'Aura Abissal', layer:'aura', icon:'🌀', bonus:{ ataquePct:0.025, tough:6, power:180 } }
};
const LAYERS = ['hair','outfit','weapon','wingsBack','wingsFront','aura'];
function add(target, src){ for(const [k,v] of Object.entries(src||{})) target[k]=(target[k]||0)+Number(v||0); return target; }

class FashionLayerManager {
  static normalize(player){
    player.fashion = player.fashion || { owned:['armadura_ferro_runa'], equipped:{}, fragments:0, bonus:{} };
    player.fashion.owned = Array.isArray(player.fashion.owned) ? Array.from(new Set(player.fashion.owned.filter(id=>SETS[id]))) : ['armadura_ferro_runa'];
    player.fashion.equipped = player.fashion.equipped || {};
    player.fashion.fragments = Math.max(0, Math.floor(player.fashion.fragments || 0));
    for(const layer of LAYERS){
      const id = player.fashion.equipped[layer];
      if(id && (!SETS[id] || !player.fashion.owned.includes(id) || SETS[id].layer !== layer)) delete player.fashion.equipped[layer];
    }
    this.recalc(player);
    return player.fashion;
  }
  static recalc(player){
    const f=this.normalizeNoRecalc(player);
    const bonus={};
    for(const id of f.owned){ add(bonus, (SETS[id]||{}).bonus); }
    for(const id of Object.values(f.equipped||{})){ add(bonus, (SETS[id]||{}).bonus); }
    f.bonus=bonus; return bonus;
  }
  static normalizeNoRecalc(player){ player.fashion = player.fashion || { owned:['armadura_ferro_runa'], equipped:{}, fragments:0, bonus:{} }; return player.fashion; }
  static unlock(player,id){ this.normalize(player); if(!SETS[id]) return {ok:false, reason:'Visual inválido.'}; if(player.fashion.owned.includes(id)) return {ok:false, reason:'Você já possui esse visual.'}; const cost = 15 + player.fashion.owned.length * 3; if((player.fashion.fragments||0) < cost) return {ok:false, reason:'Fragmentos de skin insuficientes.', cost}; player.fashion.fragments -= cost; player.fashion.owned.push(id); this.recalc(player); return {ok:true, visual:SETS[id], cost, fashion:this.publicState(player)}; }
  static grantFragments(player, amount){ this.normalize(player); player.fashion.fragments += Math.max(0, Math.floor(amount||0)); return this.publicState(player); }
  static equip(player,id){ this.normalize(player); const item=SETS[id]; if(!item) return {ok:false, reason:'Visual inválido.'}; if(!player.fashion.owned.includes(id)) return {ok:false, reason:'Você não possui esse visual.'}; player.fashion.equipped[item.layer]=id; this.recalc(player); return {ok:true, visual:item, fashion:this.publicState(player)}; }
  static unequip(player,layer){ this.normalize(player); delete player.fashion.equipped[layer]; this.recalc(player); return {ok:true, fashion:this.publicState(player)}; }
  static layers(player){ this.normalize(player); const equipped = player.fashion.equipped || {}; return {
    back: equipped.wingsBack ? `assets/skins/${equipped.wingsBack}.png` : null,
    outfit: equipped.outfit ? `assets/skins/${equipped.outfit}.png` : null,
    hair: equipped.hair ? `assets/skins/${equipped.hair}.png` : null,
    weapon: equipped.weapon ? `assets/skins/${equipped.weapon}.png` : null,
    front: equipped.wingsFront ? `assets/skins/${equipped.wingsFront}.png` : null,
    aura: equipped.aura || null
  }; }
  static publicState(player){ this.normalize(player); return { owned: player.fashion.owned.map(id=>SETS[id]).filter(Boolean), equipped: player.fashion.equipped, fragments: player.fashion.fragments, bonus: player.fashion.bonus, catalog:Object.values(SETS) }; }
}
module.exports = FashionLayerManager;
