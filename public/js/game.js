
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function fatal(msg) {
    var el = byId('fatal-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  if (typeof io === 'undefined') return fatal('Socket.IO não carregou.');
  if (!window.GAME_CLASSES || !window.MONSTERS) return fatal('shared/classes.js não carregou.');

  var socket = io();
  var GAME_CLASSES = window.GAME_CLASSES;
  var MONSTERS = window.MONSTERS;
  var LEVEL_CAP = window.LEVEL_CAP || 80;
  var state = {
    meId: null,
    me: null,
    players: {},
    monster: null,
    floating: [],
    effects: [],
    logs: [],
    lootRecente: []
  };

  var canvas = byId('game-canvas');
  var ctx = canvas.getContext('2d');
  var classSelect = byId('class-select');
  var classCards = byId('class-cards');
  var abilityBar = byId('ability-bar');
  var autoFarmBtn = byId('auto-farm-btn');

  var characterImages = {};
  Object.keys(GAME_CLASSES).forEach(function (id) {
    var img = new Image(); img.src = GAME_CLASSES[id].asset.sprite; characterImages[id] = img;
  });
  var monsterImages = {};
  MONSTERS.forEach(function (m) { var img = new Image(); img.src = m.asset; monsterImages[m.id] = img; });

  function resizeCanvas() {
    var stage = byId('stage');
    canvas.width = Math.max(400, stage.clientWidth);
    canvas.height = Math.max(360, stage.clientHeight);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function mountClassSelect() {
    classCards.innerHTML = '';
    Object.keys(GAME_CLASSES).forEach(function (id) {
      var classe = GAME_CLASSES[id];
      var card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = '<div class="class-art-wrap"><img src="' + classe.asset.portrait + '" alt="' + escapeHtml(classe.nomeCurto) + '"></div>' +
        '<div class="icone">' + classe.tipoIcone + '</div>' +
        '<div class="nome">' + escapeHtml(classe.nomeCurto) + '</div>' +
        '<div class="desc">' + escapeHtml(classe.idleDescricao) + '</div>';
      card.onclick = function () { socket.emit('selectClass', { classeId: id }); };
      classCards.appendChild(card);
    });
  }

  function mountAbilities(classeId) {
    var classe = GAME_CLASSES[classeId];
    if (!classe) { abilityBar.innerHTML = ''; return; }
    abilityBar.innerHTML = '';
    classe.habilidades.forEach(function (hab) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'ability-slot';
      el.dataset.habilidade = hab.id;
      el.title = hab.nome + ' — ' + hab.descricao;
      el.innerHTML = '<span class="ability-name">' + escapeHtml(hab.nome) + '</span><div class="cooldown-overlay hidden"></div>';
      el.onclick = function () { socket.emit('useAbility', { habilidadeId: hab.id }); };
      abilityBar.appendChild(el);
    });
  }

  function startCooldownVisual(id, durMs) {
    var slot = abilityBar.querySelector('[data-habilidade="' + id + '"]');
    if (!slot) return;
    var overlay = slot.querySelector('.cooldown-overlay');
    overlay.classList.remove('hidden');
    var end = performance.now() + durMs;
    function step() {
      var left = end - performance.now();
      if (left <= 0) {
        overlay.classList.add('hidden');
        overlay.textContent = '';
        return;
      }
      overlay.textContent = Math.ceil(left / 1000) + 's';
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function formatNumber(n) {
    n = Math.floor(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function updateHUD() {
    if (!state.me) return;
    var p = state.me;
    var classe = GAME_CLASSES[p.classeId];
    byId('hud-nome').textContent = p.nome + ' [Nv. ' + p.nivel + ']';
    byId('hud-classe').textContent = classe ? classe.nome : 'Escolha sua classe';
    byId('hud-asa-nivel').textContent = p.asaNivel || 1;
    byId('hud-asa-nome').textContent = p.asaNome || 'Asas Iniciais';
    byId('hud-xp-fill').style.width = (p.xpPercent || 0) + '%';
    byId('hud-xp-text').textContent = p.nivel >= LEVEL_CAP ? 'Nível máximo' : (p.xp + ' / ' + p.xpToNext + ' XP');
    byId('hud-power-value').textContent = formatNumber(p.power);
    byId('hud-gold-value').textContent = formatNumber(p.ouro);

    byId('hero-name-side').textContent = p.nome;
    byId('hero-class-side').textContent = classe ? classe.nome : 'Sem classe';
    byId('hero-level-side').textContent = p.nivel;
    byId('hero-power-side').textContent = formatNumber(p.power);
    byId('hero-hp-side').textContent = p.hp + ' / ' + p.maxHp;
    byId('hero-gold-side').textContent = formatNumber(p.ouro);

    var portrait = byId('hero-portrait');
    portrait.style.backgroundImage = classe ? 'url("' + classe.asset.portrait + '")' : 'none';

    autoFarmBtn.textContent = 'Farm automático: ' + (p.autoFarm ? 'ON' : 'OFF');
    autoFarmBtn.className = p.autoFarm ? 'auto-on' : 'auto-off';
    byId('stage-subtitle').textContent = p.autoFarm ? 'Auto batalha ativa' : 'Auto batalha desativada';

    renderEquipment(p);
    updateLoot();
  }

  function renderEquipment(player) {
    var grid = byId('equipment-grid');
    var labels = { arma: 'Arma', anel: 'Anel', colar: 'Colar', ornamento: 'Ornamento' };
    var slots = ['arma', 'anel', 'colar', 'ornamento'];
    grid.innerHTML = '';
    slots.forEach(function (slot) {
      var item = player.equipados ? player.equipados[slot] : null;
      var div = document.createElement('div');
      div.className = 'equipment-slot' + (item ? ' filled' : '');
      if (item) {
        div.style.borderColor = item.rarityColor || item.cor || '#fff';
        div.innerHTML = '<span>' + labels[slot] + '</span><strong>' + item.icon + ' ' + escapeHtml(item.nome) + '</strong><em>ATQ ' + (item.stats.ataque || 0) + ' · DEF ' + (item.stats.defesa || 0) + ' · CRIT ' + (item.stats.critico || 0) + ' · HP ' + (item.stats.hp || 0) + '</em>';
      } else {
        div.innerHTML = '<span>' + labels[slot] + '</span><strong>Vazio</strong><em>Equipe itens desta categoria</em>';
      }
      grid.appendChild(div);
    });
  }

  function updateEnemyHUD() {
    var m = state.monster;
    if (!m) return;
    byId('enemy-name').textContent = m.nome;
    byId('enemy-level').textContent = 'Nv. ' + m.nivel;
    byId('enemy-type').textContent = (m.tipo || 'normal').toUpperCase();
    byId('enemy-horda').textContent = m.horda || 1;
    var pct = m.hpMax ? (m.hpAtual / m.hpMax) * 100 : 0;
    byId('enemy-hp-fill').style.width = pct + '%';
    byId('enemy-hp-text').textContent = m.hpAtual + ' / ' + m.hpMax + ' HP';

    var current = ((m.horda || 1) - 1) % 10;
    byId('quest-text').textContent = current === 9 ? 'Enfrente o Dragão Elemental nesta horda!' : 'Avance até a horda 10 para invocar o Dragão Elemental';
    byId('quest-fill').style.width = ((current / 9) * 100) + '%';
    byId('quest-progress').textContent = (current + 1) + ' / 10';
  }

  function addLog(text) {
    state.logs.unshift(text);
    state.logs = state.logs.slice(0, 10);
    var logEl = byId('combat-log');
    logEl.innerHTML = state.logs.map(function (line) { return '<div class="combat-entry">' + line + '</div>'; }).join('');
  }

  function updateLoot() {
    var lootEl = byId('loot-list');
    if (!state.lootRecente.length) {
      lootEl.innerHTML = '<div class="loot-item">Nenhum loot ainda.</div>';
      return;
    }
    lootEl.innerHTML = state.lootRecente.map(function (item) {
      return '<div class="loot-item"><strong style="color:' + (item.rarityColor || item.cor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong><small>' + escapeHtml(item.slot) + ' · ' + escapeHtml(item.raridade) + ' · ATQ ' + (item.stats.ataque || 0) + ' · DEF ' + (item.stats.defesa || 0) + ' · CRIT ' + (item.stats.critico || 0) + ' · HP ' + (item.stats.hp || 0) + '</small></div>';
    }).join('');
  }

  function pushFloating(text, color, x, y, isCrit) {
    state.floating.push({ text: text, x: x, y: y, color: color || '#fff', life: 1, vy: isCrit ? -1.0 : -0.7, isCrit: !!isCrit });
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0a1442'); g.addColorStop(1, '#030711');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < 25; i++) {
      var x = (i * 97) % canvas.width;
      var y = (i * 61) % (canvas.height * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.32, canvas.height * 0.82, 140, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.72, canvas.height * 0.82, 140, 30, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlayer() {
    if (!state.me || !state.me.classeId) return;
    var img = characterImages[state.me.classeId];
    var x = canvas.width * 0.30;
    var y = canvas.height * 0.78;
    var width = 280;
    var height = 360;
    ctx.save();
    if (img && img.complete) {
      ctx.drawImage(img, x - width / 2, y - height, width, height);
    }
    ctx.fillStyle = 'rgba(5,8,22,.68)';
    ctx.strokeStyle = 'rgba(255,230,155,.45)';
    ctx.lineWidth = 1;
    roundRect(ctx, x - 110, y - height - 26, 220, 28, 10, true, true);
    ctx.fillStyle = '#ffe69b';
    ctx.font = '700 15px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(state.me.nome + ' [Nv. ' + state.me.nivel + ']', x, y - height - 8);
    ctx.restore();
  }

  function drawMonster() {
    if (!state.monster) return;
    var img = monsterImages[state.monster.templateId];
    var x = canvas.width * 0.72;
    var y = canvas.height * 0.78;
    var isDragon = state.monster.templateId === 'dragon';
    var width = isDragon ? 320 : 240;
    var height = isDragon ? 300 : 260;
    if (img && img.complete) ctx.drawImage(img, x - width / 2, y - height, width, height);
    ctx.fillStyle = 'rgba(5,8,22,.68)';
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, x - 90, y - height - 26, 180, 28, 10, true, true);
    ctx.fillStyle = '#eaf0ff';
    ctx.font = '700 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(state.monster.nome + ' [Nv. ' + state.monster.nivel + ']', x, y - height - 8);
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawEffects() {
    var now = performance.now();
    state.effects = state.effects.filter(function (e) { return now - e.start < e.duration; });
    state.effects.forEach(function (e) {
      var p = (now - e.start) / e.duration;
      var radius = 10 + p * 100;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawFloating() {
    state.floating = state.floating.filter(function (f) { return f.life > 0; });
    state.floating.forEach(function (f) {
      f.y += f.vy; f.life -= 0.018;
      ctx.save();
      ctx.globalAlpha = f.life;
      ctx.font = f.isCrit ? '900 28px Inter' : '900 20px Inter';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawPlayer();
    drawMonster();
    drawEffects();
    drawFloating();
    requestAnimationFrame(render);
  }

  autoFarmBtn.onclick = function () {
    if (!state.me) return;
    socket.emit('toggleAutoFarm', { enabled: !state.me.autoFarm });
  };

  socket.on('connect_error', function (err) { fatal('Falha ao conectar: ' + err.message); });
  socket.on('init', function (data) {
    state.meId = data.you.id; state.me = data.you; state.monster = data.monster; state.players = {};
    (data.players || []).forEach(function (p) { state.players[p.id] = p; });
    if (!state.me.classeId) { mountClassSelect(); classSelect.classList.remove('hidden'); } else { classSelect.classList.add('hidden'); mountAbilities(state.me.classeId); }
    updateHUD(); updateEnemyHUD();
  });
  socket.on('playerJoined', function (p) { state.players[p.id] = p; });
  socket.on('playerLeft', function (d) { delete state.players[d.id]; });
  socket.on('onlineCount', function (n) { byId('hud-online-count').textContent = n; });
  socket.on('playerUpdated', function (player) {
    state.players[player.id] = player;
    if (player.id === state.meId) {
      state.me = player;
      if (player.classeId) { classSelect.classList.add('hidden'); mountAbilities(player.classeId); }
    }
    updateHUD();
  });
  socket.on('gameState', function (list) {
    (list || []).forEach(function (p) { state.players[p.id] = p; if (p.id === state.meId) state.me = p; });
    updateHUD();
  });
  socket.on('enemyUpdate', function (monster) { state.monster = monster; updateEnemyHUD(); });
  socket.on('combatTick', function (data) {
    if (data.monster) { state.monster = data.monster; updateEnemyHUD(); }
    (data.attacks || []).forEach(function (attack) {
      var color = attack.isCrit ? '#ffe69b' : '#ff9090';
      pushFloating((attack.isCrit ? 'CRIT ' : '-') + attack.damage, color, canvas.width * 0.72 + (Math.random() - 0.5) * 80, canvas.height * 0.35 + (Math.random() - 0.5) * 60, attack.isCrit);
    });
  });
  socket.on('enemyDied', function (data) {
    addLog('⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP e +' + data.goldGained + ' ouro.');
    if (data.loot) {
      state.lootRecente.unshift(data.loot); state.lootRecente = state.lootRecente.slice(0, 8); updateLoot();
      addLog('🎁 ' + data.loot.icon + ' ' + data.loot.nome + (data.autoEquipped ? ' foi equipado automaticamente.' : ' foi para a bolsa.'));
    }
    if (data.progress && data.progress.leveledUp) addLog('✨ Level up! Agora você está no Nv. ' + data.progress.currentLevel + '.');
    if (data.player && data.player.id === state.meId) state.me = data.player;
    if (data.nextMonster) { state.monster = data.nextMonster; updateEnemyHUD(); }
    updateHUD();
  });
  socket.on('abilityUsed', function (evt) {
    state.effects.push({ x: canvas.width * 0.72, y: canvas.height * 0.55, color: evt.visual && evt.visual.cor ? evt.visual.cor : '#fff', start: performance.now(), duration: 850 });
    if (evt.playerId === state.meId) startCooldownVisual(evt.habilidadeId, evt.cooldown);
  });
  socket.on('cooldownRejected', function (info) { addLog('⏳ Habilidade em recarga: ' + Math.ceil(info.restanteMs / 1000) + 's.'); });
  socket.on('errorMsg', function (msg) { addLog('⚠️ ' + msg); });

  mountClassSelect();
  requestAnimationFrame(render);
})();
