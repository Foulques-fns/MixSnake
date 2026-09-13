/* Phone vibration feedback. Gracefully no-ops where unsupported (iOS Safari). */

export type HapticLevel = "off" | "light" | "strong";

export type HapticCue = "eat" | "gold" | "levelUp" | "die" | "ui" | "combo";

const PATTERNS: Record<HapticCue, { light: number | number[]; strong: number | number[] }> = {
  eat: { light: 8, strong: 18 },
  gold: { light: [10, 30, 14], strong: [22, 30, 34] },
  combo: { light: 5, strong: 10 },
  levelUp: { light: [12, 40, 12, 40, 18], strong: [26, 40, 26, 40, 48] },
  die: { light: [20, 50, 40], strong: [60, 55, 110] },
  ui: { light: 4, strong: 9 },
};

export class Haptics {
  level: HapticLevel = "light";
  private supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  get available() {
    return this.supported;
  }

  setLevel(l: HapticLevel) {
    this.level = l;
  }

  fire(cue: HapticCue) {
    if (!this.supported || this.level === "off") return;
    const p = PATTERNS[cue][this.level];
    try {
      navigator.vibrate(p);
    } catch {
      /* some browsers throw when the page is hidden */
    }
  }

  stop() {
    if (!this.supported) return;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}
