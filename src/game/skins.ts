/* Serpent skins — unlockable looks, persisted selection. */

import { nsKey } from "./accounts";

type RGB = {
  r: number;
  g: number;
  b: number;
};

export interface Skin {
  id: string;
  name: string;
  tagline: string;

  /** Body gradient stops: head → mid → tail */
  stops: [string, string, string];

  /** Head color */
  head: string;

  /** Normal glow */
  glow: string;

  /** Strong glow */
  glowHot: string;

  /** Trail RGB color */
  trail: RGB;

  /** Special rainbow rendering */
  rainbow?: boolean;

  /** Unlock requirement */
  unlock:
    | { type: "default" }
    | { type: "score"; value: number }
    | { type: "level"; value: number };
}

export const SKINS: Skin[] = [
  // ============================================================
  // DEFAULT SKINS
  // ============================================================

  {
    id: "viper",
    name: "VIPER",
    tagline: "The classic neon strain.",
    stops: ["#d2ff7a", "#6ef58b", "#0dbfa5"],
    head: "#d8ff85",
    glow: "rgba(110,245,139,0.10)",
    glowHot: "rgba(166,255,77,0.17)",
    trail: {
      r: 166,
      g: 255,
      b: 77,
    },
    unlock: { type: "default" },
  },

  {
    id: "aurora",
    name: "AURORA",
    tagline: "Cold light, quick strikes.",
    stops: ["#bff4ff", "#38bdf8", "#4f46e5"],
    head: "#d6f9ff",
    glow: "rgba(56,189,248,0.10)",
    glowHot: "rgba(56,232,255,0.17)",
    trail: {
      r: 56,
      g: 232,
      b: 255,
    },
    unlock: { type: "default" },
  },

  // ============================================================
  // SCORE 100
  // ============================================================

  {
    id: "toxic",
    name: "TOXIC",
    tagline: "Radioactive energy in every coil.",
    stops: ["#efff8a", "#a3e635", "#3f6212"],
    head: "#f4ffb0",
    glow: "rgba(163,230,53,0.11)",
    glowHot: "rgba(190,255,70,0.20)",
    trail: {
      r: 163,
      g: 230,
      b: 53,
    },
    unlock: {
      type: "score",
      value: 100,
    },
  },

  // ============================================================
  // LEVEL 2
  // ============================================================

  {
    id: "ocean",
    name: "OCEAN",
    tagline: "Deep blue. Endless motion.",
    stops: ["#b6f3ff", "#06b6d4", "#075985"],
    head: "#d5fbff",
    glow: "rgba(6,182,212,0.11)",
    glowHot: "rgba(34,211,238,0.20)",
    trail: {
      r: 34,
      g: 211,
      b: 238,
    },
    unlock: {
      type: "level",
      value: 2,
    },
  },

  // ============================================================
  // SCORE 250
  // ============================================================

  {
    id: "ember",
    name: "EMBER",
    tagline: "Burns through the grid.",
    stops: ["#ffd166", "#ff7847", "#e11d48"],
    head: "#ffe29a",
    glow: "rgba(255,120,71,0.10)",
    glowHot: "rgba(255,170,60,0.18)",
    trail: {
      r: 255,
      g: 150,
      b: 70,
    },
    unlock: {
      type: "score",
      value: 250,
    },
  },

  {
    id: "frost",
    name: "FROST",
    tagline: "Cold-blooded and razor sharp.",
    stops: ["#f0fdff", "#67e8f9", "#0891b2"],
    head: "#ffffff",
    glow: "rgba(103,232,249,0.11)",
    glowHot: "rgba(165,243,252,0.21)",
    trail: {
      r: 103,
      g: 232,
      b: 249,
    },
    unlock: {
      type: "score",
      value: 250,
    },
  },

  // ============================================================
  // LEVEL 3
  // ============================================================

  {
    id: "sakura",
    name: "SAKURA",
    tagline: "Soft petals, hard edges.",
    stops: ["#ffe3f1", "#f9a8d4", "#c026d3"],
    head: "#fff0f7",
    glow: "rgba(249,168,212,0.10)",
    glowHot: "rgba(255,150,220,0.18)",
    trail: {
      r: 249,
      g: 168,
      b: 212,
    },
    unlock: {
      type: "level",
      value: 3,
    },
  },

  {
    id: "venom",
    name: "VENOM",
    tagline: "One bite. Game over.",
    stops: ["#d9f99d", "#65a30d", "#14532d"],
    head: "#ecfccb",
    glow: "rgba(101,163,13,0.11)",
    glowHot: "rgba(132,204,22,0.20)",
    trail: {
      r: 132,
      g: 204,
      b: 22,
    },
    unlock: {
      type: "level",
      value: 3,
    },
  },

  // ============================================================
  // SCORE 400
  // ============================================================

  {
    id: "bloodmoon",
    name: "BLOODMOON",
    tagline: "A crimson light in the darkness.",
    stops: ["#fecaca", "#ef4444", "#7f1d1d"],
    head: "#fee2e2",
    glow: "rgba(239,68,68,0.11)",
    glowHot: "rgba(248,113,113,0.21)",
    trail: {
      r: 239,
      g: 68,
      b: 68,
    },
    unlock: {
      type: "score",
      value: 400,
    },
  },

  // ============================================================
  // LEVEL 4
  // ============================================================

  {
    id: "electric",
    name: "ELECTRIC",
    tagline: "Charged beyond control.",
    stops: ["#fef08a", "#22d3ee", "#2563eb"],
    head: "#ffffff",
    glow: "rgba(34,211,238,0.12)",
    glowHot: "rgba(250,204,21,0.22)",
    trail: {
      r: 34,
      g: 211,
      b: 238,
    },
    unlock: {
      type: "level",
      value: 4,
    },
  },

  {
    id: "amethyst",
    name: "AMETHYST",
    tagline: "Rare energy from another world.",
    stops: ["#f5d0fe", "#c084fc", "#6b21a8"],
    head: "#faf5ff",
    glow: "rgba(192,132,252,0.12)",
    glowHot: "rgba(216,180,254,0.22)",
    trail: {
      r: 192,
      g: 132,
      b: 252,
    },
    unlock: {
      type: "level",
      value: 4,
    },
  },

  // ============================================================
  // SCORE 600
  // ============================================================

  {
    id: "nova",
    name: "NOVA",
    tagline: "Matter from the deep void.",
    stops: ["#e0e7ff", "#a78bfa", "#4c1d95"],
    head: "#eef1ff",
    glow: "rgba(167,139,250,0.11)",
    glowHot: "rgba(167,139,250,0.20)",
    trail: {
      r: 167,
      g: 139,
      b: 250,
    },
    unlock: {
      type: "score",
      value: 600,
    },
  },

  {
    id: "plasma",
    name: "PLASMA",
    tagline: "Pure unstable energy.",
    stops: ["#fef3c7", "#f97316", "#c026d3"],
    head: "#fff7ed",
    glow: "rgba(249,115,22,0.12)",
    glowHot: "rgba(244,114,182,0.22)",
    trail: {
      r: 249,
      g: 115,
      b: 22,
    },
    unlock: {
      type: "score",
      value: 600,
    },
  },

  // ============================================================
  // LEVEL 5
  // ============================================================

  {
    id: "midas",
    name: "MIDAS",
    tagline: "Everything it touches turns gold.",
    stops: ["#fff3b0", "#ffd23f", "#b45309"],
    head: "#fff7cc",
    glow: "rgba(255,210,63,0.11)",
    glowHot: "rgba(255,220,90,0.20)",
    trail: {
      r: 255,
      g: 210,
      b: 63,
    },
    unlock: {
      type: "level",
      value: 5,
    },
  },

  {
    id: "royal",
    name: "ROYAL",
    tagline: "Built for the top of the leaderboard.",
    stops: ["#ddd6fe", "#8b5cf6", "#312e81"],
    head: "#f5f3ff",
    glow: "rgba(139,92,246,0.12)",
    glowHot: "rgba(167,139,250,0.22)",
    trail: {
      r: 139,
      g: 92,
      b: 246,
    },
    unlock: {
      type: "level",
      value: 5,
    },
  },

  // ============================================================
  // SCORE 900
  // ============================================================

  {
    id: "cyber",
    name: "CYBER",
    tagline: "Digital venom from the future.",
    stops: ["#67e8f9", "#06b6d4", "#ec4899"],
    head: "#cffafe",
    glow: "rgba(6,182,212,0.12)",
    glowHot: "rgba(236,72,153,0.22)",
    trail: {
      r: 6,
      g: 182,
      b: 212,
    },
    unlock: {
      type: "score",
      value: 900,
    },
  },

  {
    id: "inferno",
    name: "INFERNO",
    tagline: "The grid cannot contain the heat.",
    stops: ["#fef08a", "#f97316", "#991b1b"],
    head: "#fff7ed",
    glow: "rgba(249,115,22,0.13)",
    glowHot: "rgba(251,146,60,0.24)",
    trail: {
      r: 249,
      g: 115,
      b: 22,
    },
    unlock: {
      type: "score",
      value: 900,
    },
  },

  // ============================================================
  // LEVEL 6
  // ============================================================

  {
    id: "glacier",
    name: "GLACIER",
    tagline: "Frozen motion at impossible speed.",
    stops: ["#ffffff", "#93c5fd", "#1d4ed8"],
    head: "#ffffff",
    glow: "rgba(147,197,253,0.13)",
    glowHot: "rgba(191,219,254,0.24)",
    trail: {
      r: 147,
      g: 197,
      b: 253,
    },
    unlock: {
      type: "level",
      value: 6,
    },
  },

  // ============================================================
  // SCORE 1200
  // ============================================================

  {
    id: "void",
    name: "VOID",
    tagline: "Nothing escapes the darkness.",
    stops: ["#e9d5ff", "#581c87", "#09090b"],
    head: "#f5f3ff",
    glow: "rgba(168,85,247,0.12)",
    glowHot: "rgba(126,34,206,0.24)",
    trail: {
      r: 168,
      g: 85,
      b: 247,
    },
    unlock: {
      type: "score",
      value: 1200,
    },
  },

  {
    id: "neon",
    name: "NEON",
    tagline: "Pure arcade energy.",
    stops: ["#f0abfc", "#e879f9", "#22d3ee"],
    head: "#ffffff",
    glow: "rgba(232,121,249,0.13)",
    glowHot: "rgba(34,211,238,0.24)",
    trail: {
      r: 232,
      g: 121,
      b: 249,
    },
    unlock: {
      type: "score",
      value: 1200,
    },
  },

  // ============================================================
  // LEVEL 7
  // ============================================================

  {
    id: "phantom",
    name: "PHANTOM",
    tagline: "Seen for a second. Gone forever.",
    stops: ["#f1f5f9", "#94a3b8", "#334155"],
    head: "#ffffff",
    glow: "rgba(148,163,184,0.12)",
    glowHot: "rgba(226,232,240,0.22)",
    trail: {
      r: 148,
      g: 163,
      b: 184,
    },
    unlock: {
      type: "level",
      value: 7,
    },
  },

  // ============================================================
  // SCORE 1500
  // ============================================================

  {
    id: "prism",
    name: "PRISM",
    tagline: "All colors. No mercy.",
    stops: ["#ff5db1", "#ffd23f", "#38e8ff"],
    head: "#ffffff",
    glow: "rgba(255,255,255,0.10)",
    glowHot: "rgba(255,255,255,0.20)",
    trail: {
      r: 232,
      g: 244,
      b: 255,
    },
    rainbow: true,
    unlock: {
      type: "score",
      value: 1500,
    },
  },

  // ============================================================
  // LEVEL 8
  // ============================================================

  {
    id: "celestial",
    name: "CELESTIAL",
    tagline: "A serpent among the stars.",
    stops: ["#fef9c3", "#60a5fa", "#7c3aed"],
    head: "#ffffff",
    glow: "rgba(96,165,250,0.13)",
    glowHot: "rgba(196,181,253,0.24)",
    trail: {
      r: 96,
      g: 165,
      b: 250,
    },
    unlock: {
      type: "level",
      value: 8,
    },
  },

  // ============================================================
  // SCORE 2000
  // ============================================================

  {
    id: "overdrive",
    name: "OVERDRIVE",
    tagline: "Maximum speed. Zero hesitation.",
    stops: ["#fef2f2", "#fb7185", "#7c3aed"],
    head: "#ffffff",
    glow: "rgba(251,113,133,0.14)",
    glowHot: "rgba(196,181,253,0.25)",
    trail: {
      r: 251,
      g: 113,
      b: 133,
    },
    unlock: {
      type: "score",
      value: 2000,
    },
  },

  // ============================================================
  // LEVEL 10 — ELITE
  // ============================================================

  {
    id: "legend",
    name: "LEGEND",
    tagline: "Earned, never given.",
    stops: ["#ffffff", "#facc15", "#b45309"],
    head: "#ffffff",
    glow: "rgba(250,204,21,0.14)",
    glowHot: "rgba(255,255,255,0.26)",
    trail: {
      r: 250,
      g: 204,
      b: 21,
    },
    unlock: {
      type: "level",
      value: 10,
    },
  },

  // ============================================================
  // SCORE 3000 — MASTER
  // ============================================================

  {
    id: "cosmic",
    name: "COSMIC",
    tagline: "Beyond the limits of the grid.",
    stops: ["#ffffff", "#818cf8", "#ec4899"],
    head: "#ffffff",
    glow: "rgba(129,140,248,0.15)",
    glowHot: "rgba(236,72,153,0.26)",
    trail: {
      r: 129,
      g: 140,
      b: 248,
    },
    unlock: {
      type: "score",
      value: 3000,
    },
  },

  // ============================================================
  // LEVEL 15 — MYTHIC
  // ============================================================

  {
    id: "mythic",
    name: "MYTHIC",
    tagline: "Only the relentless reach this far.",
    stops: ["#fef3c7", "#f472b6", "#7c3aed"],
    head: "#ffffff",
    glow: "rgba(244,114,182,0.15)",
    glowHot: "rgba(250,204,21,0.27)",
    trail: {
      r: 244,
      g: 114,
      b: 182,
    },
    unlock: {
      type: "level",
      value: 15,
    },
  },
];

