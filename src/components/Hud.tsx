import { useEffect, useRef } from "react";
import { Pause, Volume2, VolumeX } from "lucide-react";
import type { SnakeGame } from "../game/engine";

interface Props {
  gameRef: React.RefObject<SnakeGame | null>;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

/**
 * In-game HUD. Syncs from the engine's mutable `hud` object with rAF,
 * writing to textContent directly — zero React re-renders at 60fps.
 */
export function Hud({ gameRef, muted, onPause, onToggleMute }: Props) {
  const scoreEl = useRef<HTMLDivElement>(null);
  const bestEl = useRef<HTMLDivElement>(null);
  const comboWrap = useRef<HTMLDivElement>(null);
  const comboBar = useRef<HTMLDivElement>(null);
  const comboLabel = useRef<HTMLSpanElement>(null);
  const levelEl = useRef<HTMLSpanElement>(null);
  const levelBar = useRef<HTMLDivElement>(null);
  const levelBarWrap = useRef<HTMLDivElement>(null);
  const levelNameEl = useRef<HTMLSpanElement>(null);
  const last = useRef({ score: -1, best: -1, mult: -1, frac: -1, level: -1, levelFrac: -1, name: "" });

  useEffect(() => {
    let raf = 0;
    const sync = () => {
      const g = gameRef.current;
      if (g) {
        const h = g.hud;
        if (h.score !== last.current.score) {
          last.current.score = h.score;
          if (scoreEl.current) {
            scoreEl.current.textContent = String(h.score).padStart(6, "0");
            scoreEl.current.animate(
              [{ transform: "scale(1.22)", filter: "brightness(1.7)" }, { transform: "scale(1)", filter: "brightness(1)" }],
              { duration: 180, easing: "cubic-bezier(0.2,0.9,0.3,1.4)" },
            );
          }
        }
        if (h.best !== last.current.best) {
          last.current.best = h.best;
          if (bestEl.current) bestEl.current.textContent = String(h.best).padStart(6, "0");
        }
        if (h.level !== last.current.level) {
          last.current.level = h.level;
          if (levelEl.current) {
            levelEl.current.textContent = String(h.level).padStart(2, "0");
            levelEl.current.animate(
              [{ transform: "scale(1.5)", filter: "brightness(2)" }, { transform: "scale(1)", filter: "brightness(1)" }],
              { duration: 320, easing: "cubic-bezier(0.2,0.9,0.3,1.4)" },
            );
          }
        }
        if (h.levelName !== last.current.name) {
          last.current.name = h.levelName;
          if (levelNameEl.current) levelNameEl.current.textContent = h.levelName;
        }
        if (levelBarWrap.current) levelBarWrap.current.style.display = h.ascent ? "block" : "none";
        const levelFrac = Math.round(h.levelFrac * 100);
        if (levelFrac !== last.current.levelFrac) {
          last.current.levelFrac = levelFrac;
          if (levelBar.current) levelBar.current.style.width = `${levelFrac}%`;
        }
        const comboOn = h.mult > 1 && h.phase === "playing";
        if (comboWrap.current) {
          comboWrap.current.style.opacity = comboOn ? "1" : "0";
          comboWrap.current.style.transform = comboOn ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.8)";
        }
        if (h.mult !== last.current.mult) {
          last.current.mult = h.mult;
          if (comboLabel.current) comboLabel.current.textContent = `×${h.mult}`;
        }
        const frac = Math.round(h.comboFrac * 100);
        if (frac !== last.current.frac) {
          last.current.frac = frac;
          if (comboBar.current) comboBar.current.style.width = `${frac}%`;
        }
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
      {/* score + level */}
      <div className="flex flex-col">
        <span className="font-display text-[10px] tracking-[0.35em] text-cyan-200/50">SCORE</span>
        <div
          ref={scoreEl}
          className="font-display score-glow text-2xl leading-none text-[#e8f4ff] sm:text-3xl"
          style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
        >
          000000
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-display text-[9px] tracking-[0.3em] text-cyan-200/40">BEST</span>
          <div
            ref={bestEl}
            className="font-display text-xs text-[#9fb2d8]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            000000
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5">
            <span className="font-display text-[8px] tracking-[0.2em] text-violet-300/70">LV</span>
            <span
              ref={levelEl}
              className="font-display text-[11px] font-bold text-violet-200"
              style={{ textShadow: "0 0 10px rgba(167,139,250,0.6)", fontVariantNumeric: "tabular-nums" }}
            >
              01
            </span>
          </div>
          <span
            ref={levelNameEl}
            className="font-display text-[9px] tracking-[0.22em] text-violet-300/60"
          >
            OPEN GRID
          </span>
          <div ref={levelBarWrap} className="h-1 w-12 overflow-hidden rounded-full bg-white/10 sm:w-16" style={{ display: "none" }}>
            <div
              ref={levelBar}
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-[#c4b5fd]"
              style={{ boxShadow: "0 0 8px rgba(167,139,250,0.5)", transition: "width 200ms ease" }}
            />
          </div>
        </div>
      </div>

      {/* combo meter */}
      <div
        ref={comboWrap}
        className="absolute left-1/2 top-5 flex w-28 -translate-x-1/2 flex-col items-center gap-1.5 opacity-0 transition-all duration-200 sm:w-36"
      >
        <span
          ref={comboLabel}
          className="font-display text-lg font-bold text-[#ff3df2]"
          style={{ textShadow: "0 0 16px rgba(255,61,242,0.6)" }}
        >
          ×2
        </span>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            ref={comboBar}
            className="h-full rounded-full bg-gradient-to-r from-[#ff3df2] to-[#a6ff4d]"
            style={{ boxShadow: "0 0 10px rgba(255,61,242,0.6)", transition: "width 80ms linear" }}
          />
        </div>
      </div>

      {/* buttons */}
      <div className="pointer-events-auto flex gap-2">
        <button
          onClick={onToggleMute}
          aria-label="Toggle sound"
          className="btn-icon flex h-10 w-10 items-center justify-center rounded-xl"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <button
          onClick={onPause}
          aria-label="Pause"
          className="btn-icon flex h-10 w-10 items-center justify-center rounded-xl"
        >
          <Pause size={17} />
        </button>
      </div>
    </div>
  );
}
