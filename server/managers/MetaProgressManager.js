const { MISSION_DEFS, CODEX_MILESTONES, ASCENSION_CONFIG, ARTIFACTS, ZONES } = require('../../shared/classes.js');

function nowDay(){ return new Date().toISOString().slice(0,10); }
function safeNum(v){ return Math.max(0, Math.floor(v || 0)); }

class MetaProgressManager {
  static normalize(player){
    player.missions = player.missions || { date: nowDay(), progress:{}, claimed:{} };
    if (player.missions.date !== nowDay()) player.missions = { date: nowDay(), progress:{}, claimed:{} };
    player.codex = player.codex || { kills:{}, claimed:{} };
    player.ascension = player.ascension || { rank:0, dust:0, artifacts:{} };
    player.ascension.artifacts = player.ascension.artifacts || {};
    player.season = player.season || { xp:0, level:1, claimed:{} };
    return player;
  }

  static getZone(wave){
    const h = safeNum(wave) || 1;
    let current = ZONES[0];
    for (const z of ZONES) if (h >= z.minWave) current = z;
    return current;
  }

  static progressMission(player, type, amount=1){
    this.normalize(player);
    const changed=[];
    for (const def of Object.values(MISSION_DEFS)) {
      if (def.type !== type) continue;
      const cur = player.missions.progress[def.id] || 0;
      player.missions.progress[def.id] = Math.min(def.target, cur + amount);
      changed.push(def.id);
    }
    return changed;
  }

  static recordKill(player, monster){
    this.normalize(player);
    if (monster && monster.templateId) {
      player.codex.kills[monster.templateId] = safeNum(player.codex.kills[monster.templateId]) + 1;
    }
    this.progressMission(player, 'kill', 1);
    if (monster && monster.isBoss) this.progressMission(player, 'boss', 1);
    this.addSeasonXP(player, monster && monster.isBoss ? 45 : 8);
  }

  static addSeasonXP(player, amount){
    this.normalize(player);
    player.season.xp = safeNum(player.season.xp) + safeNum(amount);
    player.season.level = Math.max(1, Math.min(50, 1 + Math.floor(player.season.xp / 120)));
  }

  static claimMission(player, id){
    this.normalize(player);
    const def = MISSION_DEFS[id];
    if (!def) return { ok:false, reason:'Missão inválida.' };
    if (player.missions.claimed[id]) return { ok:false, reason:'Missão já coletada.' };
    if ((player.missions.progress[id] || 0) < def.target) return { ok:false, reason:'Missão ainda não concluída.' };
    this.applyRewards(player, def.rewards || {});
    player.missions.claimed[id] = true;
    this.addSeasonXP(player, 35);
    return { ok:true, rewards:def.rewards, missions:this.publicMissions(player), playerMeta:this.publicMeta(player) };
  }

  static claimAllMissions(player){
    this.normalize(player);
    const results=[];
    for (const id of Object.keys(MISSION_DEFS)) {
      const res=this.claimMission(player,id);
      if(res.ok) results.push({id,rewards:res.rewards});
    }
    return { ok:true, claimed:results, missions:this.publicMissions(player), playerMeta:this.publicMeta(player) };
  }

  static applyRewards(player, rewards){
    player.ouro = safeNum(player.ouro) + safeNum(rewards.ouro);
    player.gemas = safeNum(player.gemas) + safeNum(rewards.gemas);
    player.cashGems = player.gemas;
    if (rewards.ascensionDust) {
      this.normalize(player);
      player.ascension.dust = safeNum(player.ascension.dust) + safeNum(rewards.ascensionDust);
    }
    if (rewards.talentPoints) {
      player.extraTalentPoints = safeNum(player.extraTalentPoints) + safeNum(rewards.talentPoints);
    }
  }

  static codexStepState(player, monsterId){
    this.normalize(player);
    const def = CODEX_MILESTONES[monsterId];
    const kills = safeNum(player.codex.kills[monsterId]);
    const claimed = player.codex.claimed[monsterId] || 0;
    const unlocked = def ? def.steps.filter(s=>kills>=s).length : 0;
    return { kills, claimed, unlocked, claimable: Math.max(0, unlocked-claimed) };
  }

  static claimCodex(player, monsterId){
    this.normalize(player);
    const def = CODEX_MILESTONES[monsterId];
    if (!def) return { ok:false, reason:'Codex inválido.' };
    const st = this.codexStepState(player, monsterId);
    if (!st.claimable) return { ok:false, reason:'Nenhum marco disponível.' };
    player.codex.claimed[monsterId] = st.claimed + 1;
    player.gemas = safeNum(player.gemas) + 2 + st.claimed;
    player.ouro = safeNum(player.ouro) + 700 * (st.claimed + 1);
    this.addSeasonXP(player, 40);
    return { ok:true, codex:this.publicCodex(player), playerMeta:this.publicMeta(player) };
  }

