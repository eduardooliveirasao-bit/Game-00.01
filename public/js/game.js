(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function fatal(msg) {
    var el = byId('fatal-error');
    if (!el) return console.error(msg);
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function formatNumber(n) {
    n = Math.floor(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
  function rarityClass(r) { return 'rarity-' + String(r || 'comum'); }

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
    particles: [],
    logs: [],
    lootRecente: [],
    selectedItemId: null,
    anim: {
      playerAttackUntil: 0,
      playerHitUntil: 0,
      monsterAttackUntil: 0,
      monsterHitUntil: 0,
      shakeUntil: 0
    }
  };

  var canvas = byId('game-canvas');
  var ctx = canvas.getContext('2d');
  var classSelect = byId('class-select');
  var classCards = byId('class-cards');
  var abilityBar = byId('ability-bar');
  var autoFarmBtn = byId('auto-farm-btn');
  var menuBag = byId('menu-bag');
  var menuHunt = byId('menu-hunt');
  var bagModal = byId('bag-modal');
  var bagClose = byId('bag-close');
  var bagList = byId('bag-list');
  var bagDetail = byId('bag-detail');
  var sellAllBtn = byId('sell-all-btn');
  var equipmentGrid = byId('equipment-grid');

  var audioCtx = null;
  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function playTone(freq, duration, type, gainValue) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainValue || 0.045;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    var now = audioCtx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }
  function playSound(kind) {
    ensureAudio();
    if (!audioCtx) return;
    if (kind === 'skill') { playTone(520, 0.12, 'triangle', 0.045); setTimeout(function(){ playTone(820, 0.14, 'sine', 0.035); }, 60); }
    else if (kind === 'boss') { playTone(110, 0.35, 'sawtooth', 0.055); setTimeout(function(){ playTone(170, 0.28, 'sawtooth', 0.045); }, 120); }
    else if (kind === 'hit') { playTone(180, 0.08, 'square', 0.025); }
    else if (kind === 'death') { playTone(90, 0.45, 'sawtooth', 0.04); }
    else if (kind === 'loot') { playTone(640, 0.08, 'triangle', 0.035); setTimeout(function(){ playTone(960, 0.12, 'triangle', 0.03); }, 70); }
    else if (kind === 'equip') { playTone(420, 0.08, 'triangle', 0.03); setTimeout(function(){ playTone(700, 0.1, 'triangle', 0.03); }, 70); }
  }

  var characterImages = {};
  Object.keys(GAME_CLASSES).forEach(function (id) {
    var img = new Image(); img.src = GAME_CLASSES[id].asset.sprite; characterImages[id] = img;
  });
  var monsterImages = {};
  MONSTERS.forEach(function (m) { var img = new Image(); img.src = m.asset; monsterImages[m.id] = img; });

  function resizeCanvas() {
    var stage = byId('stage');
    canvas.width = Math.max(420, stage.clientWidth);
    canvas.height = Math.max(320, stage.clientHeight);
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
      card.onclick = function () { ensureAudio(); socket.emit('selectClass', { classeId: id }); };
      classCards.appendChild(card);
    });
  }

  function mountAbilities(classeId) {
    if (abilityBar.dataset.classId === classeId && abilityBar.children.length) return;
    var classe = GAME_CLASSES[classeId];
    abilityBar.dataset.classId = classeId || '';
    abilityBar.innerHTML = '';
    if (!classe) return;
    classe.habilidades.forEach(function (hab) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'ability-slot';
      el.dataset.habilidade = hab.id;
      el.title = hab.nome + ' — ' + hab.descricao;
      el.innerHTML = '<img src="' + hab.icon + '" alt="' + escapeHtml(hab.nome) + '">' +
        '<span class="ability-name">' + escapeHtml(hab.nome) + '</span>' +
        '<span class="ability-mana">Mana ' + hab.manaCost + '</span>' +
        '<div class="cooldown-overlay hidden"></div>';
      el.onclick = function () { ensureAudio(); socket.emit('useAbility', { habilidadeId: hab.id }); };
      abilityBar.appendChild(el);
    });
  }

  function startCooldownVisual(id, durMs) {
    var slot = abilityBar.querySelector('[data-habilidade="' + id + '"]');
    if (!slot) return;
    var overlay = slot.querySelector('.cooldown-overlay');
    overlay.classList.remove('hidden');
    var end = performance.now() + durMs;
    function tick() {
      var remaining = end - performance.now();
      if (remaining <= 0) { overlay.classList.add('hidden'); overlay.textContent = ''; return; }
      overlay.textContent = Math.ceil(remaining / 1000) + 's';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
    var manaPct = p.maxMana ? Math.min(100, (p.mana / p.maxMana) * 100) : 0;
    byId('hud-mana-fill').style.width = manaPct + '%';
    byId('hud-mana-text').textContent = p.mana + ' / ' + p.maxMana;
    byId('hud-power-value').textContent = formatNumber(p.power);
    byId('hud-gold-value').textContent = formatNumber(p.ouro);
    byId('hero-name-side').textContent = p.nome;
    byId('hero-class-side').textContent = classe ? classe.nome : 'Sem classe';
    byId('hero-level-side').textContent = p.nivel;
    byId('hero-power-side').textContent = formatNumber(p.power);
    byId('hero-hp-side').textContent = p.hp + ' / ' + p.maxHp;
    byId('hero-mana-side').textContent = p.mana + ' / ' + p.maxMana;
    byId('hero-gold-side').textContent = formatNumber(p.ouro);
    byId('hero-bag-count').textContent = (p.inventario || []).length;

    var portrait = byId('hero-portrait');
    portrait.style.backgroundImage = classe ? 'url("' + classe.asset.portrait + '")' : 'none';

    var isDead = !!p.isDead;
    autoFarmBtn.textContent = isDead ? 'Ressuscitando...' : ('Farm automático: ' + (p.autoFarm ? 'ON' : 'OFF'));
    autoFarmBtn.className = isDead ? 'dead' : (p.autoFarm ? 'auto-on' : 'auto-off');
    byId('stage-subtitle').textContent = isDead ? 'Herói derrotado' : (p.autoFarm ? 'Auto batalha ativa' : 'Auto batalha desativada');
    byId('hero-status-line').textContent = isDead ? 'Ressurreição automática em instantes' : 'Herói em combate';

    renderEquipment(); renderBag(); updateLoot();
  }

  function renderEquipment() {
    var labels = { arma: 'Arma', anel: 'Anel', colar: 'Colar', ornamento: 'Ornamento' };
    var slots = ['arma', 'anel', 'colar', 'ornamento'];
    equipmentGrid.innerHTML = '';
    slots.forEach(function (slot) {
      var item = state.me && state.me.equipados ? state.me.equipados[slot] : null;
      var div = document.createElement('div');
      div.className = 'equipment-slot' + (item ? ' filled' : '');
      if (item) {
        div.style.borderColor = item.rarityColor || item.cor || '#fff';
        div.innerHTML = '<span>' + labels[slot] + '</span>' +
          '<strong style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
          '<em>' + escapeHtml(item.raridade) + ' · ATQ ' + (item.stats.ataque || 0) + ' · DEF ' + (item.stats.defesa || 0) + ' · CRIT ' + (item.stats.critico || 0) + ' · HP ' + (item.stats.hp || 0) + ' · MANA ' + (item.stats.mana || 0) + '</em>' +
          '<button data-unequip="' + slot + '">Desequipar</button>';
      } else {
        div.innerHTML = '<span>' + labels[slot] + '</span><strong>Vazio</strong><em>Abra a bolsa para equipar.</em>';
      }
      equipmentGrid.appendChild(div);
    });
  }

  function openBag() { bagModal.classList.remove('hidden'); renderBag(); }
  function closeBag() { bagModal.classList.add('hidden'); if (menuHunt) menuHunt.classList.add('active'); if (menuBag) menuBag.classList.remove('active'); }

  function statValue(item, key) { return item && item.stats ? (item.stats[key] || 0) : 0; }
  function diffHtml(item, equipped, key, label) {
    var d = statValue(item, key) - statValue(equipped, key);
    var cls = d > 0 ? 'diff-plus' : d < 0 ? 'diff-minus' : 'diff-eq';
    var sign = d > 0 ? '+' : '';
    return '<div>' + label + '<br><strong>' + statValue(item, key) + '</strong> <span class="' + cls + '">(' + sign + d + ')</span></div>';
  }

  function renderBag() {
    if (!state.me || bagModal.classList.contains('hidden')) return;
    var items = state.me.inventario || [];
    bagList.innerHTML = '';
    if (!items.length) {
      bagList.innerHTML = '<div class="bag-item">Nenhum item na bolsa ainda.</div>';
      bagDetail.innerHTML = 'Derrote monstros para obter itens.';
      return;
    }
    items.forEach(function (item) {
      var el = document.createElement('div');
      el.className = 'bag-item' + (state.selectedItemId === item.id ? ' active' : '');
      el.style.borderColor = item.rarityColor || item.cor || 'rgba(255,255,255,.08)';
      el.innerHTML = '<strong style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
        '<small>' + escapeHtml(item.slot) + ' · ' + escapeHtml(item.raridade) + ' · Nv.' + (item.requiredLevel || 1) + ' · Venda ' + (item.sellValue || 0) + ' ouro</small>';
      el.onclick = function () { state.selectedItemId = item.id; renderBag(); renderBagDetail(item); };
      bagList.appendChild(el);
    });
    var selected = items.find(function (it) { return it.id === state.selectedItemId; }) || items[0];
    if (selected) { state.selectedItemId = selected.id; renderBagDetail(selected); }
  }

  function renderBagDetail(item) {
    if (!item) { bagDetail.innerHTML = 'Selecione um item da bolsa.'; return; }
    var equipped = state.me && state.me.equipados ? state.me.equipados[item.slot] : null;
    var compare = equipped ? '<div class="compare-box"><strong>Comparado com equipado:</strong><br>' + escapeHtml(equipped.nome) + '</div>' : '<div class="compare-box">Nenhum item equipado neste slot.</div>';
    bagDetail.innerHTML = '<h3 style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</h3>' +
      '<div class="rarity ' + rarityClass(item.raridade) + '">' + escapeHtml(String(item.raridade).toUpperCase()) + (item.exclusivoBoss ? ' · LOOT EXCLUSIVO DE BOSS' : '') + ' · Slot ' + escapeHtml(item.slot) + ' · Requer Nv. ' + (item.requiredLevel || 1) + '</div>' +
      '<p>Venda por <strong>' + (item.sellValue || 0) + ' ouro</strong> ou equipe para alterar seus atributos.</p>' +
      compare +
      '<div class="detail-stats">' +
        diffHtml(item, equipped, 'ataque', 'ATQ') +
        diffHtml(item, equipped, 'defesa', 'DEF') +
        diffHtml(item, equipped, 'critico', 'CRIT') +
        diffHtml(item, equipped, 'hp', 'HP') +
        diffHtml(item, equipped, 'mana', 'MANA') +
        '<div>PODER<br><strong>' + (item.powerScore || 0) + '</strong></div>' +
      '</div>' +
      '<button id="equip-selected-btn">Equipar item</button>' +
      '<button id="sell-selected-btn">Vender item</button>';
    var equipBtn = byId('equip-selected-btn');
    var sellBtn = byId('sell-selected-btn');
    if (equipBtn) equipBtn.onclick = function () { ensureAudio(); socket.emit('equipItem', { itemId: item.id }); };
    if (sellBtn) sellBtn.onclick = function () { ensureAudio(); socket.emit('sellItem', { itemId: item.id }); };
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
    var specialWrap = byId('enemy-special-wrap');
    var specialName = byId('enemy-special-name');
    if (m.special && m.special.active) {
      specialWrap.classList.remove('hidden');
      specialName.textContent = '— ' + m.special.name;
      var spct = m.special.shieldMax ? (m.special.shieldHp / m.special.shieldMax) * 100 : 0;
      byId('enemy-special-fill').style.width = spct + '%';
      byId('enemy-special-text').textContent = m.special.shieldHp + ' / ' + m.special.shieldMax + ' Escudo';
    } else {
      specialWrap.classList.add('hidden'); specialName.textContent = '';
    }
    var current = ((m.horda || 1) - 1) % 10;
    byId('quest-text').textContent = current === 9 ? 'Enfrente o Dragão Elemental nesta horda!' : 'Avance até a horda 10 para invocar o Dragão Elemental';
    byId('quest-fill').style.width = ((current / 9) * 100) + '%';
    byId('quest-progress').textContent = (current + 1) + ' / 10';
  }

  function addLog(text) {
    state.logs.unshift(text); state.logs = state.logs.slice(0, 12);
    byId('combat-log').innerHTML = state.logs.map(function (line) { return '<div class="combat-entry">' + line + '</div>'; }).join('');
  }
  function updateLoot() {
    var lootEl = byId('loot-list');
    if (!state.lootRecente.length) { lootEl.innerHTML = '<div class="loot-item">Nenhum loot ainda.</div>'; return; }
    lootEl.innerHTML = state.lootRecente.map(function (item) {
      return '<div class="loot-item"><strong class="' + rarityClass(item.raridade) + '" style="color:' + (item.rarityColor || item.cor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong><small>' + escapeHtml(item.slot) + ' · ' + escapeHtml(item.raridade) + ' · ATQ ' + (item.stats.ataque || 0) + ' · DEF ' + (item.stats.defesa || 0) + ' · CRIT ' + (item.stats.critico || 0) + ' · HP ' + (item.stats.hp || 0) + ' · MANA ' + (item.stats.mana || 0) + '</small></div>';
    }).join('');
  }

  function pushFloating(text, color, x, y, isCrit) { state.floating.push({ text: text, x: x, y: y, color: color || '#fff', life: 1, vy: isCrit ? -1.05 : -0.75, isCrit: !!isCrit }); }
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) state.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 0.8, life: 1, color: color });
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0a1442'); g.addColorStop(1, '#030711');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < 30; i++) { var x = (i * 97 + 13) % canvas.width; var y = (i * 61 + 25) % (canvas.height * 0.55); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, y, 2, 2); }
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.28, canvas.height * 0.88, 140, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.72, canvas.height * 0.88, 150, 32, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlayer(now) {
    if (!state.me || !state.me.classeId) return;
    var img = characterImages[state.me.classeId];
    var cls = GAME_CLASSES[state.me.classeId];
    var idle = Math.sin(now / 420) * 5;
    var x = canvas.width * 0.28;
    var y = canvas.height * 0.88 + idle;
    var hit = now < state.anim.playerHitUntil;
    var attack = now < state.anim.playerAttackUntil;
    var dead = !!state.me.isDead;
    if (attack) x += 28 * Math.sin((state.anim.playerAttackUntil - now) / 280 * Math.PI);
    if (hit) x -= 18 + Math.random() * 10;
    var h = Math.min(330, Math.max(220, canvas.height * 0.78));
    var w = state.me.classeId === 'mago' ? h * 1.05 : h * 0.78;
    ctx.save();
    if (dead) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
    if (img && img.complete) ctx.drawImage(img, x - w / 2, y - h, w, h);
    ctx.restore();
    if (hit) spawnParticles(x, y - h * 0.55, '#ff7b7b', 2);
    drawNameplate(state.me.nome + ' [Nv. ' + state.me.nivel + ']', x, Math.max(22, y - h - 12), dead ? '#ffb3b3' : '#ffe69b', 'rgba(255,230,155,.4)');
  }

  function drawMonster(now) {
    if (!state.monster) return;
    var img = monsterImages[state.monster.templateId];
    var idle = Math.sin(now / 360) * 6;
    var x = canvas.width * 0.72;
    var y = canvas.height * 0.88 + idle;
    var isDragon = state.monster.templateId === 'dragon';
    var hit = now < state.anim.monsterHitUntil;
    var attack = now < state.anim.monsterAttackUntil;
    if (attack) x -= 28 * Math.sin((state.anim.monsterAttackUntil - now) / 290 * Math.PI);
    if (hit) x += (Math.random() - 0.5) * 20;
    var h = isDragon ? Math.min(330, canvas.height * 0.82) : Math.min(250, canvas.height * 0.62);
    var w = isDragon ? h * 1.18 : h * 0.95;
    if (img && img.complete) ctx.drawImage(img, x - w / 2, y - h, w, h);
    if (state.monster.special && state.monster.special.active) {
      ctx.save(); ctx.strokeStyle = 'rgba(180,140,255,.85)'; ctx.lineWidth = 6; ctx.shadowColor = 'rgba(180,140,255,.65)'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.ellipse(x, y - h / 2, w * 0.34, h * 0.43, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (hit) spawnParticles(x, y - h * 0.52, '#ff9090', 3);
    drawNameplate(state.monster.nome + ' [Nv. ' + state.monster.nivel + ']', x, Math.max(22, y - h - 12), '#eaf0ff', 'rgba(255,255,255,.16)');
  }

  function drawNameplate(text, x, y, fill, stroke) {
    ctx.save(); ctx.font = '700 13px Inter'; ctx.textAlign = 'center'; var width = Math.min(canvas.width * 0.42, ctx.measureText(text).width + 24); ctx.fillStyle = 'rgba(5,8,22,.68)'; ctx.strokeStyle = stroke; roundRect(x - width / 2, y - 16, width, 26, 10, true, true); ctx.fillStyle = fill; ctx.fillText(text, x, y + 2, width - 14); ctx.restore();
  }
  function roundRect(x, y, w, h, r, fill, stroke) { if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

  function spawnEffect(type, color) { state.effects.push({ type: type || 'ring', color: color || '#fff', start: performance.now(), duration: 950, x: canvas.width * 0.72, y: canvas.height * 0.55 }); }
  function drawEffects() {
    var now = performance.now(); state.effects = state.effects.filter(function (e) { return now - e.start < e.duration; });
    state.effects.forEach(function (e) { var p = (now - e.start) / e.duration; var x = e.x, y = e.y, c = e.color; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 4; ctx.shadowColor = c; ctx.shadowBlur = 20;
      if (e.type === 'slash') { for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 60 + i * 18, y + 45); ctx.lineTo(x + 40 + i * 18, y - 45); ctx.stroke(); } }
      else if (e.type === 'shieldBurst') { ctx.beginPath(); ctx.arc(x, y, 30 + p * 90, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 18 + p * 55, 0, Math.PI * 2); ctx.stroke(); }
      else if (e.type === 'groundCrack') { for (var j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(x + j * 18, y + 50); ctx.lineTo(x + j * 24 - 10, y + 10); ctx.lineTo(x + j * 28 + 8, y - 18); ctx.stroke(); } }
      else if (e.type === 'holyShockwave' || e.type === 'angelJudgement') { ctx.beginPath(); ctx.arc(x, y, 20 + p * 120, 0, Math.PI * 2); ctx.stroke(); for (var a = 0; a < 10; a++) { var ang = (Math.PI * 2 / 10) * a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * (45 + p * 90), y + Math.sin(ang) * (45 + p * 90)); ctx.stroke(); } }
      else if (e.type === 'arrowLine' || e.type === 'holySpear') { ctx.beginPath(); ctx.moveTo(x - 120, y + 12); ctx.lineTo(x + 50, y - 28); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 50, y - 28); ctx.lineTo(x + 28, y - 38); ctx.lineTo(x + 33, y - 8); ctx.closePath(); ctx.fill(); }
      else if (e.type === 'tripleArrow') { for (var t = -1; t <= 1; t++) { ctx.beginPath(); ctx.moveTo(x - 120, y + t * 20); ctx.lineTo(x + 30, y - 12 + t * 20); ctx.stroke(); } }
      else if (e.type === 'shadowDash') { for (var s = 0; s < 6; s++) { ctx.beginPath(); ctx.arc(x - 12 * s, y + 6 * s, 18 + p * 16, 0, Math.PI * 2); ctx.stroke(); } }
      else if (e.type === 'arrowRain' || e.type === 'meteorShower') { for (var m = 0; m < 12; m++) { var ox = -110 + m * 20; ctx.beginPath(); ctx.moveTo(x + ox, y - 120 + p * 35); ctx.lineTo(x + ox - 18, y - 55 + p * 55); ctx.stroke(); } }
      else if (e.type === 'prismBurst') { ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x - 65, y + 45); ctx.lineTo(x + 65, y + 45); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 22 + p * 52, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, 20 + p * 100, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore(); });
  }
  function drawParticles() { state.particles = state.particles.filter(function (p) { return p.life > 0; }); state.particles.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.04; ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); }
  function drawFloating() { state.floating = state.floating.filter(function (f) { return f.life > 0; }); state.floating.forEach(function (f) { f.y += f.vy; f.life -= 0.02; ctx.save(); ctx.globalAlpha = f.life; ctx.font = f.isCrit ? '900 30px Inter' : '900 20px Inter'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.fillStyle = f.color; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.restore(); }); }
  function render() { resizeCanvas(); var now = performance.now(); ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); drawPlayer(now); drawMonster(now); drawEffects(); drawParticles(); drawFloating(); requestAnimationFrame(render); }

  autoFarmBtn.onclick = function () { ensureAudio(); if (!state.me) return; socket.emit('toggleAutoFarm', { enabled: !state.me.autoFarm }); };
  menuBag.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuBag.classList.add('active'); openBag(); };
  bagClose.onclick = closeBag;
  bagModal.addEventListener('click', function (e) { if (e.target === bagModal) closeBag(); });
  sellAllBtn.onclick = function () { ensureAudio(); socket.emit('sellAllItems'); };
  equipmentGrid.addEventListener('click', function (e) { var slot = e.target && e.target.getAttribute('data-unequip'); if (slot) { ensureAudio(); socket.emit('unequipItem', { slot: slot }); } });

  socket.on('connect_error', function (err) { fatal('Falha ao conectar: ' + err.message); });
  socket.on('init', function (data) { state.meId = data.you.id; state.me = data.you; state.monster = data.monster; state.players = {}; (data.players || []).forEach(function (p) { state.players[p.id] = p; }); if (!state.me.classeId) { mountClassSelect(); classSelect.classList.remove('hidden'); } else { classSelect.classList.add('hidden'); mountAbilities(state.me.classeId); } updateHUD(); updateEnemyHUD(); });
  socket.on('playerJoined', function (p) { state.players[p.id] = p; }); socket.on('playerLeft', function (d) { delete state.players[d.id]; }); socket.on('onlineCount', function (n) { byId('hud-online-count').textContent = n; });
  socket.on('playerUpdated', function (player) { state.players[player.id] = player; if (player.id === state.meId) { state.me = player; if (player.classeId) { classSelect.classList.add('hidden'); mountAbilities(player.classeId); } } updateHUD(); });
  socket.on('gameState', function (list) { (list || []).forEach(function (p) { state.players[p.id] = p; if (p.id === state.meId) state.me = p; }); updateHUD(); });
  socket.on('enemyUpdate', function (monster) { state.monster = monster; updateEnemyHUD(); });
  socket.on('combatTick', function (data) { if (data.monster) { state.monster = data.monster; updateEnemyHUD(); }
    (data.attacks || []).forEach(function (attack) { var color = attack.isCrit ? '#ffe69b' : '#ff9090'; state.anim.playerAttackUntil = performance.now() + (attack.type === 'ability' ? 520 : 280); state.anim.monsterHitUntil = performance.now() + 360; pushFloating((attack.isCrit ? 'CRIT ' : '-') + attack.damage, color, canvas.width * 0.72 + (Math.random() - 0.5) * 90, canvas.height * 0.38 + (Math.random() - 0.5) * 60, attack.isCrit); playSound(attack.type === 'ability' ? 'skill' : 'hit'); if (attack.result && attack.result.specialTriggered) { if (attack.result.specialTriggered.type === 'bossShield') { addLog('🛡️ O Dragão Elemental ativou o Escudo Elemental! Use habilidades para quebrar.'); pushFloating('ESCUDO!', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('boss'); } else if (attack.result.specialTriggered.type === 'shieldBroken') { addLog('💥 O Escudo Elemental foi quebrado!'); pushFloating('QUEBRADO!', '#ffffff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('loot'); } } if (attack.result && attack.result.resisted) pushFloating('RESIST', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.45, false); });
    (data.monsterAttacks || []).forEach(function (ma) { state.anim.monsterAttackUntil = performance.now() + 360; if (ma.playerId === state.meId) { state.anim.playerHitUntil = performance.now() + 420; pushFloating('-' + ma.damage + ' HP', '#ffb0b0', canvas.width * 0.28, canvas.height * 0.42, ma.died); playSound(ma.died ? 'death' : 'hit'); } });
  });
  socket.on('enemyDied', function (data) { addLog('⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP e +' + data.goldGained + ' ouro.'); if (data.loot) { state.lootRecente.unshift(data.loot); state.lootRecente = state.lootRecente.slice(0, 8); addLog((data.loot.exclusivoBoss ? '🐉 Loot exclusivo: ' : '🎁 Loot obtido: ') + data.loot.icon + ' ' + data.loot.nome + ' [' + data.loot.raridade + ']'); playSound(data.loot.exclusivoBoss ? 'boss' : 'loot'); } if (data.progress && data.progress.leveledUp) addLog('✨ Level up! Agora você está no Nv. ' + data.progress.currentLevel + '.'); if (data.player && data.player.id === state.meId) state.me = data.player; if (data.nextMonster) { state.monster = data.nextMonster; updateEnemyHUD(); } updateHUD(); });
  socket.on('abilityUsed', function (evt) { spawnEffect(evt.visual && evt.visual.tipo, evt.visual && evt.visual.cor ? evt.visual.cor : '#fff'); if (evt.playerId === state.meId) startCooldownVisual(evt.habilidadeId, evt.cooldown); });
  socket.on('inventoryAction', function (info) { if (info.type === 'equip') { addLog('🧰 Item equipado: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'unequip') { addLog('🎒 Item retornou para a bolsa: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'sell') { addLog('🪙 Item vendido por +' + info.gold + ' ouro: ' + info.item.nome + '.'); state.selectedItemId = null; playSound('loot'); } if (info.type === 'sellAll') { addLog('🪙 ' + info.sold + ' itens vendidos por +' + info.gold + ' ouro.'); state.selectedItemId = null; playSound('loot'); } });
  socket.on('playerDied', function (data) { if (data.playerId === state.meId) { addLog('💀 Você foi derrotado por ' + data.monsterName + '. Ressurreição automática em 5s.'); state.anim.playerHitUntil = performance.now() + 900; playSound('death'); } });
  socket.on('playerRevived', function (data) { if (data.player && data.player.id === state.meId) { state.me = data.player; addLog('✨ Você ressuscitou e voltou ao combate.'); playSound('loot'); updateHUD(); } });
  socket.on('cooldownRejected', function (info) { addLog('⏳ Habilidade em recarga: ' + Math.ceil(info.restanteMs / 1000) + 's.'); });
  socket.on('errorMsg', function (msg) { addLog('⚠️ ' + msg); });

  mountClassSelect();
  requestAnimationFrame(render);
})();
