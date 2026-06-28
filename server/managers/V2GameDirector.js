const RESOURCE_REFERENCE = {
  flexClient: {
    file: 'Main.swf.flex.zip',
    totalFiles: 2401,
    actionScript: 1946,
    swf: 418,
    png: 28,
    dat: 9,
    importedIdeas: [
      'janelas modulares estilo Flex',
      'inventário/pocket com abas',
      'loja, correio, recompensas e atalhos',
      'map objects, exits, traps e pathfinding',
      'pets, montaria e player info'
    ]
  },
  resourceVault: {
    file: 'res.zip(1).001..013',
    parts: 13,
    archiveBytes: 6287739062,
    entries: 12775,
    note: 'Indexado como vault local de referência. O jogo usa leitura/manifesto e recria sistemas/visual sem depender de assets externos em runtime.'
  },
  sqlAndProtocol: {
    systems: [
      'TB_Account/TB_Session/TB_Role',
      'inventário, banco, mail, leilão e trade',
      'buffs, monstros, spawns e teleporte',
      'pacotes WorldLogin/RoleList/SelectRole/PlayerEnterWorld/ViewMap'
    ]
  }
};

const V2_ZONES = [
  { id: 'floresta_cristalina', nome: 'Floresta Cristalina', icon: '🌲', minWave: 1, minLevel: 1, element: 'natureza', color: '#35f0a2', bg: 'radial-gradient(circle at 35% 20%, rgba(77,255,190,.24), transparent 35%), linear-gradient(145deg,#07162f,#0a1030 58%,#151237)', bonus: { xpPct: 0.00, goldPct: 0.00, attackPct: 0.00, hpPct: 0.00 }, nodes: 12, boss: 'Slime Rei de Cristal' },
  { id: 'vale_pata_urso', nome: 'Vale Pata de Urso', icon: '🐻', minWave: 12, minLevel: 4, element: 'terra', color: '#f2c56e', bg: 'radial-gradient(circle at 72% 18%, rgba(255,214,120,.22), transparent 36%), linear-gradient(145deg,#1d1509,#182515 58%,#07121f)', bonus: { xpPct: 0.04, goldPct: 0.05, attackPct: 0.02, hpPct: 0.03 }, nodes: 16, boss: 'Urso Ancião Rúnico' },
  { id: 'cripta_dos_ossos', nome: 'Cripta dos Ossos', icon: '☠️', minWave: 24, minLevel: 8, element: 'sombra', color: '#b38cff', bg: 'radial-gradient(circle at 60% 25%, rgba(157,120,255,.20), transparent 35%), linear-gradient(145deg,#080812,#12142b 60%,#1f1030)', bonus: { xpPct: 0.08, goldPct: 0.08, attackPct: 0.04, hpPct: 0.02 }, nodes: 18, boss: 'Cavaleiro Ossário' },
  { id: 'minas_lua', nome: 'Minas da Lua Azul', icon: '💎', minWave: 40, minLevel: 14, element: 'arcano', color: '#65c7ff', bg: 'radial-gradient(circle at 20% 22%, rgba(96,205,255,.26), transparent 38%), linear-gradient(145deg,#081427,#0d1738 55%,#0e0d20)', bonus: { xpPct: 0.12, goldPct: 0.13, attackPct: 0.06, hpPct: 0.04 }, nodes: 20, boss: 'Golem de Safira Viva' },
  { id: 'santuario_fenix', nome: 'Santuário da Fênix', icon: '🔥', minWave: 62, minLevel: 21, element: 'fogo', color: '#ff8a4c', bg: 'radial-gradient(circle at 70% 24%, rgba(255,120,78,.28), transparent 36%), linear-gradient(145deg,#251010,#32131c 56%,#080b19)', bonus: { xpPct: 0.18, goldPct: 0.18, attackPct: 0.09, hpPct: 0.05 }, nodes: 24, boss: 'Fênix Rubra Renascida' },
  { id: 'biblioteca_arcana', nome: 'Biblioteca Arcana', icon: '📘', minWave: 84, minLevel: 30, element: 'luz', color: '#9fe6ff', bg: 'radial-gradient(circle at 45% 14%, rgba(158,231,255,.25), transparent 42%), linear-gradient(145deg,#071a29,#152144 55%,#21163b)', bonus: { xpPct: 0.24, goldPct: 0.20, attackPct: 0.11, hpPct: 0.08 }, nodes: 26, boss: 'Arquivista Estelar' },
  { id: 'abismo_draconico', nome: 'Abismo Dracônico', icon: '🐉', minWave: 110, minLevel: 40, element: 'dragao', color: '#ff6bdf', bg: 'radial-gradient(circle at 50% 24%, rgba(255,88,205,.26), transparent 37%), linear-gradient(145deg,#18081b,#2a1239 56%,#060912)', bonus: { xpPct: 0.32, goldPct: 0.28, attackPct: 0.16, hpPct: 0.10 }, nodes: 30, boss: 'Dragão Elemental Supremo' },
  { id: 'cidade_camara', nome: 'Cidade Camará Online', icon: '🏰', minWave: 150, minLevel: 55, element: 'guilda', color: '#ffd76b', bg: 'radial-gradient(circle at 30% 15%, rgba(255,218,120,.24), transparent 34%), linear-gradient(145deg,#16100c,#1a1736 52%,#081020)', bonus: { xpPct: 0.40, goldPct: 0.36, attackPct: 0.20, hpPct: 0.14 }, nodes: 36, boss: 'Guardião de Camará' }
];

