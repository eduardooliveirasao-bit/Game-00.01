const LevelManager = require('./LevelManager');
const LootManager = require('./LootManager');

const EXPEDITIONS = {
  curta: { id:'curta', nome:'Patrulha da Floresta', icon:'🌲', minutes:30, powerReq:0, rewardMul:1, desc:'Recompensa curta para manter progresso constante.' },
  mina: { id:'mina', nome:'Mina de Cristais', icon:'⛏️', minutes:90, powerReq:700, rewardMul:2.3, desc:'Mais ouro e pequena chance de gema extra.' },
  ruinas: { id:'ruinas', nome:'Ruínas Antigas', icon:'🏛️', minutes:180, powerReq:1800, rewardMul:4.8, desc:'Boa XP, ouro e chance maior de item raro.' },
  abismo: { id:'abismo', nome:'Abismo Elemental', icon:'🐉', minutes:360, powerReq:4200, rewardMul:9.0, desc:'Longa expedição com melhor chance de loot lendário.' }
};

function now(){ return Date.now(); }

class ExpeditionManager {
  static defs(){ return EXPEDITIONS; }

  static normalize(player){
    player.expedition = player.expedition || { active:null, history:[] };
    player.expedition.history = player.expedition.history || [];
    return player.expedition;
  }

  static start(player, id){
    const def = EXPEDITIONS[id];
    if (!def) return { ok:false, reason:'Expedição inválida.' };
    const ex = this.normalize(player);
    if (ex.active) return { ok:false, reason:'Já existe uma expedição em andamento.' };
    if ((player.power || 0) < def.powerReq) return { ok:false, reason:'Poder insuficiente para essa expedição.' };
    const startedAt = now();
    ex.active = { id, startedAt, endsAt: startedAt + def.minutes * 60000 };
    return { ok:true, expedition:this.publicExpedition(player) };
  }

  static claim(player){
    const ex = this.normalize(player);
    if (!ex.active) return { ok:false, reason:'Nenhuma expedição ativa.' };
    const def = EXPEDITIONS[ex.active.id];
    if (!def) { ex.active = null; return { ok:false, reason:'Expedição corrompida foi cancelada.' }; }
    const remaining = ex.active.endsAt - now();
    if (remaining > 0) return { ok:false, reason:'Expedição ainda não terminou.', remainingMs: remaining };
    const level = player.nivel || 1;
    const stage = player.horda || 1;
    const gold = Math.floor((450 + level * 50 + stage * 18) * def.rewardMul);
    const xp = Math.floor((260 + level * 35 + stage * 10) * def.rewardMul);
    const gems = Math.max(0, Math.floor(def.rewardMul / 2) + (Math.random() < 0.15 ? 1 : 0));
    let item = null;
    const itemChance = Math.min(0.85, 0.18 + def.rewardMul * 0.055);
    if (Math.random() < itemChance) {
      item = LootManager.createShopDrop(player, def.id === 'abismo' ? 'lendário' : def.id === 'ruinas' ? 'épico' : 'raro');
      if (item) {
        player.inventario = player.inventario || [];
        player.inventario.unshift(item);
      }
    }
    player.ouro = (player.ouro || 0) + gold;
    player.gemas = (player.gemas || 0) + gems;
    player.cashGems = player.gemas;
    LevelManager.addXP(player, xp);
    ex.history.unshift({ id:def.id, claimedAt:now(), gold, xp, gems, itemName:item && item.nome });
    ex.history = ex.history.slice(0, 12);
    ex.active = null;
    return { ok:true, rewards:{ gold, xp, gems, item }, expedition:this.publicExpedition(player) };
  }

  static publicExpedition(player){
    const ex = this.normalize(player);
    const active = ex.active ? { ...ex.active, remainingMs: Math.max(0, ex.active.endsAt - now()), ready: now() >= ex.active.endsAt } : null;
    return { defs: EXPEDITIONS, active, history: ex.history || [] };
  }
}

module.exports = ExpeditionManager;
