/* Procedural soundtrack — fully synthesized, zero audio assets.
   A 16-step lookahead sequencer drives bass, arp, pad and drums. */

import type { SoundFX } from "./audio";

export interface TrackDef {
  id: string;
  name: string;
  bpm: number;
  /** chord roots as MIDI notes, one per bar */
  prog: number[];
  /** semitone offsets forming each chord */
  chord: number[];
  drums: boolean;
  arp: boolean;
  pad: boolean;
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  cutoff: number;
}

export const TRACKS: TrackDef[] = [
  {
    id: "drive",
    name: "NEON DRIVE",
    bpm: 112,
    prog: [45, 41, 48, 43], // A2 F2 C3 G2
    chord: [0, 3, 7, 10],
    drums: true,
    arp: true,
    pad: true,
    bassWave: "sawtooth",
    leadWave: "square",
    cutoff: 1500,
  },
  {
    id: "pulse",
    name: "PULSE GRID",
    bpm: 128,
    prog: [40, 40, 43, 45], // E2 E2 G2 A2
    chord: [0, 7, 12, 15],
    drums: true,
    arp: true,
    pad: false,
    bassWave: "square",
    leadWave: "sawtooth",
    cutoff: 1900,
  },
  {
    id: "void",
    name: "DEEP VOID",
    bpm: 72,
    prog: [38, 43, 41, 36], // D2 G2 F2 C2
    chord: [0, 7, 10, 14],
    drums: false,
    arp: false,
    pad: true,
    bassWave: "sine",
    leadWave: "triangle",
    cutoff: 900,
  },
];

export function getTrack(id: string): TrackDef | null {
  return TRACKS.find((t) => t.id === id) ?? null;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const ARP_PATTERN = [0, 2, 1, 3, 2, 1, 3, 0];

export class Music {
  private sfx: SoundFX;
  private track: TrackDef | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private bar = 0;
  private intensity = 0;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private playing = false;

  constructor(sfx: SoundFX) {
    this.sfx = sfx;
  }

  get trackId() {
    return this.track?.id ?? "off";
  }

  /** Swap tracks (or "off"). Safe to call before audio is unlocked. */
  setTrack(id: string) {
    const next = getTrack(id);
    if (next?.id === this.track?.id && this.playing) return;
    const resume = this.wantPlaying; // stop() clears it — remember first
    this.stop();
    this.track = next;
    this.wantPlaying = resume;
    if (next && resume) this.start();
  }

  private wantPlaying = false;

  /** Called on gameplay start / menus. */
  play() {
    this.wantPlaying = true;
    if (this.track && !this.playing) this.start();
  }

  /** Fade out and halt the sequencer. */
  stop() {
    this.wantPlaying = false;
    this.playing = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.sfx.ctx;
    if (this.out && ctx) {
      const g = this.out;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      const dead = g;
      setTimeout(() => dead.disconnect(), 700);
      this.out = null;
      this.filter = null;
    }
  }

  /** 0..1 — brightens the filter and adds hats as the run heats up. */
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
    const ctx = this.sfx.ctx;
    if (this.filter && ctx && this.track) {
      const target = this.track.cutoff * (1 + this.intensity * 1.6);
      this.filter.frequency.setTargetAtTime(target, ctx.currentTime, 0.3);
    }
  }

  private start() {
    const ctx = this.sfx.ctx;
    const bus = this.sfx.musicBus;
    if (!ctx || !bus || !this.track) return;

    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.track.cutoff;
    this.filter.Q.value = 1.1;

    this.filter.connect(this.out).connect(bus);

    this.step = 0;
    this.bar = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** Lookahead scheduler — queues every step landing in the next 120ms. */
  private schedule() {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.track || !this.playing) return;
    const stepDur = 60 / this.track.bpm / 4; // 16th notes
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar = (this.bar + 1) % this.track.prog.length;
      }
    }
  }

  /* ---------------- voices ---------------- */

  private voice(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    glide?: number,
  ) {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.filter) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide !== undefined) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.filter);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private drum(t: number, kind: "kick" | "snare" | "hat") {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.out) return;
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g).connect(this.out);
      osc.start(t);
      osc.stop(t + 0.2);
      return;
    }
    const dur = kind === "snare" ? 0.16 : 0.045;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = kind === "snare" ? "bandpass" : "highpass";
    f.frequency.value = kind === "snare" ? 1900 : 7200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(kind === "snare" ? 0.24 : 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
  }

  private playStep(step: number, t: number, stepDur: number) {
    const tr = this.track!;
    const root = tr.prog[this.bar];

    // ---- bass ----
    if (tr.id === "void") {
      if (step === 0) this.voice(midi(root - 12), t, stepDur * 14, tr.bassWave, 0.2);
    } else if (step % 2 === 0) {
      const oct = step % 8 === 4 ? 12 : 0;
      this.voice(midi(root - 12 + oct), t, stepDur * 1.5, tr.bassWave, 0.17);
    }

    // ---- pad (chord swell at bar start) ----
    if (tr.pad && step === 0) {
      for (const iv of tr.chord) {
        this.voice(midi(root + 12 + iv), t, stepDur * 15, "triangle", 0.045);
      }
    }

    // ---- arp ----
    if (tr.arp && step % 2 === 1) {
      const idx = ARP_PATTERN[(step >> 1) % ARP_PATTERN.length];
      const note = root + 24 + tr.chord[idx % tr.chord.length];
      this.voice(midi(note), t, stepDur * 0.9, tr.leadWave, 0.055 + this.intensity * 0.045);
    }

    // ---- bells on the void track ----
    if (tr.id === "void" && (step === 6 || step === 11)) {
      const iv = tr.chord[(step + this.bar) % tr.chord.length];
      this.voice(midi(root + 24 + iv), t, stepDur * 6, "sine", 0.07);
    }

    // ---- drums ----
    if (!tr.drums) return;
    if (step % 4 === 0) this.drum(t, "kick");
    if (step === 4 || step === 12) this.drum(t, "snare");
    if (step % 2 === 0 || this.intensity > 0.45) this.drum(t, "hat");
  }
}