const V2_DUNGEONS = [
  { id: 'ninho_slime', nome: 'Ninho do Rei Slime', icon: '🟢', minLevel: 1, keyCost: 1, waves: 5, rewards: { gold: 450, xp: 260, gems: 1, ore: 2, essence: 1 } },
  { id: 'catacumba_runica', nome: 'Catacumba Rúnica', icon: '🦴', minLevel: 8, keyCost: 2, waves: 7, rewards: { gold: 980, xp: 720, gems: 2, ore: 4, essence: 2 } },
  { id: 'forja_lunar', nome: 'Forja Lunar', icon: '🌙', minLevel: 16, keyCost: 3, waves: 9, rewards: { gold: 1850, xp: 1350, gems: 3, ore: 7, essence: 4, relicDust: 1 } },
  { id: 'portal_fenix', nome: 'Portal da Fênix', icon: '🔥', minLevel: 25, keyCost: 4, waves: 11, rewards: { gold: 3200, xp: 2400, gems: 5, ore: 10, essence: 7, relicDust: 2 } },
  { id: 'raid_draconica', nome: 'Raid Dracônica Solo', icon: '🐲', minLevel: 40, keyCost: 6, waves: 15, rewards: { gold: 7200, xp: 5200, gems: 9, ore: 18, essence: 12, relicDust: 4, bossSouls: 1 } }
];

const V2_CHAPTERS = [
  { id: 'despertar', title: 'Capítulo I — Despertar Idle', goal: 'Chegue à horda 10 e derrote os primeiros monstros.', minKills: 10, minWave: 10, reward: { gold: 1000, gems: 3, keys: 2 } },
  { id: 'mapas', title: 'Capítulo II — Mapas e Portais', goal: 'Desbloqueie 3 zonas e vença a horda 30.', minWave: 30, minZones: 3, reward: { gold: 2500, gems: 5, keys: 3, ore: 5 } },
  { id: 'forja', title: 'Capítulo III — Forja de Relíquias', goal: 'Alcance poder 4000 e obtenha pó de relíquia.', minPower: 4000, minRelicDust: 1, reward: { gold: 5000, gems: 8, essence: 6, relicDust: 2 } },
  { id: 'draconico', title: 'Capítulo IV — Abismo Dracônico', goal: 'Derrote bosses e entre no Abismo Dracônico.', minBossKills: 2, zoneId: 'abismo_draconico', reward: { gold: 12000, gems: 15, bossSouls: 2, keys: 4 } },
  { id: 'camara', title: 'Capítulo V — Cidade Camará Online', goal: 'Chegue à elite V2 e desbloqueie a Cidade Camará.', minPower: 15000, zoneId: 'cidade_camara', reward: { gold: 25000, gems: 25, relicDust: 6, bossSouls: 5 } }
];

const V2_SKINS = [
  { id: 'aura_cristal', nome: 'Aura Cristalina', icon: '💠', cost: { essence: 3 }, color: '#6df7ff' },
  { id: 'manto_sombrio', nome: 'Manto Sombrio', icon: '🌑', cost: { essence: 7, relicDust: 1 }, color: '#b38cff' },
  { id: 'asa_fenix_v2', nome: 'Asa da Fênix V2', icon: '🔥', cost: { essence: 12, relicDust: 2 }, color: '#ff8a4c' },
  { id: 'coroa_camara', nome: 'Coroa de Camará', icon: '👑', cost: { bossSouls: 3, relicDust: 4 }, color: '#ffd76b' }
];

