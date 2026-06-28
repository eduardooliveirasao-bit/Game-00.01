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
  var GEM_TYPES = window.GEM_TYPES || {};
  var MOUNTS = window.MOUNTS || {};
  var SHOP_ITEMS = window.SHOP_ITEMS || {};

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
    isAuthenticated: false,
    ranking: null,
    anim: {
      playerAttackUntil: 0,
      playerHitUntil: 0,
      monsterAttackUntil: 0,
      monsterHitUntil: 0,
      shakeUntil: 0,
      playerSkillType: null,
      monsterSkillType: null
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
  var equipBestBtn = byId('equip-best-btn');
  var equipmentGrid = byId('equipment-grid');
  var paperDoll = byId('paper-doll');
  var menuRanking = byId('menu-ranking');
  var rankingModal = byId('ranking-modal');
  var rankingClose = byId('ranking-close');
  var rankingLevel = byId('ranking-level');
  var rankingPower = byId('ranking-power');
  var menuMount = byId('menu-mount');
  var mountModal = byId('mount-modal');
  var mountClose = byId('mount-close');
  var mountCard = byId('mount-card');
  var authModal = byId('auth-modal');
  var authError = byId('auth-error');
  var loginBtn = byId('login-btn');
  var registerBtn = byId('register-btn');
  var menuShop = byId('menu-shop');
  var shopModal = byId('shop-modal');
  var shopClose = byId('shop-close');
  var shopList = byId('shop-list');
  var shopInfo = byId('shop-info');
  var gmMenu = byId('menu-gm');
  var gmModal = byId('gm-modal');
  var gmClose = byId('gm-close');

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
  var mountImages = {};
  Object.keys(MOUNTS).forEach(function (id) { var img = new Image(); img.src = MOUNTS[id].asset; mountImages[id] = img; });

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
    if (byId('hud-gems-value')) byId('hud-gems-value').textContent = formatNumber(p.gemas || 0);
    byId('hero-name-side').textContent = p.nome;
    byId('hero-class-side').textContent = classe ? classe.nome : 'Sem classe';
    byId('hero-level-side').textContent = p.nivel;
    byId('hero-power-side').textContent = formatNumber(p.power);
    byId('hero-hp-side').textContent = p.hp + ' / ' + p.maxHp;
    byId('hero-mana-side').textContent = p.mana + ' / ' + p.maxMana;
    byId('hero-gold-side').textContent = formatNumber(p.ouro);
    byId('hero-bag-count').textContent = (p.inventario || []).length;
    if (byId('hero-gems-side')) byId('hero-gems-side').textContent = formatNumber(p.gemas || 0);
    if (byId('hero-boss-side')) byId('hero-boss-side').textContent = formatNumber((p.stats && p.stats.bossKills) || 0);

    var portrait = byId('hero-portrait');
    portrait.style.backgroundImage = classe ? 'url("' + classe.asset.portrait + '")' : 'none';

    var isDead = !!p.isDead;
    autoFarmBtn.textContent = isDead ? 'Ressuscitando...' : ('Farm automático: ' + (p.autoFarm ? 'ON' : 'OFF'));
    autoFarmBtn.className = isDead ? 'dead' : (p.autoFarm ? 'auto-on' : 'auto-off');
    byId('stage-subtitle').textContent = isDead ? 'Herói derrotado' : (p.autoFarm ? 'Auto batalha ativa' : 'Auto batalha desativada');
    byId('hero-status-line').textContent = isDead ? 'Ressurreição automática em instantes' : 'Herói em combate';

    if (gmMenu) gmMenu.classList.toggle('hidden', !p.isGM);
    if (authModal) authModal.classList.toggle('hidden', !!p.isAuthenticated);
    renderEquipment(); renderPaperDoll(); renderBag(); updateLoot(); renderAchievements(); renderShop();
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
          '<strong style="color:' + (item.rarityColor || '#fff') + '"><img class="mini-item-img" src="' + (item.asset || '') + '" alt=""> ' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
          '<em>' + escapeHtml(item.raridade) + ' · ATQ ' + (item.stats.ataque || 0) + ' · DEF ' + (item.stats.defesa || 0) + ' · CRIT ' + (item.stats.critico || 0) + ' · HP ' + (item.stats.hp || 0) + ' · MANA ' + (item.stats.mana || 0) + '</em>' +
          '<button data-unequip="' + slot + '">Desequipar</button>';
      } else {
        div.innerHTML = '<span>' + labels[slot] + '</span><strong>Vazio</strong><em>Abra a bolsa para equipar.</em>';
      }
      equipmentGrid.appendChild(div);
    });
  }


  function renderPaperDoll() {
    if (!paperDoll || !state.me) return;
    var cls = GAME_CLASSES[state.me.classeId];
    var eq = state.me.equipados || {};
    var mount = state.me.mount || (state.me.visualMods && state.me.visualMods.mount);
    function slotHtml(slot, label) {
      var item = eq[slot];
      if (!item) return '<div class="paper-slot ' + slot + '"><span>' + label + '</span><strong>Vazio</strong></div>';
      return '<div class="paper-slot ' + slot + '" style="border-color:' + (item.rarityColor || '#fff') + '"><span>' + label + '</span><img src="' + (item.asset || '') + '" alt=""><strong>' + escapeHtml(item.nome) + '</strong></div>';
    }
    paperDoll.innerHTML = (mount ? '<img class="paper-mount" src="' + mount.asset + '" alt="' + escapeHtml(mount.nome) + '">' : '') +
      (cls ? '<img class="paper-hero" src="' + cls.asset.sprite + '" alt="' + escapeHtml(cls.nome) + '">' : '') +
      slotHtml('arma','Arma') + slotHtml('anel','Anel') + slotHtml('colar','Colar') + slotHtml('ornamento','Asa/Orn.');
  }

  function openBag() { bagModal.classList.remove('hidden'); renderBag(); }
  function closeBag() { bagModal.classList.add('hidden'); if (menuHunt) menuHunt.classList.add('active'); if (menuBag) menuBag.classList.remove('active'); }

  function itemStats(item) { return (item && (item.totalStats || item.stats)) || {}; }
  function statValue(item, key) { var st = itemStats(item); return st ? (st[key] || 0) : 0; }
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
      var equippedBadge = item.equipped ? '<span class="bag-item-badge">Equipado</span>' : '';
      var el = document.createElement('div');
      el.className = 'bag-item' + (state.selectedItemId === item.id ? ' active' : '') + (item.equipped ? ' is-equipped' : '');
      el.style.borderColor = item.rarityColor || item.cor || 'rgba(255,255,255,.08)';
      el.innerHTML = '<div class="bag-item-top"><div class="bag-item-image-wrap"><img class="bag-item-img" src="' + (item.asset || '') + '" alt="">' + equippedBadge + '</div><div class="bag-item-text"><strong style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
        '<small>' + escapeHtml(item.slot) + ' · ' + escapeHtml(item.raridade) + ' · Nv.' + (item.requiredLevel || 1) + '</small></div></div>' +
        '<div class="bag-item-bottom"><span>Poder ' + (item.powerScore || 0) + '</span><span>Venda ' + (item.sellValue || 0) + ' ouro</span></div>';
      el.onclick = function () { state.selectedItemId = item.id; renderBag(); renderBagDetail(item); };
      bagList.appendChild(el);
    });
    var selected = items.find(function (it) { return it.id === state.selectedItemId; }) || items[0];
    if (selected) { state.selectedItemId = selected.id; renderBagDetail(selected); }
  }

  function renderBagDetail(item) {
    if (!item) { bagDetail.innerHTML = 'Selecione um item da bolsa.'; return; }
    var equipped = state.me && state.me.equipados ? state.me.equipados[item.slot] : null;
    var isEquipped = !!item.equipped;
    var gems = item.gems || [];
    var sockets = item.sockets || 1;
    var socketHtml = '<div class="gem-sockets"><strong>Encaixes de gema</strong><div class="socket-row">';
    for (var i = 0; i < sockets; i++) {
      var gemId = gems[i];
      var gem = gemId ? GEM_TYPES[gemId] : null;
      socketHtml += '<span class="gem-socket ' + (gem ? 'filled' : '') + '">' + (gem ? '<img src="' + gem.asset + '" title="' + escapeHtml(gem.nome) + '">' : '+') + '</span>';
    }
    socketHtml += '</div><div class="gem-buttons">';
    Object.keys(GEM_TYPES).forEach(function (gid) {
      var g = GEM_TYPES[gid];
      socketHtml += '<button data-gem="' + gid + '"><img src="' + g.asset + '" alt=""> ' + escapeHtml(g.nome) + '</button>';
    });
    socketHtml += '</div><small>Cada gema inserida consome 1 💎 e aumenta os atributos do item.</small></div>';

    var equippedHtml = equipped ? '<div class="compare-item"><img class="compare-item-img" src="' + (equipped.asset || '') + '" alt=""><div><span style="color:' + (equipped.rarityColor || '#fff') + '">' + equipped.icon + ' ' + escapeHtml(equipped.nome) + '</span><small>' + escapeHtml(equipped.raridade) + ' · Poder ' + (equipped.powerScore || 0) + '</small></div></div>' : 'Nada equipado';
    var equippedState = isEquipped ? '<div class="bag-detail-equipped">✅ Este item está equipado neste momento.</div>' : '';
    var actionLabel = isEquipped ? 'Desequipar item' : 'Equipar item';
    var compareLabel = isEquipped ? 'Item atualmente equipado no slot:' : 'Equipado no slot:';

    bagDetail.innerHTML = '<h3 style="color:' + (item.rarityColor || '#fff') + '"><img class="detail-item-img" src="' + (item.asset || '') + '" alt=""> ' + item.icon + ' ' + escapeHtml(item.nome) + '</h3>' +
      '<div class="rarity ' + rarityClass(item.raridade) + '">' + escapeHtml(String(item.raridade).toUpperCase()) + ' · Slot ' + escapeHtml(item.slot) + ' · Requer Nv. ' + (item.requiredLevel || 1) + '</div>' +
      equippedState +
      '<p>Venda por <strong>' + (item.sellValue || 0) + ' ouro</strong> ou equipe para alterar os atributos e o visual do herói.</p>' +
      '<div class="detail-stats">' +
        diffHtml(item, equipped, 'ataque', 'ATQ') + diffHtml(item, equipped, 'defesa', 'DEF') + diffHtml(item, equipped, 'critico', 'CRIT') + diffHtml(item, equipped, 'hp', 'HP') + diffHtml(item, equipped, 'mana', 'MANA') + '<div>PODER<br><strong>' + (item.powerScore || 0) + '</strong></div>' +
      '</div>' +
      '<div class="compare-box"><strong>' + compareLabel + '</strong><br>' + equippedHtml + '</div>' +
      socketHtml +
      '<button id="equip-selected-btn">' + actionLabel + '</button><button id="sell-selected-btn">Vender item</button>';
    var equipBtn = byId('equip-selected-btn');
    var sellBtn = byId('sell-selected-btn');
    if (equipBtn) equipBtn.onclick = function () { ensureAudio(); if (isEquipped) socket.emit('unequipItem', { slot: item.slot }); else socket.emit('equipItem', { itemId: item.id }); };
    if (sellBtn) sellBtn.onclick = function () { ensureAudio(); socket.emit('sellItem', { itemId: item.id }); };
    Array.prototype.forEach.call(bagDetail.querySelectorAll('[data-gem]'), function (btn) {
      btn.onclick = function () { ensureAudio(); socket.emit('insertGem', { itemId: item.id, gemId: btn.getAttribute('data-gem') }); };
    });
  }

  function renderAchievements() {
    var el = byId('achievement-list');
    if (!el || !state.me) return;
    var list = state.me.achievements || [];
    if (!list.length) { el.innerHTML = '<div class="achievement-item locked">Nenhuma conquista desbloqueada ainda.</div>'; return; }
    el.innerHTML = list.slice(-6).reverse().map(function (id) {
      return '<div class="achievement-item">🏆 ' + escapeHtml(id.replace(/_/g, ' ')) + '</div>';
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

  function drawSegment(img, sw, sh, srcY0, srcY1, dx, dy, dw, dh, rot, sx, sy) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot || 0);
    ctx.scale(sx || 1, sy || 1);
    var sliceY = sh * srcY0;
    var sliceH = sh * (srcY1 - srcY0);
    ctx.drawImage(img, 0, sliceY, sw, sliceH, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function drawPlayer(now) {
    if (!state.me || !state.me.classeId) return;
    var img = characterImages[state.me.classeId];
    if (!img || !img.complete) return;
    var mods = state.me.visualMods || {};
    var mount = state.me.mount || (mods && mods.mount);
    var mountImg = mount && mountImages[mount.id];
    var clsId = state.me.classeId;
    var hit = now < state.anim.playerHitUntil;
    var attack = now < state.anim.playerAttackUntil;
    var dead = !!state.me.isDead;
    var t = now / 1000;
    var bob = Math.sin(now / 240) * 4;
    var x = canvas.width * 0.28;
    var y = canvas.height * 0.88 + bob;
    var progress = attack ? 1 - Math.max(0, (state.anim.playerAttackUntil - now) / 520) : 0;
    var swing = attack ? Math.sin(progress * Math.PI) : 0;
    if (attack) { x += swing * 60; y -= swing * 18; }
    if (hit) { x -= 10 + Math.random() * 5; }

    var charH = Math.min(262, Math.max(184, canvas.height * 0.62));
    var charW = clsId === 'mago' ? charH * 0.96 : charH * 0.82;
    var mountH = mount ? Math.min(138, charH * 0.50) : 0;
    var heroAnchorY = y - mountH;
    var breath = Math.sin(now / 190) * 0.018;
    var torsoTilt = (attack ? -0.14 * swing : 0) + (hit ? -0.07 : 0) + Math.sin(now / 450) * 0.015;
    var upperY = heroAnchorY - charH * 0.62;
    var midY = heroAnchorY - charH * 0.34;
    var lowerY = heroAnchorY - charH * 0.12;
    var lowerBounce = Math.sin(now / (state.me.autoFarm ? 110 : 180)) * (state.me.autoFarm ? 8 : 4);
    var headNod = Math.sin(now / 220) * 0.05 + (attack ? 0.08 * swing : 0);
    var armArc = attack ? 0.45 * swing : Math.sin(now / 260) * 0.06;

    ctx.save();
    if (dead) { ctx.globalAlpha = 0.58; ctx.filter = 'grayscale(1)'; }

    if (mountImg && mountImg.complete) {
      var mountW = mountH * 1.58;
      var trot = Math.sin(now / 110) * (state.me.autoFarm ? 4 : 2);
      ctx.save();
      ctx.translate(x - 4, y + trot * 0.25);
      ctx.rotate((attack ? -0.02 * swing : 0) + Math.sin(now / 250) * 0.01);
      ctx.scale(1 + Math.sin(now / 150) * 0.03, 1 - Math.sin(now / 150) * 0.02);
      ctx.drawImage(mountImg, -mountW / 2, -mountH, mountW, mountH);
      ctx.restore();
    }

    var wing = mods.wing || null;
    if (wing || clsId === 'mago') {
      var wingColor = wing ? wing.color : '#d7ebff';
      var scale = wing ? (wing.size || 1.15) : 1.0;
      var flap = Math.sin(now / 120) * 0.22 + (attack ? 0.10 * swing : 0);
      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = wingColor;
      ctx.shadowColor = wingColor;
      ctx.shadowBlur = 28;
      ctx.translate(x, heroAnchorY - charH * 0.56);
      ctx.rotate(-0.2 + flap);
      ctx.beginPath(); ctx.ellipse(-charW * 0.43, 0, charW * 0.34 * scale, charH * 0.23 * scale, -0.55, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(0.4 - flap * 2);
      ctx.beginPath(); ctx.ellipse(charW * 0.43, 0, charW * 0.34 * scale, charH * 0.23 * scale, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (mods.aura) {
      ctx.save(); ctx.globalAlpha = 0.30; ctx.strokeStyle = mods.aura; ctx.shadowColor = mods.aura; ctx.shadowBlur = 24; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, heroAnchorY - charH * 0.44, charW * 0.6, charH * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    var sw = img.naturalWidth || img.width;
    var sh = img.naturalHeight || img.height;

    // pernas/base
    drawSegment(img, sw, sh, 0.60, 1.00, x, lowerY + lowerBounce * 0.35, charW, charH * 0.40, attack ? 0.04 * swing : 0, 1 + breath, 1 - breath * 0.5);
    // tronco
    drawSegment(img, sw, sh, 0.26, 0.70, x, midY, charW * (1 + (attack ? 0.02 * swing : 0)), charH * 0.44, torsoTilt, 1 + breath, 1 - breath * 0.4);
    // cabeça/ombro superior
    drawSegment(img, sw, sh, 0.00, 0.30, x + (hit ? -4 : 0), upperY + (attack ? -5 * swing : 0), charW * 0.88, charH * 0.30, headNod, 1 + breath * 0.6, 1 + breath * 0.2);

    // braço/arma extra por classe para dar sensação de ataque real
    ctx.save();
    ctx.translate(x, heroAnchorY - charH * 0.42);
    ctx.rotate(armArc + torsoTilt * 0.6);
    if (mods.weaponGlow) {
      ctx.strokeStyle = mods.weaponGlow; ctx.shadowColor = mods.weaponGlow; ctx.shadowBlur = 18; ctx.lineWidth = 5;
    } else {
      ctx.strokeStyle = '#d9f0ff'; ctx.lineWidth = 4;
    }
    if (clsId === 'guerreiro') {
      ctx.beginPath(); ctx.moveTo(charW * 0.10, -charH * 0.05); ctx.lineTo(charW * 0.42, -charH * 0.36); ctx.stroke();
      if (attack) { ctx.beginPath(); ctx.arc(charW * 0.14, -charH * 0.08, charW * 0.42, -1.2, 0.55 + swing * 0.5); ctx.stroke(); }
    } else if (clsId === 'arqueiro') {
      ctx.beginPath(); ctx.arc(charW * 0.18, -charH * 0.08, charW * 0.16, -1.2, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(charW * 0.16, -charH * 0.22); ctx.lineTo(charW * 0.38 + swing * 16, -charH * 0.08); ctx.lineTo(charW * 0.16, charH * 0.08); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(charW * 0.16, -charH * 0.06); ctx.lineTo(charW * 0.38, -charH * 0.42); ctx.stroke();
      for (var o = 0; o < 3; o++) {
        var ang = t * 2.4 + o * 2.09;
        ctx.beginPath(); ctx.arc(Math.cos(ang) * charW * 0.22, -charH * 0.05 + Math.sin(ang) * 12, 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();

    if (mods.ringGlow) { ctx.save(); ctx.fillStyle = mods.ringGlow; ctx.shadowColor = mods.ringGlow; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x - charW * 0.16, heroAnchorY - charH * 0.38, 5 + Math.sin(now / 160) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

    if (hit) spawnParticles(x, heroAnchorY - charH * 0.35, '#ff7b7b', 2);
    drawNameplate(state.me.nome + ' [Nv. ' + state.me.nivel + ']', x, Math.max(22, heroAnchorY - charH - 18), dead ? '#ffb3b3' : '#ffe69b', 'rgba(255,230,155,.4)');
    ctx.restore();
  }

  function drawMonster(now) {
    if (!state.monster) return;
    var img = monsterImages[state.monster.templateId];
    var idle = Math.sin(now / 280) * 5;
    var x = canvas.width * 0.72;
    var y = canvas.height * 0.88 + idle;
    var isDragon = state.monster.templateId === 'dragon';
    var hit = now < state.anim.monsterHitUntil;
    var attack = now < state.anim.monsterAttackUntil;
    var attackPulse = attack ? Math.sin((1 - Math.max(0, (state.anim.monsterAttackUntil - now) / 360)) * Math.PI) : 0;
    if (attack) x -= 34 * attackPulse;
    if (hit) x += (Math.random() - 0.5) * 16;
    var h = isDragon ? Math.min(300, canvas.height * 0.72) : Math.min(220, canvas.height * 0.55);
    var w = isDragon ? h * 1.18 : h * 0.96;

    ctx.save();
    ctx.translate(x, y - h / 2);
    if (state.monster.templateId === 'slime') {
      ctx.scale(1 + Math.sin(now / 170) * 0.045, 1 - Math.sin(now / 170) * 0.05);
    } else if (state.monster.templateId === 'skeleton') {
      ctx.rotate((attack ? -0.05 * attackPulse : 0) + Math.sin(now / 360) * 0.01);
    } else if (isDragon) {
      ctx.scale(1 + Math.sin(now / 210) * 0.02, 1 - Math.sin(now / 210) * 0.015);
    }
    if (img && img.complete) ctx.drawImage(img, -w / 2, -h / 2, w, h);

    if (state.monster.templateId === 'skeleton' && attack) {
      ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 5; ctx.shadowColor = '#d8f0ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(-10, -10, w * 0.24, -1.0, 0.5); ctx.stroke();
    }
    if (isDragon && attack) {
      ctx.strokeStyle = '#ffb25e'; ctx.shadowColor = '#ffb25e'; ctx.shadowBlur = 18; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-w * 0.05, -h * 0.10); ctx.bezierCurveTo(w * 0.05, -h * 0.18, w * 0.18, -h * 0.05, w * 0.32, -h * 0.18); ctx.stroke();
    }
    ctx.restore();

    if (state.monster.special && state.monster.special.active) {
      ctx.save(); ctx.strokeStyle = 'rgba(180,140,255,.85)'; ctx.lineWidth = 6; ctx.shadowColor = 'rgba(180,140,255,.65)'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.ellipse(x, y - h / 2, w * 0.34, h * 0.43, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (hit) spawnParticles(x, y - h * 0.30, '#ff9090', 3);
    drawNameplate(state.monster.nome + ' [Nv. ' + state.monster.nivel + ']', x, Math.max(22, y - h - 12), '#eaf0ff', 'rgba(255,255,255,.16)');
  }

  function drawNameplate(text, x, y, fill, stroke) {
    ctx.save(); ctx.font = '700 13px Inter'; ctx.textAlign = 'center'; var width = Math.min(canvas.width * 0.42, ctx.measureText(text).width + 24); ctx.fillStyle = 'rgba(5,8,22,.68)'; ctx.strokeStyle = stroke; roundRect(x - width / 2, y - 16, width, 26, 10, true, true); ctx.fillStyle = fill; ctx.fillText(text, x, y + 2, width - 14); ctx.restore();
  }
  function roundRect(x, y, w, h, r, fill, stroke) { if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

  function spawnEffect(type, color, opts) {
    opts = opts || {};
    state.effects.push({
      type: type || 'ring',
      color: color || '#fff',
      start: performance.now(),
      duration: opts.duration || 950,
      x: opts.x != null ? opts.x : canvas.width * 0.72,
      y: opts.y != null ? opts.y : canvas.height * 0.55,
      fromX: opts.fromX != null ? opts.fromX : canvas.width * 0.34,
      fromY: opts.fromY != null ? opts.fromY : canvas.height * 0.50,
      toX: opts.toX != null ? opts.toX : canvas.width * 0.72,
      toY: opts.toY != null ? opts.toY : canvas.height * 0.46
    });
  }
  function drawEffects() {
    var now = performance.now(); state.effects = state.effects.filter(function (e) { return now - e.start < e.duration; });
    state.effects.forEach(function (e) {
      var p = (now - e.start) / e.duration;
      var x = e.x, y = e.y, c = e.color;
      var fx = e.fromX + (e.toX - e.fromX) * p;
      var fy = e.fromY + (e.toY - e.fromY) * p;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * 0.4); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 4; ctx.shadowColor = c; ctx.shadowBlur = 20;
      if (e.type === 'slash') {
        var cx = e.toX, cy = e.toY;
        for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 60 + i * 18, cy + 45); ctx.lineTo(cx + 40 + i * 18, cy - 45); ctx.stroke(); }
      }
      else if (e.type === 'shieldBurst') { ctx.beginPath(); ctx.arc(e.toX, e.toY, 30 + p * 90, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(e.toX, e.toY, 18 + p * 55, 0, Math.PI * 2); ctx.stroke(); }
      else if (e.type === 'groundCrack') { for (var j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(e.toX + j * 18, e.toY + 50); ctx.lineTo(e.toX + j * 24 - 10, e.toY + 10); ctx.lineTo(e.toX + j * 28 + 8, e.toY - 18); ctx.stroke(); } }
      else if (e.type === 'holyShockwave' || e.type === 'angelJudgement') { ctx.beginPath(); ctx.arc(e.toX, e.toY, 20 + p * 120, 0, Math.PI * 2); ctx.stroke(); for (var a = 0; a < 10; a++) { var ang = (Math.PI * 2 / 10) * a; ctx.beginPath(); ctx.moveTo(e.toX, e.toY); ctx.lineTo(e.toX + Math.cos(ang) * (45 + p * 90), e.toY + Math.sin(ang) * (45 + p * 90)); ctx.stroke(); } }
      else if (e.type === 'arrowLine' || e.type === 'holySpear') {
        ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 18, fy - 10); ctx.lineTo(fx - 14, fy + 12); ctx.closePath(); ctx.fill();
      }
      else if (e.type === 'tripleArrow') {
        for (var t = -1; t <= 1; t++) { ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY + t * 18); ctx.lineTo(fx, fy + t * 18); ctx.stroke(); }
      }
      else if (e.type === 'shadowDash') {
        for (var s = 0; s < 6; s++) { ctx.beginPath(); ctx.arc(fx - 12 * s, fy + 6 * s, 18 + p * 16, 0, Math.PI * 2); ctx.stroke(); }
      }
      else if (e.type === 'arrowRain' || e.type === 'meteorShower') {
        for (var m = 0; m < 12; m++) { var ox = -110 + m * 20; ctx.beginPath(); ctx.moveTo(e.toX + ox, e.toY - 120 + p * 35); ctx.lineTo(e.toX + ox - 18, e.toY - 55 + p * 55); ctx.stroke(); }
      }
      else if (e.type === 'prismBurst') { ctx.beginPath(); ctx.moveTo(e.toX, e.toY - 70); ctx.lineTo(e.toX - 65, e.toY + 45); ctx.lineTo(e.toX + 65, e.toY + 45); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(e.toX, e.toY, 22 + p * 52, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(e.toX, e.toY, 20 + p * 100, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
  }
  function drawParticles() { state.particles = state.particles.filter(function (p) { return p.life > 0; }); state.particles.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.04; ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); }
  function drawFloating() { state.floating = state.floating.filter(function (f) { return f.life > 0; }); state.floating.forEach(function (f) { f.y += f.vy; f.life -= 0.02; ctx.save(); ctx.globalAlpha = f.life; ctx.font = f.isCrit ? '900 30px Inter' : '900 20px Inter'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.fillStyle = f.color; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.restore(); }); }
  function render() { resizeCanvas(); var now = performance.now(); ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); drawPlayer(now); drawMonster(now); drawEffects(); drawParticles(); drawFloating(); requestAnimationFrame(render); }



  function openRanking() { rankingModal.classList.remove('hidden'); socket.emit('requestRanking'); }
  function closeRanking() { rankingModal.classList.add('hidden'); }
  function renderRanking(data) {
    state.ranking = data || state.ranking;
    if (!state.ranking) return;
    function rows(list, kind) {
      return (list || []).map(function (p, idx) {
        var cls = GAME_CLASSES[p.classeId] || { tipoIcone: '•', nomeCurto: p.classeId || 'Classe' };
        return '<div class="rank-row"><span class="rank-pos">#' + (idx + 1) + '</span><span>' + cls.tipoIcone + ' ' + escapeHtml(p.nome) + '<small>' + escapeHtml(cls.nomeCurto || p.classeId) + ' · Montaria ' + escapeHtml((p.mount && p.mount.nome) || '-') + '</small></span><strong>' + (kind === 'level' ? ('Nv. ' + p.nivel) : (formatNumber(p.power) + ' poder')) + '</strong></div>';
      }).join('') || '<div class="rank-row">Nenhum jogador ranqueado.</div>';
    }
    rankingLevel.innerHTML = rows(state.ranking.level, 'level');
    rankingPower.innerHTML = rows(state.ranking.power, 'power');
  }

  function openMount() { mountModal.classList.remove('hidden'); renderMount(); }
  function closeMount() { mountModal.classList.add('hidden'); }
  function renderMount() {
    if (!state.me || !mountCard) return;
    var mount = state.me.mount || { id: 'lobo_cristalino', nome: 'Lobo Cristalino', level: 1, asset: 'assets/mounts/lobo_cristalino.png', bonus: { ataque: 4, hp: 40, power: 80 } };
    var nextCost = 150 * (mount.level || 1);
    mountCard.innerHTML = '<div class="mount-preview"><img src="' + mount.asset + '" alt="' + escapeHtml(mount.nome) + '"></div>' +
      '<h3>' + escapeHtml(mount.nome) + ' <span>Nv. ' + (mount.level || 1) + '</span></h3>' +
      '<p>Montaria com arte própria e animação no palco. Treinamentos aumentam poder, HP e ataque.</p>' +
      '<div class="detail-stats"><div>PODER<br><strong>+' + (mount.bonus.power || 0) + '</strong></div><div>ATQ<br><strong>+' + (mount.bonus.ataque || 0) + '</strong></div><div>HP<br><strong>+' + (mount.bonus.hp || 0) + '</strong></div><div>CUSTO<br><strong>' + nextCost + ' ouro</strong></div></div>' +
      '<button id="upgrade-mount-btn">Treinar montaria</button>';
    var btn = byId('upgrade-mount-btn');
    if (btn) btn.onclick = function () { ensureAudio(); socket.emit('upgradeMount'); };
  }


  function setAuthError(msg) {
    if (authError) authError.textContent = msg || '';
  }

  function renderShop() {
    if (!shopList) return;
    var entries = Object.keys(SHOP_ITEMS).map(function (id) { return SHOP_ITEMS[id]; });
    if (!entries.length) {
      shopList.innerHTML = '<div class="shop-card">Loja sem itens.</div>';
      return;
    }
    shopList.innerHTML = entries.map(function (item) {
      return '<div class="shop-card">' +
        '<img src="' + (item.asset || '') + '" alt="' + escapeHtml(item.nome) + '">' +
        '<div><strong>' + item.icon + ' ' + escapeHtml(item.nome) + '</strong><small>' + escapeHtml(item.desc || '') + '</small><small>Preço: 💎 ' + (item.priceGems || 0) + '</small></div>' +
        '<button data-buy="' + item.id + '">Comprar</button>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(shopList.querySelectorAll('[data-buy]'), function (btn) {
      btn.onclick = function () {
        ensureAudio();
        socket.emit('buyShopItem', { itemId: btn.getAttribute('data-buy') });
      };
    });
    if (shopInfo && state.me) shopInfo.innerHTML = 'Saldo atual: <strong>💎 ' + formatNumber(state.me.gemas || 0) + '</strong><br>Poções: Vida ' + ((state.me.pocoes && state.me.pocoes.vida) || 0) + ' · Mana ' + ((state.me.pocoes && state.me.pocoes.mana) || 0);
  }

  function openShop() {
    if (!state.me || !state.me.isAuthenticated) { setAuthError('Faça login para abrir a loja.'); if (authModal) authModal.classList.remove('hidden'); return; }
    shopModal.classList.remove('hidden');
    renderShop();
  }

  function closeShop() {
    shopModal.classList.add('hidden');
  }

  function openGM() {
    if (!state.me || !state.me.isGM) return;
    gmModal.classList.remove('hidden');
  }

  function closeGM() {
    gmModal.classList.add('hidden');
  }


  if (loginBtn) loginBtn.onclick = function () {
    ensureAudio();
    setAuthError('');
    socket.emit('loginAccount', {
      login: byId('login-user').value,
      password: byId('login-pass').value
    });
  };
  if (registerBtn) registerBtn.onclick = function () {
    ensureAudio();
    setAuthError('');
    socket.emit('registerAccount', {
      login: byId('reg-user').value,
      password: byId('reg-pass').value,
      nick: byId('reg-nick').value,
      classeId: byId('reg-class').value
    });
  };

  autoFarmBtn.onclick = function () { ensureAudio(); if (!state.me) return; socket.emit('toggleAutoFarm', { enabled: !state.me.autoFarm }); };
  menuBag.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuBag.classList.add('active'); openBag(); };
  bagClose.onclick = closeBag;
  if (menuRanking) menuRanking.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuRanking.classList.add('active'); openRanking(); };
  if (rankingClose) rankingClose.onclick = closeRanking;
  if (rankingModal) rankingModal.addEventListener('click', function (e) { if (e.target === rankingModal) closeRanking(); });
  if (menuMount) menuMount.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuMount.classList.add('active'); openMount(); };
  if (mountClose) mountClose.onclick = closeMount;
  if (mountModal) mountModal.addEventListener('click', function (e) { if (e.target === mountModal) closeMount(); });

  if (menuShop) menuShop.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuShop.classList.add('active'); openShop(); };
  if (shopClose) shopClose.onclick = closeShop;
  if (shopModal) shopModal.addEventListener('click', function (e) { if (e.target === shopModal) closeShop(); });
  var hpPotionBtn = byId('use-hp-potion');
  var mpPotionBtn = byId('use-mp-potion');
  if (hpPotionBtn) hpPotionBtn.onclick = function () { ensureAudio(); socket.emit('usePotion', { type: 'vida' }); };
  if (mpPotionBtn) mpPotionBtn.onclick = function () { ensureAudio(); socket.emit('usePotion', { type: 'mana' }); };
  if (gmMenu) gmMenu.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); gmMenu.classList.add('active'); openGM(); };
  if (gmClose) gmClose.onclick = closeGM;
  if (gmModal) {
    gmModal.addEventListener('click', function (e) { if (e.target === gmModal) closeGM(); });
    Array.prototype.forEach.call(gmModal.querySelectorAll('[data-gm]'), function (btn) {
      btn.onclick = function () {
        ensureAudio();
        var cmd = btn.getAttribute('data-gm');
        var amount = cmd === 'addLevel' ? 5 : (cmd === 'addGems' ? 10000 : 100000);
        socket.emit('gmCommand', { cmd: cmd, amount: amount });
      };
    });
  }

  bagModal.addEventListener('click', function (e) { if (e.target === bagModal) closeBag(); });
  sellAllBtn.onclick = function () { ensureAudio(); socket.emit('sellAllItems'); };
  if (equipBestBtn) equipBestBtn.onclick = function () { ensureAudio(); socket.emit('equipBestItems'); };
  equipmentGrid.addEventListener('click', function (e) { var slot = e.target && e.target.getAttribute('data-unequip'); if (slot) { ensureAudio(); socket.emit('unequipItem', { slot: slot }); } });

  socket.on('connect_error', function (err) { fatal('Falha ao conectar: ' + err.message); });
  socket.on('init', function (data) {
    state.meId = data.you.id;
    state.me = data.you;
    state.monster = data.monster;
    state.players = {};
    (data.players || []).forEach(function (p) { state.players[p.id] = p; });
    if (authModal) authModal.classList.remove('hidden');
    classSelect.classList.add('hidden');
    mountClassSelect();
    updateHUD();
    updateEnemyHUD();
    renderShop();
  });
  socket.on('playerJoined', function (p) { state.players[p.id] = p; }); socket.on('playerLeft', function (d) { delete state.players[d.id]; }); socket.on('onlineCount', function (n) { byId('hud-online-count').textContent = n; });
  socket.on('playerUpdated', function (player) {
    state.players[player.id] = player;
    if (player.id === state.meId) {
      state.me = player;
      if (player.isAuthenticated && authModal) authModal.classList.add('hidden');
      if (player.classeId) { classSelect.classList.add('hidden'); mountAbilities(player.classeId); }
      else if (player.isAuthenticated) { mountClassSelect(); classSelect.classList.remove('hidden'); }
    }
    updateHUD();
  });
  socket.on('gameState', function (list) { (list || []).forEach(function (p) { state.players[p.id] = p; if (p.id === state.meId) state.me = p; }); updateHUD(); });
  socket.on('enemyUpdate', function (monster) { state.monster = monster; updateEnemyHUD(); });
  socket.on('combatTick', function (data) { if (data.monster) { state.monster = data.monster; updateEnemyHUD(); }
    (data.attacks || []).forEach(function (attack) { var color = attack.isCrit ? '#ffe69b' : '#ff9090'; state.anim.playerAttackUntil = performance.now() + (attack.type === 'ability' ? 520 : 280); state.anim.monsterHitUntil = performance.now() + 360; pushFloating((attack.isCrit ? 'CRIT ' : '-') + attack.damage, color, canvas.width * 0.72 + (Math.random() - 0.5) * 90, canvas.height * 0.38 + (Math.random() - 0.5) * 60, attack.isCrit); playSound(attack.type === 'ability' ? 'skill' : 'hit'); if (attack.result && attack.result.specialTriggered) { if (attack.result.specialTriggered.type === 'bossShield') { addLog('🛡️ O Dragão Elemental ativou o Escudo Elemental! Use habilidades para quebrar.'); pushFloating('ESCUDO!', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('boss'); } else if (attack.result.specialTriggered.type === 'shieldBroken') { addLog('💥 O Escudo Elemental foi quebrado!'); pushFloating('QUEBRADO!', '#ffffff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('loot'); } } if (attack.result && attack.result.resisted) pushFloating('RESIST', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.45, false); });
    (data.monsterAttacks || []).forEach(function (ma) { state.anim.monsterAttackUntil = performance.now() + 360; if (ma.playerId === state.meId) { state.anim.playerHitUntil = performance.now() + 420; pushFloating('-' + ma.damage + ' HP', '#ffb0b0', canvas.width * 0.28, canvas.height * 0.42, ma.died); playSound(ma.died ? 'death' : 'hit'); } });
  });
  socket.on('enemyDied', function (data) { addLog('⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP e +' + data.goldGained + ' ouro.'); if (data.loot) { state.lootRecente.unshift(data.loot); state.lootRecente = state.lootRecente.slice(0, 8); addLog((data.loot.exclusivoBoss ? '🐉 Loot exclusivo: ' : '🎁 Loot obtido: ') + data.loot.icon + ' ' + data.loot.nome + ' [' + data.loot.raridade + ']'); playSound(data.loot.exclusivoBoss ? 'boss' : 'loot'); } if (data.progress && data.progress.leveledUp) addLog('✨ Level up! Agora você está no Nv. ' + data.progress.currentLevel + '.'); if (data.player && data.player.id === state.meId) state.me = data.player; if (data.nextMonster) { state.monster = data.nextMonster; updateEnemyHUD(); } updateHUD(); });
  socket.on('abilityUsed', function (evt) {
    var color = evt.visual && evt.visual.cor ? evt.visual.cor : '#fff';
    var type = evt.visual && evt.visual.tipo;
    state.anim.playerSkillType = type;
    state.anim.playerSkillUntil = performance.now() + 900;
    spawnEffect(type, color, {
      fromX: canvas.width * 0.35,
      fromY: canvas.height * 0.47,
      toX: canvas.width * 0.72,
      toY: canvas.height * 0.40,
      duration: /Rain|Shower|Judgement|Shockwave|Burst/.test(type || '') ? 1050 : 760
    });
    if (evt.playerId === state.meId) {
      state.anim.playerAttackUntil = performance.now() + 560;
      state.anim.monsterHitUntil = performance.now() + 420;
      startCooldownVisual(evt.habilidadeId, evt.cooldown);
    }
    playSound('skill');
  });
  socket.on('inventoryAction', function (info) { if (info.type === 'equip') { addLog('🧰 Item equipado: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'unequip') { addLog('🎒 Item retornou para a bolsa: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'sell') { addLog('🪙 Item vendido por +' + info.gold + ' ouro: ' + info.item.nome + '.'); state.selectedItemId = null; playSound('loot'); } if (info.type === 'sellAll') { addLog('🪙 ' + info.sold + ' itens vendidos por +' + info.gold + ' ouro.'); state.selectedItemId = null; playSound('loot'); } if (info.type === 'equipBest') { addLog('⚡ Melhor equipamento aplicado: ' + ((info.equippedItems || []).length) + ' item(ns).'); playSound('equip'); } if (info.type === 'gem') { addLog('💎 Gema inserida: ' + info.gem.nome + ' em ' + info.item.nome + '.'); playSound('equip'); } });
  socket.on('playerDied', function (data) { if (data.playerId === state.meId) { addLog('💀 Você foi derrotado por ' + data.monsterName + '. Ressurreição automática em 5s.'); state.anim.playerHitUntil = performance.now() + 900; playSound('death'); } });
  socket.on('playerRevived', function (data) { if (data.player && data.player.id === state.meId) { state.me = data.player; addLog('✨ Você ressuscitou e voltou ao combate.'); playSound('loot'); updateHUD(); } });
  socket.on('saveLoaded', function (info) { if (info.ok && info.player) { state.me = info.player; localStorage.setItem('legend_of_indle_save_id', info.saveId); if (byId('hud-save-status')) byId('hud-save-status').textContent = 'Save carregado'; addLog('💾 Progresso carregado.'); if (info.offlineRewards) addLog('🌙 Recompensa offline: +' + info.offlineRewards.xp + ' XP, +' + info.offlineRewards.gold + ' ouro e ' + info.offlineRewards.kills + ' abates.'); updateHUD(); } else { if (info.saveId) localStorage.setItem('legend_of_indle_save_id', info.saveId); if (byId('hud-save-status')) byId('hud-save-status').textContent = 'Novo save'; } });
  socket.on('saveStatus', function (info) { if (info.ok && byId('hud-save-status')) byId('hud-save-status').textContent = 'Salvo'; });
  socket.on('achievementsUnlocked', function (list) { (list || []).forEach(function (a) { addLog('🏆 Conquista: ' + a.nome + ' +' + (a.reward.ouro || 0) + ' ouro +' + (a.reward.gemas || 0) + ' gemas.'); playSound('loot'); }); });
  socket.on('rankingUpdate', function (data) { renderRanking(data); });
  socket.on('mountUpdated', function (data) { addLog('🐺 Montaria treinada: ' + data.mount.nome + ' Nv. ' + data.mount.level + '.'); playSound('equip'); renderMount(); });


  socket.on('authSuccess', function (data) {
    state.me = data.player;
    localStorage.setItem('legend_of_indle_account_login', data.account.login);
    if (authModal) authModal.classList.add('hidden');
    if (byId('hud-save-status')) byId('hud-save-status').textContent = data.account.isGM ? 'GM conectado' : 'Conta conectada';
    addLog('🔐 Login realizado: ' + data.account.nick + (data.account.isGM ? ' [GM]' : '') + '.');
    if (state.me.classeId) { classSelect.classList.add('hidden'); mountAbilities(state.me.classeId); }
    updateHUD();
  });

  socket.on('authError', function (msg) {
    setAuthError(msg || 'Falha ao autenticar.');
  });

  socket.on('shopAction', function (data) {
    if (data.player) state.me = data.player;
    if (data.type === 'buy') {
      var name = data.item ? data.item.nome : 'item';
      addLog('🛒 Compra realizada: ' + name + '.');
      if (data.granted && data.granted.item) addLog('🎁 Loja entregou: ' + data.granted.item.nome + '.');
      if (data.granted && data.granted.ouro) addLog('🪙 Loja entregou +' + data.granted.ouro + ' ouro.');
      if (data.granted && data.granted.mount) addLog('🐺 Montaria equipada: ' + data.granted.mount.nome + '.');
      playSound('loot');
    } else if (data.type === 'usePotion') {
      addLog('🧪 Poção usada: ' + data.potionType + '.');
      playSound('equip');
    }
    updateHUD();
    renderShop();
  });

  socket.on('gmResult', function (data) {
    if (data.player) state.me = data.player;
    addLog('🛠️ Comando GM executado: ' + data.cmd + '.');
    playSound('boss');
    updateHUD();
  });

  socket.on('cooldownRejected', function (info) { addLog('⏳ Habilidade em recarga: ' + Math.ceil(info.restanteMs / 1000) + 's.'); });
  socket.on('errorMsg', function (msg) { addLog('⚠️ ' + msg); });

  setInterval(function () { if (state.me && state.me.saveId) socket.emit('saveNow'); }, 20000);
  mountClassSelect();
  requestAnimationFrame(render);
})();
