/* 1v1 duel engine — host-authoritative simulation, best of 3 rounds.
   The host ticks the world and broadcasts snapshots; the guest sends inputs. */

import { FX, RED, type RGB } from "./fx";
import { SoundFX } from "./audio";
import { getTheme, type Settings, type Theme } from "./settings";
import { getSkin, type Skin } from "./skins";
import { Haptics } from "./haptics";
import { genMaze } from "./levels";

export type DirName = "up" | "down" | "left" | "right";
export type DuelPhase = "countdown" | "playing" | "roundEnd" | "matchEnd";
export type Side = "a" | "b";

const DIRS: Record<DirName, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

interface Cell {
  x: number;
  y: number;
}

export interface DuelConfig {
  cols: number;
  rows: number;
  maze: number;
  seed: number;
  /** ms per tick */
  step: number;
  wins: number;
}

interface Player {
  body: Cell[];
  prev: Cell[];
  dir: { x: number; y: number };
  queue: { x: number; y: number }[];
  alive: boolean;
  score: number;
  wins: number;
}

export interface Snapshot {
  t: "s";
  a: { b: number[]; al: boolean; sc: number; w: number };
  b: { b: number[]; al: boolean; sc: number; w: number };
  f: number[];
  ph: DuelPhase;
  cd: number;
  rd: number;
}

const key = (x: number, y: number) => x + y * 1000;
const clamp = (v: number, a: number, z: number) => Math.min(z, Math.max(a, v));

/* deterministic RNG so both sides build the same arena */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type BotLevel = "easy" | "normal" | "hard";

export class DuelGame {
  readonly fx = new FX();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound: SoundFX;
  private haptics: Haptics;

  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;
  private cell = 20;
  private ox = 0;
  private oy = 0;
  private bg: HTMLCanvasElement | null = null;

  cfg: DuelConfig;
  private theme: Theme;
  private skinA: Skin;
  private skinB: Skin;
  private settings: Settings;

  /** which side the local player controls */
  side: Side = "a";
  isHost = true;
  botLevel: BotLevel | null = null;

  private A: Player;
  private B: Player;
  private obstacles = new Set<number>();
  private food: Cell = { x: 0, y: 0 };
  private rand: () => number;

  phase: DuelPhase = "countdown";
  private cd = 3;
  private lastCdBlip = 99;
  private acc = 0;
  private roundEndT = 0;
  round = 1;
  lastRoundWinner: Side | "draw" | null = null;
  matchWinner: Side | "draw" | null = null;

  onSnapshot: ((s: Snapshot) => void) | null = null;
  onMatchEnd: ((winner: Side | "draw") => void) | null = null;
  onRoundEnd: ((winner: Side | "draw") => void) | null = null;

  /** guest-side snapshot cursor */
  private netT = 0;

