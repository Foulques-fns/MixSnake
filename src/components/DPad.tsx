import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DirName } from "../game/engine";

/** On-screen thumb pad for touch players who prefer buttons over swiping. */
export function DPad({ onDir }: { onDir: (d: DirName) => void }) {
  const press = (d: DirName) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDir(d);
  };

  const btn = "dpad-btn flex h-12 w-12 items-center justify-center rounded-xl";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-6 sm:hidden"
      style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5" style={{ touchAction: "none" }}>
        <span />
        <button className={btn} onPointerDown={press("up")} aria-label="Up">
          <ChevronUp size={22} />
        </button>
        <span />
        <button className={btn} onPointerDown={press("left")} aria-label="Left">
          <ChevronLeft size={22} />
        </button>
        <span />
        <button className={btn} onPointerDown={press("right")} aria-label="Right">
          <ChevronRight size={22} />
        </button>
        <span />
        <button className={btn} onPointerDown={press("down")} aria-label="Down">
          <ChevronDown size={22} />
        </button>
        <span />
      </div>
    </div>
  );
}
