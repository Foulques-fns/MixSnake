/* Ranked ladder — trophies, tiers and the duel record. Per-account. */

import { nsKey, loadAccounts } from "./accounts";

const KEY = "neon-serpent:duel:v1";

export interface DuelRecord {
  trophies: number;
  peak: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
}

const EMPTY: DuelRecord = { trophies: 0, peak: 0, wins: 0, losses: 0, draws: 0, streak: 0 };

export interface Tier {
  id: string;
  name: string;
  min: number;
  color: string;
  glow: string;
}

export const TIERS: Tier[] = [
  { id: "bronze", name: "BRONZE", min: 0, color: "#cd7f32", glow: "rgba(205,127,50,0.5)" },
  { id: "silver", name: "SILVER", min: 150, color: "#c3ccdb", glow: "rgba(195,204,219,0.5)" },
  { id: "gold", name: "GOLD", min: 350, color: "#ffd23f", glow: "rgba(255,210,63,0.55)" },
  { id: "platinum", name: "PLATINUM", min: 600, color: "#5eead4", glow: "rgba(94,234,212,0.55)" },
  { id: "diamond", name: "DIAMOND", min: 900, color: "#38e8ff", glow: "rgba(56,232,255,0.6)" },
  { id: "master", name: "MASTER", min: 1300, color: "#c084fc", glow: "rgba(192,132,252,0.6)" },
  { id: "grandmaster", name: "GRANDMASTER", min: 1800, color: "#ff3df2", glow: "rgba(255,61,242,0.65)" },
];

export function tierFor(trophies: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (trophies >= x.min) t = x;
  return t;
}

export function nextTier(trophies: number): Tier | null {
  return TIERS.find((x) => x.min > trophies) ?? null;
}

export function loadDuel(): DuelRecord {
  try {
    const raw = localStorage.getItem(nsKey(KEY));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DuelRecord>) };
  } catch {
    return { ...EMPTY };
  }
}

function write(r: DuelRecord) {
  try {
    localStorage.setItem(nsKey(KEY), JSON.stringify(r));
  } catch {
    /* private mode */
  }
}

/** Trophies swing less the higher you climb, and a win streak adds a bonus. */
export function trophyDelta(result: "win" | "loss" | "draw", trophies: number, streak: number): number {
  if (result === "draw") return 0;
  const tier = TIERS.indexOf(tierFor(trophies));
  if (result === "win") {
    const base = Math.max(12, 32 - tier * 3);
    return base + Math.min(10, Math.max(0, streak) * 2);
  }
  const base = Math.min(28, 12 + tier * 2.5);
  return -Math.round(base);
}

/** Applies a ranked result. Returns the record plus the trophy swing. */
export function recordDuel(result: "win" | "loss" | "draw", ranked: boolean) {
  const r = loadDuel();
  if (result === "win") r.wins++;
  else if (result === "loss") r.losses++;
  else r.draws++;

  let delta = 0;
  if (ranked) {
    delta = Math.round(trophyDelta(result, r.trophies, r.streak));
    r.trophies = Math.max(0, r.trophies + delta);
    r.peak = Math.max(r.peak, r.trophies);
  }
  if (result === "win") r.streak = Math.max(0, r.streak) + 1;
  else if (result === "loss") r.streak = 0;

  write(r);
  return { record: r, delta };
}

/* ---------------- world ladder (all local profiles) ---------------- */

export interface LadderRow {
  id: string;
  name: string;
  trophies: number;
  wins: number;
  losses: number;
  tier: Tier;
}

export function loadLadder(): LadderRow[] {
  const rows: LadderRow[] = [];
  for (const a of loadAccounts()) {
    let rec = { ...EMPTY };
    try {
      const raw = localStorage.getItem(`neon-serpent:u:${a.id}:${KEY}`);
      if (raw) rec = { ...EMPTY, ...(JSON.parse(raw) as Partial<DuelRecord>) };
    } catch {
      /* skip */
    }
    rows.push({
      id: a.id,
      name: a.name,
      trophies: rec.trophies,
      wins: rec.wins,
      losses: rec.losses,
      tier: tierFor(rec.trophies),
    });
  }
  return rows.sort((x, y) => y.trophies - x.trophies);
}
