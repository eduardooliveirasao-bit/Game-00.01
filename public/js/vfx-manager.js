(function () {
  'use strict';

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function nowMs() { return performance.now(); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  /**
   * VFXManager 2.0 — Legend Of Indle
   * Objetivo: dar game feel forte usando apenas 1 PNG estático por entidade.
   * Ele NÃO exige spritesheet. Tudo é feito com tween, transformações, flashes,
   * partículas, hit-stop, screen shake, slashes, projéteis e pós-processamento Canvas.
   */
  class VFXManager {
    constructor(ctx, canvas) {
      this.ctx = ctx;
      this.canvas = canvas;
      this.actions = new Map();
      this.flinches = new Map();
      this.effects = [];
      this.particles = [];
      this.afterImages = [];
      this.screenFlashList = [];
      this.shake = { startedAt: 0, until: 0, duration: 0, strength: 0 };
      this.hitStopUntil = 0;
      this.frameScale = 1;
      this.comboCounter = 0;
      this.lastImpactAt = 0;
    }

    easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
    easeOutQuart(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 4); }
    easeInCubic(t) { t = clamp(t, 0, 1); return t * t * t; }
    easeInOutSine(t) { t = clamp(t, 0, 1); return -(Math.cos(Math.PI * t) - 1) / 2; }
    easeBackOut(t) { t = clamp(t, 0, 1); const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

    dashCurve(t) {
      t = clamp(t, 0, 1);
      // 0-12% antecipação, 12-44% dash, 44-55% hold no impacto, 55-100% retorno.
      if (t < 0.12) return -0.10 * this.easeOutCubic(t / 0.12);
      if (t < 0.44) return lerp(-0.10, 1.0, this.easeOutQuart((t - 0.12) / 0.32));
      if (t < 0.55) return 1.0;
      return lerp(1.0, 0.0, this.easeInOutSine((t - 0.55) / 0.45));
    }

    hitStop(ms) { this.hitStopUntil = Math.max(this.hitStopUntil, nowMs() + (ms || 70)); }

    screenShake(strength, duration) {
      const n = nowMs();
      this.shake = {
        startedAt: n,
        until: Math.max(this.shake.until || 0, n + (duration || 200)),
        duration: Math.max(this.shake.duration || 0, duration || 200),
        strength: Math.max(this.shake.strength || 0, strength || 8)
      };
    }

    flashScreen(color, duration, alpha) {
      this.screenFlashList.push({ type: 'flash', color: color || '#ffffff', startedAt: nowMs(), duration: duration || 160, alpha: alpha == null ? 0.28 : alpha });
    }

    dashAndReturn(id, from, to, options) {
      options = options || {};
      this.actions.set(id, {
        type: 'dash', startedAt: nowMs(), duration: options.duration || 520,
        from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
        lift: options.lift == null ? -20 : options.lift,
        rotate: options.rotate == null ? 0.09 : options.rotate,
        scale: options.scale == null ? 0.075 : options.scale,
        color: options.color || '#9fd8ff', afterimage: options.afterimage !== false,
        facing: options.facing || (to.x >= from.x ? 1 : -1),
        anticipation: options.anticipation !== false
      });
      if (options.speedLines !== false) this.speedLines(from, to, options.color || '#9fd8ff', options.duration || 520);
    }

    hitFlinch(id, direction, options) {
      options = options || {};
      this.flinches.set(id, {
        startedAt: nowMs(), duration: options.duration || 220,
        dx: (direction && direction.x ? direction.x : -1) * (options.distance || 24),
        dy: (direction && direction.y ? direction.y : 0) * (options.distanceY == null ? 7 : options.distanceY),
        color: options.color || 'white', flashMs: options.flashMs || 110,
        wobble: options.wobble !== false
      });
    }

    getTransform(id, base) {
      const n = nowMs();
      const frozen = n < this.hitStopUntil;
      const tr = { x: base.x, y: base.y, rot: 0, sx: 1, sy: 1, flash: null, alpha: 1, trail: false, trailColor: null };
      const action = this.actions.get(id);
      if (action) {
        const elapsed = frozen ? Math.min(action.duration * 0.50, n - action.startedAt) : n - action.startedAt;
        const t = elapsed / action.duration;
        if (t >= 1) this.actions.delete(id);
        else {
          const p = this.dashCurve(t);
          const arc = Math.sin(clamp(p, 0, 1) * Math.PI);
          tr.x += (action.to.x - action.from.x) * p;
          tr.y += (action.to.y - action.from.y) * p + arc * action.lift;
          tr.rot += action.rotate * action.facing * Math.sin(clamp(t * 1.4, 0, 1) * Math.PI);
          tr.sx += action.scale * Math.sin(clamp(t * 1.6, 0, 1) * Math.PI);
          tr.sy -= action.scale * 0.55 * Math.sin(clamp(t * 1.6, 0, 1) * Math.PI);
          tr.trail = action.afterimage && t > 0.10 && t < 0.75;
          tr.trailColor = action.color;
        }
      }

      const flinch = this.flinches.get(id);
      if (flinch) {
        const t = (n - flinch.startedAt) / flinch.duration;
        if (t >= 1) this.flinches.delete(id);
        else {
          const recoil = Math.pow(1 - t, 2);
          tr.x += flinch.dx * recoil;
          tr.y += flinch.dy * recoil + Math.sin(t * Math.PI * 5) * (flinch.wobble ? 2.5 : 0);
          tr.rot += Math.sin(t * Math.PI * 4) * 0.045;
          tr.sx += recoil * 0.035;
          tr.sy -= recoil * 0.020;
          if (n - flinch.startedAt < flinch.flashMs) tr.flash = flinch.color;
        }
      }
      return tr;
    }

    beginFrame() {
      const ctx = this.ctx;
      const n = nowMs();
      ctx.save();
      if (n < this.shake.until) {
        const left = clamp((this.shake.until - n) / Math.max(1, this.shake.duration), 0, 1);
        const amp = this.shake.strength * left * left;
        const x = (Math.random() - 0.5) * amp;
        const y = (Math.random() - 0.5) * amp;
        const r = (Math.random() - 0.5) * 0.0035 * amp;
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.rotate(r);
        ctx.translate(-this.canvas.width / 2 + x, -this.canvas.height / 2 + y);
      } else {
        this.shake.strength = 0;
      }
    }

    endFrame() { this.drawScreenFlashes(); this.ctx.restore(); }

    drawCharacterImage(img, x, y, w, h, transform, options) {
      // Skin-ready: todas as futuras camadas usam exatamente o mesmo transform/pivot.
      options = options || {};
      const ctx = this.ctx;
      transform = transform || { x, y, rot: 0, sx: 1, sy: 1 };
      if (transform.trail) this.drawGhostImage(img, transform.x, transform.y, w, h, transform.trailColor, options.facing || 1);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.rotate(transform.rot || 0);
      ctx.scale((transform.sx || 1) * (options.facing || 1), transform.sy || 1);
      if (options.shadowColor) { ctx.shadowColor = options.shadowColor; ctx.shadowBlur = options.shadowBlur || 0; }
      if (options.dead) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
      if (transform.flash) {
        ctx.filter = transform.flash === 'red'
          ? 'brightness(1.95) sepia(1) saturate(6) hue-rotate(-35deg) contrast(1.25)'
          : 'brightness(2.9) saturate(0.12) contrast(1.25)';
      }
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
    }

    drawGhostImage(img, x, y, w, h, color, facing) {
      const ctx = this.ctx;
      for (let i = 4; i >= 1; i--) {
        ctx.save();
        ctx.globalAlpha = 0.035 + i * 0.025;
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = 'blur(1px)';
        ctx.shadowColor = color || '#9fd8ff';
        ctx.shadowBlur = 18;
        ctx.translate(x - i * 16 * (facing || 1), y + i * 3);
        ctx.scale(facing || 1, 1);
        ctx.drawImage(img, -w / 2, -h, w, h);
        ctx.restore();
      }
    }

    drawSkinLayer(img, x, y, w, h, transform, options) { this.drawCharacterImage(img, x, y, w, h, transform, options); }

    // -------- High level combat calls --------
    playPlayerAttack(meta) {
      meta = meta || {};
      const cls = meta.classId || 'guerreiro';
      const from = meta.from || { x: this.canvas.width * 0.28, y: this.canvas.height * 0.90 };
      const to = meta.to || { x: this.canvas.width * 0.55, y: this.canvas.height * 0.82 };
      const impact = meta.impact || { x: this.canvas.width * 0.72, y: this.canvas.height * 0.42 };
      const color = meta.color || (cls === 'mago' ? '#8fdcff' : cls === 'arqueiro' ? '#a8ffca' : '#ffe69b');
      const crit = !!meta.crit;
      this.comboCounter += 1;

      if (cls === 'arqueiro') {
        this.dashAndReturn('player', from, { x: from.x - 28, y: from.y - 6 }, { duration: 360, lift: -10, color, rotate: -0.04, scale: 0.035, facing: -1 });
        this.projectile({ from: { x: from.x + 80, y: from.y - 165 }, to: impact, color, kind: 'arrow', duration: 270, size: crit ? 22 : 16 });
        this.delayed(() => { this.impact(impact.x, impact.y, { color, size: crit ? 112 : 86, crit }); this.hitFlinch('monster', { x: 1, y: 0 }, { distance: crit ? 38 : 25, color: crit ? 'white' : 'red' }); }, 250);
      } else if (cls === 'mago') {
        this.dashAndReturn('player', from, { x: from.x + 22, y: from.y - 10 }, { duration: 440, lift: -20, color, rotate: 0.035, scale: 0.045 });
        this.groundRune(from.x + 45, from.y - 95, { color, size: 86, duration: 520 });
        this.beam({ from: { x: from.x + 90, y: from.y - 180 }, to: impact, color, duration: 330, width: crit ? 18 : 12 });
        this.delayed(() => { this.arcaneBurst(impact.x, impact.y, { color, size: crit ? 126 : 98 }); this.hitFlinch('monster', { x: 1, y: 0 }, { distance: crit ? 34 : 24, color: crit ? 'white' : 'red' }); }, 260);
      } else {
        this.dashAndReturn('player', from, to, { duration: crit ? 560 : 500, lift: -24, color, rotate: 0.13, scale: 0.09 });
        this.delayed(() => {
          this.slashCombo(impact.x, impact.y, { color, size: crit ? 126 : 96, count: crit ? 4 : 3 });
          this.impact(impact.x + 8, impact.y + 12, { color, size: crit ? 106 : 78, crit });
          this.hitFlinch('monster', { x: 1, y: 0 }, { distance: crit ? 42 : 26, color: crit ? 'white' : 'red' });
        }, 230);
      }

      if (crit) { this.hitStop(86); this.screenShake(17, 240); this.flashScreen('#fff2a8', 140, 0.20); }
      else this.screenShake(6, 120);
    }

    playAbility(meta) {
      meta = meta || {};
      const cls = meta.classId || 'mago';
      const color = meta.color || '#91d8ff';
      const from = meta.from || { x: this.canvas.width * 0.33, y: this.canvas.height * 0.48 };
      const to = meta.to || { x: this.canvas.width * 0.72, y: this.canvas.height * 0.40 };
      this.groundRune(from.x, from.y + 72, { color, size: 115, duration: 680 });
      this.flashScreen(color, 180, 0.14);
      if (cls === 'arqueiro') {
        for (let i = 0; i < 7; i++) this.delayed(() => this.projectile({ from: { x: from.x + rand(-30, 60), y: from.y - rand(40, 130) }, to: { x: to.x + rand(-70, 70), y: to.y + rand(-48, 42) }, color, kind: 'arrow', duration: rand(260, 430), size: 16 }), i * 48);
        this.delayed(() => this.slashCombo(to.x, to.y, { color, size: 118, count: 5 }), 360);
      } else if (cls === 'guerreiro') {
        this.playPlayerAttack({ classId: cls, from: { x: this.canvas.width * 0.28, y: this.canvas.height * 0.90 }, to: { x: this.canvas.width * 0.56, y: this.canvas.height * 0.81 }, impact: to, color, crit: true });
        this.delayed(() => this.shockwave(to.x, to.y + 40, { color, size: 150 }), 300);
      } else {
        this.beam({ from, to, color, duration: 560, width: 24 });
        this.delayed(() => this.arcaneBurst(to.x, to.y, { color, size: 150, duration: 680 }), 380);
      }
      this.hitStop(90);
      this.screenShake(15, 260);
    }

    playMonsterAttack(meta) {
      meta = meta || {};
      const from = meta.from || { x: this.canvas.width * 0.72, y: this.canvas.height * 0.90 };
      const to = meta.to || { x: this.canvas.width * 0.47, y: this.canvas.height * 0.84 };
      const impact = meta.impact || { x: this.canvas.width * 0.28, y: this.canvas.height * 0.44 };
      const boss = !!meta.boss;
      const color = boss ? '#ff864f' : '#ff9b9b';
      this.dashAndReturn('monster', from, to, { duration: boss ? 560 : 430, lift: boss ? -18 : -10, color, rotate: -0.10, scale: boss ? 0.08 : 0.05, facing: -1 });
      this.delayed(() => {
        this.slashCombo(impact.x, impact.y, { color, size: boss ? 124 : 92, count: boss ? 4 : 2, angle: 0.55 });
        this.impact(impact.x, impact.y, { color, size: boss ? 116 : 82, crit: boss });
        this.hitFlinch('player', { x: -1, y: 0 }, { distance: boss ? 44 : 28, color: 'red' });
        this.hitStop(boss ? 100 : 56);
      }, boss ? 290 : 210);
      this.screenShake(boss ? 19 : 10, boss ? 320 : 180);
    }

    playDodge(x, y) {
      this.textBurst('ESQUIVA', x, y, '#b7ffdc');
      this.smoke(x, y + 40, { color: '#b7ffdc', count: 10 });
      this.screenShake(4, 90);
    }

    playDeathBurst(x, y, color) {
      this.arcaneBurst(x, y, { color: color || '#ffe69b', size: 160, duration: 700 });
      this.shockwave(x, y + 50, { color: color || '#ffe69b', size: 180 });
      this.flashScreen(color || '#ffe69b', 220, 0.20);
      this.screenShake(18, 280);
    }

    delayed(fn, delay) { this.effects.push({ type: 'callback', startedAt: nowMs(), duration: delay || 1, fn, fired: false }); }

    // -------- Effect builders --------
    speedLines(from, to, color, duration) { this.effects.push({ type: 'speedLines', from, to, color, startedAt: nowMs(), duration: duration || 420 }); }
    slash(x, y, options) { options = options || {}; this.effects.push({ type: 'slash', x, y, startedAt: nowMs(), duration: options.duration || 360, color: options.color || '#e7f7ff', size: options.size || 88, angle: options.angle == null ? -0.55 : options.angle }); this.spawnSparks(x, y, options.color || '#e7f7ff', 16, 3.2); }
    slashCombo(x, y, options) { options = options || {}; const count = options.count || 3; for (let i = 0; i < count; i++) this.delayed(() => this.slash(x + rand(-22, 22), y + rand(-24, 24), { color: options.color, size: (options.size || 94) * rand(0.78, 1.1), angle: (options.angle == null ? -0.65 : options.angle) + rand(-0.45, 0.45), duration: 310 }), i * 48); }
    impact(x, y, options) { options = options || {}; this.effects.push({ type: 'impact', x, y, startedAt: nowMs(), duration: options.duration || 420, color: options.color || '#ffd27a', size: options.size || 72 }); this.spawnSparks(x, y, options.color || '#ffd27a', options.crit ? 30 : 18, options.crit ? 5.0 : 3.2); }
    shockwave(x, y, options) { options = options || {}; this.effects.push({ type: 'shockwave', x, y, startedAt: nowMs(), duration: options.duration || 520, color: options.color || '#ffd27a', size: options.size || 120 }); }
    arcaneBurst(x, y, options) { options = options || {}; this.effects.push({ type: 'arcane', x, y, startedAt: nowMs(), duration: options.duration || 560, color: options.color || '#86d8ff', size: options.size || 90 }); this.spawnSparks(x, y, options.color || '#86d8ff', 24, 4.0); }
    groundRune(x, y, options) { options = options || {}; this.effects.push({ type: 'rune', x, y, startedAt: nowMs(), duration: options.duration || 650, color: options.color || '#86d8ff', size: options.size || 96 }); }
    beam(options) { options = options || {}; this.effects.push({ type: 'beam', from: options.from, to: options.to, color: options.color || '#86d8ff', width: options.width || 14, startedAt: nowMs(), duration: options.duration || 420 }); }
    projectile(options) { options = options || {}; this.effects.push({ type: 'projectile', from: options.from, to: options.to, color: options.color || '#e7f7ff', kind: options.kind || 'bolt', size: options.size || 16, startedAt: nowMs(), duration: options.duration || 360 }); }
    smoke(x, y, options) { options = options || {}; for (let i = 0; i < (options.count || 8); i++) this.particles.push({ x: x + rand(-12, 12), y: y + rand(-6, 6), vx: rand(-1.4, 1.4), vy: rand(-2.2, -0.4), life: 1, color: options.color || '#b7ffdc', size: rand(7, 14), smoke: true }); }
    textBurst(text, x, y, color) { this.effects.push({ type: 'text', text, x, y, color: color || '#fff', startedAt: nowMs(), duration: 520 }); }

    spawnSparks(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.35 + Math.random()) * (speed || 3);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, size: rand(2.2, 5.4) });
      }
    }

    updateAndDraw() {
      const ctx = this.ctx;
      const n = nowMs();

      this.effects = this.effects.filter(e => {
        if (e.type === 'callback') {
          if (!e.fired && n - e.startedAt >= e.duration) { e.fired = true; e.fn && e.fn(); }
          return !e.fired;
        }
        return (n - e.startedAt) < e.duration;
      });

      for (const e of this.effects) this.drawEffect(e, n);
      this.drawParticles();
    }

    drawEffect(e, n) {
      const ctx = this.ctx;
      const p = clamp((n - e.startedAt) / e.duration, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = e.color;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 22;

      if (e.type === 'speedLines') {
        const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
        ctx.globalAlpha = (1 - p) * 0.32;
        ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const t = (i / 14 + p * 0.9) % 1;
          const ox = rand(-18, 18), oy = rand(-90, 45);
          ctx.beginPath();
          ctx.moveTo(e.from.x + dx * t + ox, e.from.y + dy * t + oy);
          ctx.lineTo(e.from.x + dx * (t + 0.14) + ox, e.from.y + dy * (t + 0.14) + oy);
          ctx.stroke();
        }
      } else if (e.type === 'slash') {
        ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        ctx.globalAlpha = Math.pow(1 - p, 0.85);
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = (10 - i * 2) * (1 - p) + 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, e.size * (0.74 + i * 0.17), -0.92 + p * 1.4, 0.62 + p * 1.4);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.22 * (1 - p);
        ctx.beginPath(); ctx.ellipse(0, 0, e.size * 1.05, e.size * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'impact') {
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size * this.easeOutQuart(p), 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI * 2 / 12 + p * 0.5;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * e.size * 0.18, e.y + Math.sin(a) * e.size * 0.18);
          ctx.lineTo(e.x + Math.cos(a) * e.size * (0.55 + p * 0.55), e.y + Math.sin(a) * e.size * (0.55 + p * 0.55));
          ctx.stroke();
        }
      } else if (e.type === 'shockwave') {
        ctx.globalAlpha = (1 - p) * 0.7;
        ctx.lineWidth = 7 * (1 - p) + 1;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, e.size * p, e.size * 0.28 * p, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'arcane') {
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(e.x, e.y, e.size * (p + i * 0.16), 0, Math.PI * 2); ctx.stroke(); }
        for (let r = 0; r < 10; r++) { const a = r * Math.PI / 5 + p * 2.8; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * e.size * (0.32 + p), e.y + Math.sin(a) * e.size * (0.32 + p)); ctx.stroke(); }
      } else if (e.type === 'rune') {
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
        ctx.translate(e.x, e.y); ctx.rotate(p * 1.1);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, e.size * 0.58, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, e.size * 0.37, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.size * 0.26, Math.sin(a) * e.size * 0.26); ctx.lineTo(Math.cos(a) * e.size * 0.62, Math.sin(a) * e.size * 0.62); ctx.stroke(); }
      } else if (e.type === 'beam') {
        const grow = Math.sin(p * Math.PI);
        ctx.globalAlpha = Math.min(1, grow * 1.3);
        ctx.lineCap = 'round';
        ctx.lineWidth = e.width * (0.6 + grow * 0.8);
        ctx.beginPath(); ctx.moveTo(e.from.x, e.from.y); ctx.lineTo(lerp(e.from.x, e.to.x, this.easeOutQuart(p)), lerp(e.from.y, e.to.y, this.easeOutQuart(p))); ctx.stroke();
        ctx.lineWidth = Math.max(2, e.width * 0.25); ctx.strokeStyle = '#ffffff'; ctx.stroke();
      } else if (e.type === 'projectile') {
        const t = this.easeOutQuart(p);
        const x = lerp(e.from.x, e.to.x, t), y = lerp(e.from.y, e.to.y, t) + Math.sin(t * Math.PI) * -22;
        const a = Math.atan2(e.to.y - e.from.y, e.to.x - e.from.x);
        ctx.globalAlpha = 1 - p * 0.15; ctx.translate(x, y); ctx.rotate(a);
        ctx.lineWidth = e.size * 0.28; ctx.beginPath(); ctx.moveTo(-e.size * 1.6, 0); ctx.lineTo(e.size * 1.5, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(e.size * 1.8, 0); ctx.lineTo(e.size * 0.65, -e.size * 0.45); ctx.lineTo(e.size * 0.65, e.size * 0.45); ctx.closePath(); ctx.fill();
      } else if (e.type === 'text') {
        ctx.globalAlpha = 1 - p;
        ctx.font = '900 ' + Math.floor(22 + p * 8) + 'px Cinzel, Georgia, serif';
        ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(e.text, e.x, e.y - p * 44); ctx.fillText(e.text, e.x, e.y - p * 44);
      }
      ctx.restore();
    }

    drawParticles() {
      const ctx = this.ctx;
      this.particles = this.particles.filter(p => p.life > 0);
      for (const p of this.particles) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.94; p.vy = p.vy * 0.94 + (p.smoke ? -0.005 : 0.05);
        p.life -= p.smoke ? 0.020 : 0.034;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, p.life) * (p.smoke ? 0.30 : 1); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.smoke ? 18 : 12; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * Math.max(0.1, p.life), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }

    drawScreenFlashes() {
      const ctx = this.ctx;
      const n = nowMs();
      this.screenFlashList = this.screenFlashList.filter(f => n - f.startedAt < f.duration);
      for (const f of this.screenFlashList) {
        const p = clamp((n - f.startedAt) / f.duration, 0, 1);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = f.alpha * (1 - p); ctx.fillStyle = f.color; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.restore();
      }
    }
  }

  window.VFXManager = VFXManager;
})();