  constructor(
    canvas: HTMLCanvasElement,
    cfg: DuelConfig,
    opts: {
      sound: SoundFX;
      haptics: Haptics;
      settings: Settings;
      side: Side;
      isHost: boolean;
      botLevel: BotLevel | null;
      skinA: string;
      skinB: string;
    },
  ) {
    this.canvas = canvas;
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("no ctx");
    this.ctx = c;
    this.cfg = cfg;
    this.sound = opts.sound;
    this.haptics = opts.haptics;
    this.settings = opts.settings;
    this.side = opts.side;
    this.isHost = opts.isHost;
    this.botLevel = opts.botLevel;
    this.theme = getTheme(opts.settings.theme);
    this.skinA = getSkin(opts.skinA);
    this.skinB = getSkin(opts.skinB);
    this.fx.particlesOn = opts.settings.particles;
    this.fx.shakeOn = opts.settings.shake;
    this.rand = rng(cfg.seed);

    this.A = this.blank();
    this.B = this.blank();
    this.buildMaze();
    this.resetRound(true);
    this.resize();

    this.lastT = performance.now();
    const loop = (t: number) => {
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  private blank(): Player {
    return { body: [], prev: [], dir: DIRS.right, queue: [], alive: true, score: 0, wins: 0 };
  }

  /* ---------------- setup ---------------- */

  private buildMaze() {
    this.obstacles = this.cfg.maze > 0 ? genMaze(this.cfg.maze, this.cfg.cols, this.cfg.rows) : new Set();
    // keep both spawn lanes clear
    const midY = Math.floor(this.cfg.rows / 2);
    for (const k of [...this.obstacles]) {
      const y = Math.floor(k / 1000);
      if (Math.abs(y - midY) <= 1) this.obstacles.delete(k);
    }
  }

  private resetRound(first = false) {
    const { cols, rows } = this.cfg;
    const midY = Math.floor(rows / 2);
    const ax = 3;
    const bx = cols - 4;
    this.A.body = [
      { x: ax, y: midY },
      { x: ax - 1, y: midY },
      { x: ax - 2, y: midY },
    ];
    this.B.body = [
      { x: bx, y: midY },
      { x: bx + 1, y: midY },
      { x: bx + 2, y: midY },
    ];
    this.A.dir = DIRS.right;
    this.B.dir = DIRS.left;
    for (const p of [this.A, this.B]) {
      p.prev = p.body.map((s) => ({ ...s }));
      p.queue = [];
      p.alive = true;
      if (first) p.wins = 0;
      p.score = 0;
    }
    this.spawnFood();
    this.phase = "countdown";
    this.cd = first ? 3 : 2;
    this.lastCdBlip = 99;
    this.acc = 0;
    this.lastRoundWinner = null;
  }

  private spawnFood() {
    const taken = new Set<number>();
    for (const p of [this.A, this.B]) for (const s of p.body) taken.add(key(s.x, s.y));
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(this.rand() * this.cfg.cols);
      const y = Math.floor(this.rand() * this.cfg.rows);
      const k = key(x, y);
      if (taken.has(k) || this.obstacles.has(k)) continue;
      this.food = { x, y };
      return;
    }
    this.food = { x: Math.floor(this.cfg.cols / 2), y: 0 };
  }

  /* ---------------- layout ---------------- */

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect?.width ?? window.innerWidth));
    const h = Math.max(200, Math.floor(rect?.height ?? window.innerHeight));
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // leave room for the duel HUD
    const padTop = 74;
    const padBottom = this.settings.touchMode === "dpad" ? 150 : 24;
    const availH = Math.max(120, h - padTop - padBottom);
    this.cell = Math.min(w / this.cfg.cols, availH / this.cfg.rows);
    this.ox = (w - this.cfg.cols * this.cell) / 2;
    this.oy = padTop + (availH - this.cfg.rows * this.cell) / 2;
    this.buildBg();
  }

  private buildBg() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const bg = document.createElement("canvas");
    bg.width = Math.floor(this.w * dpr);
    bg.height = Math.floor(this.h * dpr);
    const c = bg.getContext("2d");
    if (!c) return;
    c.scale(dpr, dpr);
    const th = this.theme;
    const { w, h, ox, oy, cell } = this;
    const aw = this.cfg.cols * cell;
    const ah = this.cfg.rows * cell;

    const g = c.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.5, Math.max(w, h) * 0.85);
    g.addColorStop(0, th.bg[0]);
    g.addColorStop(0.55, th.bg[1]);
    g.addColorStop(1, th.bg[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    if (this.settings.grid) {
      c.strokeStyle = th.grid;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 1; i < this.cfg.cols; i++) {
        c.moveTo(ox + i * cell, oy);
        c.lineTo(ox + i * cell, oy + ah);
      }
      for (let j = 1; j < this.cfg.rows; j++) {
        c.moveTo(ox, oy + j * cell);
        c.lineTo(ox + aw, oy + j * cell);
      }
      c.stroke();
    }

    if (this.obstacles.size) {
      c.save();
      c.shadowColor = th.wallGlow;
      c.shadowBlur = 10;
      const inset = cell * 0.1;
      for (const k of this.obstacles) {
        const px = ox + (k % 1000) * cell + inset;
        const py = oy + Math.floor(k / 1000) * cell + inset;
        c.fillStyle = th.wall;
        c.strokeStyle = th.wallEdge;
        c.lineWidth = 1.3;
        c.beginPath();
        c.roundRect(px, py, cell - inset * 2, cell - inset * 2, Math.min(5, cell * 0.22));
        c.fill();
        c.stroke();
      }
      c.restore();
    }

    c.save();
    c.shadowColor = th.borderGlow;
    c.shadowBlur = 18;
    c.strokeStyle = th.border;
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(ox - 1, oy - 1, aw + 2, ah + 2, Math.min(14, cell * 0.5));
    c.stroke();
    c.restore();

    this.bg = bg;
  }

  /* ---------------- input ---------------- */

  /** Local player steers. Guests send the intent upstream. */
  steer(name: DirName): { x: number; y: number } | null {
  const p = this.side === "a" ? this.A : this.B;
  const d = DIRS[name];
  const last = p.queue.length ? p.queue[p.queue.length - 1] : p.dir;
  if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return null;
  if (this.isHost) {
    if (p.queue.length < 3) p.queue.push(d);
  }
  return d;
}

  /** Host applies a remote input from the guest. */
  applyRemoteDir(d: { x: number; y: number }) {
    if (!this.isHost) return;
    const p = this.B;
    const last = p.queue.length ? p.queue[p.queue.length - 1] : p.dir;
    if (d.x === -last.x && d.y === -last.y) return;
    if (d.x === last.x && d.y === last.y) return;
    if (p.queue.length < 3) p.queue.push(d);
  }

  /* ---------------- bot ---------------- */

  private botThink() {
    const me = this.B;
    if (!me.alive) return;
    const head = me.body[0];
    const blocked = new Set<number>(this.obstacles);
    for (const s of this.A.body) blocked.add(key(s.x, s.y));
    for (const s of me.body.slice(0, -1)) blocked.add(key(s.x, s.y));

    const opts = Object.values(DIRS).filter((d) => {
      if (d.x === -me.dir.x && d.y === -me.dir.y) return false;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || ny < 0 || nx >= this.cfg.cols || ny >= this.cfg.rows) return false;
      return !blocked.has(key(nx, ny));
    });
    if (!opts.length) return;

    // flood fill to avoid trapping itself
    const space = (d: { x: number; y: number }) => {
      const start = key(head.x + d.x, head.y + d.y);
      const seen = new Set<number>([start]);
      const stack = [start];
      let n = 0;
      const cap = this.botLevel === "hard" ? 90 : this.botLevel === "normal" ? 45 : 18;
      while (stack.length && n < cap) {
        const k = stack.pop()!;
        n++;
        const x = k % 1000;
        const y = Math.floor(k / 1000);
        for (const nd of Object.values(DIRS)) {
          const ax = x + nd.x;
          const ay = y + nd.y;
          if (ax < 0 || ay < 0 || ax >= this.cfg.cols || ay >= this.cfg.rows) continue;
          const nk = key(ax, ay);
          if (seen.has(nk) || blocked.has(nk)) continue;
          seen.add(nk);
          stack.push(nk);
        }
      }
      return n;
    };

    const mistake = this.botLevel === "easy" ? 0.28 : this.botLevel === "normal" ? 0.1 : 0.02;
    let best = opts[0];
    if (Math.random() < mistake) {
      best = opts[Math.floor(Math.random() * opts.length)];
    } else {
      let bestScore = -Infinity;
      for (const d of opts) {
        const nx = head.x + d.x;
        const ny = head.y + d.y;
        const dist = Math.abs(nx - this.food.x) + Math.abs(ny - this.food.y);
        const room = space(d);
        const sc = room * 2.2 - dist * 1.4;
        if (sc > bestScore) {
          bestScore = sc;
          best = d;
        }
      }
    }
    me.queue = [best];
  }

  /* ---------------- simulation (host only) ---------------- */

  private stepPlayer(p: Player): { nx: number; ny: number } | null {
    while (p.queue.length) {
      const d = p.queue.shift()!;
      if (!(d.x === -p.dir.x && d.y === -p.dir.y)) {
        p.dir = d;
        break;
      }
    }
    return { nx: p.body[0].x + p.dir.x, ny: p.body[0].y + p.dir.y };
  }

  private tick() {
    if (this.botLevel) this.botThink();

    const moves: Record<Side, { nx: number; ny: number } | null> = {
      a: this.A.alive ? this.stepPlayer(this.A) : null,
      b: this.B.alive ? this.stepPlayer(this.B) : null,
    };

    const eats: Record<Side, boolean> = {
      a: !!moves.a && moves.a.nx === this.food.x && moves.a.ny === this.food.y,
      b: !!moves.b && moves.b.nx === this.food.x && moves.b.ny === this.food.y,
    };

    const dead: Record<Side, boolean> = { a: false, b: false };
    const check = (s: Side, mv: { nx: number; ny: number } | null) => {
      if (!mv) return;
      const { nx, ny } = mv;
      if (nx < 0 || ny < 0 || nx >= this.cfg.cols || ny >= this.cfg.rows) return (dead[s] = true);
      if (this.obstacles.has(key(nx, ny))) return (dead[s] = true);
      for (const [other, p] of [
        ["a", this.A],
        ["b", this.B],
      ] as [Side, Player][]) {
        const body = other === s && !eats[s] ? p.body.slice(0, -1) : p.body;
        for (const c of body) if (c.x === nx && c.y === ny) return (dead[s] = true);
      }
    };
    check("a", moves.a);
    check("b", moves.b);
    // head-on collision kills both
    if (moves.a && moves.b && moves.a.nx === moves.b.nx && moves.a.ny === moves.b.ny) {
      dead.a = true;
      dead.b = true;
    }

    for (const [s, p] of [
      ["a", this.A],
      ["b", this.B],
    ] as [Side, Player][]) {
      const mv = moves[s];
      if (!mv || !p.alive) continue;
      if (dead[s]) {
        p.alive = false;
        this.explode(p, s);
        continue;
      }
      p.prev = p.body.map((c) => ({ ...c }));
      p.body.unshift({ x: mv.nx, y: mv.ny });
      if (eats[s]) {
        p.score += 10;
        this.onEatFx(s);
      } else p.body.pop();
    }
    if (eats.a || eats.b) this.spawnFood();

    if (!this.A.alive || !this.B.alive) this.endRound();
  }

  private onEatFx(s: Side) {
    const px = this.ox + (this.food.x + 0.5) * this.cell;
    const py = this.oy + (this.food.y + 0.5) * this.cell;
    const col: RGB = s === "a" ? { r: 166, g: 255, b: 77 } : { r: 255, g: 100, b: 180 };
    this.fx.burst(px, py, col, 16, 180, 3);
    this.fx.ring(px, py, s === "a" ? "rgba(166,255,77,0.8)" : "rgba(255,100,180,0.8)", this.cell * 2.2, 3, 0.4);
    if (s === this.side) {
      this.sound.eat(1);
      this.haptics.fire("eat");
    } else this.sound.ui();
  }

  private explode(p: Player, s: Side) {
    for (const c of p.body) {
      const px = this.ox + (c.x + 0.5) * this.cell;
      const py = this.oy + (c.y + 0.5) * this.cell;
      this.fx.burst(px, py, RED, 6, 170, 2.6);
    }
    this.fx.shake(0.6);
    if (s === this.side) {
      this.sound.die();
      this.haptics.fire("die");
    }
  }

  private endRound() {
    const aAlive = this.A.alive;
    const bAlive = this.B.alive;
    const winner: Side | "draw" = aAlive === bAlive ? "draw" : aAlive ? "a" : "b";
    this.lastRoundWinner = winner;
    if (winner !== "draw") (winner === "a" ? this.A : this.B).wins++;
    this.phase = "roundEnd";
    this.roundEndT = 0;
    this.onRoundEnd?.(winner);

    if (this.A.wins >= this.cfg.wins || this.B.wins >= this.cfg.wins) {
      this.matchWinner = this.A.wins > this.B.wins ? "a" : this.B.wins > this.A.wins ? "b" : "draw";
    }
  }

  /* ---------------- guest sync ---------------- */

  applySnapshot(s: Snapshot) {
    this.netT = 0;
    const dec = (arr: number[]) => {
      const out: Cell[] = [];
      for (let i = 0; i < arr.length; i += 2) out.push({ x: arr[i], y: arr[i + 1] });
      return out;
    };
    this.A.body = dec(s.a.b);
    this.A.alive = s.a.al;
    this.A.score = s.a.sc;
    this.A.wins = s.a.w;
    this.B.body = dec(s.b.b);
    this.B.alive = s.b.al;
    this.B.score = s.b.sc;
    this.B.wins = s.b.w;
    this.food = { x: s.f[0], y: s.f[1] };
    const wasPhase = this.phase;
    this.phase = s.ph;
    this.cd = s.cd;
    this.round = s.rd;
    if (wasPhase !== "roundEnd" && s.ph === "roundEnd") {
      this.lastRoundWinner = this.A.alive === this.B.alive ? "draw" : this.A.alive ? "a" : "b";
      if (this.lastRoundWinner !== this.side) {
        this.sound.die();
        this.haptics.fire("die");
      }
      this.fx.shake(0.5);
    }
    if (s.a.w >= this.cfg.wins || s.b.w >= this.cfg.wins) {
      this.matchWinner = s.a.w > s.b.w ? "a" : s.b.w > s.a.w ? "b" : "draw";
    }
  }

  private emit() {
    if (!this.onSnapshot) return;
    const enc = (b: Cell[]) => {
      const out: number[] = [];
      for (const c of b) out.push(c.x, c.y);
      return out;
    };
    this.onSnapshot({
      t: "s",
      a: { b: enc(this.A.body), al: this.A.alive, sc: this.A.score, w: this.A.wins },
      b: { b: enc(this.B.body), al: this.B.alive, sc: this.B.score, w: this.B.wins },
      f: [this.food.x, this.food.y],
      ph: this.phase,
      cd: this.cd,
      rd: this.round,
    });
  }

  /* ---------------- frame ---------------- */

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.netT += dt;

    if (this.isHost) {
      if (this.phase === "countdown") {
        this.cd -= dt;
        const n = Math.ceil(this.cd);
        if (n !== this.lastCdBlip) {
          this.lastCdBlip = n;
          if (n > 0) {
            this.sound.tick(false);
            this.fx.floatText(this.w / 2, this.oy + this.cell * 2, String(n), "#e8f4ff", 48);
          }
        }
        if (this.cd <= 0) {
          this.phase = "playing";
          this.sound.tick(true);
          this.fx.floatText(this.w / 2, this.oy + this.cell * 2, "GO", "#d2ff7a", 44);
          this.acc = 0;
        }
        this.emit();
      } else if (this.phase === "playing") {
        this.acc += dt * 1000;
        let guard = 0;
        while (this.acc >= this.cfg.step && this.phase === "playing" && guard++ < 6) {
          this.tick();
          this.acc -= this.cfg.step;
          this.emit();
        }
      } else if (this.phase === "roundEnd") {
        this.roundEndT += dt;
        if (this.roundEndT > 1.9) {
          if (this.matchWinner) {
            this.phase = "matchEnd";
            this.emit();
            this.onMatchEnd?.(this.matchWinner);
          } else {
            this.round++;
            this.resetRound();
            this.emit();
          }
        }
      }
    } else if (this.phase === "matchEnd" && this.matchWinner) {
      this.onMatchEnd?.(this.matchWinner);
      this.matchWinner = null; // fire once
    }

    this.fx.update(dt);
    this.render();
  }

  /* ---------------- rendering ---------------- */

  private render() {
    const { ctx, w, h } = this;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);
    else {
      ctx.fillStyle = "#04050c";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    this.fx.applyCamera(ctx, w, h);

    // orb
    const fx = this.ox + (this.food.x + 0.5) * this.cell;
    const fy = this.oy + (this.food.y + 0.5) * this.cell;
    const [orr, org, orb] = this.theme.orb;
    const r = this.cell * 0.3 * (1 + 0.12 * Math.sin(performance.now() / 180));
    const halo = ctx.createRadialGradient(fx, fy, r * 0.2, fx, fy, r * 3);
    halo.addColorStop(0, `rgba(${orr},${org},${orb},0.4)`);
    halo.addColorStop(1, `rgba(${orr},${org},${orb},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${orr},${org},${orb})`;
    ctx.shadowColor = `rgba(${orr},${org},${orb},0.9)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const t = this.isHost && this.phase === "playing" ? clamp(this.acc / this.cfg.step, 0, 1) : 1;
    this.drawSnake(this.A, this.skinA, t, this.side === "a");
    this.drawSnake(this.B, this.skinB, t, this.side === "b");

    this.fx.draw(ctx);
    ctx.restore();
  }

  private drawSnake(p: Player, skin: Skin, t: number, isMe: boolean) {
    if (!p.body.length || !p.alive) return;
    const { ctx, cell } = this;
    const pts = p.body.map((cur, i) => {
      const prv = p.prev[Math.min(i, p.prev.length - 1)] ?? cur;
      const wrapped = Math.abs(cur.x - prv.x) > 1 || Math.abs(cur.y - prv.y) > 1;
      const x = wrapped ? cur.x : prv.x + (cur.x - prv.x) * t;
      const y = wrapped ? cur.y : prv.y + (cur.y - prv.y) * t;
      return { px: this.ox + (x + 0.5) * cell, py: this.oy + (y + 0.5) * cell };
    });

    const path = new Path2D();
    path.moveTo(pts[0].px, pts[0].py);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].px + pts[i + 1].px) / 2;
      const my = (pts[i].py + pts[i + 1].py) / 2;
      path.quadraticCurveTo(pts[i].px, pts[i].py, mx, my);
    }
    if (pts.length > 1) path.lineTo(pts[pts.length - 1].px, pts[pts.length - 1].py);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = skin.glowHot;
    ctx.lineWidth = cell * (isMe ? 1.05 : 0.9);
    ctx.stroke(path);
    ctx.restore();

    const grad = ctx.createLinearGradient(pts[0].px, pts[0].py, pts[pts.length - 1].px, pts[pts.length - 1].py);
    grad.addColorStop(0, skin.stops[0]);
    grad.addColorStop(0.4, skin.stops[1]);
    grad.addColorStop(1, skin.stops[2]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = grad;
    ctx.lineWidth = cell * 0.6;
    ctx.stroke(path);

    // head
    ctx.fillStyle = skin.head;
    ctx.beginPath();
    ctx.arc(pts[0].px, pts[0].py, cell * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // marker ring over your own snake
    if (isMe) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(pts[0].px, pts[0].py, cell * 0.56, 0, Math.PI * 2);
      ctx.stroke();
    }

    const d = p.dir;
    for (const s of [-1, 1]) {
      const bx = pts[0].px + -d.y * cell * 0.17 * s + d.x * cell * 0.1;
      const by = pts[0].py + d.x * cell * 0.17 * s + d.y * cell * 0.1;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bx, by, cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#08130c";
      ctx.beginPath();
      ctx.arc(bx + d.x * cell * 0.04, by + d.y * cell * 0.04, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- HUD data ---------------- */

  get hud() {
    const me = this.side === "a" ? this.A : this.B;
    const foe = this.side === "a" ? this.B : this.A;
    return {
      myWins: me.wins,
      foeWins: foe.wins,
      myLen: me.body.length,
      foeLen: foe.body.length,
      round: this.round,
      phase: this.phase,
      cd: Math.max(0, Math.ceil(this.cd)),
      alive: me.alive,
    };
  }
}
