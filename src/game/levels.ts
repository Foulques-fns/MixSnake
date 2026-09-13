/* Level progression — mazes adapt to any grid size, endless after level 8. */

export const EATS_PER_LEVEL = 8;

export function levelForEats(eaten: number): number {
  return 1 + Math.floor(eaten / EATS_PER_LEVEL);
}

const NAMES = [
  "OPEN GRID",
  "PILLARS",
  "CROSSFIRE",
  "SLALOM",
  "THE VAULT",
  "COLONNADE",
  "MINEFIELD",
  "SPIRAL",
  "OVERDRIVE",
];

export function levelName(level: number): string {
  return NAMES[Math.min(level, NAMES.length) - 1];
}

export const MAX_LEVEL = NAMES.length;

export interface LevelInfo {
  level: number;
  name: string;
  desc: string;
  /** score needed on this arena to unlock the next one */
  target: number;
}

const DESCS = [
  "No walls. Pure speed.",
  "Four blocks. Learn the weave.",
  "A cross that splits the field.",
  "Staggered bars, alternating gaps.",
  "Fortress walls with four doors.",
  "Columns hanging from both edges.",
  "Scattered mines. Watch your tail.",
  "Nested rings. The gauntlet.",
  "Random chaos. Endless.",
];

const TARGETS = [100, 150, 200, 250, 300, 350, 400, 500, 0];

export const LEVELS: LevelInfo[] = NAMES.map((name, i) => ({
  level: i + 1,
  name,
  desc: DESCS[i],
  target: TARGETS[i],
}));

/** An arena is playable if it's the first, or you hit the previous one's target. */
export function isLevelUnlocked(level: number, bests: Record<number, number>, bestLevel: number): boolean {
  if (level <= 1) return true;
  if (bestLevel >= level) return true; // reached it via ASCENT mode
  const prev = LEVELS[level - 2];
  return (bests[prev.level] ?? 0) >= prev.target;
}

/** Returns a set of obstacle cells keyed as x + y * 1000. */
export function genMaze(level: number, cols: number, rows: number): Set<number> {
  const s = new Set<number>();
  const add = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && yi >= 0 && xi < cols && yi < rows) s.add(xi + yi * 1000);
  };
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  switch (level) {
    case 1:
      break;

    case 2: {
      // four 2x2 pillars in the quadrants
      for (const fx of [0.25, 0.75]) {
        for (const fy of [0.33, 0.67]) {
          const px = Math.round(cols * fx);
          const py = Math.round(rows * fy);
          for (const dx of [0, 1]) for (const dy of [0, 1]) add(px + dx, py + dy);
        }
      }
      break;
    }

    case 3: {
      // cross with a wide opening at center
      for (let x = 0; x < cols; x++) if (Math.abs(x - cx) > 3) add(x, cy);
      for (let y = 0; y < rows; y++) if (Math.abs(y - cy) > 3) add(cx, y);
      break;
    }

    case 4: {
      // alternating horizontal bars, gap flips side
      const span = Math.round(cols * 0.68);
      [0.25, 0.5, 0.75].forEach((fy, i) => {
        const y = Math.round(rows * fy);
        if (i % 2 === 0) for (let x = 0; x < span; x++) add(x, y);
        else for (let x = cols - span; x < cols; x++) add(x, y);
      });
      break;
    }

    case 5: {
      // inset ring with doorways on each side
      const b = 3;
      for (let x = b; x < cols - b; x++) {
        if (Math.abs(x - cx) > 2) {
          add(x, b);
          add(x, rows - 1 - b);
        }
      }
      for (let y = b; y < rows - b; y++) {
        if (Math.abs(y - cy) > 2) {
          add(b, y);
          add(cols - 1 - b, y);
        }
      }
      break;
    }

    case 6: {
      // vertical columns, anchored top/bottom alternating
      const span = Math.round(rows * 0.6);
      [0.25, 0.5, 0.75].forEach((fx, i) => {
        const x = Math.round(cols * fx);
        if (i % 2 === 0) for (let y = 0; y < span; y++) add(x, y);
        else for (let y = rows - span; y < rows; y++) add(x, y);
      });
      break;
    }

    case 7: {
      // lattice of single mines
      let row = 0;
      for (let y = 2; y < rows - 1; y += 4, row++) {
        for (let x = 2 + (row % 2) * 2; x < cols - 1; x += 4) add(x, y);
      }
      break;
    }

    case 8: {
      // nested rings with rotating corner gaps — a loose spiral
      for (let k = 3; k * 2 < Math.min(cols, rows) - 2; k += 3) {
        const gapAt = (k / 3) % 4;
        for (let x = k; x < cols - k; x++) {
          if (!(gapAt === 0 && x > cols - k - 4)) add(x, k);
          if (!(gapAt === 1 && x > cols - k - 4)) add(x, rows - 1 - k);
        }
        for (let y = k; y < rows - k; y++) {
          if (!(gapAt === 2 && y > rows - k - 4)) add(k, y);
          if (!(gapAt === 3 && y > rows - k - 4)) add(cols - 1 - k, y);
        }
      }
      break;
    }

    default: {
      // OVERDRIVE: endless random scatter, denser with each level
      const p = Math.min(0.1, 0.035 + (level - 8) * 0.008);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (Math.abs(x - cx) + Math.abs(y - cy) < 5) continue;
          if (Math.random() < p) add(x, y);
        }
      }
      break;
    }
  }
  return s;
}
