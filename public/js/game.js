/**
 * public/js/game.js
 * -----------------------------------------------------------------------
 * Front-end do MMORPG Idle.
 *
 * Este arquivo é carregado por ÚLTIMO no index.html, depois de:
 *   1) https://cdn.socket.io/4.8.3/socket.io.min.js  -> define window.io
 *   2) shared/classes.js                              -> define window.GAME_CLASSES
 *
 * Tudo aqui dentro está em uma IIFE com guarda-corpos no topo. Se QUALQUER
 * dependência não tiver carregado, mostramos um erro visível e paramos —
 * em vez de um throw silencioso que deixava a tela toda branca.
 * -----------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // 0) GUARDA-CORPO: é exatamente isto que evita o ReferenceError + tela branca
  // ---------------------------------------------------------------------
  function falhaFatal(msg) {
    var el = document.getElementById('fatal-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      // Se nem o DOM básico existir, ao menos isto aparece no console
      // em vez de travar tudo sem deixar rastro.
      // eslint-disable-next-line no-console
      console.error(msg);
    }
  }

  if (typeof io === 'undefined') {
    falhaFatal(
      'Não foi possível carregar o Socket.io (CDN). Verifique sua conexão ' +
      'e recarregue a página. [io is not defined]'
    );
    return;
  }

  if (typeof window.GAME_CLASSES === 'undefined') {
    falhaFatal(
      'Não foi possível carregar shared/classes.js. Confira se o arquivo ' +
      'existe em /shared/classes.js e se o <script> está antes de game.js.'
    );
    return;
  }

  // Captura qualquer erro não tratado no resto do arquivo e mostra na tela
  // em vez de deixar o canvas congelado e a página muda.
  window.addEventListener('error', function (e) {
    falhaFatal('Erro inesperado: ' + e.message);
  });

  try {
    iniciarJogo();
  } catch (err) {
    falhaFatal('Falha ao iniciar o jogo: ' + err.message);
  }

  // =======================================================================
  // 1) TUDO A PARTIR DAQUI SÓ RODA SE AS DUAS DEPENDÊNCIAS EXISTIREM
  // =======================================================================
  function iniciarJogo() {
    var GAME_CLASSES = window.GAME_CLASSES;
    var WING_LEVELS = window.WING_LEVELS || [];

    // Conecta no MESMO host/porta que serviu a página — nunca hardcode
    // "http://localhost:3000". Isso evita bugs quando você fizer deploy
    // (Render, Railway, VPS, etc.) ou testar de outro dispositivo na rede.
    var socket = io();

    // -------------------------------------------------------------------
    // Estado local
    // -------------------------------------------------------------------
    var state = {
      meuId: null,
      meuPlayer: null,
      players: {},          // id -> player (visão pública do servidor)
      particulas: [],        // partículas ambiente + de habilidades
      efeitosAtivos: [],     // efeitos visuais de habilidades em andamento
      tempoInicio: performance.now()
    };

    // -------------------------------------------------------------------
    // DOM
    // -------------------------------------------------------------------
    var canvas = document.getElementById('game-canvas');
    var ctx = canvas.getContext('2d');
    var classSelectEl = document.getElementById('class-select');
    var classCardsEl = document.getElementById('class-cards');
    var abilityBarEl = document.getElementById('ability-bar');
    var hudNome = document.getElementById('hud-nome');
    var hudClasse = document.getElementById('hud-classe');
    var hudAsaNivel = document.getElementById('hud-asa-nivel');
    var hudAsaNome = document.getElementById('hud-asa-nome');
    var hudXpFill = document.getElementById('hud-xp-fill');
    var hudOnlineCount = document.getElementById('hud-online-count');

    function ajustarCanvas() {
      var stage = document.getElementById('stage');
      canvas.width = stage.clientWidth;
      canvas.height = stage.clientHeight;
    }
    window.addEventListener('resize', ajustarCanvas);
    ajustarCanvas();

    // -------------------------------------------------------------------
    // 2) Tela de seleção de classe (gerada a partir de shared/classes.js)
    // -------------------------------------------------------------------
    function montarTelaSelecaoClasse() {
      classCardsEl.innerHTML = '';
      Object.keys(GAME_CLASSES).forEach(function (classeId) {
        var classe = GAME_CLASSES[classeId];
        var card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.classe = classeId;
        card.innerHTML =
          '<div class="icone">' + classe.tipoIcone + '</div>' +
          '<div class="nome">' + classe.nome + '</div>' +
          '<div class="desc">' + classe.idleDescricao + '</div>';
        card.addEventListener('click', function () {
          socket.emit('selectClass', { classeId: classeId });
        });
        classCardsEl.appendChild(card);
      });
    }

    function montarBarraHabilidades(classeId) {
      var classe = GAME_CLASSES[classeId];
      abilityBarEl.innerHTML = '';

      var todasHabilidades = classe.habilidades.concat([classe.ultimate]);
      todasHabilidades.forEach(function (habilidade) {
        var slot = document.createElement('div');
        slot.className = 'ability-slot';
        slot.dataset.habilidade = habilidade.id;
        slot.title = habilidade.descricao;
        slot.textContent = habilidade.nome;

        var overlay = document.createElement('div');
        overlay.className = 'cooldown-overlay hidden';
        slot.appendChild(overlay);

        slot.addEventListener('click', function () {
          socket.emit('useAbility', { habilidadeId: habilidade.id });
        });

        abilityBarEl.appendChild(slot);
      });
    }

    function iniciarCooldownVisual(habilidadeId, duracaoMs) {
      var slot = abilityBarEl.querySelector('[data-habilidade="' + habilidadeId + '"]');
      if (!slot) return;
      var overlay = slot.querySelector('.cooldown-overlay');
      overlay.classList.remove('hidden');

      var restante = duracaoMs;
      overlay.textContent = Math.ceil(restante / 1000);
      var intervalo = setInterval(function () {
        restante -= 250;
        if (restante <= 0) {
          clearInterval(intervalo);
          overlay.classList.add('hidden');
          return;
        }
        overlay.textContent = Math.ceil(restante / 1000);
      }, 250);
    }

    // -------------------------------------------------------------------
    // 3) HUD
    // -------------------------------------------------------------------
    function atualizarHud() {
      if (!state.meuPlayer) return;
      var classe = GAME_CLASSES[state.meuPlayer.classeId];

      hudNome.textContent = state.meuPlayer.nome;
      hudClasse.textContent = classe ? classe.nome : '—';
      hudAsaNivel.textContent = state.meuPlayer.asaNivel;

      var estagioAtual = WING_LEVELS.find(function (w) {
        return w.nivel === state.meuPlayer.asaNivel;
      });
      hudAsaNome.textContent = estagioAtual ? estagioAtual.nome : '—';

      var proximoEstagio = WING_LEVELS.find(function (w) {
        return w.nivel === state.meuPlayer.asaNivel + 1;
      });
      if (proximoEstagio) {
        var estagioBase = estagioAtual ? estagioAtual.minXp : 0;
        var progresso = (state.meuPlayer.xp - estagioBase) / (proximoEstagio.minXp - estagioBase);
        hudXpFill.style.width = Math.min(100, Math.max(0, progresso * 100)) + '%';
      } else {
        hudXpFill.style.width = '100%'; // nível máximo de asa
      }

      hudOnlineCount.textContent = Object.keys(state.players).length;
    }

    // -------------------------------------------------------------------
    // 4) Render: jogadores, asas de cristal e partículas (placeholders
    //    geométricos — troque por sprite sheets reais quando tiver a arte).
    // -------------------------------------------------------------------
    function desenharAsas(x, y, nivel, cor) {
      var camadas = nivel; // nº de camadas escala com o nível (1 a 5)
      for (var i = 0; i < camadas; i++) {
        var tamanho = 14 + i * 6;
        var alpha = 0.85 - i * 0.12;
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.fillStyle = cor;

        // asa esquerda
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x - 4 - tamanho, y - tamanho * 0.6 - i * 3);
        ctx.lineTo(x - 4 - tamanho * 0.6, y + tamanho * 0.3);
        ctx.closePath();
        ctx.fill();

        // asa direita
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + 4 + tamanho, y - tamanho * 0.6 - i * 3);
        ctx.lineTo(x + 4 + tamanho * 0.6, y + tamanho * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Nível 4+ : fragmentos orbitando (Cristal Divino / Asa Suprema)
      if (nivel >= 4) {
        var t = performance.now() / 600;
        for (var f = 0; f < 5; f++) {
          var ang = t + (f * Math.PI * 2) / 5;
          var ox = x + Math.cos(ang) * 26;
          var oy = y + Math.sin(ang) * 14 - 10;
          ctx.fillStyle = cor;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(ox - 2, oy - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }
    }

    function desenharJogador(player) {
      var classe = GAME_CLASSES[player.classeId];
      if (!classe) return;

      var x = player.posicao.x + 80;
      var y = player.posicao.y + 80;

      // Idle: leve flutuação senoidal — todas as classes "respiram"
      var t = (performance.now() - state.tempoInicio) / 1000;
      var bob = Math.sin(t * 1.6 + (player.id.charCodeAt(0) || 0)) * 4;
      y += bob;

      desenharAsas(x, y - 6, player.asaNivel, classe.corPrimaria);

      // Corpo placeholder (substituir por sprite real do GDD)
      ctx.save();
      ctx.fillStyle = classe.corPrimaria;
      ctx.strokeStyle = classe.corSecundaria;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Nome + nível acima da cabeça
      ctx.fillStyle = '#ece9f5';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(player.nome, x, y - 26);

      // Partícula ambiente de idle (spawna ocasionalmente)
      if (Math.random() < 0.05) {
        state.particulas.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + 10,
          vy: -0.4 - Math.random() * 0.3,
          vida: 1,
          cor: classe.corParticulaIdle
        });
      }
    }

    function desenharParticulas() {
      state.particulas.forEach(function (p) {
        p.y += p.vy;
        p.vida -= 0.012;
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = p.cor;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      ctx.globalAlpha = 1;
      state.particulas = state.particulas.filter(function (p) { return p.vida > 0; });
    }

    function desenharEfeitosHabilidade() {
      var agora = performance.now();
      state.efeitosAtivos.forEach(function (efeito) {
        var progresso = (agora - efeito.inicio) / efeito.duracao;
        var raio = 10 + progresso * 60;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progresso);
        ctx.strokeStyle = efeito.cor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(efeito.x, efeito.y, raio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      state.efeitosAtivos = state.efeitosAtivos.filter(function (efeito) {
        return agora - efeito.inicio < efeito.duracao;
      });
    }

    function loopRender() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      Object.values(state.players).forEach(function (player) {
        if (player.classeId) desenharJogador(player);
      });
      desenharParticulas();
      desenharEfeitosHabilidade();
      requestAnimationFrame(loopRender);
    }

    // -------------------------------------------------------------------
    // 5) Eventos do servidor
    // -------------------------------------------------------------------
    socket.on('connect_error', function (err) {
      falhaFatal('Não foi possível conectar ao servidor: ' + err.message);
    });

    socket.on('init', function (data) {
      state.meuId = data.you.id;
      state.meuPlayer = data.you;
      data.players.forEach(function (p) { state.players[p.id] = p; });

      if (!state.meuPlayer.classeId) {
        montarTelaSelecaoClasse();
        classSelectEl.classList.remove('hidden');
      }
      atualizarHud();
    });

    socket.on('playerJoined', function (player) {
      state.players[player.id] = player;
      atualizarHud();
    });

    socket.on('playerUpdated', function (player) {
      state.players[player.id] = player;
      if (player.id === state.meuId) {
        state.meuPlayer = player;
        classSelectEl.classList.add('hidden');
        montarBarraHabilidades(player.classeId);
      }
      atualizarHud();
    });

    socket.on('playerLeft', function (data) {
      delete state.players[data.id];
      atualizarHud();
    });

    socket.on('gameState', function (lista) {
      lista.forEach(function (p) {
        state.players[p.id] = p;
        if (p.id === state.meuId) state.meuPlayer = p;
      });
      atualizarHud();
    });

    socket.on('abilityUsed', function (evento) {
      var jogador = state.players[evento.playerId];
      if (!jogador) return;

      state.efeitosAtivos.push({
        x: jogador.posicao.x + 80,
        y: jogador.posicao.y + 80,
        cor: evento.visual.cor,
        inicio: performance.now(),
        duracao: 700
      });

      if (evento.playerId === state.meuId) {
        var classe = GAME_CLASSES[evento.classeId];
        var habilidade =
          classe.habilidades.concat([classe.ultimate]).find(function (h) {
            return h.id === evento.habilidadeId;
          });
        if (habilidade) iniciarCooldownVisual(habilidade.id, habilidade.cooldown);
      }
    });

    socket.on('cooldownRejected', function (info) {
      // eslint-disable-next-line no-console
      console.warn('Habilidade em cooldown ainda por', info.restanteMs, 'ms');
    });

    socket.on('errorMsg', function (msg) {
      // eslint-disable-next-line no-console
      console.warn('[servidor]', msg);
    });

    // -------------------------------------------------------------------
    // 6) Start
    // -------------------------------------------------------------------
    requestAnimationFrame(loopRender);
  }
})();
