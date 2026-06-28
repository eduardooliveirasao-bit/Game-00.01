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
  var PETS = window.PETS || {};
  var MISSION_DEFS = window.MISSION_DEFS || {};
  var CODEX_MILESTONES = window.CODEX_MILESTONES || {};
  var ARTIFACTS = window.ARTIFACTS || {};

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
    },
    v30Tab: 'season'
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
  var claimDailyBtn = byId('claim-daily-btn');
  var dailyInfo = byId('daily-info');
  var gmMenu = byId('menu-gm');
  var gmModal = byId('gm-modal');
  var gmClose = byId('gm-close');
  var menuTalent = byId('menu-talent');
  var talentModal = byId('talent-modal');
  var talentClose = byId('talent-close');
  var talentList = byId('talent-list');
  var talentSummary = byId('talent-summary');
  var menuExpedition = byId('menu-expedition');
  var expeditionModal = byId('expedition-modal');
  var expeditionClose = byId('expedition-close');
  var expeditionList = byId('expedition-list');
  var expeditionStatus = byId('expedition-status');
  var menuMissions = byId('menu-missions');
  var missionsModal = byId('missions-modal');
  var missionsClose = byId('missions-close');
  var missionsList = byId('missions-list');
  var missionsSummary = byId('missions-summary');
  var menuCodex = byId('menu-codex');
  var codexModal = byId('codex-modal');
  var codexClose = byId('codex-close');
  var codexList = byId('codex-list');
  var codexSummary = byId('codex-summary');
  var menuAscension = byId('menu-ascension');
  var ascensionModal = byId('ascension-modal');
  var ascensionClose = byId('ascension-close');
  var ascensionSummary = byId('ascension-summary');
  var artifactList = byId('artifact-list');
  var menuV30 = byId('menu-v30');
  var v30Modal = byId('v30-modal');
  var v30Close = byId('v30-close');
  var v30Content = byId('v30-content');
  var menuV40 = byId('menu-v40');
  var v40Modal = byId('v40-modal');
  var v40Close = byId('v40-close');
  var v40Content = byId('v40-content');

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

  var imageCache = {};
  function cachedImage(src) {
    if (!src) return null;
    if (!imageCache[src]) { var img = new Image(); img.src = src; imageCache[src] = img; }
    return imageCache[src];
  }
  function loadFrames(prefix, count) {
    var list = [];
    for (var i = 0; i < count; i++) list.push(cachedImage(prefix + '/' + i + '.png'));
    return list;
  }
  var characterImages = {};
  var characterPoses = {};
  Object.keys(GAME_CLASSES).forEach(function (id) {
    characterImages[id] = cachedImage(GAME_CLASSES[id].asset.sprite);
    characterPoses[id] = {
      idle: cachedImage('assets/poses/characters/' + id + '/idle.png'),
      attack: cachedImage('assets/poses/characters/' + id + '/attack.png'),
      hit: cachedImage('assets/poses/characters/' + id + '/hit.png')
    };
  });
  var monsterImages = {};
  var monsterAnims = {};
  MONSTERS.forEach(function (m) {
    monsterImages[m.id] = cachedImage(m.asset);
    monsterAnims[m.id] = {
      idle: loadFrames('assets/anim/monsters/' + m.id + '/idle', 8),
      attack: loadFrames('assets/anim/monsters/' + m.id + '/attack', 6),
      hit: loadFrames('assets/anim/monsters/' + m.id + '/hit', 4)
    };
  });
  var mountImages = {};
  var mountAnims = {};
  Object.keys(MOUNTS).forEach(function (id) {
    mountImages[id] = cachedImage(MOUNTS[id].asset);
    mountAnims[id] = {
      idle: loadFrames('assets/anim/mounts/' + id + '/idle', 8),
      run: loadFrames('assets/anim/mounts/' + id + '/run', 8),
      hit: loadFrames('assets/anim/mounts/' + id + '/hit', 4)
    };
  });

  function animFrame(frames, now, fps) {
    if (!frames || !frames.length) return null;
    return frames[Math.floor((now / 1000) * (fps || 8)) % frames.length];
  }
  function getAnimatedImage(kind, id, action, now) {
    var groups = kind === 'monster' ? monsterAnims : mountAnims;
    var fallbacks = kind === 'monster' ? monsterImages : mountImages;
    var set = groups[id];
    var frames = set && set[action];
    var img = animFrame(frames, now, action === 'attack' ? 12 : action === 'hit' ? 14 : 8);
    return (img && img.complete) ? img : fallbacks[id];
  }
  function getCharacterPose(id, action) {
    var set = characterPoses[id] || {};
    var img = set[action] || set.idle || characterImages[id];
    return (img && img.complete) ? img : characterImages[id];
  }
  function getItemImage(src) { return cachedImage(src); }
  function lerp(a, b, t) { return a + (b - a) * t; }

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
    var eqColors = []; if (p.equipados) Object.keys(p.equipados).forEach(function(k){ if(p.equipados[k] && p.equipados[k].rarityColor) eqColors.push(p.equipados[k].rarityColor); });
    var glow = eqColors[0] || (classe && classe.corPrimaria) || '#5da9ff';
    portrait.style.borderColor = glow;
    portrait.style.boxShadow = '0 0 0 1px ' + glow + '55, 0 0 26px ' + glow + '30, inset 0 -60px 60px rgba(0,0,0,.18)';

    var isDead = !!p.isDead;
    autoFarmBtn.textContent = isDead ? 'Ressuscitando...' : ('Farm automático: ' + (p.autoFarm ? 'ON' : 'OFF'));
    autoFarmBtn.className = isDead ? 'dead' : (p.autoFarm ? 'auto-on' : 'auto-off');
    byId('stage-subtitle').textContent = isDead ? 'Herói derrotado' : (p.autoFarm ? 'Auto batalha ativa' : 'Auto batalha desativada');
    byId('hero-status-line').textContent = isDead ? 'Ressurreição automática em instantes' : 'Herói em combate';

    if (gmMenu) gmMenu.classList.toggle('hidden', !p.isGM);
    if (authModal) authModal.classList.toggle('hidden', !!p.isAuthenticated);
    renderEquipment(); renderPaperDoll(); renderBag(); updateLoot(); renderPets(); renderAchievements(); renderShop(); renderTalents(); renderExpedition(); renderMissions(); renderCodex(); renderAscension();
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
    var attrs = state.me.attributes || {};
    var mounts = state.me.mountCollection || [];
    var mountBonus = state.me.mountBonus || {};
    function slotHtml(slot, label) {
      var item = eq[slot];
      if (!item) return '<button class="paper-slot ' + slot + '"><span>' + label + '</span><strong>Vazio</strong></button>';
      return '<button class="paper-slot ' + slot + ' filled" style="border-color:' + (item.rarityColor || '#fff') + '"><span>' + label + '</span><img src="' + (item.asset || '') + '" alt=""><strong>' + escapeHtml(item.nome) + '</strong><em style="color:' + (item.rarityColor || '#fff') + '">' + escapeHtml(item.raridade) + '</em></button>';
    }
    function attr(label, value, icon, clsName) {
      return '<div class="paper-attr ' + (clsName || '') + '"><span>' + icon + ' ' + label + '</span><strong>' + formatNumber(value || 0) + '</strong></div>';
    }
    var mountRows = mounts.map(function(m){
      var b = m.bonusCalculated || {};
      return '<div class="mount-mini ' + (m.active ? 'active' : '') + '" data-mount-id="' + m.id + '"><img src="' + m.asset + '" alt=""><div><strong>' + escapeHtml(m.nome) + ' Nv.' + (m.level || 1) + '</strong><small>+' + formatNumber((b.power||0)) + ' poder · +' + (b.ataque||0) + ' ATK · +' + (b.hp||0) + ' HP</small></div><button data-activate-mount="' + m.id + '">' + (m.active ? 'Ativa' : 'Ativar') + '</button></div>';
    }).join('') || '<div class="mount-mini empty">Nenhuma montaria.</div>';
    paperDoll.innerHTML =
      '<div class="paper-hero-card">' +
        '<div class="paper-hero-frame">' + (cls ? '<img class="paper-hero" src="' + cls.asset.sprite + '" alt="' + escapeHtml(cls.nome) + '">' : '') + slotHtml('arma','Arma') + slotHtml('anel','Anel') + slotHtml('colar','Colar') + slotHtml('ornamento','Asa/Orn.') + '</div>' +
        '<div class="paper-name"><strong>' + escapeHtml(state.me.nome || 'Herói') + '</strong><small>' + escapeHtml(cls ? cls.nome : 'Sem classe') + ' · Nv. ' + (state.me.nivel || 1) + '</small></div>' +
      '</div>' +
      '<div class="paper-stats-panel">' +
        '<div class="paper-section-title">Atributos</div>' +
        '<div class="paper-attr-grid">' +
          attr('Poder', attrs.power || state.me.power, '⚔️', 'main') + attr('Ataque', attrs.attack, '🗡️') + attr('Defesa', attrs.defense, '🛡️') + attr('HP Máx.', attrs.maxHp || state.me.maxHp, '❤️') + attr('Mana Máx.', attrs.maxMana || state.me.maxMana, '🔷') + attr('Crítico', attrs.crit, '🎯') + attr('Velocidade', attrs.speed, '⚡') + attr('Evasão', attrs.evasion, '🌀') +
        '</div>' +
        '<div class="paper-section-title">Bônus acumulado de montarias</div>' +
        '<div class="mount-bonus-line">+' + formatNumber(mountBonus.power || 0) + ' Poder · +' + (mountBonus.ataque || 0) + ' ATK · +' + (mountBonus.defesa || 0) + ' DEF · +' + (mountBonus.hp || 0) + ' HP</div>' +
        '<div class="mount-collection-list">' + mountRows + '</div>' +
      '</div>';
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
    var items = (state.me.inventario || []).slice().sort(function(a,b){ if(!!a.equipped !== !!b.equipped) return a.equipped ? -1 : 1; return (b.powerScore||0) - (a.powerScore||0); });
    bagList.innerHTML = '';
    if (!items.length) {
      bagList.innerHTML = '<div class="bag-item">Nenhum item na bolsa ainda.</div>';
      bagDetail.innerHTML = 'Derrote monstros para obter itens.';
      return;
    }
    items.forEach(function (item) {
      var badges = [];
      if (item.equipped) badges.push('<span class="bag-item-badge">Equipado</span>');
      if (item.locked) badges.push('<span class="bag-item-badge lock">🔒</span>');
      if ((item.upgradeLevel || 0) > 0) badges.push('<span class="bag-item-badge plus">+' + item.upgradeLevel + '</span>');
      var equippedBadge = badges.join('');
      var el = document.createElement('div');
      el.className = 'bag-item' + (state.selectedItemId === item.id ? ' active' : '') + (item.equipped ? ' is-equipped' : '');
      el.style.borderColor = item.rarityColor || item.cor || 'rgba(255,255,255,.08)';
      el.innerHTML = '<div class="bag-item-top"><div class="bag-item-image-wrap"><img class="bag-item-img" src="' + (item.asset || '') + '" alt="">' + equippedBadge + '</div><div class="bag-item-text"><strong style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
        '<small>' + escapeHtml(item.slot) + ' · ' + escapeHtml(item.raridade) + ' · Nv.' + (item.requiredLevel || 1) + ((item.upgradeLevel||0)>0 ? ' · +' + item.upgradeLevel : '') + (item.locked ? ' · Protegido' : '') + '</small></div></div>' +
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
    var lockLabel = item.locked ? 'Desbloquear item' : 'Bloquear item';
    var upgradeLevel = item.upgradeLevel || 0;
    var upgradeCostGold = Math.floor(220 + Math.pow(upgradeLevel + 1, 1.65) * 145 + (['comum','raro','épico','lendário','mítico','boss'].indexOf(item.raridade) || 0) * 180);
    var upgradeCostGems = upgradeLevel >= 5 ? Math.ceil((upgradeLevel - 4) / 3) : 0;
    var compareLabel = isEquipped ? 'Item atualmente equipado no slot:' : 'Equipado no slot:';

    bagDetail.innerHTML = '<h3 style="color:' + (item.rarityColor || '#fff') + '"><img class="detail-item-img" src="' + (item.asset || '') + '" alt=""> ' + item.icon + ' ' + escapeHtml(item.nome) + '</h3>' +
      '<div class="rarity ' + rarityClass(item.raridade) + '">' + escapeHtml(String(item.raridade).toUpperCase()) + ' · Slot ' + escapeHtml(item.slot) + ' · Requer Nv. ' + (item.requiredLevel || 1) + ' · Melhoria +' + (item.upgradeLevel || 0) + (item.locked ? ' · 🔒 Protegido' : '') + '</div>' +
      equippedState +
      '<p>Venda por <strong>' + (item.sellValue || 0) + ' ouro</strong> ou equipe para alterar os atributos e o visual do herói.</p>' +
      '<div class="detail-stats">' +
        diffHtml(item, equipped, 'ataque', 'ATQ') + diffHtml(item, equipped, 'defesa', 'DEF') + diffHtml(item, equipped, 'critico', 'CRIT') + diffHtml(item, equipped, 'hp', 'HP') + diffHtml(item, equipped, 'mana', 'MANA') + '<div>PODER<br><strong>' + (item.powerScore || 0) + '</strong></div>' +
      '</div>' +
      '<div class="compare-box"><strong>' + compareLabel + '</strong><br>' + equippedHtml + '</div>' +
      socketHtml +
      '<div class="upgrade-box"><strong>Forja</strong><br>Melhorar para +' + (upgradeLevel + 1) + ': ' + upgradeCostGold + ' ouro' + (upgradeCostGems ? ' + ' + upgradeCostGems + ' 💎' : '') + '</div>' +
      '<button id="equip-selected-btn">' + actionLabel + '</button><button id="upgrade-selected-btn">Melhorar item</button><button id="lock-selected-btn">' + lockLabel + '</button><button id="sell-selected-btn">Vender item</button>';
    var equipBtn = byId('equip-selected-btn');
    var sellBtn = byId('sell-selected-btn');
    var upgradeBtn = byId('upgrade-selected-btn');
    var lockBtn = byId('lock-selected-btn');
    if (equipBtn) equipBtn.onclick = function () { ensureAudio(); if (isEquipped) socket.emit('unequipItem', { slot: item.slot }); else socket.emit('equipItem', { itemId: item.id }); };
    if (upgradeBtn) upgradeBtn.onclick = function () { ensureAudio(); socket.emit('upgradeItem', { itemId: item.id }); };
    if (lockBtn) lockBtn.onclick = function () { ensureAudio(); socket.emit('toggleLockItem', { itemId: item.id }); };
    if (sellBtn) sellBtn.onclick = function () { ensureAudio(); socket.emit('sellItem', { itemId: item.id }); };
    Array.prototype.forEach.call(bagDetail.querySelectorAll('[data-gem]'), function (btn) {
      btn.onclick = function () { ensureAudio(); socket.emit('insertGem', { itemId: item.id, gemId: btn.getAttribute('data-gem') }); };
    });
  }


  function addLog(text) {
    var el = byId('combat-log');
    if (!el) return;
    state.logs.unshift(text);
    state.logs = state.logs.slice(0, 14);
    el.innerHTML = state.logs.map(function (line) { return '<div class="combat-entry">' + line + '</div>'; }).join('');
  }

  function updateLoot() {
    var lootEl = byId('loot-list');
    if (!lootEl) return;
    if (!state.lootRecente.length) {
      lootEl.innerHTML = '<div class="loot-item">Nenhum loot ainda.</div>';
      return;
    }
    lootEl.innerHTML = state.lootRecente.map(function (item) {
      var aff = (item.affixes || []).slice(0, 2).map(function(a){ return '+' + a.value + ' ' + a.stat; }).join(' · ');
      return '<div class="loot-item">' +
        '<strong style="color:' + (item.rarityColor || item.cor || '#fff') + '"><img class="mini-item-img" src="' + (item.asset || '') + '" alt=""> ' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
        '<small>' + escapeHtml(item.raridade) + ' · Q' + (item.rollQuality || 50) + ' · Poder ' + (item.powerScore || 0) + (aff ? ' · ' + escapeHtml(aff) : '') + '</small>' +
      '</div>';
    }).join('');
  }

  function showEquipSuggestion(suggestion) {
    if (!suggestion || !suggestion.isBetter || !suggestion.item) return;
    var old = byId('equip-suggestion-toast');
    if (old) old.remove();
    var item = suggestion.item;
    var div = document.createElement('div');
    div.id = 'equip-suggestion-toast';
    div.className = 'equip-suggestion-toast';
    div.innerHTML = '<div class="suggestion-head">⚡ Equipamento melhor encontrado</div>' +
      '<div class="suggestion-body"><img src="' + (item.asset || '') + '" alt="">' +
      '<div><strong style="color:' + (item.rarityColor || '#fff') + '">' + item.icon + ' ' + escapeHtml(item.nome) + '</strong>' +
      '<small>' + escapeHtml(item.slot) + ' · +' + suggestion.delta + ' poder · Q' + (item.rollQuality || 50) + '</small></div></div>' +
      '<div class="suggestion-actions"><button id="equip-suggestion-accept">Equipar</button><button id="equip-suggestion-close">Depois</button></div>';
    document.body.appendChild(div);
    byId('equip-suggestion-accept').onclick = function () { ensureAudio(); socket.emit('acceptEquipSuggestion', { itemId: item.id }); div.remove(); };
    byId('equip-suggestion-close').onclick = function () { div.remove(); };
    setTimeout(function(){ if (document.body.contains(div)) div.remove(); }, 12000);
  }


  function renderPets() {
    var el = byId('pet-list');
    if (!el || !state.me) return;
    var pets = state.me.pets || { equipped: [], synergy: [] };
    var equipped = pets.equipped || [];
    if (!equipped.length) {
      el.innerHTML = '<div class="pet-item">Nenhum pet equipado.</div>';
      return;
    }
    el.innerHTML = equipped.map(function (pet) {
      return '<div class="pet-item"><img src="' + (pet.asset || '') + '" alt=""><div><strong>' + pet.icon + ' ' + escapeHtml(pet.nome) + ' Nv.' + (pet.level || 1) + '</strong><small>' + escapeHtml(pet.elemento) + '</small></div><button data-pet-up="' + pet.id + '">Treinar</button></div>';
    }).join('') + ((pets.synergy || []).length ? '<div class="pet-synergy">' + pets.synergy.map(function(s){ return '✨ ' + escapeHtml(s.nome) + ' +' + Math.round((s.danoPct||0)*100) + '% dano'; }).join('<br>') + '</div>' : '');
    Array.prototype.forEach.call(el.querySelectorAll('[data-pet-up]'), function(btn){
      btn.onclick = function(){ ensureAudio(); socket.emit('upgradePet', { petId: btn.getAttribute('data-pet-up') }); };
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
  function renderAssetIcon(src, x, y, size, glow, rot) {
    var img = getItemImage(src);
    if (!img || !img.complete) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18; }
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function spawnImpactBurst(x, y, color, scale) {
    spawnParticles(x, y, color, Math.max(6, Math.floor(8 * (scale || 1))));
    state.effects.push({ type: 'impactBurst', color: color || '#fff', start: performance.now(), duration: 320, x: x, y: y, toX: x, toY: y, fromX: x, fromY: y, scale: scale || 1 });
  }

  function drawBackground() {
    var monsterId = state.monster && state.monster.templateId;
    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (monsterId === 'dragon') { g.addColorStop(0, '#1b0d1f'); g.addColorStop(0.5, '#2b1231'); g.addColorStop(1, '#09050f'); }
    else if (monsterId === 'skeleton') { g.addColorStop(0, '#0f1730'); g.addColorStop(0.5, '#0d1e24'); g.addColorStop(1, '#04070c'); }
    else { g.addColorStop(0, '#0a1442'); g.addColorStop(0.55, '#0b1f57'); g.addColorStop(1, '#030711'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < 36; i++) {
      var sx = (i * 97 + 13) % canvas.width;
      var sy = (i * 61 + 25) % (canvas.height * 0.58);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(sx, sy, 2, 2);
    }

    if (monsterId === 'dragon') {
      ctx.save();
      var rg = ctx.createRadialGradient(canvas.width * 0.72, canvas.height * 0.28, 10, canvas.width * 0.72, canvas.height * 0.28, canvas.width * 0.35);
      rg.addColorStop(0, 'rgba(255,140,80,.24)'); rg.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(7,10,26,.6)';
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.28, canvas.height * 0.88, 165, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.72, canvas.height * 0.88, monsterId === 'dragon' ? 205 : 150, monsterId === 'dragon' ? 44 : 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    for (var j = 0; j < 7; j++) {
      var px = 42 + j * (canvas.width / 8.2);
      var py = canvas.height * 0.80 + Math.sin(j) * 8;
      ctx.fillStyle = j % 2 ? 'rgba(146,102,255,.24)' : 'rgba(118,211,255,.18)';
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px + 15, py - 44); ctx.lineTo(px + 30, py); ctx.closePath();
      ctx.fill();
    }
  }

  function drawSegment(img, sw, sh, srcY0, srcY1, dx, dy, dw, dh, rot, sx, sy, alpha) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot || 0);
    ctx.scale(sx || 1, sy || 1);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var sliceY = sh * srcY0;
    var sliceH = sh * (srcY1 - srcY0);
    ctx.drawImage(img, 0, sliceY, sw, sliceH, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function drawAfterImages(img, x, y, w, h, count, xStep, yStep, alpha) {
    for (var i = count; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = (alpha || 0.12) * (i / count);
      ctx.filter = 'blur(0.6px)';
      ctx.drawImage(img, x - w / 2 - xStep * i, y - h + yStep * i, w, h);
      ctx.restore();
    }
  }

  function drawWeaponTrail(clsId, x, y, size, swing, color) {
    ctx.save();
    ctx.strokeStyle = color || '#a9d8ff';
    ctx.shadowColor = color || '#a9d8ff';
    ctx.shadowBlur = 16;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 5;
    if (clsId === 'guerreiro') {
      ctx.beginPath(); ctx.arc(x, y, size, -1.5 + swing * 0.2, 0.8 + swing * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 8, y - 6, size * 0.72, -1.3 + swing * 0.2, 0.6 + swing * 0.35); ctx.stroke();
    } else if (clsId === 'arqueiro') {
      ctx.beginPath(); ctx.moveTo(x - size * 0.9, y + 8); ctx.lineTo(x + size * 0.9, y - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + size * 0.9, y - 8); ctx.lineTo(x + size * 0.62, y - 18); ctx.lineTo(x + size * 0.62, y + 2); ctx.closePath(); ctx.fillStyle = color || '#a9d8ff'; ctx.fill();
    } else {
      for (var r = 0; r < 3; r++) {
        ctx.beginPath(); ctx.arc(x, y, size * (0.55 + r * 0.22), swing + r * 0.8, swing + r * 0.8 + Math.PI * 0.9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPlayer(now) {
    if (!state.me || !state.me.classeId) return;
    var clsId = state.me.classeId;
    var mods = state.me.visualMods || {};
    var eq = state.me.equipados || {};
    var action = now < state.anim.playerHitUntil ? 'hit' : (now < state.anim.playerAttackUntil ? 'attack' : 'idle');
    var img = getCharacterPose(clsId, action) || characterImages[clsId];
    if (!img || !img.complete) return;

    var sw = img.naturalWidth || img.width || 1;
    var sh = img.naturalHeight || img.height || 1;
    var baseX = canvas.width * 0.28;
    var baseY = canvas.height * 0.90;
    var h = Math.min(356, Math.max(232, canvas.height * 0.76));
    var w = h * (sw / sh);
    var attackProg = action === 'attack' ? 1 - Math.max(0, (state.anim.playerAttackUntil - now) / 620) : 0;
    var attackSwing = Math.sin(attackProg * Math.PI);
    var hitProg = action === 'hit' ? 1 - Math.max(0, (state.anim.playerHitUntil - now) / 440) : 0;
    var hitShake = action === 'hit' ? (Math.random() - 0.5) * 10 : 0;
    var idleBob = Math.sin(now / 170) * 4;
    var x = baseX + hitShake + (action === 'attack' ? attackSwing * 46 : 0);
    var y = baseY + idleBob - (action === 'attack' ? attackSwing * 12 : 0);
    var torsoRot = Math.sin(now / 340) * 0.03 + (action === 'attack' ? (clsId === 'arqueiro' ? -0.20 : 0.16) * attackSwing : 0) - hitProg * 0.08;
    var headRot = Math.sin(now / 290) * 0.05 + (action === 'attack' ? 0.08 * attackSwing : 0) - hitProg * 0.10;
    var legRot = Math.sin(now / 190) * 0.03 + (action === 'attack' ? -0.06 * attackSwing : 0);
    var shadowW = Math.max(76, w * 0.26);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.beginPath(); ctx.ellipse(x, y + 10, shadowW * (1 + attackSwing * 0.10), 22 + attackSwing * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (action === 'attack') drawAfterImages(img, x, y, w, h, 3, 18, 4, 0.11);
    if (mods.aura) {
      ctx.save();
      ctx.strokeStyle = mods.aura; ctx.shadowColor = mods.aura; ctx.shadowBlur = 30; ctx.lineWidth = 3; ctx.globalAlpha = .36;
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.40, w * 0.30, h * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (clsId === 'mago') {
      ctx.save();
      ctx.globalAlpha = 0.50;
      ctx.fillStyle = 'rgba(218,235,255,.72)';
      ctx.shadowColor = '#d7ebff'; ctx.shadowBlur = 22;
      var flap = Math.sin(now / 110) * 0.22 + attackSwing * 0.18;
      ctx.translate(x, y - h * 0.62);
      ctx.rotate(-0.18 + flap); ctx.beginPath(); ctx.ellipse(-w * 0.22, 0, w * 0.18, h * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(0.36 - flap * 2); ctx.beginPath(); ctx.ellipse(w * 0.22, 0, w * 0.18, h * 0.12, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (state.me.isDead) { ctx.save(); ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
    drawSegment(img, sw, sh, 0.58, 1.00, x, y - h * 0.18, w * 0.98, h * 0.42, legRot, 1, 1 + Math.sin(now / 150) * 0.02, state.me.isDead ? 0.55 : 1);
    drawSegment(img, sw, sh, 0.20, 0.68, x + (action === 'attack' ? 10 * attackSwing : 0), y - h * 0.50, w, h * 0.48, torsoRot, 1 + attackSwing * 0.02, 1, state.me.isDead ? 0.55 : 1);
    drawSegment(img, sw, sh, 0.00, 0.24, x + (action === 'hit' ? -4 : 0), y - h * 0.86, w * 0.88, h * 0.24, headRot, 1, 1, state.me.isDead ? 0.55 : 1);
    if (state.me.isDead) ctx.restore();

    var weap = eq.arma, ring = eq.anel, neck = eq.colar, orn = eq.ornamento;
    var wxBase = x + w * (clsId === 'arqueiro' ? 0.10 : 0.18) + (action === 'attack' ? 14 * attackSwing : 0);
    var wyBase = y - h * 0.48;
    if (weap) {
      var wr = clsId === 'guerreiro' ? (0.10 + attackSwing * 1.10) : clsId === 'arqueiro' ? (-0.55 + attackSwing * 0.18) : (0.04 + attackSwing * 0.20);
      var ws = clsId === 'arqueiro' ? 62 : 56;
      renderAssetIcon(weap.asset, wxBase, wyBase, ws, weap.rarityColor, wr);
      if (action === 'attack') drawWeaponTrail(clsId, wxBase + 10, wyBase - 6, clsId === 'mago' ? 40 : 56, wr, weap.rarityColor || mods.weaponGlow || '#a9d8ff');
    } else if (action === 'attack') {
      drawWeaponTrail(clsId, wxBase + 10, wyBase - 6, clsId === 'mago' ? 40 : 56, attackSwing, mods.weaponGlow || '#a9d8ff');
    }
    if (ring) {
      var orbit = now / 280;
      renderAssetIcon(ring.asset, x - w * 0.18 + Math.cos(orbit) * 12, y - h * 0.48 + Math.sin(orbit) * 7, 26, ring.rarityColor, orbit);
    }
    if (neck) renderAssetIcon(neck.asset, x, y - h * 0.58, 30, neck.rarityColor, 0);
    if (orn && !mods.wing && clsId !== 'mago') renderAssetIcon(orn.asset, x + w * 0.10, y - h * 0.72, 40, orn.rarityColor, Math.sin(now / 420) * 0.15);

    if (action === 'attack') spawnParticles(x + w * 0.14, y - h * 0.40, mods.weaponGlow || '#9fd1ff', 2);
    if (action === 'hit') spawnParticles(x, y - h * 0.38, '#ff8686', 2);
    drawNameplate(state.me.nome + ' [Nv. ' + state.me.nivel + ']', x, Math.max(22, y - h - 10), state.me.isDead ? '#ffb3b3' : '#ffe69b', 'rgba(255,230,155,.4)');
  }

  function drawMonster(now) {
    if (!state.monster) return;
    var id = state.monster.templateId;
    var action = now < state.anim.monsterHitUntil ? 'hit' : (now < state.anim.monsterAttackUntil ? 'attack' : 'idle');
    var img = getAnimatedImage('monster', id, action, now) || monsterImages[id];
    if (!img || !img.complete) return;
    var sw = img.naturalWidth || img.width || 1;
    var sh = img.naturalHeight || img.height || 1;
    var x = canvas.width * 0.72;
    var y = canvas.height * 0.90 + Math.sin(now / 230) * 2;
    var attackPulse = action === 'attack' ? Math.sin((1 - Math.max(0, (state.anim.monsterAttackUntil - now) / 460)) * Math.PI) : 0;
    var hitProg = action === 'hit' ? 1 - Math.max(0, (state.anim.monsterHitUntil - now) / 420) : 0;
    if (action === 'attack') x -= 34 * attackPulse;
    if (action === 'hit') x += (Math.random() - 0.5) * 12;
    var isDragon = id === 'dragon';
    var h = isDragon ? Math.min(312, canvas.height * 0.68) : Math.min(232, canvas.height * 0.54);
    var w = h * (sw / sh);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.50)';
    ctx.beginPath(); ctx.ellipse(x, y + 8, (isDragon ? 112 : 86) * (1 + attackPulse * 0.08), isDragon ? 28 : 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (id === 'slime') {
      var sx = 1 + Math.sin(now / 180) * 0.04 + attackPulse * 0.10 - hitProg * 0.06;
      var sy = 1 - Math.sin(now / 180) * 0.04 - attackPulse * 0.08 + hitProg * 0.05;
      if (action === 'attack') drawAfterImages(img, x, y, w, h, 2, -14, 3, 0.10);
      ctx.save();
      ctx.translate(x, y - h / 2); ctx.scale(sx, sy); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    } else if (id === 'skeleton') {
      if (action === 'attack') drawAfterImages(img, x, y, w, h, 2, -16, 3, 0.09);
      drawSegment(img, sw, sh, 0.66, 1.00, x, y - h * 0.16, w * 0.98, h * 0.34, Math.sin(now / 190) * 0.02, 1, 1, 1);
      drawSegment(img, sw, sh, 0.24, 0.72, x - attackPulse * 10, y - h * 0.50, w, h * 0.48, -attackPulse * 0.18 + Math.sin(now / 300) * 0.02, 1, 1, 1);
      drawSegment(img, sw, sh, 0.00, 0.28, x - attackPulse * 8, y - h * 0.82, w * 0.82, h * 0.28, attackPulse * 0.10, 1, 1, 1);
      if (action === 'attack') { ctx.save(); ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 5; ctx.shadowColor = '#d8f0ff'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x - 12, y - h * 0.50, w * 0.18, -1.3, 0.45); ctx.stroke(); ctx.restore(); }
    } else {
      if (action === 'attack') drawAfterImages(img, x, y, w, h, 2, -18, 4, 0.08);
      drawSegment(img, sw, sh, 0.46, 1.00, x, y - h * 0.18, w, h * 0.54, Math.sin(now / 240) * 0.03, 1 + attackPulse * 0.02, 1, 1);
      drawSegment(img, sw, sh, 0.00, 0.50, x - attackPulse * 10, y - h * 0.72, w, h * 0.50, -attackPulse * 0.12 + Math.sin(now / 340) * 0.02, 1, 1, 1);
      ctx.save();
      var rg = ctx.createRadialGradient(x, y - h * 0.46, 10, x, y - h * 0.46, w * 0.62);
      rg.addColorStop(0, 'rgba(255,158,72,.20)'); rg.addColorStop(1, 'rgba(255,158,72,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - w, y - h - 60, w * 2, h * 1.4); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(255,176,96,.75)'; ctx.shadowColor = 'rgba(255,176,96,.75)'; ctx.shadowBlur = 18; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + w * 0.12, y - h * 0.56); ctx.lineTo(x + w * 0.32 + Math.sin(now / 180) * 10, y - h * 0.64); ctx.stroke(); ctx.restore();
    }

    if (state.monster.special && state.monster.special.active) {
      ctx.save(); ctx.strokeStyle = 'rgba(180,140,255,.85)'; ctx.lineWidth = 6; ctx.shadowColor = 'rgba(180,140,255,.65)'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.ellipse(x, y - h * 0.54, w * 0.30, h * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (action === 'hit') spawnParticles(x, y - h * 0.42, '#ff9090', 3);
    drawNameplate(state.monster.nome + ' [Nv. ' + state.monster.nivel + ']', x, Math.max(22, y - h - 8), '#eaf0ff', 'rgba(255,255,255,.16)');
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
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * 0.35); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 4; ctx.shadowColor = c; ctx.shadowBlur = 20;
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
      else if (e.type === 'impactBurst') {
        var rays = 9;
        for (var r = 0; r < rays; r++) { var ang2 = (Math.PI * 2 / rays) * r + p * 0.8; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(ang2) * (22 + p * 32) * (e.scale || 1), e.y + Math.sin(ang2) * (22 + p * 32) * (e.scale || 1)); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(e.x, e.y, (12 + p * 18) * (e.scale || 1), 0, Math.PI * 2); ctx.stroke();
      }
      else { ctx.beginPath(); ctx.arc(e.toX, e.toY, 20 + p * 100, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
  }
  function drawParticles() { state.particles = state.particles.filter(function (p) { return p.life > 0; }); state.particles.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.04; ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); }
  function drawFloating() { state.floating = state.floating.filter(function (f) { return f.life > 0; }); state.floating.forEach(function (f) { f.y += f.vy; f.life -= 0.02; ctx.save(); ctx.globalAlpha = f.life; ctx.font = f.isCrit ? '900 30px Inter' : '900 20px Inter'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.fillStyle = f.color; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.restore(); }); }
  function render() { resizeCanvas(); var now = performance.now(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); if (now < state.anim.shakeUntil) { var amp = Math.max(1, (state.anim.shakeUntil - now) / 28); ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp); } drawBackground(); drawPlayer(now); drawMonster(now); drawEffects(); drawParticles(); drawFloating(); ctx.restore(); requestAnimationFrame(render); }



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
    var collection = state.me.mountCollection || [mount];
    var bonus = state.me.mountBonus || {};
    var nextCost = 150 * (mount.level || 1);
    var rows = collection.map(function(m){
      var b = m.bonusCalculated || {};
      return '<div class="mount-card-row ' + (m.active ? 'active' : '') + '"><img src="' + m.asset + '" alt=""><div><strong>' + escapeHtml(m.nome) + ' Nv. ' + (m.level || 1) + '</strong><small>Acumulado: +' + formatNumber(b.power||0) + ' poder · +' + (b.ataque||0) + ' ATK · +' + (b.defesa||0) + ' DEF · +' + (b.hp||0) + ' HP</small></div><button data-activate-mount="' + m.id + '">' + (m.active ? 'Ativa' : 'Ativar') + '</button></div>';
    }).join('');
    mountCard.innerHTML = '<div class="mount-summary"><div class="mount-preview"><img src="' + mount.asset + '" alt="' + escapeHtml(mount.nome) + '"></div><div><h3>' + escapeHtml(mount.nome) + ' <span>Nv. ' + (mount.level || 1) + '</span></h3><p>Montarias não aparecem mais na batalha. Cada montaria obtida soma atributos permanentes ao personagem, e a ativa define qual você treina.</p></div></div>' +
      '<div class="detail-stats"><div>PODER<br><strong>+' + formatNumber(bonus.power || 0) + '</strong></div><div>ATQ<br><strong>+' + (bonus.ataque || 0) + '</strong></div><div>DEF<br><strong>+' + (bonus.defesa || 0) + '</strong></div><div>HP<br><strong>+' + (bonus.hp || 0) + '</strong></div><div>VEL<br><strong>+' + Math.floor((bonus.speed || 0) * 100) + '</strong></div><div>EVASÃO<br><strong>+' + (bonus.evasao || 0) + '</strong></div></div>' +
      '<button id="upgrade-mount-btn">Treinar montaria ativa — ' + nextCost + ' ouro</button>' +
      '<div class="mount-collection-list modal-list">' + rows + '</div>';
    var btn = byId('upgrade-mount-btn');
    if (btn) btn.onclick = function () { ensureAudio(); socket.emit('upgradeMount'); };
    Array.prototype.forEach.call(mountCard.querySelectorAll('[data-activate-mount]'), function (button) {
      button.onclick = function () { ensureAudio(); socket.emit('activateMount', { mountId: button.getAttribute('data-activate-mount') }); };
    });
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
    if (dailyInfo && state.me) {
      var daily = state.me.daily || {};
      var today = new Date().toISOString().slice(0,10);
      var claimed = daily.lastClaimDay === today;
      dailyInfo.innerHTML = claimed ? '✅ Diária coletada hoje · Sequência: ' + (daily.streak || 0) + ' dia(s)' : '🎁 Disponível hoje · Sequência atual: ' + (daily.streak || 0) + ' dia(s)';
      if (claimDailyBtn) claimDailyBtn.disabled = claimed;
    }
  }

  function openShop() {
    if (!state.me || !state.me.isAuthenticated) { setAuthError('Faça login para abrir a loja.'); if (authModal) authModal.classList.remove('hidden'); return; }
    shopModal.classList.remove('hidden');
    renderShop();
  }

  function closeShop() {
    shopModal.classList.add('hidden');
  }


  function openTalents() { if (talentModal) { talentModal.classList.remove('hidden'); renderTalents(); } }
  function closeTalents() { if (talentModal) talentModal.classList.add('hidden'); }
  function renderTalents() {
    if (!talentList || !state.me) return;
    var data = state.me.talents || {};
    var defs = (data && data.defs) || {};
    var bonuses = (data && data.bonuses) || {};
    if (talentSummary) {
      talentSummary.innerHTML = '<div><strong>Pontos disponíveis</strong><span>' + (data.available || 0) + '</span></div>' +
        '<div><strong>Pontos gastos</strong><span>' + (data.spent || 0) + '</span></div>' +
        '<div><strong>Poder de talentos</strong><span>+' + formatNumber(bonuses.power || 0) + '</span></div>' +
        '<button id="reset-talents-btn">Resetar talentos</button>';
      var rb = byId('reset-talents-btn');
      if (rb) rb.onclick = function(){ ensureAudio(); socket.emit('resetTalents'); };
    }
    var ids = Object.keys(defs);
    if (!ids.length) { talentList.innerHTML = '<div class="talent-card">Talentos indisponíveis.</div>'; return; }
    talentList.innerHTML = ids.map(function(id){
      var t = defs[id];
      var pct = t.max ? Math.floor(((t.level || 0) / t.max) * 100) : 0;
      var maxed = (t.level || 0) >= t.max;
      return '<div class="talent-card ' + (maxed ? 'maxed' : '') + '">' +
        '<div class="talent-icon">' + (t.icon || '🌟') + '</div>' +
        '<div class="talent-info"><strong>' + escapeHtml(t.nome) + ' <span>Nv. ' + (t.level || 0) + '/' + t.max + '</span></strong>' +
        '<small>' + escapeHtml(t.desc || '') + '</small><div class="talent-bar"><i style="width:' + pct + '%"></i></div></div>' +
        '<button data-talent="' + id + '"' + (maxed ? ' disabled' : '') + '>' + (maxed ? 'Máx.' : ('+ Custo ' + (t.nextCost || 1))) + '</button>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(talentList.querySelectorAll('[data-talent]'), function(btn){
      btn.onclick = function(){ ensureAudio(); socket.emit('upgradeTalent', { id: btn.getAttribute('data-talent') }); };
    });
  }

  function openExpedition() { if (expeditionModal) { expeditionModal.classList.remove('hidden'); renderExpedition(); } }
  function closeExpedition() { if (expeditionModal) expeditionModal.classList.add('hidden'); }
  function formatTimeMs(ms) {
    ms = Math.max(0, Math.floor(ms || 0));
    var s = Math.floor(ms / 1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h) return h + 'h ' + String(m).padStart(2,'0') + 'm';
    return m + 'm ' + String(sec).padStart(2,'0') + 's';
  }
  function renderExpedition() {
    if (!expeditionList || !state.me) return;
    var data = state.me.expedition || {};
    var defs = data.defs || {};
    var active = data.active || null;
    if (expeditionStatus) {
      if (active) {
        var def = defs[active.id] || { nome: active.id };
        expeditionStatus.innerHTML = '<strong>Em andamento:</strong> ' + escapeHtml(def.nome || active.id) +
          '<br><span>' + (active.ready ? 'Pronta para coletar!' : ('Tempo restante: ' + formatTimeMs(active.remainingMs))) + '</span>' +
          '<button id="claim-expedition-btn"' + (!active.ready ? ' disabled' : '') + '>Coletar recompensa</button>';
        var cb = byId('claim-expedition-btn');
        if (cb) cb.onclick = function(){ ensureAudio(); socket.emit('claimExpedition'); };
      } else {
        expeditionStatus.innerHTML = '<strong>Nenhuma expedição ativa.</strong><br><span>Escolha uma missão abaixo para gerar recursos paralelos.</span>';
      }
    }
    var ids = Object.keys(defs);
    expeditionList.innerHTML = ids.map(function(id){
      var e = defs[id];
      var blocked = active || ((state.me.power || 0) < (e.powerReq || 0));
      return '<div class="expedition-card ' + (blocked ? 'blocked' : '') + '">' +
        '<div class="expedition-icon">' + (e.icon || '🧭') + '</div><div><strong>' + escapeHtml(e.nome) + '</strong>' +
        '<small>' + escapeHtml(e.desc || '') + '</small><small>Duração: ' + e.minutes + 'min · Poder necessário: ' + formatNumber(e.powerReq || 0) + '</small></div>' +
        '<button data-expedition="' + id + '"' + (blocked ? ' disabled' : '') + '>' + (active ? 'Ocupado' : 'Iniciar') + '</button></div>';
    }).join('');
    Array.prototype.forEach.call(expeditionList.querySelectorAll('[data-expedition]'), function(btn){
      btn.onclick = function(){ ensureAudio(); socket.emit('startExpedition', { id: btn.getAttribute('data-expedition') }); };
    });
  }


  function openMissions() { if (missionsModal) { missionsModal.classList.remove('hidden'); renderMissions(); } }
  function closeMissions() { if (missionsModal) missionsModal.classList.add('hidden'); }
  function renderMissions() {
    if (!missionsList || !state.me) return;
    var meta = state.me.meta || {};
    var data = (meta.missions && meta.missions.defs) || {};
    var ready = Object.keys(data).filter(function(id){ return data[id].ready; }).length;
    if (missionsSummary) missionsSummary.innerHTML = '<strong>Missões de hoje</strong><span>' + (meta.missions && meta.missions.date || '-') + '</span><p>' + ready + ' missão(ões) pronta(s) para coletar.</p><button id="claim-all-missions-btn">Coletar prontas</button>';
    var allBtn = byId('claim-all-missions-btn');
    if (allBtn) allBtn.onclick = function(){ ensureAudio(); socket.emit('claimAllMissions'); };
    missionsList.innerHTML = Object.keys(data).map(function(id){
      var m = data[id]; var pct = m.target ? Math.floor((Math.min(m.progress || 0, m.target) / m.target) * 100) : 0;
      return '<div class="meta-card ' + (m.ready ? 'ready' : '') + '"><div class="meta-icon">' + (m.icon || '📜') + '</div><div><strong>' + escapeHtml(m.nome) + '</strong><small>' + escapeHtml(m.desc || '') + '</small><div class="talent-bar"><i style="width:' + pct + '%"></i></div><small>' + (m.progress || 0) + ' / ' + m.target + ' · +' + ((m.rewards && m.rewards.ouro) || 0) + ' ouro +' + ((m.rewards && m.rewards.gemas) || 0) + ' gemas</small></div><button data-mission="' + id + '" ' + (!m.ready ? 'disabled' : '') + '>' + (m.claimed ? 'Coletado' : 'Coletar') + '</button></div>';
    }).join('') || '<div class="meta-card">Nenhuma missão disponível.</div>';
    Array.prototype.forEach.call(missionsList.querySelectorAll('[data-mission]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('claimMission', { id: btn.getAttribute('data-mission') }); }; });
  }

  function openCodex() { if (codexModal) { codexModal.classList.remove('hidden'); renderCodex(); } }
  function closeCodex() { if (codexModal) codexModal.classList.add('hidden'); }
  function renderCodex() {
    if (!codexList || !state.me) return;
    var codex = (state.me.meta && state.me.meta.codex) || {};
    var defs = codex.defs || {};
    var b = codex.bonuses || {};
    if (codexSummary) codexSummary.innerHTML = '<strong>Bônus permanentes do Codex</strong><p>ATQ +' + Math.round((b.ataquePct||0)*100) + '% · HP +' + Math.round((b.hpPct||0)*100) + '% · Ouro +' + Math.round((b.goldPct||0)*100) + '% · Drop +' + Math.round((b.dropPct||0)*100) + '% · Poder +' + formatNumber(b.power||0) + '</p>';
    codexList.innerHTML = Object.keys(defs).map(function(id){
      var c=defs[id]; var st=c.state||{}; var next=(c.steps||[])[st.claimed] || 'Máx.'; var pct=next==='Máx.'?100:Math.floor(Math.min(100, ((st.kills||0)/next)*100));
      return '<div class="meta-card ' + (st.claimable ? 'ready' : '') + '"><div class="meta-icon">' + (c.icon||'📖') + '</div><div><strong>' + escapeHtml(c.nome) + '</strong><small>Abates: ' + (st.kills||0) + ' · Marcos coletados: ' + (st.claimed||0) + '/' + ((c.steps||[]).length) + '</small><div class="talent-bar"><i style="width:' + pct + '%"></i></div><small>Próximo marco: ' + next + '</small></div><button data-codex="' + id + '" ' + (!st.claimable ? 'disabled' : '') + '>Coletar</button></div>';
    }).join('') || '<div class="meta-card">Codex indisponível.</div>';
    Array.prototype.forEach.call(codexList.querySelectorAll('[data-codex]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('claimCodex', { monsterId: btn.getAttribute('data-codex') }); }; });
  }

  function openAscension() { if (ascensionModal) { ascensionModal.classList.remove('hidden'); renderAscension(); } }
  function closeAscension() { if (ascensionModal) ascensionModal.classList.add('hidden'); }
  function renderAscension() {
    if (!artifactList || !state.me) return;
    var a = (state.me.meta && state.me.meta.ascension) || {};
    var rank = a.rank || 0;
    var dust = a.dust || 0;
    if (ascensionSummary) ascensionSummary.innerHTML = '<strong>Ascensão ' + rank + '</strong><span>Poeira Astral: ' + dust + '</span><p>Bônus de ascensão: +' + Math.round(((a.bonuses&&a.bonuses.ataquePct)||0)*100) + '% ATQ · +' + Math.round(((a.bonuses&&a.bonuses.hpPct)||0)*100) + '% HP · +' + formatNumber((a.bonuses&&a.bonuses.power)||0) + ' poder</p><button id="ascend-player-btn" ' + (!a.canAscend ? 'disabled' : '') + '>Ascender personagem</button>';
    var ab = byId('ascend-player-btn');
    if (ab) ab.onclick=function(){ ensureAudio(); socket.emit('ascendPlayer'); };
    var defs = a.artifactDefs || ARTIFACTS;
    var arts = a.artifacts || {};
    artifactList.innerHTML = Object.keys(defs).map(function(id){
      var art=defs[id]; var lvl=arts[id]||0; var max=art.max||20; var pct=Math.floor((lvl/max)*100); var cost=(art.costDust||2)+Math.floor(lvl/4);
      return '<div class="meta-card ' + (lvl>=max?'maxed':'') + '"><div class="meta-icon">' + (art.icon||'🌌') + '</div><div><strong>' + escapeHtml(art.nome) + ' <span>Nv. ' + lvl + '/' + max + '</span></strong><small>' + escapeHtml(art.desc||'') + '</small><div class="talent-bar"><i style="width:' + pct + '%"></i></div><small>Custo: ' + cost + ' poeira</small></div><button data-artifact="' + id + '" ' + (lvl>=max?'disabled':'') + '>Evoluir</button></div>';
    }).join('');
    Array.prototype.forEach.call(artifactList.querySelectorAll('[data-artifact]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('upgradeArtifact', { id: btn.getAttribute('data-artifact') }); }; });
  }

  function openGM() {
    if (!state.me || !state.me.isGM) return;
    gmModal.classList.remove('hidden');
  }

  function closeGM() {
    gmModal.classList.add('hidden');
  }




  function bonusLine(bonus) {
    if (!bonus) return '';
    return Object.keys(bonus).map(function(k){
      var v = bonus[k];
      var label = k.replace('Pct','%');
      return label + ' +' + (String(k).indexOf('Pct') >= 0 ? Math.round(v*1000)/10 + '%' : Math.round(v*10)/10);
    }).join(' · ');
  }

  function openV30() { if (!v30Modal) return; v30Modal.classList.remove('hidden'); renderV30(); }
  function closeV30() { if (v30Modal) v30Modal.classList.add('hidden'); }

  function renderV30() {
    if (!v30Content || !state.me) return;
    var e = state.me.endgame || {};
    var tab = state.v30Tab || 'season';
    var tabs = v30Modal ? v30Modal.querySelectorAll('[data-v30-tab]') : [];
    Array.prototype.forEach.call(tabs, function(btn){ btn.classList.toggle('active', btn.getAttribute('data-v30-tab') === tab); });
    if (!e.version) { v30Content.innerHTML = '<div class="v30-card">Sistemas finais carregando...</div>'; return; }
    if (tab === 'season') {
      var rewards = (e.season.rewards || []).map(function(r){
        var claimed = (e.season.claimed || []).indexOf(r.tier) >= 0;
        var ready = (e.season.xp || 0) >= r.xp;
        var rr = r.reward || {};
        return '<div class="v30-card ' + (claimed ? 'claimed' : ready ? 'ready' : '') + '"><h3>Tier ' + r.tier + ' <span>' + (claimed ? 'Coletado' : ready ? 'Pronto' : r.xp + ' XP') + '</span></h3><p>Ouro ' + formatNumber(rr.ouro||0) + ' · Gemas ' + formatNumber(rr.gemas||0) + (rr.item ? ' · Item ' + rr.item : '') + (rr.dust ? ' · Poeira ' + rr.dust : '') + '</p><button data-season="' + r.tier + '" ' + (!ready || claimed ? 'disabled' : '') + '>Coletar</button></div>';
      }).join('');
      v30Content.innerHTML = '<div class="v30-hero"><h3>Temporada V30</h3><p>XP de temporada: <b>' + formatNumber(e.season.xp||0) + '</b>. Ganhe XP matando monstros, bosses, torre, fendas e pesquisa.</p></div><div class="v30-grid">' + rewards + '</div>';
      Array.prototype.forEach.call(v30Content.querySelectorAll('[data-season]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v30ClaimSeason', { tier:Number(btn.getAttribute('data-season')) }); }; });
    } else if (tab === 'research') {
      v30Content.innerHTML = '<div class="v30-hero"><h3>Laboratório Arcano</h3><p>Bônus ativos: ' + bonusLine(e.bonuses) + '</p></div><div class="v30-grid">' + (e.research.defs||[]).map(function(d){ var lv=(e.research.levels&&e.research.levels[d.id])||0; var c=d.nextCost||{}; return '<div class="v30-card"><h3>' + d.icon + ' ' + d.nome + ' <span>' + lv + '/' + d.max + '</span></h3><p>' + d.desc + '</p><small>' + bonusLine(d.bonusPerLevel) + '</small><button data-research="' + d.id + '" ' + (lv>=d.max?'disabled':'') + '>Pesquisar: ' + formatNumber(c.ouro||0) + ' ouro ' + (c.gemas ? '+ ' + c.gemas + ' 💎' : '') + '</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v30Content.querySelectorAll('[data-research]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v30UpgradeResearch', { id:btn.getAttribute('data-research') }); }; });
    } else if (tab === 'tower') {
      v30Content.innerHTML = '<div class="v30-grid v30-grid-two"><div class="v30-card ready"><h3>🗼 Torre Celeste</h3><p>Andar atual: <b>' + (e.tower.floor||1) + '</b><br>Melhor andar: <b>' + (e.tower.best||0) + '</b><br>Requer poder: <b>' + formatNumber(e.tower.requiredPower||0) + '</b></p><button id="v30-tower-btn">Desafiar Torre</button></div><div class="v30-card ready"><h3>🌀 Fenda Dimensional</h3><p>Cargas: <b>' + (e.rift.charges||0) + '/5</b><br>Recompensas: ouro, gemas e item aleatório de alto valor.</p><button id="v30-rift-btn" ' + ((e.rift.charges||0)<=0?'disabled':'') + '>Abrir Fenda</button></div></div>';
      var tb=byId('v30-tower-btn'); if(tb) tb.onclick=function(){ ensureAudio(); socket.emit('v30ChallengeTower'); };
      var rb=byId('v30-rift-btn'); if(rb) rb.onclick=function(){ ensureAudio(); socket.emit('v30RunRift'); };
    } else if (tab === 'titles') {
      var unlocked = e.titles.unlocked || [];
      v30Content.innerHTML = '<div class="v30-hero"><h3>Títulos de Prestígio</h3><p>Título equipado: <b>' + (e.titles.equipped || '-') + '</b></p></div><div class="v30-grid">' + (e.titles.all||[]).map(function(t){ var has=unlocked.indexOf(t.id)>=0; return '<div class="v30-card ' + (has?'ready':'') + '"><h3>' + t.icon + ' ' + t.nome + '</h3><p>' + t.desc + '<br><small>Req: ' + t.req + '</small></p><small>' + bonusLine(t.bonus) + '</small><button data-title="' + t.id + '" ' + (!has?'disabled':'') + '>' + (e.titles.equipped===t.id?'Equipado':'Equipar') + '</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v30Content.querySelectorAll('[data-title]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v30EquipTitle', { id:btn.getAttribute('data-title') }); }; });
    } else if (tab === 'mail') {
      v30Content.innerHTML = '<div class="v30-hero"><h3>Correio e Códigos</h3><p>Use códigos de teste: <b>LAUNCHV30</b>, <b>INDLEVIP</b>, <b>GMEVENT</b>.</p><div class="v30-code-row"><input id="v30-code-input" placeholder="Digite o código"><button id="v30-code-btn">Resgatar</button><button id="v30-mail-all">Coletar correio</button></div></div><div class="v30-list">' + (e.mailbox||[]).map(function(m){ var r=m.reward||{}; return '<div class="v30-card ' + (m.claimed?'claimed':'ready') + '"><h3>📬 ' + escapeHtml(m.title||'Mensagem') + '<span>' + (m.claimed?'Coletado':'Novo') + '</span></h3><p>' + escapeHtml(m.body||'') + '</p><small>Ouro ' + formatNumber(r.ouro||0) + ' · Gemas ' + formatNumber(r.gemas||0) + (r.dust?' · Poeira '+r.dust:'') + '</small><button data-mail="' + m.id + '" ' + (m.claimed?'disabled':'') + '>Coletar</button></div>'; }).join('') + '</div>';
      var cb=byId('v30-code-btn'); if(cb) cb.onclick=function(){ ensureAudio(); socket.emit('v30RedeemCode', { code:(byId('v30-code-input')||{}).value||'' }); };
      var all=byId('v30-mail-all'); if(all) all.onclick=function(){ ensureAudio(); socket.emit('v30ClaimMail', { all:true }); };
      Array.prototype.forEach.call(v30Content.querySelectorAll('[data-mail]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v30ClaimMail', { id:btn.getAttribute('data-mail') }); }; });
    } else if (tab === 'reroll') {
      var items = (state.me.inventario || []).slice().sort(function(a,b){ return (b.powerScore||0)-(a.powerScore||0); }).slice(0,16);
      v30Content.innerHTML = '<div class="v30-hero"><h3>Reforja Premium</h3><p>Rerolla qualidade e atributos variáveis de um item usando ouro e gemas.</p></div><div class="v30-grid">' + items.map(function(it){ return '<div class="v30-card item-card"><img src="' + (it.asset||'') + '"><h3 style="color:' + (it.rarityColor||'#fff') + '">' + escapeHtml(it.nome) + ' +' + (it.upgradeLevel||0) + '</h3><p>Poder ' + (it.powerScore||0) + ' · Q' + (it.rollQuality||0) + '%</p><button data-reroll="' + it.id + '">Reforjar</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v30Content.querySelectorAll('[data-reroll]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v30RerollItem', { itemId:btn.getAttribute('data-reroll') }); }; });
    }
  }



  function openV40() { if (!v40Modal) return; v40Modal.classList.remove('hidden'); renderV40(); }
  function closeV40() { if (v40Modal) v40Modal.classList.add('hidden'); }

  function renderV40() {
    if (!v40Content || !state.me) return;
    var v = state.me.v40 || {};
    var tab = state.v40Tab || 'hub';
    var tabs = v40Modal ? v40Modal.querySelectorAll('[data-v40-tab]') : [];
    Array.prototype.forEach.call(tabs, function(btn){ btn.classList.toggle('active', btn.getAttribute('data-v40-tab') === tab); });
    if (!v.version) { v40Content.innerHTML = '<div class="v30-card">Carregando V40...</div>'; return; }
    function costText(c){ return 'Essência ' + formatNumber(c.essence||0) + (c.ouro ? ' · Ouro ' + formatNumber(c.ouro) : '') + (c.gemas ? ' · 💎 ' + c.gemas : ''); }
    if (tab === 'hub') {
      v40Content.innerHTML = '<div class="v30-hero"><h3>🌠 Central V40</h3><p>Essência: <b>' + formatNumber(v.essence||0) + '</b> · Honra: <b>' + formatNumber(v.honor||0) + '</b> · Poder V40: <b>' + formatNumber(v.powerBonus||0) + '</b></p><p>Bônus ativos: ' + bonusLine(v.bonuses) + '</p></div><div class="v30-grid">' + (v.milestones||[]).map(function(m){ var r=m.reward||{}; return '<div class="v30-card ' + (m.claimed?'claimed':m.ready?'ready':'') + '"><h3>🏁 ' + escapeHtml(m.nome) + '<span>' + (m.claimed?'Coletado':m.ready?'Pronto':'Bloqueado') + '</span></h3><p>Recompensa: Ouro ' + formatNumber(r.ouro||0) + ' · Gemas ' + formatNumber(r.gemas||0) + ' · Essência ' + formatNumber(r.essence||0) + (r.cosmetic?' · Visual '+r.cosmetic:'') + '</p><button data-v40-milestone="' + m.id + '" ' + (!m.ready || m.claimed ? 'disabled' : '') + '>Coletar marco</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v40Content.querySelectorAll('[data-v40-milestone]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v40ClaimMilestone', { id:btn.getAttribute('data-v40-milestone') }); }; });
    } else if (tab === 'raid') {
      var hp = v.raid.bossHp || 1; var dmg = v.raid.damage || 0; var pct = Math.min(100, Math.floor((dmg/hp)*100));
      v40Content.innerHTML = '<div class="v30-hero"><h3>🐲 Raid Mundial — Soberano Elemental</h3><p>Energia: <b>' + (v.raid.energy||0) + '/5</b> · Nível do boss: <b>' + (v.raid.level||1) + '</b> · Melhor dano: <b>' + formatNumber(v.raid.bestDamage||0) + '</b></p><div class="talent-bar"><i style="width:' + pct + '%"></i></div><p>Dano acumulado: ' + formatNumber(dmg) + ' / ' + formatNumber(hp) + '</p><button id="v40-raid-btn" ' + ((v.raid.energy||0)<=0?'disabled':'') + '>Atacar Raid</button></div>';
      var rb=byId('v40-raid-btn'); if(rb) rb.onclick=function(){ ensureAudio(); socket.emit('v40AttackRaid'); };
    } else if (tab === 'guild') {
      var g=v.guild||{}; var c=g.nextCost||{};
      v40Content.innerHTML = '<div class="v30-hero"><h3>🏰 ' + escapeHtml(g.name||'Ordem Indle') + '</h3><p>Nível da Ordem: <b>' + (g.level||1) + '</b> · Contribuição: <b>' + (g.contribution||0) + '</b></p><p>A Ordem é seu sistema de guilda solo inicial: cada contribuição sobe a estrutura e soma bônus permanentes.</p><button id="v40-guild-btn">Contribuir: ' + formatNumber(c.ouro||0) + ' ouro ' + (c.gemas?'+ '+c.gemas+' 💎':'') + '</button></div>';
      var gb=byId('v40-guild-btn'); if(gb) gb.onclick=function(){ ensureAudio(); socket.emit('v40ContributeGuild'); };
    } else if (tab === 'runes') {
      v40Content.innerHTML = '<div class="v30-hero"><h3>🔮 Runas Eternas</h3><p>Use essência obtida em combate, raid e contratos para evoluir runas permanentes.</p></div><div class="v30-grid">' + ((v.runes&&v.runes.defs)||[]).map(function(d){ var lv=(v.runes.levels&&v.runes.levels[d.id])||0; var c=d.nextCost||{}; return '<div class="v30-card"><h3>' + d.icon + ' ' + d.nome + '<span>' + lv + '/' + d.max + '</span></h3><p>' + d.desc + '</p><small>' + bonusLine(d.bonusPerLevel) + '</small><button data-v40-rune="' + d.id + '" ' + (lv>=d.max?'disabled':'') + '>Evoluir: ' + costText(c) + '</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v40Content.querySelectorAll('[data-v40-rune]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v40UpgradeRune', { id:btn.getAttribute('data-v40-rune') }); }; });
    } else if (tab === 'arena') {
      var a=v.arena||{};
      v40Content.innerHTML = '<div class="v30-hero"><h3>⚔️ Arena Espelho</h3><p>Rating: <b>' + (a.rating||1000) + '</b> · Vitórias: <b>' + (a.wins||0) + '</b> · Derrotas: <b>' + (a.losses||0) + '</b> · Tickets: <b>' + (a.tickets||0) + '/5</b></p><p>Dispute contra um espelho de poder variável e ganhe honra, essência e gemas.</p><button id="v40-arena-btn" ' + ((a.tickets||0)<=0?'disabled':'') + '>Lutar na Arena</button></div>';
      var ab=byId('v40-arena-btn'); if(ab) ab.onclick=function(){ ensureAudio(); socket.emit('v40RunArena'); };
    } else if (tab === 'contracts') {
      v40Content.innerHTML = '<div class="v30-hero"><h3>📜 Contratos de Caça V40</h3><p>Contratos renovam diariamente e recompensam o farm de monstros específicos.</p></div><div class="v30-grid">' + ((v.contracts&&v.contracts.defs)||[]).map(function(c){ var p=(v.contracts.progress&&v.contracts.progress[c.id])||0; var claimed=(v.contracts.claimed||[]).indexOf(c.id)>=0; var ready=p>=c.need; var r=c.reward||{}; return '<div class="v30-card ' + (claimed?'claimed':ready?'ready':'') + '"><h3>' + c.icon + ' ' + c.nome + '<span>' + Math.min(p,c.need) + '/' + c.need + '</span></h3><p>Ouro ' + formatNumber(r.ouro||0) + ' · Gemas ' + formatNumber(r.gemas||0) + ' · Essência ' + formatNumber(r.essence||0) + ' · Honra ' + formatNumber(r.honor||0) + '</p><button data-v40-contract="' + c.id + '" ' + (!ready || claimed ? 'disabled' : '') + '>Coletar</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v40Content.querySelectorAll('[data-v40-contract]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v40ClaimContract', { id:btn.getAttribute('data-v40-contract') }); }; });
    } else if (tab === 'alchemy') {
      v40Content.innerHTML = '<div class="v30-hero"><h3>⚗️ Alquimia</h3><p>Buffs ativos: ' + ((v.buffs||[]).map(function(b){return (b.icon||'🧪')+' '+escapeHtml(b.nome||b.id);}).join(' · ') || 'nenhum') + '</p></div><div class="v30-grid">' + (v.alchemy||[]).map(function(a){ return '<div class="v30-card"><h3>' + a.icon + ' ' + a.nome + '</h3><p>' + a.desc + '</p><small>Custo: ' + costText(a.cost||{}) + '</small><button data-v40-alchemy="' + a.id + '">Criar e usar</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v40Content.querySelectorAll('[data-v40-alchemy]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v40CraftAlchemy', { id:btn.getAttribute('data-v40-alchemy') }); }; });
    } else if (tab === 'cosmetics') {
      var un=(v.cosmetics&&v.cosmetics.unlocked)||[];
      v40Content.innerHTML = '<div class="v30-hero"><h3>🎨 Visual e Auras</h3><p>Visual equipado: <b>' + ((v.cosmetics&&v.cosmetics.equipped)||'classic') + '</b>. Cosméticos dão pequenos bônus e mudam o estilo visual.</p></div><div class="v30-grid">' + ((v.cosmetics&&v.cosmetics.all)||[]).map(function(c){ var has=un.indexOf(c.id)>=0; return '<div class="v30-card ' + (has?'ready':'') + '"><h3>' + c.icon + ' ' + c.nome + '</h3><p>' + c.desc + '</p><small>' + bonusLine(c.bonus) + '</small><button data-v40-cosmetic="' + c.id + '" ' + (!has?'disabled':'') + '>' + ((v.cosmetics&&v.cosmetics.equipped)===c.id?'Equipado':'Equipar') + '</button></div>'; }).join('') + '</div>';
      Array.prototype.forEach.call(v40Content.querySelectorAll('[data-v40-cosmetic]'), function(btn){ btn.onclick=function(){ ensureAudio(); socket.emit('v40EquipCosmetic', { id:btn.getAttribute('data-v40-cosmetic') }); }; });
    }
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


  if (menuTalent) menuTalent.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuTalent.classList.add('active'); openTalents(); };
  if (talentClose) talentClose.onclick = closeTalents;
  if (talentModal) talentModal.addEventListener('click', function (e) { if (e.target === talentModal) closeTalents(); });
  if (menuExpedition) menuExpedition.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuExpedition.classList.add('active'); openExpedition(); };
  if (expeditionClose) expeditionClose.onclick = closeExpedition;
  if (expeditionModal) expeditionModal.addEventListener('click', function (e) { if (e.target === expeditionModal) closeExpedition(); });
  if (menuMissions) menuMissions.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuMissions.classList.add('active'); openMissions(); };
  if (missionsClose) missionsClose.onclick = closeMissions;
  if (missionsModal) missionsModal.addEventListener('click', function (e) { if (e.target === missionsModal) closeMissions(); });
  if (menuCodex) menuCodex.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuCodex.classList.add('active'); openCodex(); };
  if (codexClose) codexClose.onclick = closeCodex;
  if (codexModal) codexModal.addEventListener('click', function (e) { if (e.target === codexModal) closeCodex(); });
  if (menuAscension) menuAscension.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuAscension.classList.add('active'); openAscension(); };
  if (ascensionClose) ascensionClose.onclick = closeAscension;
  if (menuV30) menuV30.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuV30.classList.add('active'); openV30(); };
  if (menuV40) menuV40.onclick = function () { ensureAudio(); Array.prototype.forEach.call(byId('bottom-menu').querySelectorAll('button'), function (b) { b.classList.remove('active'); }); menuV40.classList.add('active'); openV40(); };
  if (v30Close) v30Close.onclick = closeV30;
  if (v40Close) v40Close.onclick = closeV40;
  if (v40Modal) Array.prototype.forEach.call(v40Modal.querySelectorAll('[data-v40-tab]'), function(btn){ btn.onclick=function(){ state.v40Tab=btn.getAttribute('data-v40-tab'); renderV40(); }; });
  if (v30Modal) Array.prototype.forEach.call(v30Modal.querySelectorAll('[data-v30-tab]'), function(btn){ btn.onclick=function(){ state.v30Tab=btn.getAttribute('data-v30-tab'); renderV30(); }; });
  if (ascensionModal) ascensionModal.addEventListener('click', function (e) { if (e.target === ascensionModal) closeAscension(); });

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

  if (claimDailyBtn) claimDailyBtn.onclick = function () { ensureAudio(); socket.emit('claimDailyReward'); };

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
    renderV30();
  });
  socket.on('gameState', function (list) { (list || []).forEach(function (p) { state.players[p.id] = p; if (p.id === state.meId) state.me = p; }); updateHUD(); renderV30(); });
  socket.on('enemyUpdate', function (monster) { state.monster = monster; updateEnemyHUD(); });
  socket.on('combatTick', function (data) { if (data.monster) { state.monster = data.monster; updateEnemyHUD(); }
    (data.attacks || []).forEach(function (attack) { var color = attack.isCrit ? '#ffe69b' : '#ff9090'; state.anim.playerAttackUntil = performance.now() + (attack.type === 'ability' ? 520 : 280); state.anim.monsterHitUntil = performance.now() + 360; state.anim.shakeUntil = performance.now() + 120; var fxX = canvas.width * 0.72 + (Math.random() - 0.5) * 90; var fxY = canvas.height * 0.38 + (Math.random() - 0.5) * 60; pushFloating((attack.isCrit ? 'CRIT ' : '-') + attack.damage, color, fxX, fxY, attack.isCrit); spawnImpactBurst(fxX, fxY, color, attack.isCrit ? 1.35 : 1); playSound(attack.type === 'ability' ? 'skill' : 'hit'); if (attack.result && attack.result.specialTriggered) { if (attack.result.specialTriggered.type === 'bossShield') { addLog('🛡️ O Dragão Elemental ativou o Escudo Elemental! Use habilidades para quebrar.'); pushFloating('ESCUDO!', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('boss'); } else if (attack.result.specialTriggered.type === 'shieldBroken') { addLog('💥 O Escudo Elemental foi quebrado!'); pushFloating('QUEBRADO!', '#ffffff', canvas.width * 0.72, canvas.height * 0.28, true); playSound('loot'); } } if (attack.result && attack.result.resisted) pushFloating('RESIST', '#cdb7ff', canvas.width * 0.72, canvas.height * 0.45, false); });
    (data.monsterAttacks || []).forEach(function (ma) { state.anim.monsterAttackUntil = performance.now() + 360; if (ma.playerId === state.meId) { state.anim.playerHitUntil = performance.now() + 420; state.anim.shakeUntil = performance.now() + 160; var hx = canvas.width * 0.28; var hy = canvas.height * 0.42; pushFloating('-' + ma.damage + ' HP', '#ffb0b0', hx, hy, ma.died); spawnImpactBurst(hx, hy, '#ff9b9b', ma.died ? 1.4 : 1); playSound(ma.died ? 'death' : 'hit'); } });
  });
  socket.on('enemyDied', function (data) { addLog('⚔️ ' + data.killerName + ' derrotou ' + data.deadMonster.nome + ' e ganhou +' + data.xpReward + ' XP e +' + data.goldGained + ' ouro.'); if (data.loot) { state.lootRecente.unshift(data.loot); state.lootRecente = state.lootRecente.slice(0, 8); addLog((data.loot.exclusivoBoss ? '🐉 Loot exclusivo: ' : '🎁 Loot obtido: ') + data.loot.icon + ' ' + data.loot.nome + ' [' + data.loot.raridade + ']'); playSound(data.loot.exclusivoBoss ? 'boss' : 'loot'); } if (data.autoEquipSuggestion && data.killerId === state.meId) { showEquipSuggestion(data.autoEquipSuggestion); } if (data.progress && data.progress.leveledUp) addLog('✨ Level up! Agora você está no Nv. ' + data.progress.currentLevel + '.'); if (data.player && data.player.id === state.meId) state.me = data.player; if (data.meta && state.me) state.me.meta = data.meta; if (data.nextMonster) { state.monster = data.nextMonster; updateEnemyHUD(); } updateHUD(); });
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
      state.anim.playerAttackUntil = performance.now() + 560; state.anim.shakeUntil = performance.now() + 120;
      state.anim.monsterHitUntil = performance.now() + 420;
      startCooldownVisual(evt.habilidadeId, evt.cooldown);
    }
    spawnImpactBurst(canvas.width * 0.72, canvas.height * 0.40, color, 1.1); playSound('skill');
  });
  socket.on('inventoryAction', function (info) { if (info.type === 'equip') { addLog('🧰 Item equipado: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'unequip') { addLog('🎒 Item retornou para a bolsa: ' + info.item.icon + ' ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'sell') { addLog('🪙 Item vendido por +' + info.gold + ' ouro: ' + info.item.nome + '.'); state.selectedItemId = null; playSound('loot'); } if (info.type === 'sellAll') { addLog('🪙 ' + info.sold + ' itens vendidos por +' + info.gold + ' ouro.'); state.selectedItemId = null; playSound('loot'); } if (info.type === 'equipBest') { addLog('⚡ Melhor equipamento aplicado: ' + ((info.equippedItems || []).length) + ' item(ns).'); playSound('equip'); } if (info.type === 'gem') { addLog('💎 Gema inserida: ' + info.gem.nome + ' em ' + info.item.nome + '.'); playSound('equip'); } if (info.type === 'upgradeItem') { addLog('🔥 Forja: ' + info.item.nome + ' melhorado para +' + (info.item.upgradeLevel || 0) + '.'); playSound('equip'); } if (info.type === 'lockItem') { addLog((info.item.locked ? '🔒 Item protegido: ' : '🔓 Item desbloqueado: ') + info.item.nome + '.'); playSound('equip'); } });
  socket.on('playerDied', function (data) { if (data.playerId === state.meId) { addLog('💀 Você foi derrotado por ' + data.monsterName + '. Ressurreição automática em 5s.'); state.anim.playerHitUntil = performance.now() + 900; playSound('death'); } });
  socket.on('playerRevived', function (data) { if (data.player && data.player.id === state.meId) { state.me = data.player; addLog('✨ Você ressuscitou e voltou ao combate.'); playSound('loot'); updateHUD(); } });
  socket.on('saveLoaded', function (info) { if (info.ok && info.player) { state.me = info.player; localStorage.setItem('legend_of_indle_save_id', info.saveId); if (byId('hud-save-status')) byId('hud-save-status').textContent = 'Save carregado'; addLog('💾 Progresso carregado.'); if (info.offlineRewards) addLog('🌙 Recompensa offline: +' + info.offlineRewards.xp + ' XP, +' + info.offlineRewards.gold + ' ouro e ' + info.offlineRewards.kills + ' abates.'); updateHUD(); } else { if (info.saveId) localStorage.setItem('legend_of_indle_save_id', info.saveId); if (byId('hud-save-status')) byId('hud-save-status').textContent = 'Novo save'; } });
  socket.on('saveStatus', function (info) { if (info.ok && byId('hud-save-status')) byId('hud-save-status').textContent = 'Salvo'; });
  socket.on('achievementsUnlocked', function (list) { (list || []).forEach(function (a) { addLog('🏆 Conquista: ' + a.nome + ' +' + (a.reward.ouro || 0) + ' ouro +' + (a.reward.gemas || 0) + ' gemas.'); playSound('loot'); }); });
  socket.on('rankingUpdate', function (data) { renderRanking(data); });
  socket.on('mountUpdated', function (data) { if (state.me) { if (data.mount) state.me.mount = data.mount; if (data.collection) state.me.mountCollection = data.collection; if (data.bonus) state.me.mountBonus = data.bonus; } addLog('🐺 Montaria atualizada: ' + data.mount.nome + ' Nv. ' + data.mount.level + '.'); playSound('equip'); renderMount(); renderPaperDoll(); updateHUD(); });
  socket.on('petUpdated', function (data) { if (data.pets && state.me) state.me.pets = data.pets; addLog('🐾 Pet atualizado.'); playSound('equip'); updateHUD(); });


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


  socket.on('talentAction', function (data) {
    if (data.player) state.me = data.player;
    addLog('🌟 Talentos atualizados. Poder atual: ' + formatNumber(state.me.power || 0) + '.');
    playSound('equip');
    updateHUD();
    renderTalents();
  });
  socket.on('metaUpdated', function (data) { if (data.player) state.me = data.player; if (data.meta && state.me) state.me.meta = data.meta; addLog('🌌 Meta progressão atualizada.'); playSound('loot'); updateHUD(); renderMissions(); renderCodex(); renderAscension(); });

  socket.on('expeditionAction', function (data) {
    if (data.player) state.me = data.player;
    if (data.type === 'start') addLog('🧭 Expedição iniciada.');
    if (data.type === 'claim' && data.result && data.result.rewards) {
      var r = data.result.rewards;
      addLog('🧭 Expedição concluída: +' + formatNumber(r.gold || 0) + ' ouro, +' + formatNumber(r.xp || 0) + ' XP, +' + formatNumber(r.gems || 0) + ' gemas.');
      if (r.item) state.lootRecente.unshift(r.item);
    }
    playSound(data.type === 'claim' ? 'loot' : 'equip');
    updateHUD();
    renderExpedition(); renderMissions();
  });



  socket.on('v30Action', function(data) {
    if (data.player) state.me = data.player;
    var type = data.type || 'sistema';
    var msg = '✨ V30 atualizado.';
    if (type === 'research') msg = '🔬 Pesquisa concluída.';
    if (type === 'tower') msg = '🗼 Torre vencida: andar ' + data.result.floor + '.';
    if (type === 'rift') msg = '🌀 Fenda concluída: +' + formatNumber(data.result.gold||0) + ' ouro, +' + formatNumber(data.result.gems||0) + ' gemas.';
    if (type === 'season') msg = '🎟️ Recompensa de temporada coletada.';
    if (type === 'title') msg = '🏷️ Título equipado: ' + data.result.title.nome + '.';
    if (type === 'mail') msg = '📬 Correio coletado.';
    if (type === 'code') msg = '🎁 Código resgatado: ' + data.result.code + '.';
    if (type === 'reroll') msg = '♻️ Item reforjado: ' + data.result.item.nome + '.';
    addLog(msg);
    playSound('loot');
    updateHUD(); renderV30(); renderBag(); renderPaperDoll();
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

  socket.on('dailyReward', function (data) {
    if (data.player) state.me = data.player;
    addLog('🎁 Diária coletada: +' + data.reward.gold + ' ouro, +' + data.reward.gems + ' gemas e poções.');
    playSound('loot');
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
