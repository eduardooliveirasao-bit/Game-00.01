(function () {
  'use strict';

  var LEVEL_CAP = 80;
  var XP_TABLE = {};
  for (var level = 1; level <= LEVEL_CAP; level++) {
    XP_TABLE[level] = level >= LEVEL_CAP ? 0 : Math.floor(110 + level * 58 + Math.pow(level, 1.88) * 39);
  }

  function buildItems(classId, namesBySlot, color) {
    var rarities = ['comum', 'raro', 'épico', 'lendário', 'mítico'];
    var icons = { arma: '⚔️', anel: '💍', colar: '📿', ornamento: '✨' };
    var slotOrder = ['arma', 'anel', 'colar', 'ornamento'];
    var items = [];

    slotOrder.forEach(function (slot) {
      namesBySlot[slot].forEach(function (name, index) {
        var tier = index + 1;
        var stats = { ataque: 0, defesa: 0, critico: 0, hp: 0, mana: 0 };
        if (slot === 'arma') {
          stats.ataque = 9 + tier * 7;
          stats.critico = classId === 'arqueiro' ? tier * 2 : (classId === 'mago' ? tier : Math.floor(tier / 2));
          stats.mana = classId === 'mago' ? tier * 6 : 0;
        } else if (slot === 'anel') {
          stats.ataque = 2 + tier * 2;
          stats.critico = 3 + tier * 2;
          stats.mana = classId === 'mago' ? 4 + tier * 6 : 0;
        } else if (slot === 'colar') {
          stats.hp = 18 + tier * 20;
          stats.defesa = 2 + tier * 2;
          stats.mana = classId === 'mago' ? 8 + tier * 5 : 0;
        } else if (slot === 'ornamento') {
          stats.hp = 16 + tier * 15;
          stats.defesa = 5 + tier * 4;
          stats.critico = classId === 'arqueiro' ? tier : Math.max(1, Math.floor(tier / 2));
          stats.mana = classId === 'mago' ? 6 + tier * 4 : 0;
        }

        items.push({
          id: classId + '_' + slot + '_' + tier,
          classeId: classId,
          nome: name,
          slot: slot,
          raridade: rarities[Math.min(rarities.length - 1, index)],
          requiredLevel: 1 + index * 8,
          cor: color,
          icon: icons[slot],
          asset: 'assets/items/' + slot + '_' + rarities[Math.min(rarities.length - 1, index)] + '.png',
          sockets: Math.min(3, 1 + Math.floor(index / 2)),
          gems: [],
          visual: { glow: color, wing: slot === 'ornamento' && (name.indexOf('Asa') >= 0 || name.indexOf('Pena') >= 0 || name.indexOf('Sigilo') >= 0), tier: tier },
          stats: stats
        });
      });
    });

    return items;
  }

  var GAME_CLASSES = {
    guerreiro: {
      id: 'guerreiro',
      nome: 'Kael, Guardião de Ferro',
      nomeCurto: 'Guerreiro',
      tipoIcone: '⚔️',
      papel: 'Linha de frente / Tank',
      asset: { sprite: 'assets/characters/guerreiro.png', portrait: 'assets/characters/guerreiro_portrait.png' },
      corPrimaria: '#c84840',
      corSecundaria: '#ffe69b',
      corParticulaIdle: '#ff7b6b',
      baseStats: { maxHp: 250, mana: 70, baseDano: 18, multiplicadorNivel: 3.35, defesa: 28, critico: 8 },
      idleDescricao: 'Escudo alto, espada pesada e postura inabalável.',
      habilidades: [
        { id: 'golpe_brutal', nome: 'Golpe Brutal', descricao: 'Corte pesado de espada.', cooldown: 6500, manaCost: 18, danoMultiplicador: 1.7, bonusCritico: 5, visual: { cor: '#ff7b6b', tipo: 'slash' }, icon: 'assets/skills/golpe_brutal.png' },
        { id: 'muralha_de_aco', nome: 'Muralha de Aço', descricao: 'Investida com escudo energizado.', cooldown: 10500, manaCost: 28, danoMultiplicador: 2.15, visual: { cor: '#f6d36a', tipo: 'shieldBurst' }, icon: 'assets/skills/muralha_de_aco.png' },
        { id: 'impacto_colossal', nome: 'Impacto Colossal', descricao: 'Salto e impacto devastador.', cooldown: 14500, manaCost: 38, danoMultiplicador: 2.85, visual: { cor: '#d95b43', tipo: 'groundCrack' }, icon: 'assets/skills/impacto_colossal.png' },
        { id: 'fortaleza_do_guardiao', nome: 'Fortaleza do Guardião', descricao: 'Ultimate do guerreiro.', cooldown: 26000, manaCost: 55, danoMultiplicador: 4.7, bonusCritico: 15, visual: { cor: '#fff0b4', tipo: 'holyShockwave' }, icon: 'assets/skills/fortaleza_do_guardiao.png' }
      ]
    },
    arqueiro: {
      id: 'arqueiro',
      nome: 'Lyra, Sombra Verde',
      nomeCurto: 'Arqueira',
      tipoIcone: '🏹',
      papel: 'Retaguarda / Crítico',
      asset: { sprite: 'assets/characters/arqueiro.png', portrait: 'assets/characters/arqueiro_portrait.png' },
      corPrimaria: '#1f8c58',
      corSecundaria: '#8ef0b1',
      corParticulaIdle: '#6cf5a4',
      baseStats: { maxHp: 160, mana: 110, baseDano: 22, multiplicadorNivel: 3.95, defesa: 11, critico: 25 },
      idleDescricao: 'Arco em prontidão, mobilidade e tiros precisos.',
      habilidades: [
        { id: 'flecha_precisa', nome: 'Flecha Precisa', descricao: 'Disparo certeiro de longo alcance.', cooldown: 6000, manaCost: 16, danoMultiplicador: 1.85, bonusCritico: 10, visual: { cor: '#76ffc6', tipo: 'arrowLine' }, icon: 'assets/skills/flecha_precisa.png' },
        { id: 'rajada_tripla', nome: 'Rajada Tripla', descricao: 'Três flechas em sequência.', cooldown: 9000, manaCost: 26, danoMultiplicador: 2.3, visual: { cor: '#44dca2', tipo: 'tripleArrow' }, icon: 'assets/skills/rajada_tripla.png' },
        { id: 'passo_sombrio', nome: 'Passo Sombrio', descricao: 'Disparo espiritual de alta precisão.', cooldown: 13000, manaCost: 34, danoMultiplicador: 2.7, bonusCritico: 18, visual: { cor: '#11b37b', tipo: 'shadowDash' }, icon: 'assets/skills/passo_sombrio.png' },
        { id: 'chuva_de_flechas', nome: 'Chuva de Flechas', descricao: 'Ultimate da arqueira.', cooldown: 26000, manaCost: 52, danoMultiplicador: 4.55, bonusCritico: 28, visual: { cor: '#caffdc', tipo: 'arrowRain' }, icon: 'assets/skills/chuva_de_flechas.png' }
      ]
    },
    mago: {
      id: 'mago',
      nome: 'Elyon, o Arcano Azul',
      nomeCurto: 'Mago Arcanjo',
      tipoIcone: '🪽',
      papel: 'DPS mágico / Controle',
      asset: { sprite: 'assets/characters/mago.png', portrait: 'assets/characters/mago_portrait.png' },
      corPrimaria: '#5da9ff',
      corSecundaria: '#d7ebff',
      corParticulaIdle: '#9bd0ff',
      baseStats: { maxHp: 128, mana: 340, baseDano: 27, multiplicadorNivel: 4.45, defesa: 8, critico: 16 },
      idleDescricao: 'Asas de arcanjo, aura azul e magia celestial.',
      habilidades: [
        { id: 'chuva_celestial', nome: 'Chuva Celestial', descricao: 'Fragmentos de luz caem do céu.', cooldown: 6500, manaCost: 22, danoMultiplicador: 1.95, visual: { cor: '#6fc9ff', tipo: 'meteorShower' }, icon: 'assets/skills/chuva_celestial.png' },
        { id: 'lanca_serafica', nome: 'Lança Seráfica', descricao: 'Lança de energia angelical.', cooldown: 10000, manaCost: 34, danoMultiplicador: 2.45, visual: { cor: '#9fe2ff', tipo: 'holySpear' }, icon: 'assets/skills/lanca_serafica.png' },
        { id: 'prisma_arcano', nome: 'Prisma Arcano', descricao: 'Feixe prismático concentrado.', cooldown: 14500, manaCost: 45, danoMultiplicador: 2.95, bonusCritico: 10, visual: { cor: '#6b79ff', tipo: 'prismBurst' }, icon: 'assets/skills/prisma_arcano.png' },
        { id: 'juizo_do_arcanjo', nome: 'Juízo do Arcanjo', descricao: 'Ultimate celestial do mago.', cooldown: 27000, manaCost: 68, danoMultiplicador: 5.0, bonusCritico: 16, visual: { cor: '#ffffff', tipo: 'angelJudgement' }, icon: 'assets/skills/juizo_do_arcanjo.png' }
      ]
    }
  };

  var ITEM_CATALOG = {
    guerreiro: buildItems('guerreiro', {
      arma: ['Espada de Ferro Vivo', 'Lâmina Rubra', 'Espada do Leão de Valdoria', 'Espada Quebra-Runas', 'Espada do Guardião Supremo'],
      anel: ['Anel do Juramento', 'Anel do Bastião', 'Anel da Vanguarda', 'Anel do Campeão Carmesim', 'Anel do Rei de Ferro'],
      colar: ['Colar do Escudeiro', 'Colar da Honra', 'Colar de Aço Sagrado', 'Colar do General', 'Colar do Guardião Eterno'],
      ornamento: ['Insígnia do Recruta', 'Broche da Muralha', 'Ornamento do Leão', 'Medalha de Guerra', 'Emblema do Trono de Ferro']
    }, '#c84840'),
    arqueiro: buildItems('arqueiro', {
      arma: ['Arco da Folha Nova', 'Arco da Lua Verde', 'Arco das Sombras Silvestres', 'Arco da Caçada Prismática', 'Arco da Rainha da Mata'],
      anel: ['Anel da Mira Fina', 'Anel do Vento', 'Anel do Falcão', 'Anel da Lua Oculta', 'Anel da Caçadora Suprema'],
      colar: ['Colar de Sementes Élficas', 'Colar da Trilha', 'Colar da Brisa', 'Colar da Alvorada Verde', 'Colar do Espírito da Floresta'],
      ornamento: ['Pena do Explorador', 'Pingente de Trevo', 'Ornamento de Ramo Vivo', 'Insígnia da Lua Verde', 'Talismã da Rainha Élfica']
    }, '#1f8c58'),
    mago: buildItems('mago', {
      arma: ['Cajado da Faísca Azul', 'Cajado Prismático', 'Cajado das Asas Sagradas', 'Cajado da Constelação', 'Cajado do Arcanjo Azul'],
      anel: ['Anel do Mana Puro', 'Anel das Runas', 'Anel da Aurora Arcana', 'Anel Celestial', 'Anel do Firmamento Azul'],
      colar: ['Colar da Luz Serena', 'Colar da Estrela Guia', 'Colar de Lunaris', 'Colar do Santuário', 'Colar do Juízo Celestial'],
      ornamento: ['Orbe de Cristal', 'Relicário Azul', 'Emblema Seráfico', 'Asa Cerimonial', 'Sigilo do Arcanjo']
    }, '#5da9ff')
  };

  var MONSTERS = [
    { id: 'slime', nome: 'Slime Verde', tipo: 'normal', asset: 'assets/monsters/slime.png', hpBase: 85, xpBase: 28, goldBase: 10 },
    { id: 'skeleton', nome: 'Esqueleto Espadachim', tipo: 'elite', asset: 'assets/monsters/skeleton.png', hpBase: 160, xpBase: 56, goldBase: 18 },
    { id: 'dragon', nome: 'Dragão Elemental', tipo: 'boss', asset: 'assets/monsters/dragon.png', hpBase: 860, xpBase: 280, goldBase: 90 }
  ];

  var WING_LEVELS = [
    { nivel: 1, nome: 'Asas Iniciais', minLevel: 1 },
    { nivel: 2, nome: 'Asas Refinadas', minLevel: 10 },
    { nivel: 3, nome: 'Asas Celestiais', minLevel: 25 },
    { nivel: 4, nome: 'Asas Divinas', minLevel: 45 },
    { nivel: 5, nome: 'Asas Supremas', minLevel: 65 }
  ];



  var GEM_TYPES = {
    rubi: { id: 'rubi', nome: 'Rubi de Ataque', asset: 'assets/gems/rubi.png', cor: '#ff4965', stats: { ataque: 10, defesa: 0, critico: 0, hp: 0, mana: 0 } },
    safira: { id: 'safira', nome: 'Safira Arcana', asset: 'assets/gems/safira.png', cor: '#6db8ff', stats: { ataque: 4, defesa: 0, critico: 0, hp: 0, mana: 45 } },
    esmeralda: { id: 'esmeralda', nome: 'Esmeralda Vital', asset: 'assets/gems/esmeralda.png', cor: '#66f59d', stats: { ataque: 0, defesa: 3, critico: 0, hp: 80, mana: 0 } },
    topazio: { id: 'topazio', nome: 'Topázio Crítico', asset: 'assets/gems/topazio.png', cor: '#ffd86b', stats: { ataque: 3, defesa: 0, critico: 6, hp: 0, mana: 0 } }
  };

  var MOUNTS = {
    lobo_cristalino: { id: 'lobo_cristalino', nome: 'Lobo Cristalino', asset: 'assets/mounts/lobo_cristalino.png', unlockLevel: 1, bonus: { power: 80, speed: 1.0, ataque: 4, hp: 40 } },
    grifo_dourado: { id: 'grifo_dourado', nome: 'Grifo Dourado', asset: 'assets/mounts/grifo_dourado.png', unlockLevel: 10, bonus: { power: 220, speed: 1.12, ataque: 12, hp: 120 } },
    dragao_mirim: { id: 'dragao_mirim', nome: 'Dragão Mirim Elemental', asset: 'assets/mounts/dragao_mirim.png', unlockLevel: 25, bonus: { power: 520, speed: 1.28, ataque: 28, hp: 260 } }
  };

  var EXPORTS = { LEVEL_CAP: LEVEL_CAP, XP_TABLE: XP_TABLE, GAME_CLASSES: GAME_CLASSES, ITEM_CATALOG: ITEM_CATALOG, MONSTERS: MONSTERS, WING_LEVELS: WING_LEVELS, GEM_TYPES: GEM_TYPES, MOUNTS: MOUNTS };

  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
  else {
    window.LEVEL_CAP = LEVEL_CAP;
    window.XP_TABLE = XP_TABLE;
    window.GAME_CLASSES = GAME_CLASSES;
    window.ITEM_CATALOG = ITEM_CATALOG;
    window.MONSTERS = MONSTERS;
    window.WING_LEVELS = WING_LEVELS;
    window.GEM_TYPES = GEM_TYPES;
    window.MOUNTS = MOUNTS;
  }
})();
