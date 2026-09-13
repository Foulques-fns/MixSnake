/* NEON SERPENT — core engine: fixed-timestep logic + interpolated 60fps rendering.
   Levels: obstacle mazes that reshape the arena every 8 eats. Skins: swappable looks. */

import { FX, LIME, CYAN, AMBER, RED, type RGB } from "./fx";
import { SoundFX } from "./audio";
import { bestScore, recordLevelReached } from "./storage";
import { EATS_PER_LEVEL, MAX_LEVEL, genMaze, levelForEats, levelName } from "./levels";
import { getSkin, loadSkinId, type Skin } from "./skins";
import { getSpeed, getTheme, loadSettings, type Settings, type Theme } from "./settings";
import { Music } from "./music";
import { Haptics } from "./haptics";
import { recordRun } from "./storage";
import { nsKey } from "./accounts";

export type GamePhase = "idle" | "playing" | "paused" | "dying";
export type DirName = "up" | "down" | "left" | "right";

export type GameMode = "arena" | "ascent";

export interface StartOptions {
  /** arena to play (1..MAX_LEVEL) */
  level?: number;
  /** "arena" keeps the chosen maze all run; "ascent" reshapes every 8 eats */
  mode?: GameMode;
}

export interface GameOverPayload {
  score: number;
  len: number;
  level: number;
  startLevel: number;
  mode: GameMode;
}
export type GameEventHandler = (ev: GameOverPayload) => void;

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

type FoodType = "norm" | "gold";

interface Food extends Cell {
  type: FoodType;
  born: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const key = (x: number, y: number) => x + y * 1000;

const COMBO_MIN = 3.2; // floor — near orbs stay snappy
const COMBO_MAX = 9.5; // ceiling for cross-map treks
const COMBO_SLACK = 1.55; // maneuvering margin over raw travel time
const MAX_MULT = Infinity;
const GOLD_LIFE = 5.5; // seconds
const GOLD_CHANCE = 0.16;
const DIE_DURATION = 1.0;

export class SnakeGame {
  readonly sound = new SoundFX();
  readonly music = new Music(this.sound);
  readonly haptics = new Haptics();
  readonly fx = new FX();

  /** Mutated in place; HUD reads it every frame without React re-renders. */
  readonly hud = {
    score: 0,
    best: 0,
    mult: 1,
    comboFrac: 0,
    level: 1,
    levelFrac: 0,
    levelName: "OPEN GRID",
    ascent: false,
    phase: "idle" as GamePhase,
  };

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onGameOver: GameEventHandler;

  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;

  // grid
  private cols = 21;
  private rows = 21;
  private cell = 24;
  private ox = 0;
  private oy = 0;
  private bg: HTMLCanvasElement | null = null;

  // state
  phase: GamePhase = "idle";
  private snake: Cell[] = [];
  private prev: Cell[] = [];
  private dir = DIRS.right;
  private dirQueue: { x: number; y: number }[] = [];
  private stepMs = 130;
  private acc = 0;
  private score = 0;
  private eaten = 0;
  private mult = 1;
  private comboLeft = 0;
  private comboTotal = COMBO_MIN;
  private food: Food | null = null;
  private goldStreak = 0;

  // levels & look
  private level = 1;
  private startLevel = 1;
  private mode: GameMode = "arena";
  private obstacles = new Set<number>();
  private skin: Skin = getSkin(loadSkinId());
  private settings: Settings = loadSettings();
  private theme: Theme = getTheme(this.settings.theme);

  // death sequence
  private dieT = 0;
  private dieIndex = 0;
  private flashT = 0;

  // countdown + run timing
  private countdown = 0;
  private lastBlip = -1;
  private runSeconds = 0;

