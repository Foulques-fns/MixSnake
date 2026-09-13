import { useEffect, useMemo, useState } from "react";
import {
  Play,
  RotateCcw,
  Home,
  Trophy,
  Crown,
  Layers,
  TrendingUp,
  SlidersHorizontal,
  Swords,
  UserRound,
  Ghost,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Hand,
  Skull,
  Palette,
  Lock,
  Check,
  ChevronLeft,
  Zap,
  Download,
} from "lucide-react";
import type { ScoreEntry } from "../game/storage";
import { SKINS, isUnlocked, unlockHint, type Skin } from "../game/skins";
import { LEVELS, genMaze, isLevelUnlocked } from "../game/levels";
import type { GameMode } from "../game/engine";
import type { TFunc } from "../i18n";

/* ------------------------------------------------ score table ------------------------------------------------ */

export function ScoreTable({
  scores,
  highlightRank = -1,
  t,
}: {
  scores: ScoreEntry[];
  highlightRank?: number;
  t: TFunc;
}) {
  const rows = scores.slice(0, 5);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2 text-cyan-200/50">
        <Trophy size={12} />
        <span className="font-display text-[10px] tracking-[0.35em]">{t("hallOfFame")}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-[#6d7ea6]">{t("noRuns")}</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((s, i) => (
            <div
              key={`${s.date}-${i}`}
              className={`score-row flex items-center justify-between rounded-lg px-2 py-1.5 ${
                i === highlightRank ? "bg-[#a6ff4d]/10 outline outline-1 outline-[#a6ff4d]/40" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`font-display w-5 text-center text-xs ${
                    i === 0 ? "text-[#ffd23f]" : i < 3 ? "text-[#38e8ff]" : "text-[#6d7ea6]"
                  }`}
                >
                  {i === 0 ? <Crown size={12} className="mx-auto" /> : `0${i + 1}`}
                </span>
                <span className="font-display text-sm text-[#e8f4ff]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {String(s.score).padStart(6, "0")}
                </span>
              </div>
              <span className="text-[10px] tracking-widest text-[#6d7ea6]">
                {s.len} {t("seg")} · {t("lv")} {s.lvl ?? 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ start ------------------------------------------------ */

export function StartScreen({
  scores,
  onPlay,
  onSkins,
  onLevels,
  onSettings,
  onDuel,
  touchMode,
  playerName,
  onProfile,
  t,
}: {
  scores: ScoreEntry[];
  touchMode: string;
  playerName: string | null;
  onProfile: () => void;
  onDuel: () => void;
  onPlay: () => void;
  onSkins: () => void;
  onLevels: () => void;
  onSettings: () => void;
  t: TFunc;
}) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const media = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setIsInstalled(media.matches);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    media.addEventListener?.("change", updateInstalled);
    updateInstalled();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      media.removeEventListener?.("change", updateInstalled);
    };
  }, []);

  const installMixSnake = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);

    if (isIOS) {
      window.alert("Sur iPhone/iPad : ouvre Partager, puis « Sur l’écran d’accueil ».");
    } else {
      window.alert("Ouvre le menu de ton navigateur puis choisis « Installer MixSnake » ou « Ajouter à l’écran d’accueil ».");
    }
  };

  return (
 <div className="menu-overlay overlay-fade absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-[#04050c]/60 p-2 backdrop-blur-[6px] sm:p-4">
     <div className="menu-content flex h-full max-h-full w-full max-w-lg flex-col items-center justify-center gap-3 overflow-hidden py-2 sm:gap-5 sm:py-4">
        <button
          onClick={onProfile}
          className="pop-in flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md transition-all hover:border-[#a6ff4d]/50 hover:bg-[#a6ff4d]/[0.07]"
        >
          {playerName ? (
            <UserRound size={12} className="text-[#a6ff4d]" />
          ) : (
            <Ghost size={12} className="text-[#6d7ea6]" />
          )}
          <span className="font-display text-[10px] tracking-[0.2em] text-[#e8f4ff]">
            {playerName ?? t("guest")}
          </span>
          <ChevronRight size={11} className="text-[#6d7ea6]" />
        </button>

        <div className="flex flex-col items-center">
          <span className="font-display mb-3 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1 text-[9px] tracking-[0.5em] text-cyan-200/70">
            {t("tagline")}
          </span>
          <h1 className="font-display text-center leading-none">
            <span className="stroke-title float-slow block text-[clamp(2.5rem,11vw,4.5rem)] font-black tracking-tight">
  MIX
</span>

<span
  className="title-glow block bg-gradient-to-br from-[#d2ff7a] via-[#a6ff4d] to-[#38e8ff] bg-clip-text text-[clamp(3rem,14vw,5.5rem)] font-black tracking-[-0.04em] text-transparent"
>
  SNAKE
</span>
          </h1>
          <p className="mt-4 max-w-xs text-center text-xs leading-relaxed text-[#9fb2d8] sm:text-sm">
            {t("pitch")
              .split(/(\{reshapes\}|\{combo\}|\{gold\})/)
              .map((part, i) => {
                if (part === "{reshapes}")
                  return (
                    <span key={i} className="text-violet-300">
                      {t("pitchReshapes")}
                    </span>
                  );
                if (part === "{combo}")
                  return (
                    <span key={i} className="text-[#ff3df2]">
                      {t("pitchCombo")}
                    </span>
                  );
                if (part === "{gold}")
                  return (
                    <span key={i} className="text-[#ffd23f]">
                      {t("pitchGold")}
                    </span>
                  );
                return <span key={i}>{part}</span>;
              })}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={onPlay}
            className="btn-neon pulse-ring pop-in flex items-center gap-3 rounded-2xl px-10 py-4 text-sm font-bold sm:px-14 sm:py-5 sm:text-base"
          >
            <Play size={18} strokeWidth={3} />
            {t("play")}
          </button>
          <button
            onClick={onDuel}
            className="pop-in flex items-center gap-2.5 rounded-2xl border px-8 py-3 text-[11px] font-bold transition-all"
            style={{
              fontFamily: "Orbitron, sans-serif",
              letterSpacing: "0.2em",
              color: "#ffd23f",
              borderColor: "rgba(255,210,63,0.45)",
              background: "rgba(255,210,63,0.08)",
              boxShadow: "0 0 22px rgba(255,210,63,0.14)",
              animationDelay: "0.04s",
            }}
          >
            <Swords size={15} /> {t("duel")}
          </button>

          {!isInstalled && (
            <button
              onClick={installMixSnake}
              className="pop-in flex items-center gap-2.5 rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.06] px-7 py-2.5 text-[10px] font-bold text-cyan-200 transition-all hover:border-cyan-300/60 hover:bg-cyan-300/[0.1]"
              style={{
                fontFamily: "Orbitron, sans-serif",
                letterSpacing: "0.16em",
                animationDelay: "0.05s",
              }}
            >
              <Download size={14} /> INSTALLER MIXSNAKE
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={onLevels} className="btn-ghost pop-in flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-bold" style={{ animationDelay: "0.06s" }}>
              <Layers size={13} /> {t("arenas")}
            </button>
            <button onClick={onSkins} className="btn-ghost pop-in flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-bold" style={{ animationDelay: "0.1s" }}>
              <Palette size={13} /> {t("skins")}
            </button>
            <button onClick={onSettings} className="btn-ghost pop-in flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-bold" style={{ animationDelay: "0.14s" }}>
              <SlidersHorizontal size={13} /> {t("settings")}
            </button>
          </div>
          <span className="font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
            {t("orPressEnter", { key: "" })}<span className="text-[#a6ff4d]">ENTER</span>
          </span>
        </div>

        <div className="pop-in w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md" style={{ animationDelay: "0.15s" }}>
          <ScoreTable scores={scores} t={t} />
        </div>

        <div className="flex flex-col items-center gap-2 pb-2 text-[#6d7ea6]">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="kbd flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /><ArrowLeft size={10} /><ArrowRight size={10} /></span>
            <span className="text-[10px]">{t("or")}</span>
            <span className="kbd">WASD</span>
            <span className="text-[10px]">{t("steer")}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="kbd">P</span>
            <span className="text-[10px]">{t("pause")}</span>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <Hand size={12} className="text-[#38e8ff]" />
            <span className="text-[10px] tracking-wider">{t(touchMode === "dpad" ? "tapToSteer" : "swipeToSteer")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ arena select ------------------------------------------------ */

const PREVIEW_COLS = 15;
const PREVIEW_ROWS = 12;

function MazePreview({ level, locked }: { level: number; locked: boolean }) {
  // deterministic sample of the real generator
  const cells = useMemo(() => Array.from(genMaze(level, PREVIEW_COLS, PREVIEW_ROWS)), [level]);
  const unit = 6;
  return (
    <svg
      viewBox={`0 0 ${PREVIEW_COLS * unit} ${PREVIEW_ROWS * unit}`}
      className="h-full w-full"
      style={{ opacity: locked ? 0.3 : 1 }}
    >
      <rect
        x="0.5"
        y="0.5"
        width={PREVIEW_COLS * unit - 1}
        height={PREVIEW_ROWS * unit - 1}
        rx="3"
        fill="rgba(8,12,30,0.6)"
        stroke="rgba(56,232,255,0.35)"
        strokeWidth="0.8"
      />
      {cells.map((k) => (
        <rect
          key={k}
          x={(k % 1000) * unit + 0.6}
          y={Math.floor(k / 1000) * unit + 0.6}
          width={unit - 1.2}
          height={unit - 1.2}
          rx="1.2"
          fill="rgba(139,92,246,0.55)"
          stroke="rgba(196,181,253,0.7)"
          strokeWidth="0.4"
        />
      ))}
      {/* the serpent's start position */}
      <rect
        x={Math.floor(PREVIEW_COLS / 2) * unit - unit * 2.4}
        y={Math.floor(PREVIEW_ROWS / 2) * unit + 1.4}
        width={unit * 3.4}
        height={unit - 2.8}
        rx="1.4"
        fill="#a6ff4d"
      />
    </svg>
  );
}

export function LevelScreen({
  levelBests,
  bestLevel,
  onPick,
  onBack,
  t,
}: {
  levelBests: Record<number, number>;
  bestLevel: number;
  onPick: (level: number, mode: GameMode) => void;
  onBack: () => void;
  t: TFunc;
}) {
  const [mode, setMode] = useState<GameMode>("arena");

  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/70 p-4 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto py-2">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl" aria-label="Back">
            <ChevronLeft size={17} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-display stroke-title text-2xl font-black tracking-[0.25em] sm:text-3xl">{t("arenas")}</h2>
            <span className="text-[10px] tracking-[0.3em] text-[#6d7ea6]">{t("pickBattleground")}</span>
          </div>
          <div className="w-9" />
        </div>

        {/* mode toggle */}
        <div className="flex justify-center">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { id: "arena" as GameMode, label: t("singleArena"), icon: Layers },
                { id: "ascent" as GameMode, label: t("ascent"), icon: TrendingUp },
              ]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-display text-[9px] tracking-[0.16em] transition-all ${
                  mode === m.id
                    ? "bg-[#a6ff4d]/15 text-[#a6ff4d] shadow-[0_0_16px_rgba(166,255,77,0.15)]"
                    : "text-[#6d7ea6] hover:text-[#9fb2d8]"
                }`}
              >
                <m.icon size={12} />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="-mt-2 text-center text-[10px] text-[#6d7ea6]">
          {mode === "arena"
            ? t("singleArenaHint")
            : t("ascentHint")}
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {LEVELS.map((info, i) => {
            const unlocked = isLevelUnlocked(info.level, levelBests, bestLevel);
            const best = levelBests[info.level] ?? 0;
            const nextTarget = info.target;
            return (
              <button
                key={info.level}
                onClick={() => unlocked && onPick(info.level, mode)}
                disabled={!unlocked}
                className={`pop-in group relative flex flex-col gap-1.5 rounded-2xl border p-2.5 text-left transition-all duration-150 ${
                  unlocked
                    ? "border-white/10 bg-white/[0.03] hover:border-[#a6ff4d]/50 hover:bg-[#a6ff4d]/[0.06] hover:shadow-[0_0_20px_rgba(166,255,77,0.14)]"
                    : "cursor-not-allowed border-white/6 bg-white/[0.015]"
                }`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="relative h-16 w-full overflow-hidden rounded-lg bg-black/30 p-1">
                  <MazePreview level={info.level} locked={!unlocked} />
                  {!unlocked && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Lock size={16} className="text-[#ffd23f]/80" />
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className={`font-display text-[10px] font-bold tracking-[0.14em] ${unlocked ? "text-[#e8f4ff]" : "text-[#4d5a7d]"}`}>
                    {String(info.level).padStart(2, "0")} {info.name}
                  </span>
                  {unlocked && best > 0 && (
                    <span className="font-display text-[9px] text-[#38e8ff]/80" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {best}
                    </span>
                  )}
                </div>
                {unlocked ? (
                  <span className="text-[9px] leading-tight text-[#6d7ea6]">{info.desc}</span>
                ) : (
                  <span className="text-[9px] leading-tight text-[#ffd23f]/70">
                    {t("scoreOn", { n: LEVELS[info.level - 2].target, name: LEVELS[info.level - 2].name })}
                  </span>
                )}
                {unlocked && nextTarget > 0 && best < nextTarget && info.level < LEVELS.length && (
                  <span className="text-[8px] tracking-wider text-[#4d5a7d]">{t("nextUnlockAt", { n: nextTarget })}</span>
                )}
              </button>
            );
          })}
        </div>

        <span className="pb-2 text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
          {t("escToGoBack", { esc: "ESC" })}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ skin garage ------------------------------------------------ */

function SkinPreview({ skin, locked }: { skin: Skin; locked: boolean }) {
  const gid = `skin-grad-${skin.id}`;
  return (
    <svg viewBox="0 0 120 46" className="h-12 w-full" style={{ filter: locked ? "grayscale(0.9) brightness(0.55)" : undefined }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          {skin.rainbow ? (
            <>
              <stop offset="0" stopColor="#38e8ff" />
              <stop offset="0.33" stopColor="#a6ff4d" />
              <stop offset="0.66" stopColor="#ffd23f" />
              <stop offset="1" stopColor="#ff5db1" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={skin.stops[2]} />
              <stop offset="0.6" stopColor={skin.stops[1]} />
              <stop offset="1" stopColor={skin.stops[0]} />
            </>
          )}
        </linearGradient>
      </defs>
      <path
        d="M12 26 C 28 8, 42 44, 60 26 S 88 8, 102 24"
        stroke={`url(#${gid})`}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="103" cy="24" r="7.5" fill={skin.head} />
      <circle cx="100.5" cy="20.5" r="1.9" fill="#fff" />
      <circle cx="101.2" cy="20.5" r="1" fill="#08130c" />
      <circle cx="100.5" cy="27" r="1.9" fill="#fff" />
      <circle cx="101.2" cy="27" r="1" fill="#08130c" />
    </svg>
  );
}

export function SkinScreen({
  bestScore,
  bestLevel,
  selectedId,
  onSelect,
  onBack,
  t,
}: {
  bestScore: number;
  bestLevel: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  t: TFunc;
}) {
  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/70 p-4 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto py-2">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl" aria-label="Back">
            <ChevronLeft size={17} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-display stroke-title text-2xl font-black tracking-[0.25em] sm:text-3xl">{t("garage")}</h2>
            <span className="text-[10px] tracking-[0.3em] text-[#6d7ea6]">{t("chooseSerpent")}</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="flex justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1">
            <Trophy size={11} className="text-cyan-300/80" />
            <span className="font-display text-[10px] text-cyan-100/90" style={{ fontVariantNumeric: "tabular-nums" }}>
              {String(bestScore).padStart(6, "0")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/5 px-3 py-1">
            <Zap size={11} className="text-violet-300/80" />
            <span className="font-display text-[10px] text-violet-100/90">{t("level")} {bestLevel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {SKINS.map((skin, i) => {
            const unlocked = isUnlocked(skin, bestScore, bestLevel);
            const selected = skin.id === selectedId;
            return (
              <button
                key={skin.id}
                onClick={() => unlocked && onSelect(skin.id)}
                disabled={!unlocked}
                className={`pop-in group relative flex flex-col items-center gap-1 rounded-2xl border p-3 transition-all duration-150 ${
                  selected
                    ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/8 shadow-[0_0_24px_rgba(166,255,77,0.18)]"
                    : unlocked
                      ? "border-white/10 bg-white/[0.03] hover:border-cyan-300/40 hover:bg-white/[0.05] hover:shadow-[0_0_18px_rgba(56,232,255,0.12)]"
                      : "cursor-not-allowed border-white/6 bg-white/[0.015]"
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#a6ff4d] p-0.5">
                    <Check size={11} strokeWidth={3.5} className="text-[#04050c]" />
                  </span>
                )}
                <div className="w-full rounded-xl bg-black/30 px-1">
                  <SkinPreview skin={skin} locked={!unlocked} />
                </div>
                <span className={`font-display text-[11px] font-bold tracking-[0.18em] ${unlocked ? "text-[#e8f4ff]" : "text-[#4d5a7d]"}`}>
                  {skin.name}
                </span>
                {unlocked ? (
                  <span className="text-[9px] leading-tight text-[#6d7ea6]">{skin.tagline}</span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] tracking-wider text-[#ffd23f]/80">
                    <Lock size={9} /> {unlockHint(skin)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="pb-2 text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
          {t("escToGoBack", { esc: "ESC" })}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ pause ------------------------------------------------ */

export function PauseScreen({
  onResume,
  onRestart,
  onQuit,
  onSettings,
  t,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onSettings: () => void;
  t: TFunc;
}) {
  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/70 p-4 backdrop-blur-md">
      <div className="pop-in flex w-full max-w-xs flex-col items-center gap-6">
        <h2 className="font-display stroke-title text-4xl font-black tracking-widest sm:text-5xl">{t("paused")}</h2>
        <div className="flex w-full flex-col gap-3">
          <button onClick={onResume} className="btn-neon flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-xs font-bold">
            <Play size={15} strokeWidth={3} /> {t("resume")}
          </button>
          <button onClick={onRestart} className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[11px] font-bold">
            <RotateCcw size={14} /> {t("restart")}
          </button>
          <div className="flex gap-2.5">
            <button onClick={onSettings} className="btn-ghost flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold">
              <SlidersHorizontal size={14} /> {t("settings")}
            </button>
            <button onClick={onQuit} className="btn-ghost flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold">
              <Home size={14} /> {t("menu")}
            </button>
          </div>
        </div>
        <span className="font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
          {t("toResume", { p: "P", esc: "ESC" })}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ game over ------------------------------------------------ */

export interface RunResult {
  score: number;
  len: number;
  level: number;
  startLevel: number;
  mode: GameMode;
  rank: number;
  unlockedNext?: string;
}

export function GameOverScreen({
  result,
  scores,
  onRestart,
  onQuit,
  onLevels,
  t,
}: {
  result: RunResult;
  scores: ScoreEntry[];
  onRestart: () => void;
  onQuit: () => void;
  onLevels: () => void;
  t: TFunc;
}) {
  const isBest = result.rank === 0 && result.score > 0;
  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/60 p-4 backdrop-blur-[6px]">
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-4 overflow-y-auto py-4">
        <div className="flex flex-col items-center gap-1">
          <Skull size={20} className="mb-1 text-[#ff4d6d]" style={{ filter: "drop-shadow(0 0 10px rgba(255,77,109,0.7))" }} />
          <h2
            className="font-display text-4xl font-black tracking-widest text-[#ff4d6d] sm:text-5xl"
            style={{ textShadow: "0 0 20px rgba(255,77,109,0.5), 0 0 70px rgba(255,77,109,0.25)" }}
          >
            {t("gameOver")}
          </h2>
        </div>

        {isBest && (
          <div className="pop-in flex items-center gap-2 rounded-full border border-[#ffd23f]/50 bg-[#ffd23f]/10 px-4 py-1.5">
            <Crown size={13} className="text-[#ffd23f]" />
            <span className="font-display text-[10px] font-bold tracking-[0.3em] text-[#ffd23f]">{t("newHighScore")}</span>
          </div>
        )}

        <div className="pop-in flex flex-col items-center" style={{ animationDelay: "0.08s" }}>
          <div
            className="font-display score-glow text-6xl font-black text-[#e8f4ff] sm:text-7xl"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {result.score}
          </div>
          <span className="mt-1.5 flex items-center gap-2 text-[10px] tracking-[0.3em] text-[#6d7ea6]">
            {result.len} {t("segments")}
            <span className="opacity-40">·</span>
            <span className="text-violet-300">
              {result.mode === "ascent" ? `${t("ascent")} → ${t("lv")} ${result.level}` : LEVELS[result.level - 1].name}
            </span>
          </span>
        </div>

        {result.unlockedNext && (
          <div className="pop-in flex items-center gap-2 rounded-full border border-[#a6ff4d]/50 bg-[#a6ff4d]/10 px-4 py-1.5">
            <Layers size={13} className="text-[#a6ff4d]" />
            <span className="font-display text-[10px] font-bold tracking-[0.24em] text-[#a6ff4d]">
              {t("arenaUnlocked")} · {result.unlockedNext}
            </span>
          </div>
        )}

        <div className="pop-in w-full rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-md" style={{ animationDelay: "0.16s" }}>
          <ScoreTable scores={scores} highlightRank={result.rank} t={t} />
        </div>

        <div className="pop-in flex w-full flex-col gap-2.5 pb-2" style={{ animationDelay: "0.24s" }}>
          <button onClick={onRestart} className="btn-neon pulse-ring flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-xs font-bold">
            <RotateCcw size={15} strokeWidth={3} /> {t("retry")} {result.mode === "ascent" ? t("ascent") : LEVELS[result.startLevel - 1].name}
          </button>
          <div className="flex gap-2.5">
            <button onClick={onLevels} className="btn-ghost flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold">
              <Layers size={14} /> {t("arenas")}
            </button>
            <button onClick={onQuit} className="btn-ghost flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold">
              <Home size={14} /> {t("menu")}
            </button>
          </div>
          <span className="blink mt-1 text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
            {t("pressEnterAgain", { key: "ENTER" })}
          </span>
        </div>
      </div>
    </div>
  );
}
