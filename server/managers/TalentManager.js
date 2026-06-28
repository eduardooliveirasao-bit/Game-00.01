const TALENTS = {
  ataque: { id:'ataque', nome:'Força Arcana', icon:'⚔️', max:25, desc:'+2% dano por nível', effect:{ ataquePct:0.02 }, cost:(lvl)=>1+Math.floor(lvl/5) },
  vida: { id:'vida', nome:'Vitalidade', icon:'❤️', max:25, desc:'+3% HP máximo por nível', effect:{ hpPct:0.03 }, cost:(lvl)=>1+Math.floor(lvl/5) },
  defesa: { id:'defesa', nome:'Couraça', icon:'🛡️', max:20, desc:'+4 defesa por nível', effect:{ defesa:4 }, cost:(lvl)=>1+Math.floor(lvl/6) },
  critico: { id:'critico', nome:'Precisão Crítica', icon:'💥', max:20, desc:'+1.2% crítico por nível', effect:{ critico:1.2 }, cost:(lvl)=>1+Math.floor(lvl/6) },
  mana: { id:'mana', nome:'Fluxo de Mana', icon:'🔷', max:20, desc:'+3% mana por nível', effect:{ manaPct:0.03 }, cost:(lvl)=>1+Math.floor(lvl/6) },
  velocidade: { id:'velocidade', nome:'Ritmo Idle', icon:'⚡', max:15, desc:'+1 velocidade e +0.25 evasão por nível', effect:{ speed:1, evasion:0.25 }, cost:(lvl)=>1+Math.floor(lvl/5) },
  fortuna: { id:'fortuna', nome:'Fortuna de Caça', icon:'🪙', max:20, desc:'+2% ouro por nível', effect:{ goldPct:0.02 }, cost:(lvl)=>1+Math.floor(lvl/6) },
  sabedoria: { id:'sabedoria', nome:'Sabedoria de Combate', icon:'📘', max:20, desc:'+2% XP por nível', effect:{ xpPct:0.02 }, cost:(lvl)=>1+Math.floor(lvl/6) },
  saque: { id:'saque', nome:'Instinto de Loot', icon:'🎁', max:15, desc:'+1.5% chance/qualidade de drop por nível', effect:{ dropPct:0.015 }, cost:(lvl)=>1+Math.floor(lvl/5) },
};

function spentPoints(talents){
  let total = 0;
  for (const id of Object.keys(talents || {})) {
    const def = TALENTS[id];
    const lvl = Math.max(0, Math.floor(talents[id] || 0));
    for (let i = 0; i < lvl; i++) total += def ? def.cost(i) : 1;
  }
  return total;
}

class TalentManager {
  static defs(){ return TALENTS; }

  static normalize(player){
    player.talents = player.talents || {};
    for (const id of Object.keys(player.talents)) {
      if (!TALENTS[id]) delete player.talents[id];
      else player.talents[id] = Math.max(0, Math.min(TALENTS[id].max, Math.floor(player.talents[id] || 0)));
    }
    return player.talents;
  }

  static earnedPoints(player){
    const levelPoints = Math.max(0, (player.nivel || 1) - 1);
    const bossPoints = Math.floor(((player.stats && player.stats.bossKills) || 0) / 2);
    const masteryPoints = Math.floor(((player.kills || 0) / 75));
    return levelPoints + bossPoints + masteryPoints + Math.max(0, Math.floor(player.extraTalentPoints || 0));
  }

  static spentPoints(player){
    this.normalize(player);
    return spentPoints(player.talents);
  }

  static availablePoints(player){
    return Math.max(0, this.earnedPoints(player) - this.spentPoints(player));
  }

  static getBonuses(player){
    this.normalize(player);
    const b = { ataquePct:0, hpPct:0, manaPct:0, defesa:0, critico:0, speed:0, evasion:0, goldPct:0, xpPct:0, dropPct:0, power:0 };
    for (const [id, lvl] of Object.entries(player.talents || {})) {
      const def = TALENTS[id];
      if (!def || !lvl) continue;
      for (const [k, v] of Object.entries(def.effect || {})) b[k] = (b[k] || 0) + v * lvl;
    }
    b.power = Math.floor((b.ataquePct * 1200) + (b.hpPct * 800) + b.defesa * 7 + b.critico * 12 + b.speed * 9 + b.evasion * 16 + b.goldPct * 500 + b.xpPct * 500 + b.dropPct * 700);
    return b;
  }

  static upgrade(player, id){
    this.normalize(player);
    const def = TALENTS[id];
    if (!def) return { ok:false, reason:'Talento inválido.' };
    const current = player.talents[id] || 0;
    if (current >= def.max) return { ok:false, reason:'Talento já está no nível máximo.' };
    const cost = def.cost(current);
    if (this.availablePoints(player) < cost) return { ok:false, reason:'Pontos de talento insuficientes.' };
    player.talents[id] = current + 1;
    return { ok:true, id, level:player.talents[id], cost, talents:this.publicTalents(player) };
  }

  static reset(player){
    player.talents = {};
    return { ok:true, talents:this.publicTalents(player) };
  }

  static publicTalents(player){
    this.normalize(player);
    const defs = {};
    for (const [id, def] of Object.entries(TALENTS)) {
      defs[id] = { ...def, level: player.talents[id] || 0, nextCost: (player.talents[id] || 0) >= def.max ? 0 : def.cost(player.talents[id] || 0) };
    }
    return {
      defs,
      values: { ...(player.talents || {}) },
      earned: this.earnedPoints(player),
      spent: this.spentPoints(player),
      available: this.availablePoints(player),
      bonuses: this.getBonuses(player)
    };
  }
}

module.exports = TalentManager;
