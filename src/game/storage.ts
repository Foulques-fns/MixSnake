/* Local high-score + stats persistence — top 8 runs kept.
   All keys are namespaced per signed-in account (see accounts.ts). */

import { nsKey } from "./accounts";

const KEY = "neon-serpent:scores:v1";
const STATS_KEY = "neon-serpent:stats:v1";

export interface ScoreEntry {
  score: number;
  len: number;
  date: number;
  lvl?: number;
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(nsKey(KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ScoreEntry =>
          typeof e === "object" && e !== null && typeof (e as ScoreEntry).score === "number",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/** Inserts a run. Returns the rank (0-based) or -1 if it didn't make the table. */
export function saveScore(score: number, len: number, lvl = 1): { list: ScoreEntry[]; rank: number } {
  const list = loadScores();
  const entry: ScoreEntry = { score, len, date: Date.now(), lvl };
  if (score > 0) list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 8);
  const rank = score > 0 ? trimmed.indexOf(entry) : -1;
  try {
    localStorage.setItem(nsKey(KEY), JSON.stringify(trimmed));
  } catch {
    /* private mode */
  }
  return { list: trimmed, rank };
}

export function bestScore(): number {
  const list = loadScores();
  return list.length > 0 ? list[0].score : 0;
}

/* ---------------- stats (skin unlocks) ---------------- */

export interface Stats {
  bestLevel: number;
  runs: number;
  orbs: number;
  /** total seconds played */
  seconds: number;
}

const EMPTY_STATS: Stats = { bestLevel: 1, runs: 0, orbs: 0, seconds: 0 };

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(nsKey(STATS_KEY));
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      bestLevel: typeof parsed.bestLevel === "number" ? Math.max(1, parsed.bestLevel) : 1,
      runs: typeof parsed.runs === "number" ? parsed.runs : 0,
      orbs: typeof parsed.orbs === "number" ? parsed.orbs : 0,
      seconds: typeof parsed.seconds === "number" ? parsed.seconds : 0,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function writeStats(s: Stats) {
  try {
    localStorage.setItem(nsKey(STATS_KEY), JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

/** Tally a finished run into lifetime stats. */
export function recordRun(orbs: number, seconds: number): Stats {
  const s = loadStats();
  s.runs += 1;
  s.orbs += orbs;
  s.seconds += Math.round(seconds);
  writeStats(s);
  return s;
}

/** Wipes every saved key — scores, stats, unlocks, settings, skin. */
export function eraseAllData() {
  for (const k of [
    KEY,
    STATS_KEY,
    LEVEL_BESTS_KEY,
    "neon-serpent:settings:v1",
    "neon-serpent:skin",
    "neon-serpent:muted",
  ]) {
    try {
      localStorage.removeItem(nsKey(k));
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- per-arena bests (level unlocks) ---------------- */

const LEVEL_BESTS_KEY = "neon-serpent:levelbests:v1";

export function loadLevelBests(): Record<number, number> {
  try {
    const raw = localStorage.getItem(nsKey(LEVEL_BESTS_KEY));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(k);
      if (Number.isFinite(n) && typeof v === "number") out[n] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function recordLevelScore(level: number, score: number): Record<number, number> {
  const bests = loadLevelBests();
  if (score > (bests[level] ?? 0)) {
    bests[level] = score;
    try {
      localStorage.setItem(nsKey(LEVEL_BESTS_KEY), JSON.stringify(bests));
    } catch {
      /* private mode */
    }
  }
  return bests;
}

export function recordLevelReached(level: number): number {
  const stats = loadStats();
  if (level > stats.bestLevel) {
    stats.bestLevel = level;
    try {
      localStorage.setItem(nsKey(STATS_KEY), JSON.stringify(stats));
    } catch {
      /* private mode */
    }
  }
  return stats.bestLevel;
}
