/* Tiny synthesized SFX engine — no audio assets, pure WebAudio.
   Owns the shared AudioContext and the master / music / sfx gain buses. */

import { nsKey } from "./accounts";

const MUTE_KEY = "neon-serpent:muted";

interface ToneOpts {
  freq: number;
  end?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
  attack?: number;
}

export class SoundFX {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** public buses so the music engine can plug in */
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;

  muted: boolean;
  private masterVol = 0.85;
  private musicVol = 0.5;
  private sfxVol = 0.8;

  onUnlock: (() => void) | null = null;

  constructor() {
    this.muted = typeof localStorage !== "undefined" && localStorage.getItem(nsKey(MUTE_KEY)) === "1";
  }

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVol;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVol;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);

      this.onUnlock?.();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /* ---------------- volumes ---------------- */

  private ramp(node: GainNode | null, v: number) {
    if (!node || !this.ctx) return;
    node.gain.cancelScheduledValues(this.ctx.currentTime);
    node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMasterVolume(v: number) {
    this.masterVol = v;
    this.ramp(this.master, this.muted ? 0 : v);
  }

  setMusicVolume(v: number) {
    this.musicVol = v;
    this.ramp(this.musicBus, v);
  }

  setSfxVolume(v: number) {
    this.sfxVol = v;
    this.ramp(this.sfxBus, v);
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(nsKey(MUTE_KEY), m ? "1" : "0");
    } catch {
      /* private mode */
    }
    this.ramp(this.master, m ? 0 : this.masterVol);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ---------------- synth primitives ---------------- */

  private tone({ freq, end, dur = 0.1, type = "square", vol = 0.16, delay = 0, attack = 0.004 }: ToneOpts) {
    if (!this.ctx || !this.sfxBus) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur = 0.35, vol = 0.3, delay = 0) {
    if (!this.ctx || !this.sfxBus) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t0);
    filter.frequency.exponentialRampToValueAtTime(140, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t0);
  }

  /* ---------------- game cues ---------------- */

  eat(mult: number) {
    const f = 380 + mult * 80;
    this.tone({ freq: f, end: f * 1.6, dur: 0.09, type: "square", vol: 0.14 });
    this.tone({ freq: f * 2.02, dur: 0.06, type: "sine", vol: 0.1, delay: 0.025 });
  }

  gold() {
    this.tone({ freq: 660, dur: 0.08, type: "triangle", vol: 0.16 });
    this.tone({ freq: 990, dur: 0.08, type: "triangle", vol: 0.16, delay: 0.07 });
    this.tone({ freq: 1320, end: 1760, dur: 0.16, type: "triangle", vol: 0.18, delay: 0.14 });
  }

  comboUp() {
    this.tone({ freq: 520, end: 880, dur: 0.08, type: "sawtooth", vol: 0.07 });
  }

  comboLost() {
    this.tone({ freq: 480, end: 240, dur: 0.14, type: "sawtooth", vol: 0.06 });
  }

  die() {
    this.tone({ freq: 260, end: 46, dur: 0.55, type: "sawtooth", vol: 0.26 });
    this.tone({ freq: 140, end: 38, dur: 0.6, type: "square", vol: 0.16, delay: 0.04 });
    this.noise(0.4, 0.28, 0.02);
  }

  ui() {
    this.tone({ freq: 940, end: 1240, dur: 0.05, type: "sine", vol: 0.1 });
  }

  pause() {
    this.tone({ freq: 620, dur: 0.07, type: "sine", vol: 0.11 });
    this.tone({ freq: 470, dur: 0.09, type: "sine", vol: 0.11, delay: 0.08 });
  }

  start() {
    this.tone({ freq: 440, dur: 0.07, type: "triangle", vol: 0.14 });
    this.tone({ freq: 660, dur: 0.07, type: "triangle", vol: 0.14, delay: 0.075 });
    this.tone({ freq: 880, end: 1100, dur: 0.12, type: "triangle", vol: 0.15, delay: 0.15 });
  }

  /** countdown blip; `go` gives the higher final tone */
  tick(go = false) {
    if (go) this.tone({ freq: 880, end: 1320, dur: 0.22, type: "triangle", vol: 0.18 });
    else this.tone({ freq: 520, dur: 0.09, type: "triangle", vol: 0.13 });
  }

  levelUp() {
    this.tone({ freq: 392, dur: 0.08, type: "triangle", vol: 0.15 });
    this.tone({ freq: 523, dur: 0.08, type: "triangle", vol: 0.15, delay: 0.07 });
    this.tone({ freq: 659, dur: 0.08, type: "triangle", vol: 0.15, delay: 0.14 });
    this.tone({ freq: 1046, end: 1568, dur: 0.28, type: "triangle", vol: 0.17, delay: 0.21 });
    this.tone({ freq: 2093, dur: 0.18, type: "sine", vol: 0.08, delay: 0.21 });
  }

  newBest() {
    this.tone({ freq: 523, dur: 0.1, type: "triangle", vol: 0.16, delay: 0.1 });
    this.tone({ freq: 659, dur: 0.1, type: "triangle", vol: 0.16, delay: 0.2 });
    this.tone({ freq: 784, dur: 0.1, type: "triangle", vol: 0.16, delay: 0.3 });
    this.tone({ freq: 1046, end: 1568, dur: 0.35, type: "triangle", vol: 0.18, delay: 0.4 });
  }
}
