
(function () {
  'use strict';

  var LEVEL_CAP = 80;
  var XP_TABLE = {};
  for (var level = 1; level <= LEVEL_CAP; level++) {
    XP_TABLE[level] = level >= LEVEL_CAP ? 0 : Math.floor(100 + level * 55 + Math.pow(level, 1.86) * 38);
  }

  function buildItems(classId, namesBySlot, color) {
    var rarities = ['comum', 'raro', 'épico', 'lendário', 'mítico'];
    var icons = { arma: '⚔️', anel: '💍', colar: '📿', ornamento: '✨' };
    var slotOrder = ['arma', 'anel', 'colar', 'ornamento'];
    var items = [];

    slotOrder.forEach(function (slot) {
      namesBySlot[slot].forEach(function (name, index) {
        var tier = index + 1;
        var requiredLevel = 1 + (index * 8);
        var rarity = rarities[Math.min(rarities.length - 1, index)];
        var stats = { ataque: 0, defesa: 0, critico: 0, hp: 0, mana: 0 };

        if (slot === 'arma') {
          stats.ataque = 8 + tier * 7;
          stats.critico = classId === 'arqueiro' ? tier * 2 : (classId === 'mago' ? tier : 0);
        } else if (slot === 'anel') {
          stats.critico = 2 + tier * 2;
          stats.ataque = 2 + tier * 2;
        } else if (slot === 'colar') {
          stats.hp = 15 + tier * 18;
          stats.ataque = 1 + tier * 2;
          stats.mana = classId === 'mago' ? 12 + tier * 8 : 0;
        } else if (slot === 'ornamento') {
          stats.defesa = 4 + tier * 4;
          stats.hp = 12 + tier * 14;
          stats.critico = classId === 'guerreiro' ? tier : 1 + Math.floor(tier / 2);
        }

        items.push({
          id: classId + '_' + slot + '_' + tier,
          classeId: classId,
          nome: name,
          slot: slot,
          raridade: rarity,
          requiredLevel: requiredLevel,
          cor: color,
          icon: icons[slot],
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
      asset: {
        sprite: 'assets/characters/guerreiro.png',
        portrait: 'assets/characters/guerreiro_portrait.png'
      },
      corPrimaria: '#c84840',
      corSecundaria: '#ffe69b',
      corParticulaIdle: '#ff6f61',
      baseStats: { maxHp: 240, mana: 40, baseDano: 17, multiplicadorNivel: 3.25, defesa: 26, critico: 8 },
      idleDescricao: 'Escudo alto, espada pesada e presença imponente na linha de frente.',
      habilidades: [
        { id: 'golpe_brutal', nome: 'Golpe Brutal', descricao: 'Corte pesado de espada.', cooldown: 7000, danoMultiplicador: 1.7, bonusCritico: 5, visual: { cor: '#ff7b6b' } },
        { id: 'muralha_de_aco', nome: 'Muralha de Aço', descricao: 'Investida com escudo energizado.', cooldown: 11000, danoMultiplicador: 2.2, visual: { cor: '#f6d36a' } },
        { id: 'impacto_colossal', nome: 'Impacto Colossal', descricao: 'Salto e impacto devastador.', cooldown: 16000, danoMultiplicador: 2.9, visual: { cor: '#d95b43' } },
        { id: 'fortaleza_do_guardiao', nome: 'Fortaleza do Guardião', descricao: 'Ultimate do guerreiro com energia dourada.', cooldown: 30000, danoMultiplicador: 4.8, bonusCritico: 15, visual: { cor: '#fff0b4' } }
      ]
    },
    arqueiro: {
      id: 'arqueiro',
      nome: 'Lyra, Sombra Verde',
      nomeCurto: 'Arqueira',
      tipoIcone: '🏹',
      papel: 'Retaguarda / Crítico',
      asset: {
        sprite: 'assets/characters/arqueiro.png',
        portrait: 'assets/characters/arqueiro_portrait.png'
      },
      corPrimaria: '#1f8c58',
      corSecundaria: '#8ef0b1',
      corParticulaIdle: '#6cf5a4',
      baseStats: { maxHp: 155, mana: 90, baseDano: 21, multiplicadorNivel: 3.9, defesa: 10, critico: 24 },
      idleDescricao: 'Postura leve, arco preciso e disparos rápidos.',
      habilidades: [
        { id: 'flecha_precisa', nome: 'Flecha Precisa', descricao: 'Disparo certeiro de longo alcance.', cooldown: 6500, danoMultiplicador: 1.85, bonusCritico: 10, visual: { cor: '#76ffc6' } },
        { id: 'rajada_tripla', nome: 'Rajada Tripla', descricao: 'Três flechas em sequência.', cooldown: 9500, danoMultiplicador: 2.3, visual: { cor: '#44dca2' } },
        { id: 'passo_sombrio', nome: 'Passo Sombrio', descricao: 'Desloca-se e dispara uma flecha espiritual.', cooldown: 14000, danoMultiplicador: 2.75, bonusCritico: 18, visual: { cor: '#11b37b' } },
        { id: 'chuva_de_flechas', nome: 'Chuva de Flechas', descricao: 'Ultimate da arqueira.', cooldown: 30000, danoMultiplicador: 4.6, bonusCritico: 28, visual: { cor: '#caffdc' } }
      ]
    },
    mago: {
      id: 'mago',
      nome: 'Elyon, o Arcano Azul',
      nomeCurto: 'Mago Arcanjo',
      tipoIcone: '🪽',
      papel: 'DPS mágico / Controle',
      asset: {
        sprite: 'assets/characters/mago.png',
        portrait: 'assets/characters/mago_portrait.png'
      },
      corPrimaria: '#5da9ff',
      corSecundaria: '#d7ebff',
      corParticulaIdle: '#9bd0ff',
      baseStats: { maxHp: 125, mana: 320, baseDano: 26, multiplicadorNivel: 4.35, defesa: 8, critico: 16 },
      idleDescricao: 'Mago alado com asas de arcanjo, aura azul e magia celestial.',
      habilidades: [
        { id: 'chuva_celestial', nome: 'Chuva Celestial', descricao: 'Fragmentos de luz caem do céu.', cooldown: 7000, danoMultiplicador: 1.95, visual: { cor: '#6fc9ff' } },
        { id: 'lanca_serafica', nome: 'Lança Seráfica', descricao: 'Lança de energia angelical.', cooldown: 10500, danoMultiplicador: 2.5, visual: { cor: '#9fe2ff' } },
        { id: 'prisma_arcano', nome: 'Prisma Arcano', descricao: 'Prisma mágico concentrado.', cooldown: 15000, danoMultiplicador: 2.95, bonusCritico: 10, visual: { cor: '#6b79ff' } },
        { id: 'juizo_do_arcanjo', nome: 'Juízo do Arcanjo', descricao: 'Ultimate celestial do mago.', cooldown: 30000, danoMultiplicador: 5.0, bonusCritico: 16, visual: { cor: '#ffffff' } }
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
    { id: 'skeleton', nome: 'Esqueleto Espadachim', tipo: 'elite', asset: 'assets/monsters/skeleton.png', hpBase: 155, xpBase: 55, goldBase: 18 },
    { id: 'dragon', nome: 'Dragão Elemental', tipo: 'boss', asset: 'assets/monsters/dragon.png', hpBase: 780, xpBase: 260, goldBase: 85 }
  ];

  var WING_LEVELS = [
    { nivel: 1, nome: 'Asas Iniciais', minLevel: 1 },
    { nivel: 2, nome: 'Asas Refinadas', minLevel: 10 },
    { nivel: 3, nome: 'Asas Celestiais', minLevel: 25 },
    { nivel: 4, nome: 'Asas Divinas', minLevel: 45 },
    { nivel: 5, nome: 'Asas Supremas', minLevel: 65 }
  ];

  var EXPORTS = {
    LEVEL_CAP: LEVEL_CAP,
    XP_TABLE: XP_TABLE,
    GAME_CLASSES: GAME_CLASSES,
    ITEM_CATALOG: ITEM_CATALOG,
    MONSTERS: MONSTERS,
    WING_LEVELS: WING_LEVELS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EXPORTS;
  } else {
    window.LEVEL_CAP = LEVEL_CAP;
    window.XP_TABLE = XP_TABLE;
    window.GAME_CLASSES = GAME_CLASSES;
    window.ITEM_CATALOG = ITEM_CATALOG;
    window.MONSTERS = MONSTERS;
    window.WING_LEVELS = WING_LEVELS;
  }
})();
