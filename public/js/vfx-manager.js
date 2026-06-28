(function () {
  'use strict';

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function nowMs() { return performance.now(); }

  class VFXManager {
    constructor(ctx, canvas) {
      this.ctx = ctx;
      this.canvas = canvas;
      this.actions = new Map();
      this.flinches = new Map();
      this.particles = [];
      this.effects = [];
      this.shake = { until: 0, strength: 0, decay: 1 };
    }

    easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    easeInOutBack(t) {
      t = clamp(t, 0, 1);
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    easeDashReturn(t) {
      t = clamp(t, 0, 1);
      if (t < 0.42) return this.easeOutCubic(t / 0.42);
      return 1 - this.easeInOutBack((t - 0.42) / 0.58);
    }

    dashAndReturn(id, from, to, options) {
      options = options || {};
      this.actions.set(id, {
        type: 'dash',
        startedAt: nowMs(),
        duration: options.duration || 460,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        lift: options.lift == null ? -18 : options.lift,
        rotate: options.rotate == null ? 0.08 : options.rotate,
        scale: options.scale == null ? 0.06 : options.scale,
        trail: options.trail !== false,
        color: options.color || '#9fd8ff'
      });
    }

    hitFlinch(id, direction, options) {
      options = options || {};
      this.flinches.set(id, {
        startedAt: nowMs(),
        duration: options.duration || 180,
        dx: (direction && direction.x ? direction.x : -1) * (options.distance || 22),
        dy: (direction && direction.y ? direction.y : 0) * (options.distance || 8),
        color: options.color || 'white',
        flashMs: options.flashMs || 100
      });
    }

    screenShake(strength, duration, decay) {
      this.shake = {
        until: Math.max(this.shake.until, nowMs() + (duration || 200)),
        strength: Math.max(this.shake.strength, strength || 8),
        decay: decay || 1
      };
    }

    getTransform(id, base) {
      const tNow = nowMs();
      const transform = { x: base.x, y: base.y, rot: 0, sx: 1, sy: 1, flash: null, alpha: 1, trail: false, trailColor: null };
      const action = this.actions.get(id);
      if (action) {
        const t = (tNow - action.startedAt) / action.duration;
        if (t >= 1) this.actions.delete(id);
        else {
          const p = this.easeDashReturn(t);
          transform.x += (action.to.x - action.from.x) * p;
          transform.y += (action.to.y - action.from.y) * p + Math.sin(p * Math.PI) * action.lift;
          transform.rot += action.rotate * Math.sin(p * Math.PI);
          transform.sx += action.scale * Math.sin(p * Math.PI);
          transform.sy -= action.scale * 0.45 * Math.sin(p * Math.PI);
          transform.trail = action.trail;
          transform.trailColor = action.color;
        }
      }
      const flinch = this.flinches.get(id);
      if (flinch) {
        const t = (tNow - flinch.startedAt) / flinch.duration;
        if (t >= 1) this.flinches.delete(id);
        else {
          const recoil = Math.sin((1 - t) * Math.PI * 0.5);
          transform.x += flinch.dx * recoil;
          transform.y += flinch.dy * recoil;
          if (tNow - flinch.startedAt < flinch.flashMs) transform.flash = flinch.color;
        }
      }
      return transform;
    }

    beginFrame() {
      const tNow = nowMs();
      this.ctx.save();
      if (tNow < this.shake.until) {
        const left = (this.shake.until - tNow) / Math.max(1, this.shake.until - (this.shake.until - 200));
        const amp = this.shake.strength * Math.max(0.2, left) * this.shake.decay;
        this.ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      } else {
        this.shake.strength = 0;
      }
    }

    endFrame() { this.ctx.restore(); }

    drawImage(img, x, y, w, h, transform, options) {
      options = options || {};
      transform = transform || { x: x, y: y, rot: 0, sx: 1, sy: 1 };
      const ctx = this.ctx;
      if (transform.trail) {
        for (let i = 3; i >= 1; i--) {
          ctx.save();
          ctx.globalAlpha = 0.08 * i;
          ctx.filter = 'blur(0.8px)';
          ctx.shadowColor = transform.trailColor || '#9fd8ff';
          ctx.shadowBlur = 12;
          ctx.drawImage(img, x - w / 2 - i * 14, y - h + i * 4, w, h);
          ctx.restore();
        }
      }
      ctx.save();
      ctx.translate(transform.x, transform.y - h / 2);
      ctx.rotate(transform.rot || 0);
      ctx.scale(transform.sx || 1, transform.sy || 1);
      if (options.dead) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
      if (transform.flash) {
        ctx.filter = transform.flash === 'red'
          ? 'brightness(1.8) sepia(1) saturate(6) hue-rotate(-35deg)'
          : 'brightness(2.6) saturate(0.2)';
      }
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    slash(x, y, options) {
      options = options || {};
      this.effects.push({ type: 'slash', x, y, startedAt: nowMs(), duration: options.duration || 380, color: options.color || '#e7f7ff', size: options.size || 88, angle: options.angle || -0.55 });
      this.spawnSparks(x, y, options.color || '#e7f7ff', 14, 2.8);
    }

    impact(x, y, options) {
      options = options || {};
      this.effects.push({ type: 'impact', x, y, startedAt: nowMs(), duration: options.duration || 420, color: options.color || '#ffd27a', size: options.size || 72 });
      this.spawnSparks(x, y, options.color || '#ffd27a', options.crit ? 24 : 16, options.crit ? 4.5 : 3.0);
    }

    arcaneBurst(x, y, options) {
      options = options || {};
      this.effects.push({ type: 'arcane', x, y, startedAt: nowMs(), duration: options.duration || 560, color: options.color || '#86d8ff', size: options.size || 90 });
      this.spawnSparks(x, y, options.color || '#86d8ff', 18, 3.8);
    }

    spawnSparks(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.45 + Math.random()) * (speed || 3);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, size: 2 + Math.random() * 3 });
      }
    }

    updateAndDraw() {
      const ctx = this.ctx;
      const tNow = nowMs();
      this.effects = this.effects.filter(e => (tNow - e.startedAt) < e.duration);
      for (const e of this.effects) {
        const p = clamp((tNow - e.startedAt) / e.duration, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = e.color;
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 22;
        ctx.globalAlpha = 1 - p;
        if (e.type === 'slash') {
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          ctx.lineWidth = 8 * (1 - p) + 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, e.size * (0.75 + i * 0.18), -0.85 + p * 1.2, 0.58 + p * 1.2);
            ctx.stroke();
          }
        } else if (e.type === 'arcane') {
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.size * (p + i * 0.18), 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let r = 0; r < 8; r++) {
            const a = r * Math.PI / 4 + p * 2;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + Math.cos(a) * e.size * (0.35 + p), e.y + Math.sin(a) * e.size * (0.35 + p));
            ctx.stroke();
          }
        } else {
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * p, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 10; i++) {
            const a = i * Math.PI * 2 / 10 + p * 0.5;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * e.size * 0.25, e.y + Math.sin(a) * e.size * 0.25);
            ctx.lineTo(e.x + Math.cos(a) * e.size * (0.55 + p * 0.55), e.y + Math.sin(a) * e.size * (0.55 + p * 0.55));
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      this.particles = this.particles.filter(p => p.life > 0);
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + 0.05;
        p.life -= 0.035;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  window.VFXManager = VFXManager;
})();
