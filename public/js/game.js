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
      lootRecente: [],
      tempoInicio: performance.now(),
      ultimoGolpeVisual: 0
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
    var hudGold = document.getElementById('hud-gold-value');
    var hudPower = document.getElementById('hud-power-value');

    var enemyName = document.getElementById('enemy-name');
    var enemyLevel = document.getElementById('enemy-level');
    var enemyType = document.getElementById('enemy-type');
    var enemyHpFill = document.getElementById('enemy-hp-fill');
    var enemyHpText = document.getElementById('enemy-hp-text');

    var combatLogEl = document.getElementById('combat-log');
    var heroNameSide = document.getElementById('hero-name-side');
    var heroClassSide = document.getElementById('hero-class-side');
    var heroLevelSide = document.getElementById('hero-level-side');
    var heroPowerSide = document.getElementById('hero-power-side');
    var heroHpSide = document.getElementById('hero-hp-side');
    var heroGoldSide = document.getElementById('hero-gold-side');
    var equipmentGrid = document.getElementById('equipment-grid');
    var lootList = document.getElementById('loot-list');
    var questFill = document.getElementById('quest-fill');
    var questProgress = document.getElementById('quest-progress');
    var questText = document.getElementById('quest-text');
    var heroPortrait = document.getElementById('hero-portrait');

    var characterImages = {};
    Object.keys(GAME_CLASSES).forEach(function (classeId) {
      var classe = GAME_CLASSES[classeId];
      if (!classe.asset || !classe.asset.sprite) return;
      var img = new Image();
      img.src = classe.asset.sprite;
      characterImages[classeId] = img;
    });

    function ajustarCanvas() {
      var stage = document.getElementById('stage');
      canvas.width = Math.max(320, stage.clientWidth);
      canvas.height = Math.max(320, stage.clientHeight);
    }
    window.addEventListener('resize', ajustarCanvas);
    ajustarCanvas();

    function formatarNumero(valor) {
      valor = Math.floor(valor || 0);
      if (valor >= 1000000) return (valor / 1000000).toFixed(1) + 'M';
      if (valor >= 1000) return (valor / 1000).toFixed(1) + 'K';
      return String(valor);
    }

    function escaparHtml(valor) {
      return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function obterNomeAsaPorNivel(nivel) {
      var found = WING_LEVELS.find(function (w) { return w.nivel === nivel; });
      return found ? found.nome : 'Asas Iniciais';
    }

    function montarTelaSelecaoClasse() {
      classCardsEl.innerHTML = '';
      Object.keys(GAME_CLASSES).forEach(function (classeId) {
        var classe = GAME_CLASSES[classeId];
        var card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.classe = classeId;
        var portrait = classe.asset && classe.asset.portrait ? classe.asset.portrait : '';
        card.innerHTML =
          '<div class="class-art-wrap">' +
            (portrait ? '<img src="' + portrait + '" alt="' + escaparHtml(classe.nomeCurto) + '">' : '<div class="icone">' + classe.tipoIcone + '</div>') +
          '</div>' +
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
        slot.innerHTML = '<span>' + habilidade.nome + '</span><div class="cooldown-overlay hidden"></div>';
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
      }, 120);
    }

    function atualizarHud() {
      if (!state.meuPlayer) return;
      var p = state.meuPlayer;
      var classe = GAME_CLASSES[p.classeId];
      var nivel = p.nivel || 1;
      var xpToNext = p.xpToNext || 0;
      var xp = p.xp || 0;
      var xpPercent = nivel >= LEVEL_CAP ? 100 : (p.xpPercent || 0);
      var power = p.power || 0;

      hudNome.textContent = p.nome + ' [Nv. ' + nivel + ']';
      hudClasse.textContent = classe ? classe.nome : 'Escolha sua classe';
      hudAsaNivel.textContent = p.asaNivel || 1;
      hudAsaNome.textContent = p.asaNome || obterNomeAsaPorNivel(p.asaNivel || 1);
      hudXpFill.style.width = Math.min(100, Math.max(0, xpPercent)) + '%';
      hudXpText.textContent = nivel >= LEVEL_CAP ? 'Nível máximo' : xp + ' / ' + xpToNext + ' XP';
      hudOnlineCount.textContent = Object.keys(state.players).length;
      if (hudGold) hudGold.textContent = formatarNumero(p.ouro || 0);
      if (hudPower) hudPower.textContent = formatarNumero(power);

      if (heroNameSide) heroNameSide.textContent = p.nome;
      if (heroClassSide) heroClassSide.textContent = classe ? classe.nome : 'Escolha uma classe';
      if (heroLevelSide) heroLevelSide.textContent = nivel;
      if (heroPowerSide) heroPowerSide.textContent = formatarNumero(power);
      if (heroHpSide) heroHpSide.textContent = (p.hp || 0) + ' / ' + (p.maxHp || 0);
      if (heroGoldSide) heroGoldSide.textContent = formatarNumero(p.ouro || 0);

      if (heroPortrait) {
        if (classe && classe.asset && classe.asset.portrait) {
          heroPortrait.classList.add('has-art');
          heroPortrait.style.backgroundImage = 'linear-gradient(180deg, rgba(5,8,22,.08), rgba(5,8,22,.22)), url("' + classe.asset.portrait + '")';
        } else {
          heroPortrait.classList.remove('has-art');
          heroPortrait.style.backgroundImage = '';
        }
      }

      atualizarEquipamentos(p);
      atualizarQuest(p);
    }

    function atualizarEnemyHud() {
      if (!state.monster) return;
      var percent = state.monster.hpMax > 0 ? (state.monster.hpAtual / state.monster.hpMax) * 100 : 0;
      enemyName.textContent = state.monster.nome;
      enemyLevel.textContent = 'Nv. ' + state.monster.nivel;
      enemyType.textContent = state.monster.isBoss ? 'BOSS' : String(state.monster.tipo || 'normal').toUpperCase();
      enemyHpFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
      enemyHpText.textContent = state.monster.hpAtual + ' / ' + state.monster.hpMax + ' HP';
    }

    function atualizarQuest(player) {
      var kills = player.kills || 0;
      var dentro = kills % 10;
      var fase = player.fase || Math.floor(kills / 10) + 1;
      if (questFill) questFill.style.width = (dentro * 10) + '%';
      if (questProgress) questProgress.textContent = dentro + ' / 10';
      if (questText) questText.textContent = 'Fase ' + fase + ' — derrote 10 monstros para invocar o boss';
    }

    function atualizarEquipamentos(player) {
      if (!equipmentGrid) return;
      var inventario = (player.inventario || []).slice(-6).reverse();
      equipmentGrid.innerHTML = '';
      for (var i = 0; i < 6; i++) {
        var item = inventario[i];
        var slot = document.createElement('div');
        slot.className = 'equipment-slot' + (item ? ' filled loot-' + item.raridade : '');
        slot.innerHTML = item
          ? '<strong>' + item.icone + ' ' + escaparHtml(item.nome) + '</strong><small>+' + (item.stats.ataque || 0) + ' ATQ</small>'
          : '<span>Vazio</span>';
        equipmentGrid.appendChild(slot);
      }
    }

    function atualizarLoot() {
      if (!lootList) return;
      if (state.lootRecente.length === 0) {
        lootList.innerHTML = '<div class="loot-item">Nenhum loot ainda.</div>';
        return;
      }
      lootList.innerHTML = state.lootRecente.slice(0, 5).map(function (item) {
        return '<div class="loot-item loot-' + item.raridade + '">' +
          item.icone + ' <strong>' + escaparHtml(item.nome) + '</strong><br>' +
          '<span>' + item.raridade.toUpperCase() + ' · +' + (item.stats.ataque || 0) + ' ATQ</span>' +
          '</div>';
      }).join('');
    }

    function adicionarLog(texto) {
      state.log.unshift(texto);
      state.log = state.log.slice(0, 7);
      if (combatLogEl) {
        combatLogEl.innerHTML = state.log.map(function (linha) {
          return '<div>' + linha + '</div>';
        }).join('');
      }
    }

    function adicionarDanoFlutuante(texto, isCrit, cor, x, y) {
      state.danosFlutuantes.push({
        x: x || canvas.width * 0.68,
        y: y || canvas.height * 0.46,
        vy: -0.82 - Math.random() * 0.42,
        vida: 1,
        texto: texto,
        isCrit: !!isCrit,
        cor: cor || (isCrit ? '#ffe69b' : '#f2efff')
      });
    }

    function desenharFundo() {
      var w = canvas.width;
      var h = canvas.height;
      var t = performance.now() / 1000;

      var grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(26, 35, 88, 0.24)');
      grd.addColorStop(0.55, 'rgba(10, 14, 34, 0.16)');
      grd.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.5;
      for (var i = 0; i < 34; i++) {
        var sx = (i * 149 + Math.sin(t * 0.1 + i) * 18) % w;
        var sy = (i * 67) % Math.max(1, h * 0.55);
        ctx.fillStyle = i % 3 === 0 ? '#66c9ff' : '#ffe69b';
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();

      // plataformas e cristais do cenário
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.78, 150, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.70, h * 0.76, 170, 38, 0, 0, Math.PI * 2);
      ctx.fill();

      for (var c = 0; c < 7; c++) {
        var cx = 28 + c * 72;
        var cy = h - 72 - Math.sin(t + c) * 3;
        ctx.fillStyle = c % 2 ? 'rgba(185,133,255,.22)' : 'rgba(102,201,255,.22)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 40);
        ctx.lineTo(cx + 12, cy);
        ctx.lineTo(cx - 12, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    function desenharAsasArcanjo(x, y, escala, nivel) {
      var camadas = Math.max(4, (nivel || 1) + 3);
      for (var lado = -1; lado <= 1; lado += 2) {
        for (var i = 0; i < camadas; i++) {
          var largura = (34 + i * 9) * escala;
          var altura = (18 + i * 5) * escala;
          var px = x + lado * (34 + i * 11) * escala;
          var py = y - (16 - i * 5) * escala;
          ctx.save();
          ctx.globalAlpha = Math.max(0.18, 0.86 - i * 0.08);
          ctx.fillStyle = i % 2 ? '#d8f4ff' : '#ffffff';
          ctx.strokeStyle = '#ffe69b';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(px, py, largura, altura, lado * -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function desenharAsasCristal(x, y, escala, nivel, cor) {
      for (var i = 0; i < Math.max(2, nivel || 1); i++) {
        var tamanho = (32 + i * 12) * escala;
        ctx.save();
        ctx.globalAlpha = Math.max(0.35, 0.85 - i * 0.1);
        ctx.fillStyle = cor;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        [-1, 1].forEach(function (lado) {
          ctx.beginPath();
          ctx.moveTo(x + lado * 10 * escala, y);
          ctx.lineTo(x + lado * tamanho, y - tamanho * 0.68);
          ctx.lineTo(x + lado * tamanho * 0.72, y + tamanho * 0.34);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    function desenharJogador(player, index) {
      var classe = GAME_CLASSES[player.classeId];
      if (!classe) return;

      var souEu = player.id === state.meuId;
      var x = souEu ? canvas.width * 0.30 : canvas.width * 0.15 + (index * 46);
      var y = souEu ? canvas.height * 0.88 : canvas.height * 0.82 + (index % 2) * 18;
      var t = performance.now() / 1000;
      var bob = Math.sin(t * 1.65 + index) * (souEu ? 6 : 3);
      var img = characterImages[player.classeId];
      var altura = souEu ? Math.min(canvas.height * 0.88, player.classeId === 'mago' ? 430 : 390) : 190;

      ctx.save();
      ctx.translate(x, y + bob);

      // Sombra do herói no chão
      ctx.fillStyle = 'rgba(0,0,0,.36)';
      ctx.beginPath();
      ctx.ellipse(0, 8, souEu ? 118 : 54, souEu ? 24 : 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Aura de classe
      var aura = ctx.createRadialGradient(0, -altura * 0.44, 8, 0, -altura * 0.44, altura * 0.46);
      aura.addColorStop(0, classe.corPrimaria + '40');
      aura.addColorStop(0.55, classe.corSecundaria + '1f');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, -altura * 0.44, altura * 0.46, 0, Math.PI * 2);
      ctx.fill();

      if (img && img.complete && img.naturalWidth > 0) {
        var largura = altura * (img.naturalWidth / img.naturalHeight);
        // O mago tem asas grandes; damos um leve destaque sem cortar o sprite.
        if (player.classeId === 'mago' && souEu) largura *= 1.06;
        ctx.save();
        ctx.shadowColor = classe.corPrimaria;
        ctx.shadowBlur = souEu ? 26 : 10;
        ctx.drawImage(img, -largura / 2, -altura, largura, altura);
        ctx.restore();
      } else {
        // Fallback simples caso a imagem ainda não tenha carregado.
        ctx.fillStyle = classe.corPrimaria;
        ctx.strokeStyle = classe.corSecundaria;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-22, -92, 44, 74, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f4d0a5';
        ctx.beginPath();
        ctx.arc(0, -116, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Placa do nome
      ctx.font = souEu ? '900 15px Inter' : '700 11px Inter';
      ctx.textAlign = 'center';
      var label = player.nome + ' [Nv. ' + player.nivel + ']';
      var labelY = -altura - 10;
      var measure = ctx.measureText(label).width + 22;
      ctx.fillStyle = 'rgba(5,8,22,.72)';
      ctx.strokeStyle = souEu ? 'rgba(255,230,155,.45)' : 'rgba(255,255,255,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-measure / 2, labelY - 20, measure, 25, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = souEu ? '#ffe69b' : '#f2efff';
      ctx.fillText(label, 0, labelY - 2);

      ctx.restore();

      if (Math.random() < 0.16) {
        state.particulas.push({
          x: x + (Math.random() - 0.5) * 90,
          y: y - altura * 0.58 + (Math.random() - 0.5) * 85,
          vy: -0.55 - Math.random() * 0.45,
          vida: 1,
          cor: classe.corParticulaIdle
        });
      }
    }

    function desenharMonstro() {
      if (!state.monster) return;
      var x = canvas.width * 0.70;
      var y = canvas.height * 0.60;
      var t = performance.now() / 1000;
      var boss = state.monster.isBoss;
      var escala = boss ? 2.1 : 1.65;
      var bob = Math.sin(t * 1.8) * 7;

      ctx.save();
      ctx.translate(x, y + bob);
      ctx.scale(escala, escala);

      var aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 92);
      aura.addColorStop(0, boss ? 'rgba(255,230,155,.34)' : 'rgba(102,201,255,.24)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 92, 0, Math.PI * 2);
      ctx.fill();

      // chapéu/coroa cristalina
      ctx.fillStyle = boss ? '#9854d8' : '#2b7ca0';
      ctx.strokeStyle = boss ? '#ffe69b' : '#66c9ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -28, 48, 34, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // corpo
      ctx.fillStyle = boss ? '#4b235f' : '#14394e';
      ctx.beginPath();
      ctx.roundRect(-36, -24, 72, 82, 17);
      ctx.fill();
      ctx.stroke();

      // olhos
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-14, 8, 5, 0, Math.PI * 2);
      ctx.arc(14, 8, 5, 0, Math.PI * 2);
      ctx.fill();

      // cristais no topo
      ctx.fillStyle = boss ? '#ffe69b' : '#66c9ff';
      for (var i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-34 + i * 13.5, -58);
        ctx.lineTo(-27 + i * 13.5, -82 - Math.sin(t + i) * 5);
        ctx.lineTo(-20 + i * 13.5, -58);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      if (Math.random() < 0.1) {
        state.particulas.push({
          x: x + (Math.random() - 0.5) * 150,
          y: y - 40 + (Math.random() - 0.5) * 90,
          vy: -0.25 - Math.random() * 0.3,
          vida: 1,
          cor: boss ? '#ffe69b' : '#66c9ff'
        });
      }
    }

    function desenharParticulas() {
      state.particulas.forEach(function (p) {
        p.y += p.vy;
        p.vida -= 0.014;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      state.particulas = state.particulas.filter(function (p) { return p.vida > 0; });
    }

    function desenharEfeitosHabilidade() {
      var agora = performance.now();
      state.efeitosAtivos.forEach(function (efeito) {
        var progresso = (agora - efeito.inicio) / efeito.duracao;
        var raio = 20 + progresso * 110;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progresso);
        ctx.strokeStyle = efeito.cor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(efeito.x, efeito.y, raio, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(efeito.x - raio, efeito.y);
        ctx.lineTo(efeito.x + raio, efeito.y);
        ctx.moveTo(efeito.x, efeito.y - raio);
        ctx.lineTo(efeito.x, efeito.y + raio);
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
        ctx.font = d.isCrit ? '900 28px Inter' : '900 19px Inter';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.72)';
        ctx.strokeText(d.texto, d.x, d.y);
        ctx.fillText(d.texto, d.x, d.y);
        ctx.restore();
      });
      state.danosFlutuantes = state.danosFlutuantes.filter(function (d) { return d.vida > 0; });
    }

    function loopRender() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      desenharFundo();
      desenharMonstro();
      var playersList = Object.values(state.players).filter(function (p) { return p.classeId; });
      playersList.sort(function (a, b) { return a.id === state.meuId ? -1 : (b.id === state.meuId ? 1 : 0); });
      playersList.forEach(function (player, index) { desenharJogador(player, index); });
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
        classSelectEl.classList.add('hidden');
        montarBarraHabilidades(state.meuPlayer.classeId);
      }

      atualizarHud();
      atualizarEnemyHud();
      atualizarLoot();
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
        var x = canvas.width * 0.70 + (Math.random() - 0.5) * 90;
        var y = canvas.height * 0.44 + (Math.random() - 0.5) * 50;
        adicionarDanoFlutuante((attack.isCrit ? 'CRÍTICO ' : '-') + attack.damage, attack.isCrit, classe ? classe.corSecundaria : null, x, y);
      });
    });

    socket.on('enemyDied', function (data) {
      var texto = '⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP';
      if (data.goldGained) texto += ' e +' + data.goldGained + ' ouro';
      texto += '.';
      adicionarLog(texto);

      if (data.loot) {
        state.lootRecente.unshift(data.loot);
        state.lootRecente = state.lootRecente.slice(0, 8);
        atualizarLoot();
        adicionarLog('🎁 Loot: ' + data.loot.icone + ' ' + data.loot.nome + ' [' + data.loot.raridade + ']');
      }

      if (data.progress && data.progress.leveledUp) {
        adicionarLog('✨ Level up! Agora você está no Nv. ' + data.progress.currentLevel + '.');
      }

      if (data.nextMonster) {
        state.monster = data.nextMonster;
        atualizarEnemyHud();
      }
    });

    socket.on('abilityUsed', function (evento) {
      var x = canvas.width * 0.70;
      var y = canvas.height * 0.52;
      state.efeitosAtivos.push({
        x: x,
        y: y,
        cor: evento.visual && evento.visual.cor ? evento.visual.cor : '#ffe69b',
        inicio: performance.now(),
        duracao: 850
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