  // decor
  private headBlinkAt = 2.5;
  private ambientT = 0;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, onGameOver: GameEventHandler) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onGameOver = onGameOver;
    this.hud.best = bestScore();
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
    this.music.stop();
    this.haptics.stop();
  }

  setSkin(id: string) {
    this.skin = getSkin(id);
  }

  /** Re-read the mute flag after a profile switch. */
  reloadMuted() {
    try {
      this.sound.setMuted(localStorage.getItem(nsKey("neon-serpent:muted")) === "1");
    } catch {
      /* private mode */
    }
  }

  /** Live-apply player settings; repaints the arena for theme changes. */
  applySettings(s: Settings) {
    const themeChanged = s.theme !== this.settings.theme || s.grid !== this.settings.grid;
    this.settings = s;
    this.theme = getTheme(s.theme);
    this.fx.particlesOn = s.particles;
    this.fx.shakeOn = s.shake;

    this.sound.setMasterVolume(s.masterVol);
    this.sound.setMusicVolume(s.musicVol);
    this.sound.setSfxVolume(s.sfxVol);
    this.haptics.setLevel(s.haptics);
    this.music.setTrack(s.music);

    if (this.phase === "playing" || this.phase === "paused") {
      this.stepMs = Math.max(this.minStep(), this.baseStep() - (s.ramp ? this.eaten * 1.3 : 0));
    }
    if (themeChanged) this.buildBg();
  }

  /* ================= layout ================= */

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

    if (this.phase === "idle") {
      const target = Math.min(w, h) / 21;
      this.cols = clamp(Math.round(w / target), 14, 28);
      this.rows = clamp(Math.round(h / target), 14, 36);
    }
    this.cell = Math.min(w / this.cols, h / this.rows);
    this.ox = (w - this.cols * this.cell) / 2;
    this.oy = (h - this.rows * this.cell) / 2;
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
    const { w, h, ox, oy, cell, cols, rows } = this;
    const aw = cols * cell;
    const ah = rows * cell;

    const th = this.theme;

    // base gradient
    const g = c.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.5, Math.max(w, h) * 0.85);
    g.addColorStop(0, th.bg[0]);
    g.addColorStop(0.55, th.bg[1]);
    g.addColorStop(1, th.bg[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    // soft color blobs
    const blob = (x: number, y: number, r: number, col: string) => {
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = rg;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(w * 0.12, h * 0.1, w * 0.5, th.blobs[0]);
    blob(w * 0.9, h * 0.85, w * 0.55, th.blobs[1]);
    blob(w * 0.5, h * 1.02, w * 0.6, th.blobs[2]);

    // grid lines inside arena
    if (this.settings.grid) {
      c.strokeStyle = th.grid;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 1; i < cols; i++) {
        c.moveTo(ox + i * cell, oy);
        c.lineTo(ox + i * cell, oy + ah);
      }
      for (let j = 1; j < rows; j++) {
        c.moveTo(ox, oy + j * cell);
        c.lineTo(ox + aw, oy + j * cell);
      }
      c.stroke();
    }

    // obstacle blocks — violet neon crystals
    if (this.obstacles.size > 0) {
      c.save();
      const inset = cell * 0.1;
      const sz = cell - inset * 2;
      const r = Math.min(5, cell * 0.22);
      c.shadowColor = th.wallGlow;
      c.shadowBlur = 10;
      for (const k of this.obstacles) {
        const x = k % 1000;
        const y = Math.floor(k / 1000);
        const px = ox + x * cell + inset;
        const py = oy + y * cell + inset;
        c.fillStyle = th.wall;
        c.strokeStyle = th.wallEdge;
        c.lineWidth = 1.4;
        c.beginPath();
        c.roundRect(px, py, sz, sz, r);
        c.fill();
        c.stroke();
        // inner facets
        c.fillStyle = "rgba(214,196,255,0.28)";
        c.beginPath();
        c.roundRect(px + sz * 0.28, py + sz * 0.28, sz * 0.44, sz * 0.44, r * 0.6);
        c.fill();
      }
      c.restore();
    }

    // arena border + glow
    const r = Math.min(14, cell * 0.5);
    c.save();
    c.shadowColor = th.borderGlow;
    c.shadowBlur = 18;
    c.strokeStyle = th.border;
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(ox - 1, oy - 1, aw + 2, ah + 2, r);
    c.stroke();
    c.restore();

    // corner brackets
    c.strokeStyle = th.bracket;
    c.lineWidth = 2.5;
    c.lineCap = "round";
    const L = Math.min(18, cell * 0.8);
    const corners: [number, number, number, number][] = [
      [ox - 6, oy - 6, 1, 1],
      [ox + aw + 6, oy - 6, -1, 1],
      [ox - 6, oy + ah + 6, 1, -1],
      [ox + aw + 6, oy + ah + 6, -1, -1],
    ];
    c.beginPath();
    for (const [x, y, sx, sy] of corners) {
      c.moveTo(x + L * sx, y);
      c.lineTo(x, y);
      c.lineTo(x, y + L * sy);
    }
    c.stroke();

    this.bg = bg;
  }

  /* ================= control ================= */

  start(opts: StartOptions = {}) {
    const level = clamp(Math.round(opts.level ?? 1), 1, MAX_LEVEL);
    this.sound.unlock();
    this.sound.start();
    this.fx.clear();
    this.phase = "playing";
    this.hud.phase = "playing";
    this.score = 0;
    this.eaten = 0;
    this.mult = 1;
    this.comboLeft = 0;
    this.acc = 0;
    this.dieIndex = 0;
    this.goldStreak = 0;
    this.mode = opts.mode ?? "arena";
    this.level = level;
    this.startLevel = level;
    this.stepMs = this.baseStep();
    this.obstacles.clear();
    this.buildBg();
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    this.prev = this.snake.map((s) => ({ ...s }));
    this.dir = DIRS.right;
    this.dirQueue = [];
    this.food = null;
    // lay the chosen arena before the first orb so food never spawns in a wall
    if (level > 1) this.applyLevel(false);
    this.spawnFood(true);
    this.refreshComboWindow();
    this.runSeconds = 0;

    // optional 3-2-1 countdown before the snake moves
    this.countdown = this.settings.countdown ? 3 : 0;
    this.lastBlip = -1;
    if (this.countdown === 0) {
      this.fx.ring(this.w / 2, this.h * 0.42, "rgba(166,255,77,0.7)", this.cell * 5, 3, 0.6);
      this.fx.floatText(this.w / 2, this.h * 0.42, "GO", "#d2ff7a", 42);
    }
    if (level > 1) this.fx.floatText(this.w / 2, this.h * 0.42 + 40, levelName(level), "#8b7bd8", 15);

    this.music.play();
    this.music.setIntensity(0);
    this.haptics.fire("ui");
    this.updateHud();
  }

  /** Starting tick interval — scaled by the speed preset; higher arenas begin faster. */
  private baseStep() {
    const f = getSpeed(this.settings.speed).factor;
    return Math.max(46, (132 - (this.level - 1) * 6) * f);
  }

  /** Fastest the snake may ever get, so INSANE stays playable. */
  private minStep() {
    return Math.max(40, 58 * getSpeed(this.settings.speed).factor);
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.hud.phase = "paused";
    this.sound.pause();
    this.music.setIntensity(0);
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.hud.phase = "playing";
    this.sound.ui();
  }

  toIdle() {
    this.phase = "idle";
    this.hud.phase = "idle";
    this.music.stop();
    this.haptics.stop();
    this.fx.clear();
    this.food = null;
    this.snake = [];
    this.prev = [];
    this.obstacles.clear();
    this.buildBg();
    this.resize();
  }

  setDirection(name: DirName) {
    if (this.phase !== "playing") return;
    const d = DIRS[name];
    const q = this.dirQueue;
    const last = q.length > 0 ? q[q.length - 1] : this.dir;
    if (d.x === -last.x && d.y === -last.y) return;
    if (d.x === last.x && d.y === last.y) return;
    if (q.length < 3) q.push(d);
  }

  /* ================= simulation ================= */

  private isFree(x: number, y: number, occupied: Set<number>) {
    return !occupied.has(key(x, y)) && !this.obstacles.has(key(x, y));
  }

  private spawnFood(first = false) {
    const occupied = new Set(this.snake.map((s) => key(s.x, s.y)));
    const head = this.snake[0] ?? { x: this.cols / 2, y: this.rows / 2 };
    let chosen: Cell | null = null;
    if (first) {
      // first bite is served right in front of you
      const x = clamp(head.x + 5, 1, this.cols - 2);
      const y = Math.round(head.y);
      if (this.isFree(x, y, occupied)) chosen = { x, y };
    }
    for (let tries = 0; !chosen && tries < 200; tries++) {
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      if (!this.isFree(x, y, occupied)) continue;
      if (!first && Math.abs(x - head.x) + Math.abs(y - head.y) < 5) continue;
      chosen = { x, y };
      break;
    }
    if (!chosen) {
      // exhaustive fallback
      outer: for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.isFree(x, y, occupied)) {
            chosen = { x, y };
            break outer;
          }
        }
      }
    }
    if (!chosen) return; // grid full — you've basically won
    const gold = !first && (Math.random() < GOLD_CHANCE || this.goldStreak >= 6);
    if (gold) this.goldStreak = 0;
    this.food = { x: chosen.x, y: chosen.y, type: gold ? "gold" : "norm", born: this.time };
    const px = this.ox + (chosen.x + 0.5) * this.cell;
    const py = this.oy + (chosen.y + 0.5) * this.cell;
    this.fx.ring(px, py, gold ? "rgba(255,210,63,0.8)" : "rgba(56,232,255,0.7)", this.cell * 1.6, 2.5, 0.45);
  }

  private tick() {
    while (this.dirQueue.length > 0) {
      const d = this.dirQueue.shift()!;
      if (!(d.x === -this.dir.x && d.y === -this.dir.y)) {
        this.dir = d;
        break;
      }
    }

    const head = this.snake[0];
    let nx = head.x + this.dir.x;
    let ny = head.y + this.dir.y;

    // walls — wrap around or die
    const offGrid = nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows;
    if (offGrid) {
      if (!this.settings.wrap) {
        this.die();
        return;
      }
      nx = (nx + this.cols) % this.cols;
      ny = (ny + this.rows) % this.rows;
    }
    if (this.obstacles.has(key(nx, ny))) {
      this.die();
      return;
    }

    const eating = this.food !== null && this.food.x === nx && this.food.y === ny;
    // self (tail cell is legal unless growing)
    const body = eating ? this.snake : this.snake.slice(0, -1);
    for (const s of body) {
      if (s.x === nx && s.y === ny) {
        this.die();
        return;
      }
    }

    this.prev = this.snake.map((s) => ({ ...s }));
    this.snake.unshift({ x: nx, y: ny });
    if (eating) {
      this.onEat(this.food!);
    } else {
      this.snake.pop();
    }
  }

  private onEat(food: Food) {
    const gold = food.type === "gold";
    this.eaten++;
    this.goldStreak++;

    // combo
    if (this.comboLeft > 0) {
     this.mult++;
this.sound.comboUp();
    } else {
      this.mult = 1;
    }
    this.comboLeft = 0;

    const points = (gold ? 50 : 10) * this.mult;
    this.score += points;

    // level progression — only in ASCENT mode; arena runs keep their chosen maze
    if (this.mode === "ascent") {
      const newLevel = Math.min(MAX_LEVEL, this.startLevel + levelForEats(this.eaten) - 1);
      if (newLevel > this.level) {
        this.level = newLevel;
        this.applyLevel(true);
      }
    }
    this.stepMs = Math.max(this.minStep(), this.baseStep() - (this.settings.ramp ? this.eaten * 1.3 : 0));

    const px = this.ox + (food.x + 0.5) * this.cell;
    const py = this.oy + (food.y + 0.5) * this.cell;
    const col: RGB = gold ? AMBER : CYAN;
    this.fx.burst(px, py, col, gold ? 34 : 18, gold ? 260 : 190, gold ? 4 : 3.2);
    if (this.mult >= 3) this.fx.burst(px, py, LIME, 10, 150, 2.6);
    this.fx.ring(px, py, gold ? "rgba(255,210,63,0.9)" : "rgba(56,232,255,0.85)", this.cell * 2.4, 3, 0.4);
    this.fx.floatText(
      px,
      py - this.cell * 0.6,
      `+${points}`,
      gold ? "#ffd23f" : "#aef6ff",
      this.cell * (gold ? 0.85 : 0.62),
    );
    this.fx.kick(gold ? 0.055 : 0.028);
    this.fx.shake(gold ? 0.16 : 0.07);

    if (gold) {
      this.sound.gold();
      this.haptics.fire("gold");
    } else {
      this.sound.eat(this.mult);
      this.haptics.fire(this.mult > 1 ? "combo" : "eat");
    }

    this.spawnFood();
    this.refreshComboWindow();
    this.updateHud();
  }

  /**
   * Combo window scales with real travel time to the next orb
   * (manhattan distance × current speed × slack), floored so
   * close orbs stay snappy and capped for cross-map treks.
   */
  private refreshComboWindow() {
    let windowSec = COMBO_MIN;
    if (this.food && this.snake.length > 0) {
      const head = this.snake[0];
      const dist = Math.abs(this.food.x - head.x) + Math.abs(this.food.y - head.y);
      const travel = (dist * this.stepMs) / 1000;
      windowSec = clamp(Math.max(windowSec, travel * COMBO_SLACK), COMBO_MIN, COMBO_MAX);
    }
    this.comboLeft = windowSec;
    this.comboTotal = windowSec;
  }

  /** Lay the current level's maze (fairly). `celebrate` fires the level-up fanfare. */
  private applyLevel(celebrate: boolean) {
    const maze = genMaze(this.level, this.cols, this.rows);

    // fairness filter — never land on the snake, in front of the head, or on food
    const head = this.snake[0];
    const bodySet = new Set(this.snake.map((s) => key(s.x, s.y)));
    for (const k of maze) {
      const x = k % 1000;
      const y = Math.floor(k / 1000);
      if (bodySet.has(k)) {
        maze.delete(k);
        continue;
      }
      if (Math.abs(x - head.x) + Math.abs(y - head.y) <= 4) {
        maze.delete(k);
        continue;
      }
      if (this.food && Math.abs(x - this.food.x) + Math.abs(y - this.food.y) <= 2) maze.delete(k);
    }
    this.obstacles = maze;
    this.buildBg();
    recordLevelReached(this.level);

    // telegraph the reshape — sparkle bursts on a sample of fresh walls
    const cells = Array.from(maze);
    for (let i = 0; i < cells.length; i += Math.max(1, Math.floor(cells.length / 14))) {
      const k = cells[i];
      const px = this.ox + ((k % 1000) + 0.5) * this.cell;
      const py = this.oy + (Math.floor(k / 1000) + 0.5) * this.cell;
      this.fx.burst(px, py, { r: 167, g: 139, b: 250 }, 3, 90, 2);
    }
    if (!celebrate) return;

    // fanfare
    this.sound.levelUp();
    this.haptics.fire("levelUp");
    this.fx.shake(0.22);
    this.fx.kick(0.05);
    this.fx.ring(this.w / 2, this.h * 0.4, "rgba(167,139,250,0.8)", this.cell * 7, 3, 0.7);
    this.fx.floatText(this.w / 2, this.h * 0.38, `LEVEL ${this.level}`, "#c4b5fd", 40);
    this.fx.floatText(this.w / 2, this.h * 0.38 + 36, levelName(this.level), "#8b7bd8", 15);
    const px = this.ox + (head.x + 0.5) * this.cell;
    const py = this.oy + (head.y + 0.5) * this.cell;
    this.fx.burst(px, py, { r: 167, g: 139, b: 250 }, 22, 230, 3);
  }

  private die() {
    this.phase = "dying";
    this.dieT = 0;
    this.dieIndex = 0;
    this.flashT = 0.16;
    this.fx.shake(0.85);
    this.fx.kick(0.085);
    this.sound.die();
    this.haptics.fire("die");
    this.updateHud();
  }

  /* ================= frame ================= */

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.time += dt;

    if (this.phase === "playing" && this.countdown > 0) {
      // frozen on the grid until the countdown clears
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastBlip) {
        this.lastBlip = n;
        if (n > 0) {
          this.sound.tick(false);
          this.haptics.fire("ui");
          this.fx.floatText(this.w / 2, this.h * 0.42, String(n), "#e8f4ff", 56);
          this.fx.ring(this.w / 2, this.h * 0.42, "rgba(232,244,255,0.5)", this.cell * 3.4, 2.5, 0.5);
        }
      }
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.sound.tick(true);
        this.haptics.fire("eat");
        this.fx.floatText(this.w / 2, this.h * 0.42, "GO", "#d2ff7a", 46);
        this.fx.ring(this.w / 2, this.h * 0.42, "rgba(166,255,77,0.75)", this.cell * 5, 3, 0.6);
        this.acc = 0;
      }
    } else if (this.phase === "playing") {
      this.runSeconds += dt;
      this.acc += dt * 1000;
      let guard = 0;
      while (this.acc >= this.stepMs && this.phase === "playing" && guard++ < 8) {
        this.tick();
        this.acc -= this.stepMs;
      }

      // combo decay
      if (this.comboLeft > 0) {
        this.comboLeft -= dt;
        if (this.comboLeft <= 0) {
          this.comboLeft = 0;
          if (this.mult > 1) this.sound.comboLost();
          this.mult = 1;
          this.updateHud();
        }
      }

      // gold expiry
      if (this.food?.type === "gold" && this.time - this.food.born > GOLD_LIFE) {
        const px = this.ox + (this.food.x + 0.5) * this.cell;
        const py = this.oy + (this.food.y + 0.5) * this.cell;
        this.fx.burst(px, py, AMBER, 8, 90, 2.4);
        this.spawnFood();
      }

      this.hud.comboFrac = this.comboTotal > 0 ? this.comboLeft / this.comboTotal : 0;
      this.hud.mult = this.mult;

      // soundtrack heats up with combo + speed
      const speedFrac = 1 - (this.stepMs - this.minStep()) / Math.max(1, this.baseStep() - this.minStep());
      const comboIntensity = clamp((this.mult - 1) / 20, 0, 1);

this.music.setIntensity(
  Math.max(comboIntensity, clamp(speedFrac, 0, 1) * 0.8)
);
      // motion trail when fast / combo
      const speedUp = 132 - this.stepMs;
      const head = this.renderPoints(1)[0];
      if (head && (this.mult >= 3 || speedUp > 50) && Math.random() < 0.5) {
        this.fx.trail(head.px, head.py, this.skin.trail);
      }
    } else if (this.phase === "dying") {
      this.dieT += dt;
      const total = Math.max(1, this.snake.length);
      const target = Math.min(total, Math.floor((this.dieT / DIE_DURATION) * total));
      while (this.dieIndex < target) {
        const seg = this.snake[this.dieIndex];
        const px = this.ox + (seg.x + 0.5) * this.cell;
        const py = this.oy + (seg.y + 0.5) * this.cell;
        this.fx.burst(px, py, this.dieIndex === 0 ? RED : this.skin.trail, this.dieIndex === 0 ? 26 : 8, 200, 3);
        this.dieIndex++;
      }
      if (this.dieT >= DIE_DURATION) {
        const score = this.score;
        const len = this.snake.length;
        const level = this.level;
        recordRun(this.eaten, this.runSeconds);
        this.music.stop();
        this.phase = "idle";
        this.hud.phase = "idle";
        this.hud.comboFrac = 0;
        this.onGameOver({ score, len, level, startLevel: this.startLevel, mode: this.mode });
      }
    } else {
      // idle ambience
      this.ambientT -= dt;
      if (this.ambientT <= 0) {
        this.ambientT = 0.16;
        this.fx.ambient(Math.random() * this.w, this.h * (0.3 + Math.random() * 0.7));
      }
    }

    if (this.flashT > 0) this.flashT -= dt;
    this.fx.update(dt);
    this.render();
  }

  private updateHud() {
    this.hud.score = this.score;
    this.hud.mult = this.mult;
    this.hud.level = this.level;
    this.hud.levelName = levelName(this.level);
    this.hud.ascent = this.mode === "ascent";
    this.hud.levelFrac =
      this.mode === "ascent" && this.level < MAX_LEVEL ? (this.eaten % EATS_PER_LEVEL) / EATS_PER_LEVEL : 0;
    this.hud.phase = this.phase;
    if (this.score > this.hud.best) this.hud.best = this.score;
  }

  /* ================= rendering ================= */

  private renderPoints(t: number): { px: number; py: number }[] {
    const n = this.snake.length;
    const pts: { px: number; py: number }[] = [];
    for (let i = 0; i < n; i++) {
      const cur = this.snake[i];
      const prv = this.prev[Math.min(i, this.prev.length - 1)] ?? cur;
      // a jump > 1 cell means this segment wrapped — snap instead of streaking
      const wrapped = Math.abs(cur.x - prv.x) > 1 || Math.abs(cur.y - prv.y) > 1;
      const x = wrapped ? cur.x : prv.x + (cur.x - prv.x) * t;
      const y = wrapped ? cur.y : prv.y + (cur.y - prv.y) * t;
      pts.push({ px: this.ox + (x + 0.5) * this.cell, py: this.oy + (y + 0.5) * this.cell });
    }
    return pts;
  }

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

    if (this.phase !== "idle") {
      if (this.food) this.drawFood();
      if (this.snake.length > 0) this.drawSnake();
    }

    this.fx.draw(ctx);
    ctx.restore();

    // death flash
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.flashT / 0.16, 0, 1) * 0.5;
      ctx.fillStyle = "#ffd7dd";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  private drawFood() {
    const f = this.food!;
    const { ctx, cell } = this;
    const px = this.ox + (f.x + 0.5) * cell;
    const py = this.oy + (f.y + 0.5) * cell;
    const gold = f.type === "gold";
    const age = this.time - f.born;
    const grow = clamp(age / 0.18, 0, 1);
    const ease = 1 - Math.pow(1 - grow, 3);
    const remaining = gold ? GOLD_LIFE - age : Infinity;
    const blink = gold && remaining < 1.6 ? (Math.sin(this.time * 18) > 0 ? 1 : 0.25) : 1;

    const base = cell * (gold ? 0.36 : 0.3) * ease;
    const pulse = 1 + 0.14 * Math.sin(this.time * (gold ? 7.5 : 5.5));
    const r = base * pulse;
    const bob = Math.sin(this.time * 2.4 + f.x) * cell * 0.045;

    ctx.save();
    ctx.globalAlpha = blink;
    const [tr, tg, tb] = this.theme.orb;
    const cr = gold ? 255 : tr;
    const cg = gold ? 210 : tg;
    const cb = gold ? 63 : tb;

    // halo
    const halo = ctx.createRadialGradient(px, py + bob, r * 0.2, px, py + bob, r * 3.1);
    halo.addColorStop(0, `rgba(${cr},${cg},${cb},0.4)`);
    halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py + bob, r * 3.1, 0, Math.PI * 2);
    ctx.fill();

    // orbit ring
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.5)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(px, py + bob, r * 1.85, r * 1.35, this.time * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    // core
    ctx.shadowColor = `rgba(${cr},${cg},${cb},0.9)`;
    ctx.shadowBlur = 16;
    const core = ctx.createRadialGradient(px - r * 0.3, py + bob - r * 0.3, r * 0.1, px, py + bob, r);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.45, `rgba(${cr},${cg},${cb},1)`);
    core.addColorStop(1, `rgba(${cr * 0.5},${cg * 0.5},${cb * 0.5},1)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(px, py + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // gold countdown arc
    if (gold) {
      const frac = clamp(remaining / GOLD_LIFE, 0, 1);
      ctx.strokeStyle = "rgba(255,246,214,0.85)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px, py + bob, r * 2.35, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSnake() {
    const { ctx, cell } = this;
    const sk = this.skin;
    const t = this.phase === "playing" ? clamp(this.acc / this.stepMs, 0, 1) : 1;
    const pts = this.renderPoints(t);

    // hide exploded segments during death
    const startIx = this.phase === "dying" ? this.dieIndex : 0;
    const vis = pts.slice(startIx);
    if (vis.length === 0) return;

    const head = vis[0];
    const tail = vis[vis.length - 1];

    // split into runs so wrapped jumps don't draw across the arena
    const maxGap = cell * 1.8;
    const runs: { px: number; py: number }[][] = [];
    let run: { px: number; py: number }[] = [vis[0]];
    for (let i = 1; i < vis.length; i++) {
      const a = vis[i - 1];
      const b = vis[i];
      if (Math.abs(a.px - b.px) > maxGap || Math.abs(a.py - b.py) > maxGap) {
        runs.push(run);
        run = [b];
      } else run.push(b);
    }
    runs.push(run);

    // build smooth path through each run
    const path = new Path2D();
    for (const r of runs) {
      if (r.length === 1) {
        path.moveTo(r[0].px - 0.01, r[0].py);
        path.lineTo(r[0].px, r[0].py);
        continue;
      }
      path.moveTo(r[0].px, r[0].py);
      for (let i = 1; i < r.length - 1; i++) {
        const mx = (r[i].px + r[i + 1].px) / 2;
        const my = (r[i].py + r[i + 1].py) / 2;
        path.quadraticCurveTo(r[i].px, r[i].py, mx, my);
      }
      path.lineTo(r[r.length - 1].px, r[r.length - 1].py);
    }

    // under-glow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.mult >= 4 ? sk.glowHot : sk.glow;
    ctx.lineWidth = cell * 0.98;
    ctx.stroke(path);
    ctx.restore();

    // body gradient
    const grad = ctx.createLinearGradient(head.px, head.py, tail.px, tail.py);
    let headCol = sk.head;
    let tailCol = sk.stops[2];
    if (sk.rainbow) {
      const base = (this.time * 80) % 360;
      grad.addColorStop(0, `hsl(${base}, 95%, 70%)`);
      grad.addColorStop(0.5, `hsl(${(base + 70) % 360}, 95%, 60%)`);
      grad.addColorStop(1, `hsl(${(base + 140) % 360}, 90%, 52%)`);
      headCol = `hsl(${base}, 95%, 76%)`;
      tailCol = `hsl(${(base + 140) % 360}, 90%, 52%)`;
    } else {
      grad.addColorStop(0, sk.stops[0]);
      grad.addColorStop(0.35, sk.stops[1]);
      grad.addColorStop(1, sk.stops[2]);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = grad;
    ctx.lineWidth = cell * 0.62;
    ctx.stroke(path);

    // spine highlight
    if (vis.length > 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = cell * 0.2;
      ctx.stroke(path);
    }

    // tail cap dot
    if (vis.length > 1) {
      ctx.fillStyle = tailCol;
      ctx.beginPath();
      ctx.arc(tail.px, tail.py, cell * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- head ----
    if (this.phase === "dying" && startIx > 0) return;
    const d = this.dir;
    const stretch = this.phase === "playing" ? 1.09 : 1;
    ctx.save();
    ctx.translate(head.px, head.py);
    const ang = Math.atan2(d.y, d.x);
    ctx.rotate(ang);
    ctx.scale(stretch, 1 / Math.sqrt(stretch));
    ctx.fillStyle = headCol;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // eyes (with periodic blink)
    this.headBlinkAt -= 1 / 60;
    const blinking = this.headBlinkAt < 0.12 && this.headBlinkAt > -0.02;
    if (this.headBlinkAt <= -0.02) this.headBlinkAt = 2.2 + Math.random() * 2.4;

    const ex = d.x;
    const ey = d.y;
    const pxv = -ey;
    const pyv = ex;
    const eo = cell * 0.19;
    const fwd = cell * 0.1;
    ctx.save();
    if (blinking) {
      ctx.strokeStyle = "#0a2b1a";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      for (const s of [-1, 1]) {
        const bx = head.px + pxv * eo * s + ex * fwd;
        const by = head.py + pyv * eo * s + ey * fwd;
        ctx.beginPath();
        ctx.moveTo(bx - pyv * cell * 0.07, by + pxv * cell * 0.07);
        ctx.lineTo(bx + pyv * cell * 0.07, by - pxv * cell * 0.07);
        ctx.stroke();
      }
    } else {
      for (const s of [-1, 1]) {
        const bx = head.px + pxv * eo * s + ex * fwd;
        const by = head.py + pyv * eo * s + ey * fwd;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.115, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#08130c";
        ctx.beginPath();
        ctx.arc(bx + ex * cell * 0.045, by + ey * cell * 0.045, cell * 0.058, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
