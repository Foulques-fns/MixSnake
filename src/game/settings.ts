/* Player settings — speed, color themes, juice toggles. Persisted per account. */

import { nsKey } from "./accounts";

export interface Theme {
  id: string;
  name: string;
  /** radial background stops: center → mid → edge */
  bg: [string, string, string];
  /** three ambient blobs */
  blobs: [string, string, string];
  grid: string;
  border: string;
  borderGlow: string;
  bracket: string;
  wall: string;
  wallEdge: string;
  wallGlow: string;
  /** normal orb color */
  orb: [number, number, number];
}

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "MIDNIGHT",
    bg: ["#0b1128", "#070a1c", "#04050c"],
    blobs: ["rgba(166,255,77,0.05)", "rgba(56,232,255,0.06)", "rgba(255,61,242,0.045)"],
    grid: "rgba(122,164,255,0.055)",
    border: "rgba(56,232,255,0.32)",
    borderGlow: "rgba(56,232,255,0.55)",
    bracket: "rgba(166,255,77,0.75)",
    wall: "rgba(96,60,190,0.34)",
    wallEdge: "rgba(167,139,250,0.6)",
    wallGlow: "rgba(139,92,246,0.55)",
    orb: [56, 232, 255],
  },
  {
    id: "synthwave",
    name: "SYNTHWAVE",
    bg: ["#2a1040", "#170a2c", "#0a0416"],
    blobs: ["rgba(255,61,242,0.09)", "rgba(255,143,64,0.06)", "rgba(94,45,255,0.08)"],
    grid: "rgba(255,110,240,0.07)",
    border: "rgba(255,61,242,0.4)",
    borderGlow: "rgba(255,61,242,0.6)",
    bracket: "rgba(255,196,64,0.8)",
    wall: "rgba(150,32,140,0.4)",
    wallEdge: "rgba(255,140,240,0.65)",
    wallGlow: "rgba(255,61,242,0.6)",
    orb: [255, 196, 64],
  },
  {
    id: "matrix",
    name: "MATRIX",
    bg: ["#04160c", "#020d07", "#010603"],
    blobs: ["rgba(60,255,130,0.07)", "rgba(20,200,90,0.06)", "rgba(120,255,180,0.04)"],
    grid: "rgba(60,255,130,0.07)",
    border: "rgba(60,255,130,0.35)",
    borderGlow: "rgba(60,255,130,0.5)",
    bracket: "rgba(190,255,210,0.7)",
    wall: "rgba(20,120,60,0.4)",
    wallEdge: "rgba(90,255,150,0.6)",
    wallGlow: "rgba(60,255,130,0.5)",
    orb: [140, 255, 170],
  },
  {
    id: "ice",
    name: "GLACIER",
    bg: ["#0c2036", "#071426", "#030a14"],
    blobs: ["rgba(120,220,255,0.07)", "rgba(90,150,255,0.06)", "rgba(200,240,255,0.04)"],
    grid: "rgba(150,220,255,0.07)",
    border: "rgba(150,225,255,0.36)",
    borderGlow: "rgba(150,225,255,0.55)",
    bracket: "rgba(230,250,255,0.8)",
    wall: "rgba(40,110,175,0.4)",
    wallEdge: "rgba(170,225,255,0.65)",
    wallGlow: "rgba(120,200,255,0.55)",
    orb: [180, 240, 255],
  },
  {
    id: "ember",
    name: "MAGMA",
    bg: ["#30110a", "#1c0a06", "#0b0403"],
    blobs: ["rgba(255,140,40,0.08)", "rgba(255,60,40,0.07)", "rgba(255,200,80,0.045)"],
    grid: "rgba(255,150,80,0.06)",
    border: "rgba(255,140,60,0.38)",
    borderGlow: "rgba(255,110,40,0.6)",
    bracket: "rgba(255,215,120,0.8)",
    wall: "rgba(160,50,20,0.42)",
    wallEdge: "rgba(255,160,90,0.65)",
    wallGlow: "rgba(255,110,40,0.55)",
    orb: [255, 180, 90],
  },
  {
    id: "mono",
    name: "CARBON",
    bg: ["#1a1d24", "#101218", "#06070a"],
    blobs: ["rgba(220,230,255,0.045)", "rgba(180,195,225,0.04)", "rgba(255,255,255,0.03)"],
    grid: "rgba(200,215,245,0.06)",
    border: "rgba(225,235,255,0.3)",
    borderGlow: "rgba(225,235,255,0.4)",
    bracket: "rgba(255,255,255,0.75)",
    wall: "rgba(110,120,145,0.38)",
    wallEdge: "rgba(215,225,245,0.6)",
    wallGlow: "rgba(200,215,245,0.45)",
    orb: [235, 243, 255],
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/* ---------------- speed ---------------- */

export interface SpeedPreset {
  id: string;
  name: string;
  desc: string;
  /** multiplier on the tick interval — lower = faster */
  factor: number;
}

export const SPEEDS: SpeedPreset[] = [
  { id: "chill", name: "CHILL", desc: "Relaxed pace", factor: 1.34 },
  { id: "normal", name: "NORMAL", desc: "The classic feel", factor: 1 },
  { id: "fast", name: "FAST", desc: "Sharp reflexes", factor: 0.78 },
  { id: "insane", name: "INSANE", desc: "Blink and you're gone", factor: 0.6 },
];

export function getSpeed(id: string): SpeedPreset {
  return SPEEDS.find((s) => s.id === id) ?? SPEEDS[1];
}

/* ---------------- settings ---------------- */

export interface Settings {
  speed: string;
  theme: string;
  /** speed ramps up as you eat */
  ramp: boolean;
  /** pass through walls instead of dying */
  wrap: boolean;
  shake: boolean;
  particles: boolean;
  scanlines: boolean;
  grid: boolean;
  countdown: boolean;

  /* audio */
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  /** track id, or "off" */
  music: string;

  /* device */
  haptics: "off" | "light" | "strong";
  touchMode: "swipe" | "dpad";

  /* locale — "auto" follows the browser */
  lang: string;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: "normal",
  theme: "midnight",
  ramp: true,
  wrap: false,
  shake: true,
  particles: true,
  scanlines: true,
  grid: true,
  countdown: true,

  masterVol: 0.85,
  musicVol: 0.45,
  sfxVol: 0.8,
  music: "drive",

  haptics: "light",
  touchMode: "swipe",

  lang: "auto",
};

const KEY = "neon-serpent:settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(nsKey(KEY));
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(nsKey(KEY), JSON.stringify(s));
  } catch {
    /* private mode */
  }
}
