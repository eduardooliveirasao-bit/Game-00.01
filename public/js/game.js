(function () {
  'use strict';

  function falhaFatal(msg) {
    var el = document.getElementById('fatal-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      console.error(msg);
    }
  }

  if (typeof io === 'undefined') {
    falhaFatal('Não foi possível carregar o Socket.io. Verifique a conexão e recarregue a página.');
    return;
  }

  if (typeof window.GAME_CLASSES === 'undefined') {
    falhaFatal('Não foi possível carregar /shared/classes.js antes do game.js.');
    return;
  }

  window.addEventListener('error', function (e) {
    falhaFatal('Erro inesperado: ' + e.message);
  });

  try {
    iniciarJogo();
  } catch (err) {
    falhaFatal('Falha ao iniciar o jogo: ' + err.message);
  }

  function iniciarJogo() {
    var GAME_CLASSES = window.GAME_CLASSES;
    var WING_LEVELS = window.WING_LEVELS || [];
    var LEVEL_CAP = window.LEVEL_CAP || 80;
    var socket = io();

    var state = {
      meuId: null,
      meuPlayer: null,
      players: {},
      monster: null,
      particulas: [],
      efeitosAtivos: [],
      danosFlutuantes: [],
      log: [],
      tempoInicio: performance.now()
    };

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
    var hudXpText = document.getElementById('hud-xp-text');
    var hudOnlineCount = document.getElementById('hud-online-count');

    var enemyName = document.getElementById('enemy-name');
    var enemyLevel = document.getElementById('enemy-level');
    var enemyType = document.getElementById('enemy-type');
    var enemyHpFill = document.getElementById('enemy-hp-fill');
    var enemyHpText = document.getElementById('enemy-hp-text');
    var combatLogEl = document.getElementById('combat-log');

    function ajustarCanvas() {
      var stage = document.getElementById('stage');
      canvas.width = stage.clientWidth;
      canvas.height = stage.clientHeight;
    }
    window.addEventListener('resize', ajustarCanvas);
    ajustarCanvas();

    function montarTelaSelecaoClasse() {
      classCardsEl.innerHTML = '';
      Object.keys(GAME_CLASSES).forEach(function (classeId) {
        var classe = GAME_CLASSES[classeId];
        var card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.classe = classeId;
        card.innerHTML =
          '<div class="icone">' + classe.tipoIcone + '</div>' +
          '<div class="nome">' + classe.nomeCurto + '</div>' +
          '<div class="desc">' + classe.idleDescricao + '</div>';
        card.addEventListener('click', function () {
          socket.emit('selectClass', { classeId: classeId });
        });
        classCardsEl.appendChild(card);
      });
    }

    function montarBarraHabilidades(classeId) {
      if (abilityBarEl.dataset.classeAtual === classeId) return;
      var classe = GAME_CLASSES[classeId];
      if (!classe) return;

      abilityBarEl.dataset.classeAtual = classeId;
      abilityBarEl.innerHTML = '';

      classe.habilidades.concat([classe.ultimate]).forEach(function (habilidade) {
        var slot = document.createElement('div');
        slot.className = 'ability-slot';
        slot.dataset.habilidade = habilidade.id;
        slot.title = habilidade.nome + ' — ' + habilidade.descricao;
        slot.innerHTML =
          '<span>' + habilidade.nome + '</span>' +
          '<div class="cooldown-overlay hidden"></div>';
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

      var final = performance.now() + duracaoMs;
      var intervalo = setInterval(function () {
        var restante = final - performance.now();
        if (restante <= 0) {
          clearInterval(intervalo);
          overlay.classList.add('hidden');
          overlay.textContent = '';
          return;
        }
        overlay.textContent = Math.ceil(restante / 1000) + 's';
      }, 150);
    }

    function atualizarHud() {
      if (!state.meuPlayer) return;
      var classe = GAME_CLASSES[state.meuPlayer.classeId];
      var nivel = state.meuPlayer.nivel || 1;
      var xpToNext = state.meuPlayer.xpToNext || 0;
      var xp = state.meuPlayer.xp || 0;
      var xpPercent = nivel >= LEVEL_CAP ? 100 : (state.meuPlayer.xpPercent || 0);

      hudNome.textContent = state.meuPlayer.nome + ' [Nv. ' + nivel + ']';
      hudClasse.textContent = classe ? classe.nome : 'Escolha sua classe';
      hudAsaNivel.textContent = state.meuPlayer.asaNivel || 1;
      hudAsaNome.textContent = state.meuPlayer.asaNome || obterNomeAsaPorNivel(state.meuPlayer.asaNivel || 1);
      hudXpFill.style.width = Math.min(100, Math.max(0, xpPercent)) + '%';
      if (hudXpText) {
        hudXpText.textContent = nivel >= LEVEL_CAP
          ? 'Nível máximo'
          : xp + ' / ' + xpToNext + ' XP';
      }
      hudOnlineCount.textContent = Object.keys(state.players).length;
    }

    function obterNomeAsaPorNivel(nivel) {
      var found = WING_LEVELS.find(function (w) { return w.nivel === nivel; });
      return found ? found.nome : '—';
    }

    function atualizarEnemyHud() {
      if (!state.monster) return;
      var percent = state.monster.hpMax > 0
        ? (state.monster.hpAtual / state.monster.hpMax) * 100
        : 0;

      enemyName.textContent = state.monster.nome;
      enemyLevel.textContent = 'Nv. ' + state.monster.nivel;
      enemyType.textContent = state.monster.isBoss ? 'BOSS' : state.monster.tipo.toUpperCase();
      enemyHpFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
      enemyHpText.textContent = state.monster.hpAtual + ' / ' + state.monster.hpMax + ' HP';
    }

    function adicionarLog(texto) {
      state.log.unshift(texto);
      state.log = state.log.slice(0, 5);
      if (combatLogEl) {
        combatLogEl.innerHTML = state.log.map(function (linha) {
          return '<div>' + linha + '</div>';
        }).join('');
      }
    }

    function adicionarDanoFlutuante(texto, isCrit, cor) {
      state.danosFlutuantes.push({
        x: canvas.width * 0.68 + (Math.random() - 0.5) * 80,
        y: canvas.height * 0.42 + (Math.random() - 0.5) * 30,
        vy: -0.65 - Math.random() * 0.35,
        vida: 1,
        texto: texto,
        isCrit: !!isCrit,
        cor: cor || (isCrit ? '#f1d98b' : '#ece9f5')
      });
    }

    function desenharAsasCristal(x, y, nivel, cor) {
      for (var i = 0; i < nivel; i++) {
        var tamanho = 14 + i * 6;
        var alpha = 0.85 - i * 0.12;
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.fillStyle = cor;

        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x - 8 - tamanho, y - tamanho * 0.7 - i * 3);
        ctx.lineTo(x - 8 - tamanho * 0.55, y + tamanho * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + 5, y);
        ctx.lineTo(x + 8 + tamanho, y - tamanho * 0.7 - i * 3);
        ctx.lineTo(x + 8 + tamanho * 0.55, y + tamanho * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function desenharAsasArcanjo(x, y, nivel) {
      var camadas = Math.max(2, nivel + 1);
      for (var lado = -1; lado <= 1; lado += 2) {
        for (var i = 0; i < camadas; i++) {
          var largura = 18 + i * 7;
          var altura = 18 + i * 5;
          ctx.save();
          ctx.globalAlpha = 0.75 - i * 0.07;
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#bfe9ff';
          ctx.strokeStyle = '#f1d98b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(
            x + lado * (18 + i * 6),
            y - 8 + i * 3,
            largura,
            altura,
            lado * -0.55,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function desenharJogador(player) {
      var classe = GAME_CLASSES[player.classeId];
      if (!classe) return;

      var x = player.posicao.x + 80;
      var y = player.posicao.y + 80;
      var t = (performance.now() - state.tempoInicio) / 1000;
      y += Math.sin(t * 1.6 + (player.id.charCodeAt(0) || 0)) * 4;

      if (player.classeId === 'mago') {
        desenharAsasArcanjo(x, y - 6, player.asaNivel || 1);
      } else {
        desenharAsasCristal(x, y - 6, player.asaNivel || 1, classe.corPrimaria);
      }

      ctx.save();
      ctx.fillStyle = classe.corPrimaria;
      ctx.strokeStyle = classe.corSecundaria;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (player.classeId === 'guerreiro') {
        ctx.fillStyle = classe.corSecundaria;
        ctx.fillRect(x - 22, y - 4, 8, 20);
      } else if (player.classeId === 'arqueiro') {
        ctx.strokeStyle = classe.corSecundaria;
        ctx.beginPath();
        ctx.arc(x + 18, y, 14, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      } else if (player.classeId === 'mago') {
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y - 23, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#ece9f5';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(player.nome + ' [Nv. ' + player.nivel + ']', x, y - 30);

      if (Math.random() < 0.05) {
        state.particulas.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y + 12,
          vy: -0.4 - Math.random() * 0.3,
          vida: 1,
          cor: classe.corParticulaIdle
        });
      }
    }

    function desenharMonstro() {
      if (!state.monster) return;
      var x = canvas.width * 0.68;
      var y = canvas.height * 0.46;
      var t = performance.now() / 1000;
      var boss = state.monster.isBoss;
      var escala = boss ? 1.35 : 1;
      var bob = Math.sin(t * 1.8) * 5;

      ctx.save();
      ctx.translate(x, y + bob);
      ctx.scale(escala, escala);

      var aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 92);
      aura.addColorStop(0, boss ? 'rgba(212,175,55,0.42)' : 'rgba(93,173,226,0.26)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 92, 0, Math.PI * 2);
      ctx.fill();

      // Silhueta inspirada em criaturas idle/fantasia, sem copiar personagem existente.
      ctx.fillStyle = boss ? '#7d3c98' : '#24566f';
      ctx.strokeStyle = boss ? '#f1d98b' : '#5dade2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -20, 46, 32, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = boss ? '#4a235a' : '#173c50';
      ctx.beginPath();
      ctx.moveTo(-16, -18);
      ctx.lineTo(16, -18);
      ctx.quadraticCurveTo(34, -18, 34, 0);
      ctx.lineTo(34, 28);
      ctx.quadraticCurveTo(34, 46, 16, 46);
      ctx.lineTo(-16, 46);
      ctx.quadraticCurveTo(-34, 46, -34, 28);
      ctx.lineTo(-34, 0);
      ctx.quadraticCurveTo(-34, -18, -16, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-14, 4, 5, 0, Math.PI * 2);
      ctx.arc(14, 4, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = boss ? '#f1d98b' : '#5dade2';
      for (var i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-28 + i * 14, -48);
        ctx.lineTo(-20 + i * 14, -65 - Math.sin(t + i) * 6);
        ctx.lineTo(-12 + i * 14, -48);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      ctx.fillStyle = '#ece9f5';
      ctx.textAlign = 'center';
      ctx.font = '14px Cinzel, serif';
      ctx.fillText(state.monster.nome + ' [Nv. ' + state.monster.nivel + ']', x, y - 105);
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
        var raio = 10 + progresso * 72;
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

    function desenharDanosFlutuantes() {
      state.danosFlutuantes.forEach(function (d) {
        d.y += d.vy;
        d.vida -= 0.018;
        ctx.save();
        ctx.globalAlpha = Math.max(0, d.vida);
        ctx.fillStyle = d.cor;
        ctx.font = d.isCrit ? 'bold 22px Inter, sans-serif' : 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.texto, d.x, d.y);
        ctx.restore();
      });
      state.danosFlutuantes = state.danosFlutuantes.filter(function (d) { return d.vida > 0; });
    }

    function loopRender() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grd.addColorStop(0, 'rgba(21,25,51,0.18)');
      grd.addColorStop(1, 'rgba(11,14,26,0.05)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      desenharMonstro();
      Object.values(state.players).forEach(function (player) {
        if (player.classeId) desenharJogador(player);
      });
      desenharParticulas();
      desenharEfeitosHabilidade();
      desenharDanosFlutuantes();
      requestAnimationFrame(loopRender);
    }

    socket.on('connect_error', function (err) {
      falhaFatal('Não foi possível conectar ao servidor: ' + err.message);
    });

    socket.on('init', function (data) {
      state.meuId = data.you.id;
      state.meuPlayer = data.you;
      state.monster = data.monster;
      state.players = {};
      data.players.forEach(function (p) { state.players[p.id] = p; });

      if (!state.meuPlayer.classeId) {
        montarTelaSelecaoClasse();
        classSelectEl.classList.remove('hidden');
      } else {
        montarBarraHabilidades(state.meuPlayer.classeId);
      }

      atualizarHud();
      atualizarEnemyHud();
    });

    socket.on('playerJoined', function (player) {
      state.players[player.id] = player;
      atualizarHud();
    });

    socket.on('playerUpdated', function (player) {
      state.players[player.id] = player;
      if (player.id === state.meuId) {
        state.meuPlayer = player;
        if (player.classeId) {
          classSelectEl.classList.add('hidden');
          montarBarraHabilidades(player.classeId);
        }
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

    socket.on('enemyUpdate', function (monster) {
      state.monster = monster;
      atualizarEnemyHud();
    });

    socket.on('combatTick', function (data) {
      if (data.monster) {
        state.monster = data.monster;
        atualizarEnemyHud();
      }

      (data.attacks || []).forEach(function (attack) {
        var jogador = state.players[attack.playerId];
        var classe = jogador ? GAME_CLASSES[jogador.classeId] : null;
        adicionarDanoFlutuante(
          (attack.isCrit ? 'CRÍTICO ' : '-') + attack.damage,
          attack.isCrit,
          classe ? classe.corSecundaria : null
        );
      });
    });

    socket.on('enemyDied', function (data) {
      adicionarLog('⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP.');
      if (data.nextMonster) {
        state.monster = data.nextMonster;
        atualizarEnemyHud();
      }
    });

    socket.on('abilityUsed', function (evento) {
      var jogador = state.players[evento.playerId];
      var x = jogador ? jogador.posicao.x + 80 : canvas.width * 0.35;
      var y = jogador ? jogador.posicao.y + 80 : canvas.height * 0.5;

      state.efeitosAtivos.push({
        x: x,
        y: y,
        cor: evento.visual.cor,
        inicio: performance.now(),
        duracao: 800
      });

      if (evento.playerId === state.meuId) {
        iniciarCooldownVisual(evento.habilidadeId, evento.cooldown);
      }
    });

    socket.on('cooldownRejected', function (info) {
      adicionarLog('⏳ Habilidade em recarga: ' + Math.ceil(info.restanteMs / 1000) + 's.');
    });

    socket.on('errorMsg', function (msg) {
      adicionarLog('⚠️ ' + msg);
    });

    requestAnimationFrame(loopRender);
  }
})();