  static getCodexBonuses(player){
    this.normalize(player);
    const b = { ataquePct:0, hpPct:0, goldPct:0, defesa:0, critico:0, dropPct:0, power:0 };
    for (const [id, def] of Object.entries(CODEX_MILESTONES)) {
      const claimed = safeNum((player.codex.claimed || {})[id]);
      for (const [k,v] of Object.entries(def.bonusPerStep || {})) b[k] = (b[k] || 0) + v * claimed;
    }
    b.power = Math.floor((b.ataquePct||0)*1500 + (b.hpPct||0)*1100 + (b.goldPct||0)*700 + (b.defesa||0)*8 + (b.critico||0)*14 + (b.dropPct||0)*1000);
    return b;
  }

  static getArtifactBonuses(player){
    this.normalize(player);
    const b = { ataquePct:0, hpPct:0, manaPct:0, xpPct:0, goldPct:0, dropPct:0, defesa:0, critico:0, power:0 };
    for (const [id,lvl] of Object.entries(player.ascension.artifacts || {})) {
      const def = ARTIFACTS[id];
      if (!def) continue;
      for (const [k,v] of Object.entries(def.bonus || {})) b[k] = (b[k] || 0) + v * lvl;
    }
    b.power = Math.floor((b.ataquePct||0)*1800 + (b.hpPct||0)*1400 + (b.manaPct||0)*700 + (b.xpPct||0)*800 + (b.goldPct||0)*800 + (b.dropPct||0)*1300 + (b.defesa||0)*8 + (b.critico||0)*15);
    return b;
  }

  static getAscensionBonuses(player){
    this.normalize(player);
    const rank = safeNum(player.ascension.rank);
    const per = ASCENSION_CONFIG.bonusesPerRank;
    return {
      ataquePct:(per.ataquePct||0)*rank,
      hpPct:(per.hpPct||0)*rank,
      xpPct:(per.xpPct||0)*rank,
      goldPct:(per.goldPct||0)*rank,
      power:(per.power||0)*rank
    };
  }

  static upgradeArtifact(player, id){
    this.normalize(player);
    const def=ARTIFACTS[id];
    if(!def) return {ok:false,reason:'Artefato inválido.'};
    const cur=safeNum(player.ascension.artifacts[id]);
    if(cur>=def.max) return {ok:false,reason:'Artefato no máximo.'};
    const cost=def.costDust + Math.floor(cur/4);
    if(safeNum(player.ascension.dust)<cost) return {ok:false,reason:'Poeira astral insuficiente.'};
    player.ascension.dust-=cost;
    player.ascension.artifacts[id]=cur+1;
    return {ok:true, meta:this.publicMeta(player)};
  }

  static canAscend(player){
    this.normalize(player);
    return (player.nivel||1)>=ASCENSION_CONFIG.minLevel && (player.power||0)>=ASCENSION_CONFIG.minPower;
  }

  static ascend(player){
    this.normalize(player);
    if(!this.canAscend(player)) return {ok:false,reason:`Ascensão exige Nv. ${ASCENSION_CONFIG.minLevel} e ${ASCENSION_CONFIG.minPower} poder.`};
    const rank=safeNum(player.ascension.rank)+1;
    const dust=ASCENSION_CONFIG.baseDustReward + Math.floor((player.power||0)/15000) + rank;
    player.ascension.rank=rank;
    player.ascension.dust=safeNum(player.ascension.dust)+dust;
    player.nivel=1; player.level=1; player.xp=0; player.horda=1;
    player.hp=player.maxHp; player.mana=player.maxMana;
    this.addSeasonXP(player, 150);
    return {ok:true,dust,meta:this.publicMeta(player)};
  }

  static publicMissions(player){
    this.normalize(player);
    const defs={};
    for (const [id,def] of Object.entries(MISSION_DEFS)) defs[id] = { ...def, progress: player.missions.progress[id] || 0, claimed: !!player.missions.claimed[id], ready: (player.missions.progress[id] || 0) >= def.target && !player.missions.claimed[id] };
    return { date:player.missions.date, defs };
  }

  static publicCodex(player){
    this.normalize(player);
    const defs={};
    for (const [id,def] of Object.entries(CODEX_MILESTONES)) defs[id] = { ...def, state:this.codexStepState(player,id) };
    return { defs, bonuses:this.getCodexBonuses(player) };
  }

  static publicSeason(player){
    this.normalize(player);
    return { xp:player.season.xp, level:player.season.level, nextXp:player.season.level>=50?0:player.season.level*120, claimed:player.season.claimed||{} };
  }

  static publicMeta(player){
    this.normalize(player);
    return {
      zone:this.getZone(player.horda||1),
      missions:this.publicMissions(player),
      codex:this.publicCodex(player),
      ascension:{ ...player.ascension, canAscend:this.canAscend(player), config:ASCENSION_CONFIG, bonuses:this.getAscensionBonuses(player), artifactBonuses:this.getArtifactBonuses(player), artifactDefs:ARTIFACTS },
      season:this.publicSeason(player)
    };
  }
}
module.exports = MetaProgressManager;