function now() { return Date.now(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function safeInt(v) { return Math.max(0, Math.floor(v || 0)); }
function byId(rows, id) { return rows.find((r) => r.id === id) || rows[0]; }
function addCurrency(player, reward = {}) {
  player.ouro = (player.ouro || 0) + safeInt(reward.gold);
  player.gemas = (player.gemas || 0) + safeInt(reward.gems);
  player.cashGems = player.gemas;
  const v2 = V2GameDirector.normalize(player);
  v2.resources.ore += safeInt(reward.ore);
  v2.resources.essence += safeInt(reward.essence);
  v2.resources.relicDust += safeInt(reward.relicDust);
  v2.resources.bossSouls += safeInt(reward.bossSouls);
  v2.dungeons.keys += safeInt(reward.keys);
}

class V2GameDirector {
  static definitions() {
    return { version: '2.0.0', zones: V2_ZONES, dungeons: V2_DUNGEONS, chapters: V2_CHAPTERS, skins: V2_SKINS, resourceReference: RESOURCE_REFERENCE };
  }

  static normalize(player) {
    player.v2 = player.v2 || {};
    const v2 = player.v2;
    v2.version = '2.0.0';
    v2.createdAt = v2.createdAt || now();
    v2.world = v2.world || {};
    v2.world.zoneId = v2.world.zoneId || (player.world && player.world.zoneId) || 'floresta_cristalina';
    v2.world.unlocked = Array.isArray(v2.world.unlocked) && v2.world.unlocked.length ? v2.world.unlocked : ['floresta_cristalina'];
    v2.world.node = safeInt(v2.world.node);
    v2.world.discovery = safeInt(v2.world.discovery);
    v2.world.reputation = safeInt(v2.world.reputation);
    v2.world.portalEnergy = Math.min(100, safeInt(v2.world.portalEnergy || 35));
    v2.world.mapHistory = Array.isArray(v2.world.mapHistory) ? v2.world.mapHistory.slice(-25) : [];
    v2.campaign = v2.campaign || { completed: [], claimed: [] };
    v2.campaign.completed = Array.isArray(v2.campaign.completed) ? v2.campaign.completed : [];
    v2.campaign.claimed = Array.isArray(v2.campaign.claimed) ? v2.campaign.claimed : [];
    v2.dungeons = v2.dungeons || {};
    v2.dungeons.keys = safeInt(v2.dungeons.keys || 3);
    v2.dungeons.runs = safeInt(v2.dungeons.runs);
    v2.dungeons.best = v2.dungeons.best || {};
    v2.dungeons.history = Array.isArray(v2.dungeons.history) ? v2.dungeons.history.slice(-15) : [];
    v2.battle = v2.battle || {};
    v2.battle.combo = safeInt(v2.battle.combo);
    v2.battle.fury = clamp(safeInt(v2.battle.fury || 0), 0, 100);
    v2.battle.manualCooldownUntil = safeInt(v2.battle.manualCooldownUntil);
    v2.battle.ultimateCooldownUntil = safeInt(v2.battle.ultimateCooldownUntil);
    v2.battle.style = v2.battle.style || 'aggressive';
    v2.battle.autoUlt = v2.battle.autoUlt !== false;
    v2.resources = v2.resources || {};
    v2.resources.ore = safeInt(v2.resources.ore);
    v2.resources.essence = safeInt(v2.resources.essence);
    v2.resources.relicDust = safeInt(v2.resources.relicDust);
    v2.resources.bossSouls = safeInt(v2.resources.bossSouls);
    v2.visuals = v2.visuals || {};
    v2.visuals.quality = v2.visuals.quality || 'ultra';
    v2.visuals.aura = v2.visuals.aura || 'aura_cristal';
    v2.visuals.unlockedSkins = Array.isArray(v2.visuals.unlockedSkins) && v2.visuals.unlockedSkins.length ? v2.visuals.unlockedSkins : ['aura_cristal'];
    v2.visuals.showCompanions = v2.visuals.showCompanions !== false;
    v2.visuals.showMinions = v2.visuals.showMinions !== false;
    v2.visuals.camera = v2.visuals.camera !== false;
    v2.codex = v2.codex || {};
    v2.codex.resourceEntries = RESOURCE_REFERENCE.resourceVault.entries;
    v2.codex.flexFiles = RESOURCE_REFERENCE.flexClient.totalFiles;
    v2.codex.protocolSystems = RESOURCE_REFERENCE.sqlAndProtocol.systems.length;
    v2.codex.notes = v2.codex.notes || [
      'Sistema V2 montado com base nos pacotes Flex/AS, SQL, protocolo e res vault enviados.',
      'Visual recriado para Canvas/HTML moderno, sem precisar do Flash Player.',
      'Arquitetura local com saves JSON e Socket.IO preservada.'
    ];
    this.autoUnlock(player);
    return v2;
  }

  static activeZone(player) {
    const v2 = this.normalize(player);
    return byId(V2_ZONES, v2.world.zoneId);
  }

  static activeBonus(player) {
    const zone = this.activeZone(player);
    const v2 = this.normalize(player);
    const completed = v2.campaign.claimed.length;
    return {
      xpPct: (zone.bonus.xpPct || 0) + completed * 0.01,
      goldPct: (zone.bonus.goldPct || 0) + completed * 0.01,
      attackPct: zone.bonus.attackPct || 0,
      hpPct: zone.bonus.hpPct || 0,
      power: completed * 350 + v2.resources.bossSouls * 1200 + v2.resources.relicDust * 220
    };
  }

  static powerBonus(player) {
    const v2 = this.normalize(player);
    const zone = this.activeZone(player);
    return Math.floor((v2.campaign.claimed.length * 420) + (v2.resources.bossSouls * 1250) + (v2.resources.relicDust * 240) + (v2.world.unlocked.length * 180) + ((zone.minWave || 1) * 8));
  }

  static autoUnlock(player) {
    const v2 = player.v2 || {};
    const kills = safeInt(player.kills);
    const lvl = safeInt(player.nivel || player.level || 1);
    const wave = Math.max(safeInt(player.horda || 1), 1);
    for (const zone of V2_ZONES) {
      if (!v2.world.unlocked.includes(zone.id) && wave >= zone.minWave && lvl >= zone.minLevel) {
        v2.world.unlocked.push(zone.id);
        v2.world.discovery += 10;
      }
    }
    for (const chapter of V2_CHAPTERS) {
      if (!v2.campaign.completed.includes(chapter.id) && this.chapterReady(player, chapter)) {
        v2.campaign.completed.push(chapter.id);
      }
    }
    if (kills > 0) v2.world.portalEnergy = clamp((v2.world.portalEnergy || 0) + Math.floor(kills / 50), 0, 100);
  }

  static chapterReady(player, chapter) {
    const v2 = player.v2 || {};
    if (chapter.minKills && safeInt(player.kills) < chapter.minKills) return false;
    if (chapter.minWave && safeInt(player.horda || 1) < chapter.minWave) return false;
    if (chapter.minZones && v2.world.unlocked.length < chapter.minZones) return false;
    if (chapter.minPower && safeInt(player.power) < chapter.minPower) return false;
    if (chapter.minRelicDust && v2.resources.relicDust < chapter.minRelicDust) return false;
    if (chapter.minBossKills && (!player.stats || safeInt(player.stats.bossKills) < chapter.minBossKills)) return false;
    if (chapter.zoneId && !v2.world.unlocked.includes(chapter.zoneId)) return false;
    return true;
  }

  static publicState(player) {
    const v2 = this.normalize(player);
    const defs = this.definitions();
    return JSON.parse(JSON.stringify({ state: v2, definitions: defs, activeZone: this.activeZone(player), bonuses: this.activeBonus(player) }));
  }

  static enterZone(player, zoneId) {
    const v2 = this.normalize(player);
    const zone = byId(V2_ZONES, zoneId);
    if (!zone) return { ok: false, reason: 'Zona V2 inválida.' };
    if (!v2.world.unlocked.includes(zone.id)) return { ok: false, reason: 'Zona ainda bloqueada. Avance hordas/nível para liberar.' };
    v2.world.zoneId = zone.id;
    v2.world.node = 0;
    v2.world.mapHistory.push({ zoneId: zone.id, at: now() });
    if (player.world) {
      player.world.zoneId = zone.id;
      player.world.enteredAt = now();
    }
    return { ok: true, type: 'enterZone', zone, v2: this.publicState(player) };
  }

  static onKill(player, deadMonster, loot) {
    const v2 = this.normalize(player);
    const zone = this.activeZone(player);
    const isBoss = !!(deadMonster && deadMonster.isBoss);
    const lvl = safeInt(deadMonster && deadMonster.nivel);
    const ore = 1 + Math.floor(lvl / 18) + (isBoss ? 4 : 0);
    const essence = (Math.random() < (isBoss ? 0.95 : 0.18)) ? 1 + (isBoss ? 2 : 0) : 0;
    const relicDust = isBoss ? 1 : (Math.random() < 0.025 ? 1 : 0);
    v2.resources.ore += ore;
    v2.resources.essence += essence;
    v2.resources.relicDust += relicDust;
    if (isBoss) v2.resources.bossSouls += 1;
    v2.battle.combo = Math.min(999, (v2.battle.combo || 0) + 1);
    v2.battle.fury = clamp((v2.battle.fury || 0) + (isBoss ? 18 : 5), 0, 100);
    v2.world.node = (v2.world.node + 1) % Math.max(1, zone.nodes || 12);
    v2.world.reputation += isBoss ? 6 : 1;
    v2.world.portalEnergy = clamp((v2.world.portalEnergy || 0) + (isBoss ? 12 : 2), 0, 100);
    this.autoUnlock(player);
    return { ore, essence, relicDust, bossSouls: isBoss ? 1 : 0, zone, combo: v2.battle.combo, fury: v2.battle.fury, loot: loot || null };
  }

  static manualStrike(player, monsterManager, CombatManager, currentNow = now()) {
    const v2 = this.normalize(player);
    if (!player.classeId) return { ok: false, reason: 'Escolha uma classe primeiro.' };
    if (player.isDead) return { ok: false, reason: 'Você está derrotado.' };
    if (currentNow < (v2.battle.manualCooldownUntil || 0)) return { ok: false, reason: 'Golpe V2 em recarga.', restanteMs: v2.battle.manualCooldownUntil - currentNow };
    const zoneBonus = this.activeBonus(player);
    const ability = { danoMultiplicador: 1.35 + Math.min(1.2, (v2.battle.combo || 0) * 0.012) + (zoneBonus.attackPct || 0), bonusCritico: 6 + Math.min(20, Math.floor((v2.battle.fury || 0) / 8)) };
    const info = CombatManager.calculateDamage(player, ability);
    const result = monsterManager.takeDamage(info.damage, player.nivel, 'ability');
    v2.battle.manualCooldownUntil = currentNow + 420;
    v2.battle.combo = Math.min(999, (v2.battle.combo || 0) + 1);
    v2.battle.fury = clamp((v2.battle.fury || 0) + 4, 0, 100);
    return { ok: true, type: 'v2Manual', playerId: player.id, playerName: player.nome, classeId: player.classeId, habilidadeId: 'v2_manual_strike', habilidadeNome: 'Golpe V2', visual: { tipo: 'v2Slash', cor: this.activeZone(player).color }, icon: '⚡', cooldown: 420, damage: result.damageApplied, isCrit: info.isCrit, monsterDied: result.died, result, v2: this.publicState(player) };
  }

  static ultimateBurst(player, monsterManager, CombatManager, currentNow = now()) {
    const v2 = this.normalize(player);
    if (!player.classeId) return { ok: false, reason: 'Escolha uma classe primeiro.' };
    if (player.isDead) return { ok: false, reason: 'Você está derrotado.' };
    if (currentNow < (v2.battle.ultimateCooldownUntil || 0)) return { ok: false, reason: 'Ultimate V2 em recarga.', restanteMs: v2.battle.ultimateCooldownUntil - currentNow };
    if ((v2.battle.fury || 0) < 45) return { ok: false, reason: 'Fúria V2 insuficiente. Ataque para carregar.' };
    const zone = this.activeZone(player);
    const ability = { danoMultiplicador: 4.2 + Math.min(2.1, (v2.battle.combo || 0) * 0.018), bonusCritico: 25 };
    const info = CombatManager.calculateDamage(player, ability);
    const result = monsterManager.takeDamage(info.damage, player.nivel, 'ability');
    v2.battle.fury = Math.max(0, (v2.battle.fury || 0) - 45);
    v2.battle.combo = Math.min(999, (v2.battle.combo || 0) + 8);
    v2.battle.ultimateCooldownUntil = currentNow + 5200;
    return { ok: true, type: 'v2Ultimate', playerId: player.id, playerName: player.nome, classeId: player.classeId, habilidadeId: 'v2_ultimate_burst', habilidadeNome: 'Ruptura ' + zone.nome, visual: { tipo: 'v2Ultimate', cor: zone.color }, icon: '🌌', cooldown: 5200, damage: result.damageApplied, isCrit: info.isCrit, monsterDied: result.died, result, v2: this.publicState(player) };
  }

  static runDungeon(player, dungeonId, LevelManager) {
    const v2 = this.normalize(player);
    const dungeon = byId(V2_DUNGEONS, dungeonId);
    if (!dungeon) return { ok: false, reason: 'Dungeon V2 inválida.' };
    if ((player.nivel || 1) < dungeon.minLevel) return { ok: false, reason: 'Nível insuficiente para esta dungeon.' };
    if (v2.dungeons.keys < dungeon.keyCost) return { ok: false, reason: 'Chaves V2 insuficientes.' };
    v2.dungeons.keys -= dungeon.keyCost;
    v2.dungeons.runs += 1;
    const scale = 1 + Math.max(0, (player.nivel || 1) - dungeon.minLevel) * 0.05;
    const reward = {
      gold: Math.floor(dungeon.rewards.gold * scale),
      xp: Math.floor(dungeon.rewards.xp * scale),
      gems: dungeon.rewards.gems || 0,
      ore: dungeon.rewards.ore || 0,
      essence: dungeon.rewards.essence || 0,
      relicDust: dungeon.rewards.relicDust || 0,
      bossSouls: dungeon.rewards.bossSouls || 0
    };
    addCurrency(player, reward);
    LevelManager.addXP(player, reward.xp);
    v2.dungeons.best[dungeon.id] = Math.max(v2.dungeons.best[dungeon.id] || 0, dungeon.waves);
    v2.dungeons.history.push({ id: dungeon.id, at: now(), reward });
    this.autoUnlock(player);
    return { ok: true, type: 'dungeon', dungeon, reward, v2: this.publicState(player) };
  }

  static claimChapter(player, chapterId) {
    const v2 = this.normalize(player);
    const chapter = byId(V2_CHAPTERS, chapterId);
    if (!chapter) return { ok: false, reason: 'Capítulo inválido.' };
    if (!this.chapterReady(player, chapter)) return { ok: false, reason: 'Objetivo do capítulo ainda não concluído.' };
    if (v2.campaign.claimed.includes(chapter.id)) return { ok: false, reason: 'Capítulo já coletado.' };
    if (!v2.campaign.completed.includes(chapter.id)) v2.campaign.completed.push(chapter.id);
    v2.campaign.claimed.push(chapter.id);
    addCurrency(player, chapter.reward);
    this.autoUnlock(player);
    return { ok: true, type: 'chapter', chapter, reward: chapter.reward, v2: this.publicState(player) };
  }

  static unlockSkin(player, skinId) {
    const v2 = this.normalize(player);
    const skin = byId(V2_SKINS, skinId);
    if (!skin) return { ok: false, reason: 'Visual inválido.' };
    if (v2.visuals.unlockedSkins.includes(skin.id)) {
      v2.visuals.aura = skin.id;
      return { ok: true, type: 'skinEquip', skin, v2: this.publicState(player) };
    }
    for (const [key, value] of Object.entries(skin.cost || {})) {
      if ((v2.resources[key] || 0) < value) return { ok: false, reason: 'Recursos insuficientes para desbloquear este visual.' };
    }
    for (const [key, value] of Object.entries(skin.cost || {})) v2.resources[key] -= value;
    v2.visuals.unlockedSkins.push(skin.id);
    v2.visuals.aura = skin.id;
    return { ok: true, type: 'skinUnlock', skin, v2: this.publicState(player) };
  }

  static setVisual(player, patch = {}) {
    const v2 = this.normalize(player);
    if (patch.quality) v2.visuals.quality = String(patch.quality).slice(0, 20);
    if (patch.showCompanions != null) v2.visuals.showCompanions = !!patch.showCompanions;
    if (patch.showMinions != null) v2.visuals.showMinions = !!patch.showMinions;
    if (patch.camera != null) v2.visuals.camera = !!patch.camera;
    if (patch.style) v2.battle.style = String(patch.style).slice(0, 20);
    return { ok: true, type: 'visual', v2: this.publicState(player) };
  }
}

module.exports = V2GameDirector;