const SKIN_KEY = "neon-serpent:skin";

/**
 * Returns a skin by its ID.
 * Falls back to the default skin if the ID doesn't exist.
 */
export function getSkin(id: string): Skin {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}

/**
 * Loads the currently selected skin from localStorage.
 */
export function loadSkinId(): string {
  try {
    return localStorage.getItem(nsKey(SKIN_KEY)) || SKINS[0].id;
  } catch {
    return SKINS[0].id;
  }
}

/**
 * Saves the currently selected skin.
 */
export function saveSkinId(id: string) {
  try {
    localStorage.setItem(nsKey(SKIN_KEY), id);
  } catch {
    /* Ignore private browsing / unavailable storage */
  }
}

/**
 * Checks whether a skin is unlocked.
 */
export function isUnlocked(
  skin: Skin,
  bestScore: number,
  bestLevel: number,
): boolean {
  if (skin.unlock.type === "default") {
    return true;
  }

  if (skin.unlock.type === "score") {
    return bestScore >= skin.unlock.value;
  }

  if (skin.unlock.type === "level") {
    return bestLevel >= skin.unlock.value;
  }

  return false;
}

/**
 * Returns the text displayed for a locked skin.
 */
export function unlockHint(skin: Skin): string {
  if (skin.unlock.type === "score") {
    return `SCORE ${skin.unlock.value}+`;
  }

  if (skin.unlock.type === "level") {
    return `REACH LEVEL ${skin.unlock.value}`;
  }

  return "";
}
