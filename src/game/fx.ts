/* Juice layer: particles, shockwave rings, floating texts, screen shake & kick. */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  drag: number;
  grav: number;
  sparkle: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  maxLife: number;
  width: number;
  color: string;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  size: number;
  color: string;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const LIME: RGB = { r: 166, g: 255, b: 77 };
export const CYAN: RGB = { r: 56, g: 232, b: 255 };
export const AMBER: RGB = { r: 255, g: 210, b: 63 };
export const RED: RGB = { r: 255, g: 77, b: 109 };
export const WHITE: RGB = { r: 232, g: 244, b: 255 };

const MAX_PARTICLES = 520;
const css = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

export class FX {
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];

  private trauma = 0;
  private kickAmt = 0;
  reduceMotion = false;
  particlesOn = true;
  shakeOn = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }

  /* ---------------- spawners ---------------- */

  burst(x: number, y: number, color: RGB, count: number, speed: number, size: number, spread = Math.PI * 2, dir = 0) {
    if (!this.particlesOn) return;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.85);
      const maxLife = 0.45 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: maxLife,
        maxLife,
        size: size * (0.5 + Math.random() * 0.9),
        r: color.r,
        g: color.g,
        b: color.b,
        drag: 0.88,
        grav: 0,
        sparkle: Math.random() < 0.3,
      });
    }
  }

  trail(x: number, y: number, color: RGB, count = 1) {
    if (!this.particlesOn) return;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const maxLife = 0.3 + Math.random() * 0.25;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        life: maxLife,
        maxLife,
        size: 1.4 + Math.random() * 2.4,
        r: color.r,
        g: color.g,
        b: color.b,
        drag: 0.94,
        grav: 0,
        sparkle: false,
      });
    }
  }

  ambient(x: number, y: number) {
    if (!this.particlesOn) return;
    if (this.particles.length >= MAX_PARTICLES) return;
    const maxLife = 3 + Math.random() * 4;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: -6 - Math.random() * 10,
      life: maxLife,
      maxLife,
      size: 0.8 + Math.random() * 1.6,
      r: 90,
      g: 140,
      b: 200,
      drag: 0.995,
      grav: 0,
      sparkle: false,
    });
  }

  ring(x: number, y: number, color: string, maxR: number, width: number, dur = 0.5) {
    this.rings.push({ x, y, r: 2, vr: maxR / dur, life: dur, maxLife: dur, width, color });
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, size, color });
  }

  /* ---------------- camera feel ---------------- */

  shake(amount: number) {
    if (!this.shakeOn) return;
    if (this.reduceMotion) amount *= 0.25;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  kick(amount: number) {
    if (!this.shakeOn) return;
    if (this.reduceMotion) amount *= 0.3;
    this.kickAmt = Math.min(0.09, this.kickAmt + amount);
  }

  /* ---------------- lifecycle ---------------- */

  update(dt: number) {
    const P = this.particles;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) {
        P[i] = P[P.length - 1];
        P.pop();
        continue;
      }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    const R = this.rings;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      r.life -= dt;
      r.r += r.vr * dt;
      if (r.life <= 0) R.splice(i, 1);
    }
    const T = this.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.9, dt * 60);
      if (t.life <= 0) T.splice(i, 1);
    }
    this.trauma = Math.max(0, this.trauma - dt * 2.1);
    this.kickAmt = Math.max(0, this.kickAmt - dt * 0.34);
  }

  /** Call inside ctx.save(); applies shake translate + punch scale. */
  applyCamera(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const s = this.trauma * this.trauma;
    const ox = (Math.random() * 2 - 1) * s * 14;
    const oy = (Math.random() * 2 - 1) * s * 14;
    const scale = 1 + this.kickAmt;
    ctx.translate(w / 2 + ox, h / 2 + oy);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.particles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.particles) {
        const t = p.life / p.maxLife;
        const a = t * t;
        const sz = p.size * (p.sparkle ? (0.4 + 0.6 * Math.abs(Math.sin(p.life * 30))) : t * 0.6 + 0.4);
        ctx.fillStyle = css(p, a * (p.sparkle ? 1 : 0.85));
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, sz), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const r of this.rings) {
      const t = r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * t;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      const scaleIn = Math.min(1, (t.maxLife - t.life) * 9);
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `800 ${t.size * (0.72 + 0.28 * scaleIn)}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.trauma = 0;
    this.kickAmt = 0;
  }
}
