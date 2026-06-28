(function () {
  'use strict';

  function waitForClient() {
    if (window.LegendClient && window.LegendClient.socket && document.body) return boot();
    setTimeout(waitForClient, 80);
  }

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function id(v) { return document.getElementById(v); }
  function fmt(n) {
    n = Math.floor(n || 0);
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
  function pct(v) { return Math.max(0, Math.min(100, Math.round(v || 0))); }

  function boot() {
    var LC = window.LegendClient;
    var socket = LC.socket;
    var state = LC.state;
    var v2 = {
      tab: 'world',
      payload: null,
      definitions: null,
      activeZone: null,
      bonuses: null,
      lastAction: null,
      fx: [],
      trail: [],
      pulse: 0,
      opened: false
    };

    ensureDOM();
    var fxCanvas = id('v2-fx-canvas');
    var fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;
    var modal = id('v2-modal');
    var content = id('v2-content');
    var hud = id('v2-stage-hud');

    function currentPlayer() { return state.me || (v2.payload && v2.payload.player) || null; }
    function currentV2() {
      var me = currentPlayer();
      if (me && me.v2 && me.v2.state) return me.v2;
      if (v2.payload && v2.payload.v2) return v2.payload.v2;
      return { state: null, definitions: v2.definitions || null, activeZone: v2.activeZone || null, bonuses: v2.bonuses || null };
    }
    function defs() {
      var p = currentV2();
      return (p && p.definitions) || v2.definitions || { zones: [], dungeons: [], chapters: [], skins: [], resourceReference: {} };
    }
    function v2State() {
      var p = currentV2();
      return (p && p.state) || { world: { unlocked: ['floresta_cristalina'], zoneId: 'floresta_cristalina' }, battle: { fury: 0, combo: 0 }, dungeons: { keys: 0 }, resources: {}, visuals: {}, campaign: { completed: [], claimed: [] }, codex: {} };
    }
    function activeZone() {
      var p = currentV2();
      var d = defs();
      var st = v2State();
      return (p && p.activeZone) || (d.zones || []).filter(function (z) { return z.id === st.world.zoneId; })[0] || (d.zones || [])[0] || { nome: 'Zona V2', color: '#6df7ff', icon: '🌌', bonus: {}, nodes: 12 };
    }

    function ensureDOM() {
      var stage = id('stage');
      if (stage && !id('v2-fx-canvas')) {
        var canvas = document.createElement('canvas');
        canvas.id = 'v2-fx-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        stage.appendChild(canvas);
      }
      if (stage && !id('v2-stage-hud')) {
        var h = document.createElement('div');
        h.id = 'v2-stage-hud';
        h.innerHTML = '<div class="v2-zone-pill">🌌 V2 carregando...</div><div class="v2-battle-bars"><span>Fúria</span><b><i></i></b></div><div class="v2-mini-map"></div>';
        stage.appendChild(h);
      }
      var menu = id('bottom-menu');
      if (menu && !id('menu-v2')) {
        var btn = document.createElement('button');
        btn.id = 'menu-v2';
        btn.innerHTML = '🌌 V2';
        menu.insertBefore(btn, menu.firstChild);
      }
      if (!id('v2-modal')) {
        var sec = document.createElement('section');
        sec.id = 'v2-modal';
        sec.className = 'modal hidden v2-modal';
        sec.innerHTML = '<div class="modal-card v2-card">\n'
          + '<button id="v2-close" class="modal-close">×</button>\n'
          + '<div class="v2-title-row"><div><p class="eyebrow">Legend Of Indle</p><h2>V2 — Ultimate MMORPG Reforjado</h2><span>Cliente visual, mundo, dungeons, campanha, resource vault e combate manual real.</span></div><button id="v2-refresh" class="v2-primary">Atualizar V2</button></div>\n'
          + '<div class="v2-tabs"><button data-tab="world">Mundo</button><button data-tab="battle">Batalha</button><button data-tab="dungeons">Dungeons</button><button data-tab="campaign">Campanha</button><button data-tab="visual">Visual</button><button data-tab="codex">Vault</button></div>\n'
          + '<div id="v2-content"></div>\n'
          + '</div>';
        document.body.appendChild(sec);
      }
    }

    function openModal(tab) {
      v2.tab = tab || v2.tab || 'world';
      v2.opened = true;
      modal.classList.remove('hidden');
      socket.emit('v2RequestState');
      renderAll();
    }
    function closeModal() { v2.opened = false; modal.classList.add('hidden'); }

    function renderAll() {
      renderHUD();
      if (v2.opened) renderModal();
    }

    function renderHUD() {
      if (!hud) return;
      var st = v2State();
      var zone = activeZone();
      var me = currentPlayer() || {};
      var monster = state.monster || {};
      var fury = pct(st.battle && st.battle.fury);
      document.documentElement.style.setProperty('--v2-zone-color', zone.color || '#6df7ff');
      var nodes = Math.max(1, zone.nodes || 12);
      var node = (st.world && st.world.node) || 0;
      var dots = '';
      for (var i = 0; i < Math.min(nodes, 20); i++) dots += '<i class="' + (i <= node ? 'on' : '') + '"></i>';
      hud.innerHTML = '<div class="v2-zone-pill"><b>' + esc(zone.icon || '🌌') + ' ' + esc(zone.nome || 'Zona V2') + '</b><span>Horda ' + fmt(me.horda || 1) + ' • ' + esc(monster.nome || 'inimigo') + '</span></div>'
        + '<div class="v2-battle-bars"><span>Fúria V2</span><b><i style="width:' + fury + '%"></i></b><em>' + fury + '%</em></div>'
        + '<div class="v2-battle-bars combo"><span>Combo</span><b><i style="width:' + pct(((st.battle && st.battle.combo) || 0) % 100) + '%"></i></b><em>x' + fmt((st.battle && st.battle.combo) || 0) + '</em></div>'
        + '<div class="v2-mini-map">' + dots + '</div>';
    }

    function tabButton(name, label) { return '<button class="' + (v2.tab === name ? 'active' : '') + '" data-tab="' + name + '">' + label + '</button>'; }
    function renderModal() {
      var st = v2State();
      var d = defs();
      var zone = activeZone();
      var me = currentPlayer() || {};
      var tabs = id('v2-modal').querySelector('.v2-tabs');
      if (tabs) tabs.innerHTML = tabButton('world', 'Mundo') + tabButton('battle', 'Batalha') + tabButton('dungeons', 'Dungeons') + tabButton('campaign', 'Campanha') + tabButton('visual', 'Visual') + tabButton('codex', 'Vault');
      if (!content) return;
      var html = '';
      if (v2.lastAction) html += '<div class="v2-toast-line">' + esc(v2.lastAction) + '</div>';
      if (v2.tab === 'world') html += renderWorld(st, d, zone, me);
      if (v2.tab === 'battle') html += renderBattle(st, d, zone, me);
      if (v2.tab === 'dungeons') html += renderDungeons(st, d, me);
      if (v2.tab === 'campaign') html += renderCampaign(st, d, me);
      if (v2.tab === 'visual') html += renderVisual(st, d);
      if (v2.tab === 'codex') html += renderCodex(st, d);
      content.innerHTML = html;
    }

    function renderWorld(st, d, zone, me) {
      var unlocked = (st.world && st.world.unlocked) || [];
      var rows = (d.zones || []).map(function (z) {
        var open = unlocked.indexOf(z.id) >= 0;
        var active = zone.id === z.id;
        return '<button class="v2-zone-card ' + (open ? 'open' : 'locked') + ' ' + (active ? 'active' : '') + '" data-zone="' + z.id + '">'
          + '<strong>' + esc(z.icon) + ' ' + esc(z.nome) + '</strong>'
          + '<span>Horda ' + z.minWave + ' • Nv. ' + z.minLevel + ' • ' + esc(z.boss) + '</span>'
          + '<small>XP +' + Math.round((z.bonus.xpPct || 0) * 100) + '% • Ouro +' + Math.round((z.bonus.goldPct || 0) * 100) + '% • ATK +' + Math.round((z.bonus.attackPct || 0) * 100) + '%</small>'
          + '<em>' + (active ? 'ATIVA' : open ? 'ENTRAR' : 'BLOQUEADA') + '</em></button>';
      }).join('');
      return '<div class="v2-grid two"><div class="v2-panel big"><h3>Mapa V2 Reforjado</h3><p>As zonas foram recriadas com base nos mapas, teleportes, handlers e referências Flex enviados. O progresso libera regiões, nodes e bônus reais.</p><div class="v2-zone-list">' + rows + '</div></div>'
        + '<div class="v2-panel"><h3>Status do Mundo</h3><div class="v2-stat"><span>Zona ativa</span><b>' + esc(zone.nome) + '</b></div><div class="v2-stat"><span>Nodes explorados</span><b>' + fmt((st.world && st.world.node) || 0) + ' / ' + fmt(zone.nodes || 12) + '</b></div><div class="v2-stat"><span>Reputação</span><b>' + fmt((st.world && st.world.reputation) || 0) + '</b></div><div class="v2-stat"><span>Energia de Portal</span><b>' + fmt((st.world && st.world.portalEnergy) || 0) + '%</b></div><div class="v2-stat"><span>Zonas abertas</span><b>' + unlocked.length + ' / ' + ((d.zones || []).length) + '</b></div><div class="v2-lore">Atual: ' + esc(zone.boss) + '</div></div></div>';
    }

    function renderBattle(st, d, zone, me) {
      var fury = (st.battle && st.battle.fury) || 0;
      return '<div class="v2-grid two"><div class="v2-panel big"><h3>Batalha 2.0 — Agora com dano manual real</h3><p>O botão manual não é só visual: ele manda evento ao servidor, causa dano, aumenta combo, gera fúria, recompensa e pode matar o inimigo.</p><div class="v2-battle-actions"><button id="v2-manual" class="v2-primary big">⚡ Golpe V2 Real</button><button id="v2-ultimate" class="v2-danger big">🌌 Ultimate V2</button></div><div class="v2-meter"><span>Fúria</span><b><i style="width:' + pct(fury) + '%"></i></b><em>' + fmt(fury) + ' / 100</em></div><div class="v2-meter"><span>Combo</span><b><i style="width:' + pct(((st.battle && st.battle.combo) || 0) % 100) + '%"></i></b><em>x' + fmt((st.battle && st.battle.combo) || 0) + '</em></div></div>'
        + '<div class="v2-panel"><h3>Diretor Visual</h3><div class="v2-stat"><span>Estilo</span><b>' + esc((st.battle && st.battle.style) || 'aggressive') + '</b></div><div class="v2-stat"><span>Zona</span><b>' + esc(zone.nome) + '</b></div><div class="v2-stat"><span>Cor de aura</span><b>' + esc(zone.color) + '</b></div><button class="v2-secondary" data-visual-style="aggressive">Postura Agressiva</button><button class="v2-secondary" data-visual-style="cinematic">Postura Cinemática</button><button class="v2-secondary" data-visual-style="safe">Postura Segura</button></div></div>';
    }

    function renderDungeons(st, d, me) {
      var keys = (st.dungeons && st.dungeons.keys) || 0;
      var cards = (d.dungeons || []).map(function (x) {
        var can = (me.nivel || 1) >= x.minLevel && keys >= x.keyCost;
        return '<button class="v2-dungeon-card ' + (can ? 'open' : 'locked') + '" data-dungeon="' + x.id + '"><strong>' + esc(x.icon) + ' ' + esc(x.nome) + '</strong><span>Nv. ' + x.minLevel + ' • ' + x.waves + ' ondas • custo ' + x.keyCost + ' chave(s)</span><small>+' + fmt(x.rewards.gold) + ' ouro • +' + fmt(x.rewards.xp) + ' XP • +' + fmt(x.rewards.gems || 0) + ' gemas</small><em>' + (can ? 'RODAR AGORA' : 'BLOQUEADA') + '</em></button>';
      }).join('');
      return '<div class="v2-panel big"><h3>Dungeons locais V2</h3><p>Inspiradas nos sistemas de mapa, entrada, saída, eventos, rewards e spawns enviados. Funcionam localmente e salvam progresso.</p><div class="v2-stat-row"><div><span>Chaves</span><b>' + fmt(keys) + '</b></div><div><span>Runs</span><b>' + fmt((st.dungeons && st.dungeons.runs) || 0) + '</b></div><div><span>Pó Relíquia</span><b>' + fmt((st.resources && st.resources.relicDust) || 0) + '</b></div></div><div class="v2-zone-list dungeons">' + cards + '</div></div>';
    }

    function renderCampaign(st, d, me) {
      var claimed = (st.campaign && st.campaign.claimed) || [];
      var completed = (st.campaign && st.campaign.completed) || [];
      var cards = (d.chapters || []).map(function (ch) {
        var ready = completed.indexOf(ch.id) >= 0;
        var done = claimed.indexOf(ch.id) >= 0;
        return '<button class="v2-chapter-card ' + (done ? 'done' : ready ? 'ready' : 'locked') + '" data-chapter="' + ch.id + '"><strong>' + esc(ch.title) + '</strong><span>' + esc(ch.goal) + '</span><small>Recompensa: ' + Object.keys(ch.reward || {}).map(function (k) { return k + ' +' + fmt(ch.reward[k]); }).join(' • ') + '</small><em>' + (done ? 'COLETADO' : ready ? 'COLETAR' : 'EM PROGRESSO') + '</em></button>';
      }).join('');
      return '<div class="v2-panel big"><h3>Campanha V2</h3><p>O jogo agora tem linha de campanha, objetivos e recompensas permanentes.</p><div class="v2-zone-list chapters">' + cards + '</div></div>';
    }

    function renderVisual(st, d) {
      var unlocked = (st.visuals && st.visuals.unlockedSkins) || [];
      var active = st.visuals && st.visuals.aura;
      var skins = (d.skins || []).map(function (s) {
        var open = unlocked.indexOf(s.id) >= 0;
        var on = active === s.id;
        var cost = Object.keys(s.cost || {}).map(function (k) { return k + ' ' + fmt(s.cost[k]); }).join(' • ');
        return '<button class="v2-skin-card ' + (open ? 'open' : 'locked') + ' ' + (on ? 'active' : '') + '" data-skin="' + s.id + '"><strong>' + esc(s.icon) + ' ' + esc(s.nome) + '</strong><span>' + (open ? 'Desbloqueado' : 'Custo: ' + esc(cost)) + '</span><em>' + (on ? 'EQUIPADO' : open ? 'EQUIPAR' : 'DESBLOQUEAR') + '</em></button>';
      }).join('');
      return '<div class="v2-grid two"><div class="v2-panel big"><h3>Visual V2</h3><p>Camada visual nova com aura, overlay de Canvas, mapa, companions e minions procedurais. Mantém compatibilidade com os sprites atuais.</p><div class="v2-zone-list skins">' + skins + '</div></div><div class="v2-panel"><h3>Opções</h3><button class="v2-secondary" data-visual-toggle="showCompanions">Companheiros ON/OFF</button><button class="v2-secondary" data-visual-toggle="showMinions">Minions ON/OFF</button><button class="v2-secondary" data-visual-toggle="camera">Câmera ON/OFF</button><button class="v2-secondary" data-quality="ultra">Qualidade Ultra</button><button class="v2-secondary" data-quality="performance">Qualidade Performance</button></div></div>';
    }

    function renderCodex(st, d) {
      var ref = d.resourceReference || {};
      return '<div class="v2-grid two"><div class="v2-panel big"><h3>Vault reaproveitado</h3><p>Este V2 foi estruturado usando todo o material enviado: cliente Flex, SWFs, ActionScript, SQL, handlers Python, protocolo, mapas, monstros, buffs e o res.zip dividido em 13 partes.</p><div class="v2-stat-row"><div><span>Flex files</span><b>' + fmt(ref.flexClient && ref.flexClient.totalFiles) + '</b></div><div><span>.AS</span><b>' + fmt(ref.flexClient && ref.flexClient.actionScript) + '</b></div><div><span>SWF</span><b>' + fmt(ref.flexClient && ref.flexClient.swf) + '</b></div><div><span>Res entries</span><b>' + fmt(ref.resourceVault && ref.resourceVault.entries) + '</b></div></div><div class="v2-lore">' + esc((ref.resourceVault && ref.resourceVault.note) || '') + '</div></div><div class="v2-panel"><h3>Sistemas importados como referência</h3>' + ((ref.sqlAndProtocol && ref.sqlAndProtocol.systems) || []).map(function (x) { return '<div class="v2-chip">' + esc(x) + '</div>'; }).join('') + '</div></div>';
    }

    function pushFX(kind, x, y, color, power) {
      v2.fx.push({ kind: kind || 'burst', x: x || 0.72, y: y || 0.42, color: color || (activeZone().color || '#6df7ff'), power: power || 1, born: performance.now(), ttl: 700 + Math.random() * 400 });
      if (v2.fx.length > 90) v2.fx.splice(0, v2.fx.length - 90);
    }

    function resizeFx() {
      if (!fxCanvas) return;
      var rect = fxCanvas.parentElement.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.floor(rect.width * dpr));
      var h = Math.max(1, Math.floor(rect.height * dpr));
      if (fxCanvas.width !== w || fxCanvas.height !== h) {
        fxCanvas.width = w; fxCanvas.height = h; fxCanvas.style.width = rect.width + 'px'; fxCanvas.style.height = rect.height + 'px';
      }
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function renderFx(t) {
      if (!fxCanvas || !fxCtx) return requestAnimationFrame(renderFx);
      resizeFx();
      var w = fxCanvas.clientWidth, h = fxCanvas.clientHeight;
      var zone = activeZone();
      var st = v2State();
      fxCtx.clearRect(0, 0, w, h);
      // Background parallax aura and map lines
      fxCtx.save();
      fxCtx.globalAlpha = 0.12;
      var grad = fxCtx.createRadialGradient(w * 0.58, h * 0.22, 20, w * 0.58, h * 0.22, Math.max(w, h) * 0.72);
      grad.addColorStop(0, zone.color || '#6df7ff'); grad.addColorStop(1, 'transparent');
      fxCtx.fillStyle = grad; fxCtx.fillRect(0, 0, w, h);
      fxCtx.restore();
      var quality = (st.visuals && st.visuals.quality) || 'ultra';
      var orbCount = quality === 'performance' ? 12 : 28;
      for (var i = 0; i < orbCount; i++) {
        var a = t * 0.00025 + i * 0.82;
        var x = w * (0.18 + ((Math.sin(a * 1.7 + i) + 1) * 0.34));
        var y = h * (0.18 + ((Math.cos(a * 1.2 + i * 2) + 1) * 0.32));
        fxCtx.globalAlpha = 0.10 + (i % 5) * 0.02;
        fxCtx.fillStyle = zone.color || '#6df7ff';
        fxCtx.beginPath(); fxCtx.arc(x, y, 1.8 + (i % 4), 0, Math.PI * 2); fxCtx.fill();
      }
      // Companions and minions
      if (!st.visuals || st.visuals.showCompanions !== false) {
        for (var c = 0; c < 3; c++) drawCompanion(w * 0.18 + c * 42, h * 0.66 + Math.sin(t / 360 + c) * 12, zone.color, c);
      }
      if (!st.visuals || st.visuals.showMinions !== false) {
        for (var m = 0; m < 4; m++) {
          var ma = t / 620 + m * Math.PI / 2;
          drawMinion(w * 0.72 + Math.cos(ma) * 58, h * 0.43 + Math.sin(ma) * 24, zone.color, m);
        }
      }
      // Active projectile line from combo/fury
      if (((st.battle && st.battle.combo) || 0) > 0) {
        fxCtx.save();
        fxCtx.globalAlpha = 0.11 + Math.min(0.22, ((st.battle.fury || 0) / 400));
        fxCtx.strokeStyle = zone.color || '#6df7ff'; fxCtx.lineWidth = 2;
        fxCtx.beginPath(); fxCtx.moveTo(w * 0.30, h * 0.46); fxCtx.quadraticCurveTo(w * 0.50, h * (0.22 + Math.sin(t / 400) * 0.04), w * 0.72, h * 0.42); fxCtx.stroke();
        fxCtx.restore();
      }
      // Bursts
      var now = performance.now();
      v2.fx = v2.fx.filter(function (f) { return now - f.born < f.ttl; });
      v2.fx.forEach(function (f) {
        var k = (now - f.born) / f.ttl;
        var x = f.x * w, y = f.y * h;
        fxCtx.save();
        fxCtx.globalAlpha = Math.max(0, 1 - k);
        fxCtx.strokeStyle = f.color; fxCtx.fillStyle = f.color;
        for (var r = 0; r < 5; r++) {
          fxCtx.beginPath(); fxCtx.arc(x, y, (14 + r * 12 + k * 70) * f.power, 0, Math.PI * 2); fxCtx.stroke();
        }
        if (f.kind === 'ultimate') {
          fxCtx.globalAlpha *= 0.55;
          fxCtx.fillRect(0, 0, w, h);
        }
        fxCtx.restore();
      });
      requestAnimationFrame(renderFx);
    }

    function drawCompanion(x, y, color, i) {
      fxCtx.save(); fxCtx.globalAlpha = 0.65; fxCtx.fillStyle = color || '#6df7ff'; fxCtx.strokeStyle = 'rgba(255,255,255,.75)';
      fxCtx.beginPath(); fxCtx.arc(x, y, 8 + i * 1.5, 0, Math.PI * 2); fxCtx.fill(); fxCtx.stroke();
      fxCtx.globalAlpha = 0.25; fxCtx.beginPath(); fxCtx.arc(x, y, 18 + i * 4, 0, Math.PI * 2); fxCtx.stroke(); fxCtx.restore();
    }
    function drawMinion(x, y, color, i) {
      fxCtx.save(); fxCtx.globalAlpha = 0.42; fxCtx.fillStyle = 'rgba(0,0,0,.65)'; fxCtx.beginPath(); fxCtx.ellipse(x, y + 14, 15, 5, 0, 0, Math.PI * 2); fxCtx.fill(); fxCtx.fillStyle = color || '#ff6bdf'; fxCtx.globalAlpha = 0.36; fxCtx.beginPath(); fxCtx.arc(x, y, 11 + (i % 2) * 4, 0, Math.PI * 2); fxCtx.fill(); fxCtx.restore();
    }

    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('button') : null;
      if (!t) return;
      if (t.id === 'menu-v2') openModal('world');
      if (t.id === 'manual-strike-btn') { socket.emit('v2ManualStrike'); pushFX('manual', 0.72, 0.42, activeZone().color, 0.9); }
      if (t.id === 'v2-close') closeModal();
      if (t.id === 'v2-refresh') socket.emit('v2RequestState');
      if (t.dataset && t.dataset.tab) { v2.tab = t.dataset.tab; renderModal(); }
      if (t.dataset && t.dataset.zone) socket.emit('v2EnterZone', { zoneId: t.dataset.zone });
      if (t.dataset && t.dataset.dungeon) socket.emit('v2RunDungeon', { dungeonId: t.dataset.dungeon });
      if (t.dataset && t.dataset.chapter) socket.emit('v2ClaimChapter', { chapterId: t.dataset.chapter });
      if (t.dataset && t.dataset.skin) socket.emit('v2UnlockSkin', { skinId: t.dataset.skin });
      if (t.dataset && t.dataset.quality) socket.emit('v2SetVisual', { quality: t.dataset.quality });
      if (t.dataset && t.dataset.visualStyle) socket.emit('v2SetVisual', { style: t.dataset.visualStyle });
      if (t.dataset && t.dataset.visualToggle) {
        var st = v2State(); var key = t.dataset.visualToggle; var val = !(st.visuals && st.visuals[key] !== false);
        var patch = {}; patch[key] = val; socket.emit('v2SetVisual', patch);
      }
      if (t.id === 'v2-manual') { socket.emit('v2ManualStrike'); pushFX('manual', 0.72, 0.42, activeZone().color, 0.75); }
      if (t.id === 'v2-ultimate') { socket.emit('v2UltimateBurst'); pushFX('ultimate', 0.62, 0.40, activeZone().color, 1.8); }
    });

    socket.on('init', function (data) {
      v2.payload = data || v2.payload;
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      renderAll();
    });
    socket.on('playerUpdated', function (player) { if (player && state.meId === player.id) state.me = player; renderAll(); });
    socket.on('enemyUpdate', function () { renderAll(); });
    socket.on('v2State', function (data) {
      v2.payload = data || v2.payload;
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      else if (data && data.definitions) v2.definitions = data.definitions;
      renderAll();
    });
    socket.on('v2Action', function (data) {
      if (data && data.player) state.me = data.player;
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      var label = data && data.result && (data.result.zone && data.result.zone.nome || data.result.dungeon && data.result.dungeon.nome || data.result.chapter && data.result.chapter.title || data.result.skin && data.result.skin.nome);
      v2.lastAction = '✅ V2 atualizado: ' + (label || (data && data.type) || 'sistema') + '.';
      pushFX(data && data.type === 'chapter' ? 'ultimate' : 'burst', 0.55, 0.35, activeZone().color, data && data.type === 'dungeon' ? 1.2 : 0.9);
      renderAll();
    });
    socket.on('v2Combat', function (data) {
      if (data && data.player) state.me = data.player;
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      v2.lastAction = '⚔️ ' + (data.type === 'ultimate' ? 'Ultimate V2' : 'Golpe V2') + ' causou ' + fmt(data.event && data.event.damage) + ' dano.';
      pushFX(data.type === 'ultimate' ? 'ultimate' : 'manual', 0.72, 0.42, activeZone().color, data.type === 'ultimate' ? 1.9 : 1.0);
      renderAll();
    });
    socket.on('combatTick', function (data) {
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      var attacks = (data && data.attacks) || [];
      if (attacks.length) pushFX(attacks.some(function (a) { return a.habilidadeId === 'v2_ultimate_burst'; }) ? 'ultimate' : 'burst', 0.72, 0.42, activeZone().color, attacks.length > 1 ? 1.2 : 0.7);
      renderAll();
    });
    socket.on('enemyDied', function (data) {
      if (data && data.player) state.me = data.player;
      if (data && data.v2) { v2.definitions = data.v2.definitions; v2.activeZone = data.v2.activeZone; v2.bonuses = data.v2.bonuses; }
      var k = data && data.v2Kill;
      if (k) v2.lastAction = '🎁 V2 loot: +' + fmt(k.ore) + ' minério, +' + fmt(k.essence) + ' essência, +' + fmt(k.relicDust) + ' pó.';
      pushFX('ultimate', 0.72, 0.42, activeZone().color, 1.3);
      renderAll();
    });

    socket.emit('v2RequestState');
    requestAnimationFrame(renderFx);
    renderAll();
  }

  waitForClient();
})();
