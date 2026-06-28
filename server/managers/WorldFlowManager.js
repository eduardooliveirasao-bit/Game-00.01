const ZONES = [
  { id:'floresta_cristalina', nome:'Floresta Cristalina', minLevel:1, minPower:0, chapter:1, bonus:{ xpPct:.00, goldPct:.00 }, desc:'A entrada viva do Reino Indle.' },
  { id:'cripta_dos_ossos', nome:'Cripta dos Ossos', minLevel:5, minPower:900, chapter:2, bonus:{ xpPct:.04, goldPct:.03 }, desc:'Corredores antigos e mortos inquietos.' },
  { id:'ruinas_celestes', nome:'Ruínas Celestes', minLevel:12, minPower:2400, chapter:3, bonus:{ xpPct:.08, goldPct:.07 }, desc:'Pedras flutuantes e magia residual.' },
  { id:'vulcao_elemental', nome:'Vulcão Elemental', minLevel:22, minPower:5200, chapter:4, bonus:{ xpPct:.12, goldPct:.12 }, desc:'A forja natural dos bosses elementais.' },
  { id:'reino_do_ceu', nome:'Reino do Céu', minLevel:35, minPower:11000, chapter:5, bonus:{ xpPct:.18, goldPct:.15 }, desc:'Onde asas, runas e ascensão se encontram.' },
  { id:'abismo_rúnico', nome:'Abismo Rúnico', minLevel:50, minPower:22000, chapter:6, bonus:{ xpPct:.26, goldPct:.22 }, desc:'Endgame local para caçadores lendários.' }
];
const ROUTES = {
  floresta_cristalina:['cripta_dos_ossos'],
  cripta_dos_ossos:['floresta_cristalina','ruinas_celestes'],
  ruinas_celestes:['cripta_dos_ossos','vulcao_elemental'],
  vulcao_elemental:['ruinas_celestes','reino_do_ceu'],
  reino_do_ceu:['vulcao_elemental','abismo_rúnico'],
  'abismo_rúnico':['reino_do_ceu']
};
function getZone(id){ return ZONES.find(z=>z.id===id) || ZONES[0]; }
class WorldFlowManager {
  static normalize(player){ player.world = player.world || { zoneId:'floresta_cristalina', unlocked:['floresta_cristalina'], routeHistory:[], enteredAt:Date.now(), clientConfig:{} }; if(!getZone(player.world.zoneId)) player.world.zoneId='floresta_cristalina'; player.world.unlocked = Array.from(new Set((player.world.unlocked||[]).concat(['floresta_cristalina']).filter(id=>getZone(id)))); this.refreshUnlocks(player); return player.world; }
  static refreshUnlocks(player){ const w = player.world || (player.world={zoneId:'floresta_cristalina',unlocked:['floresta_cristalina']}); const power=player.power||0, lvl=player.nivel||1; for(const z of ZONES){ if(lvl>=z.minLevel && power>=z.minPower && !w.unlocked.includes(z.id)) w.unlocked.push(z.id); } return w.unlocked; }
  static enter(player, zoneId){ this.normalize(player); const z=getZone(zoneId); if(!z) return {ok:false, reason:'Zona inválida.'}; this.refreshUnlocks(player); if(!player.world.unlocked.includes(z.id)) return {ok:false, reason:`Requer Nv.${z.minLevel} e ${z.minPower} poder.`}; const from=player.world.zoneId; player.world.zoneId=z.id; player.world.enteredAt=Date.now(); player.world.routeHistory.unshift({ from, to:z.id, at:Date.now() }); player.world.routeHistory=player.world.routeHistory.slice(0,20); return {ok:true, zone:z, world:this.publicState(player)}; }
  static activeBonus(player){ this.normalize(player); return getZone(player.world.zoneId).bonus || {}; }
  static publicState(player){ this.normalize(player); const active=getZone(player.world.zoneId); return { active, zones:ZONES.map(z=>({...z, unlocked:player.world.unlocked.includes(z.id), connected:ROUTES[player.world.zoneId]?.includes(z.id)||z.id===player.world.zoneId})), routes:ROUTES, routeHistory:player.world.routeHistory||[] }; }
}
module.exports = WorldFlowManager;
