(function () {
  'use strict';

  var LEVEL_CAP = 80;

  // XP necessária para subir do nível atual para o próximo.
  // Exemplo: XP_TABLE[1] = XP necessária para sair do Nv. 1 e ir ao Nv. 2.
  var XP_TABLE = {};
  for (var level = 1; level <= LEVEL_CAP; level++) {
    XP_TABLE[level] = level >= LEVEL_CAP
      ? 0
      : Math.floor(90 + (level * 55) + Math.pow(level, 1.82) * 42);
  }

  var GAME_CLASSES = {
    guerreiro: {
      id: 'guerreiro',
      nome: 'Kael, Guardião de Ferro',
      nomeCurto: 'Guerreiro',
      tipoIcone: '⚔️',
      asset: { sprite: 'assets/characters/guerreiro.png', portrait: 'assets/characters/guerreiro_portrait.png' },
      papel: 'Tank / DPS corpo a corpo',
      corPrimaria: '#C0392B',
      corSecundaria: '#D4AF37',
      corTerciaria: '#FFFFFF',
      baseStats: {
        maxHp: 260,
        mana: 30,
        baseDano: 18,
        multiplicadorNivel: 3.2,
        defesa: 24,
        velocidade: 1.0,
        critico: 8
      },
      especialidade: { critico: 1, mobilidade: 2, defesa: 5 },
      idleDescricao: 'Linha de frente. Escudo alto, espada pesada e partículas vermelhas subindo ao redor.',
      corParticulaIdle: '#E74C3C',
      lore: 'Antigo capitão de Valdoria, Kael protege o grupo como uma muralha viva enquanto busca redenção nas masmorras corrompidas.',
      habilidades: [
        {
          id: 'muralha_divina',
          nome: 'Muralha Divina',
          descricao: 'Finca o escudo no chão e causa dano pesado ao inimigo atual.',
          cooldown: 12000,
          danoMultiplicador: 1.75,
          visual: { tipo: 'barreira', cor: '#D4AF37' }
        },
        {
          id: 'impacto_colossal',
          nome: 'Impacto Colossal',
          descricao: 'Salta e cai violentamente, causando dano brutal.',
          cooldown: 16000,
          danoMultiplicador: 2.25,
          visual: { tipo: 'impacto_solo', cor: '#E74C3C' }
        },
        {
          id: 'escudo_espelhado',
          nome: 'Escudo Espelhado',
          descricao: 'Concentra energia no escudo e libera uma onda dourada.',
          cooldown: 22000,
          danoMultiplicador: 2.75,
          visual: { tipo: 'espelho', cor: '#F1C40F' }
        }
      ],
      ultimate: {
        id: 'fortaleza_guardiao',
        nome: 'Fortaleza do Guardião',
        descricao: 'Invoca uma fortaleza de cristal e desfere um golpe massivo.',
        cooldown: 90000,
        danoMultiplicador: 6.5,
        visual: { tipo: 'fortaleza', cor: '#D4AF37' }
      }
    },

    arqueiro: {
      id: 'arqueiro',
      nome: 'Lyra, Sombra Verde',
      nomeCurto: 'Arqueira',
      tipoIcone: '🏹',
      asset: { sprite: 'assets/characters/arqueiro.png', portrait: 'assets/characters/arqueiro_portrait.png' },
      papel: 'DPS rápido / Crítico',
      corPrimaria: '#1E8449',
      corSecundaria: '#17A2B8',
      corTerciaria: '#FFFFFF',
      baseStats: {
        maxHp: 145,
        mana: 85,
        baseDano: 22,
        multiplicadorNivel: 3.8,
        defesa: 10,
        velocidade: 1.35,
        critico: 24
      },
      especialidade: { critico: 5, mobilidade: 4, defesa: 2 },
      idleDescricao: 'Retaguarda. Arco preparado, postura leve e flechas espirituais orbitando.',
      corParticulaIdle: '#2ECC71',
      lore: 'Criada nas florestas de Eldara, Lyra elimina ameaças antes que elas alcancem o grupo.',
      habilidades: [
        {
          id: 'flecha_fantasma',
          nome: 'Flecha Fantasma',
          descricao: 'Uma flecha etérea que atravessa a defesa do alvo.',
          cooldown: 9000,
          danoMultiplicador: 1.95,
          visual: { tipo: 'flecha_dividida', cor: '#2ECC71' }
        },
        {
          id: 'tempestade_mil_flechas',
          nome: 'Tempestade de Mil Flechas',
          descricao: 'Invoca centenas de flechas mágicas sobre o inimigo.',
          cooldown: 18000,
          danoMultiplicador: 3.0,
          visual: { tipo: 'chuva_flechas', cor: '#16A085' }
        },
        {
          id: 'instinto_mortal',
          nome: 'Instinto Mortal',
          descricao: 'Disparo concentrado com chance elevada de crítico.',
          cooldown: 14000,
          danoMultiplicador: 2.35,
          bonusCritico: 30,
          visual: { tipo: 'buff_aura', cor: '#1ABC9C' }
        }
      ],
      ultimate: {
        id: 'eclipse_cacador',
        nome: 'Eclipse do Caçador',
        descricao: 'Cobre o céu com flechas luminosas em um ataque devastador.',
        cooldown: 95000,
        danoMultiplicador: 7.2,
        bonusCritico: 45,
        visual: { tipo: 'eclipse', cor: '#0B5345' }
      }
    },

    mago: {
      id: 'mago',
      nome: 'Elyon, o Arcano Azul',
      nomeCurto: 'Mago Arcanjo',
      tipoIcone: '🪽',
      asset: { sprite: 'assets/characters/mago.png', portrait: 'assets/characters/mago_portrait.png' },
      papel: 'DPS mágico / Controle / Suporte',
      corPrimaria: '#5DADE2',
      corSecundaria: '#8E44AD',
      corTerciaria: '#FFFFFF',
      baseStats: {
        maxHp: 120,
        mana: 320,
        baseDano: 26,
        multiplicadorNivel: 4.25,
        defesa: 8,
        velocidade: 1.08,
        critico: 16
      },
      especialidade: { cura: 5, magia: 5, controle: 3 },
      idleDescricao: 'Mago de asas de arcanjo. Cajado flutuante, auréola arcana, runas e penas de luz ao redor.',
      corParticulaIdle: '#AF7AC5',
      lore: 'Elyon nasceu na Academia de Lunaris e despertou asas de arcanjo ao tocar um núcleo celestial proibido.',
      asas: {
        tipo: 'arcanjo',
        descricao: 'Duas asas grandes, brancas e azuladas, com penas luminosas, brilho dourado nas pontas e runas flutuantes.'
      },
      habilidades: [
        {
          id: 'chuva_celestial',
          nome: 'Chuva Celestial',
          descricao: 'Meteoro sagrado que explode em luz azul e dourada.',
          cooldown: 11000,
          danoMultiplicador: 2.2,
          visual: { tipo: 'meteoros', cor: '#5DADE2' }
        },
        {
          id: 'cura_suprema',
          nome: 'Lança Seráfica',
          descricao: 'Conjura uma lança de luz angelical contra o inimigo.',
          cooldown: 15000,
          danoMultiplicador: 2.75,
          visual: { tipo: 'circulo_cura', cor: '#FFFFFF' }
        },
        {
          id: 'prisma_arcano',
          nome: 'Prisma Arcano',
          descricao: 'Feixe mágico que se divide em raios arcanos.',
          cooldown: 17000,
          danoMultiplicador: 3.15,
          visual: { tipo: 'prisma', cor: '#8E44AD' }
        }
      ],
      ultimate: {
        id: 'santuario_celestial',
        nome: 'Juízo do Arcanjo',
        descricao: 'Abre as asas de arcanjo e invoca um julgamento celestial.',
        cooldown: 100000,
        danoMultiplicador: 8.0,
        visual: { tipo: 'arvore_cristal', cor: '#FFFFFF' }
      }
    }
  };

  // Asas visuais evoluem por nível do personagem, separadas da XP de level.
  var WING_LEVELS = [
    { nivel: 1, nome: 'Asas Iniciais', minLevel: 1 },
    { nivel: 2, nome: 'Asas Refinadas', minLevel: 10 },
    { nivel: 3, nome: 'Asas Celestiais', minLevel: 25 },
    { nivel: 4, nome: 'Asas Divinas', minLevel: 45 },
    { nivel: 5, nome: 'Asas Supremas', minLevel: 65 }
  ];

  var MONSTERS = [
    { id: 'slime_cristal', nome: 'Slime de Cristal', minLevel: 1, hpBase: 70, xpBase: 35, tipo: 'normal' },
    { id: 'cogumelo_sombrio', nome: 'Cogumelo Sombrio', minLevel: 3, hpBase: 110, xpBase: 55, tipo: 'normal' },
    { id: 'besouro_runa', nome: 'Besouro de Runa', minLevel: 8, hpBase: 190, xpBase: 95, tipo: 'normal' },
    { id: 'sentinela_aco', nome: 'Sentinela de Aço', minLevel: 15, hpBase: 340, xpBase: 170, tipo: 'elite' },
    { id: 'guardiao_abissal', nome: 'Guardião Abissal', minLevel: 30, hpBase: 650, xpBase: 350, tipo: 'elite' },
    { id: 'arcanjo_corrompido', nome: 'Arcanjo Corrompido', minLevel: 50, hpBase: 1200, xpBase: 760, tipo: 'elite' }
  ];

  var EXPORTS = {
    LEVEL_CAP: LEVEL_CAP,
    GAME_CLASSES: GAME_CLASSES,
    WING_LEVELS: WING_LEVELS,
    XP_TABLE: XP_TABLE,
    MONSTERS: MONSTERS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EXPORTS;
  } else {
    window.LEVEL_CAP = LEVEL_CAP;
    window.GAME_CLASSES = GAME_CLASSES;
    window.WING_LEVELS = WING_LEVELS;
    window.XP_TABLE = XP_TABLE;
    window.MONSTERS = MONSTERS;
  }
})();
