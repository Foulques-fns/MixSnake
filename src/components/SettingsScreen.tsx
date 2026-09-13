import { useState } from "react";
import {
  ChevronLeft,
  Gauge,
  Palette,
  Sparkles,
  RotateCcw,
  Check,
  Volume2,
  VolumeX,
  Music4,
  Vibrate,
  Languages,
  Gamepad2,
  BarChart3,
  Trash2,
  Monitor,
  UserRound,
  Ghost,
  LogOut,
  KeyRound,
  UserX,
} from "lucide-react";
import {
  SPEEDS,
  THEMES,
  DEFAULT_SETTINGS,
  type Settings,
  type Theme,
} from "../game/settings";
import { TRACKS } from "../game/music";
import { LANGS } from "../i18n";
import type { Dict, TFunc } from "../i18n";
import type { Stats } from "../game/storage";

type Tab = "game" | "audio" | "visual" | "lang";

/* ---------------- shared controls ---------------- */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Gauge;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-cyan-200/60">
        <Icon size={12} />
        <span className="font-display text-[10px] tracking-[0.32em]">{title}</span>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label,
  desc,
  on,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-left transition-all ${
        disabled ? "opacity-40" : "hover:border-cyan-300/30 hover:bg-white/[0.045]"
      }`}
    >
      <span className="flex flex-col">
        <span className="font-display text-[10px] tracking-[0.16em] text-[#e8f4ff]">{label}</span>
        <span className="text-[9px] leading-tight text-[#6d7ea6]">{desc}</span>
      </span>
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-all duration-200"
        style={{
          background: on ? "linear-gradient(90deg,#a6ff4d,#38e8ff)" : "rgba(159,178,216,0.16)",
          boxShadow: on ? "0 0 12px rgba(166,255,77,0.4)" : undefined,
        }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-[#04050c] transition-all duration-200"
          style={{ left: on ? "18px" : "2px" }}
        />
      </span>
    </button>
  );
}

function Slider({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: typeof Volume2;
}) {
  const pct = Math.round(value * 100);
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <Icon size={14} className="shrink-0 text-cyan-200/70" />
      <span className="w-16 shrink-0 font-display text-[9px] tracking-[0.14em] text-[#9fb2d8]">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="neon-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(90deg,#a6ff4d 0%,#38e8ff ${pct}%,rgba(159,178,216,0.16) ${pct}%)`,
        }}
      />
      <span
        className="w-8 shrink-0 text-right font-display text-[10px] text-[#e8f4ff]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {pct}
      </span>
    </label>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: { id: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition-all ${
              on
                ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/10 shadow-[0_0_16px_rgba(166,255,77,0.15)]"
                : "border-white/10 bg-white/[0.02] hover:border-cyan-300/35 hover:bg-white/[0.05]"
            }`}
          >
            <span className={`font-display text-[9px] tracking-[0.12em] ${on ? "text-[#a6ff4d]" : "text-[#9fb2d8]"}`}>
              {o.label}
            </span>
            {o.sub && <span className="text-center text-[8px] leading-tight text-[#6d7ea6]">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwatch({ theme, selected }: { theme: Theme; selected: boolean }) {
  return (
    <span
      className="relative block h-11 w-full overflow-hidden rounded-lg"
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, ${theme.bg[0]}, ${theme.bg[1]} 55%, ${theme.bg[2]})`,
        boxShadow: selected ? `0 0 18px ${theme.borderGlow}` : undefined,
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${theme.grid} 1px, transparent 1px), linear-gradient(to bottom, ${theme.grid} 1px, transparent 1px)`,
          backgroundSize: "8px 8px",
        }}
      />
      <span
        className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-[2px]"
        style={{ background: theme.wall, border: `1px solid ${theme.wallEdge}` }}
      />
      <span
        className="absolute right-2 top-2 h-2 w-2 rounded-full"
        style={{
          background: `rgb(${theme.orb.join(",")})`,
          boxShadow: `0 0 7px rgb(${theme.orb.join(",")})`,
        }}
      />
      <span
        className="absolute bottom-2 left-2 h-1.5 w-2/3 rounded-full"
        style={{ background: "linear-gradient(90deg,#0dbfa5,#6ef58b,#d2ff7a)" }}
      />
      <span className="absolute inset-0 rounded-lg" style={{ border: `1px solid ${theme.border}` }} />
    </span>
  );
}

/* ---------------- screen ---------------- */

export function SettingsScreen({
  settings,
  stats,
  muted,
  playerName,
  onSignOut,
  onChangeCode,
  onDeleteAccount,
  hapticsAvailable,
  t,
  onChange,
  onToggleMute,
  onErase,
  onBack,
}: {
  settings: Settings;
  stats: Stats;
  muted: boolean;
  playerName: string | null;
  onSignOut: () => void;
  onChangeCode: () => void;
  onDeleteAccount: () => void;
  hapticsAvailable: boolean;
  t: TFunc;
  onChange: (s: Settings) => void;
  onToggleMute: () => void;
  onErase: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("game");
  const [confirmErase, setConfirmErase] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: "game", label: t("tabGame"), icon: Gamepad2 },
    { id: "audio", label: t("tabAudio"), icon: Music4 },
    { id: "visual", label: t("tabVisual"), icon: Monitor },
    { id: "lang", label: t("tabLang"), icon: Languages },
  ];

  const hhmm = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/78 p-4 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-xl flex-col gap-3 overflow-y-auto py-2">
        {/* header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl" aria-label="Back">
            <ChevronLeft size={17} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-display stroke-title text-2xl font-black tracking-[0.25em] sm:text-3xl">
              {t("settings")}
            </h2>
            <span className="text-[10px] tracking-[0.3em] text-[#6d7ea6]">{t("tuneYourRun")}</span>
          </div>
          <button
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label={t("resetDefaults")}
            title={t("resetDefaults")}
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-display text-[9px] tracking-[0.14em] transition-all ${
                tab === tb.id
                  ? "bg-[#a6ff4d]/15 text-[#a6ff4d] shadow-[0_0_14px_rgba(166,255,77,0.14)]"
                  : "text-[#6d7ea6] hover:text-[#9fb2d8]"
              }`}
            >
              <tb.icon size={12} />
              <span className="hidden sm:inline">{tb.label}</span>
            </button>
          ))}
        </div>

        {/* ---------------- GAME ---------------- */}
        {tab === "game" && (
          <>
            <Section icon={Gauge} title={t("snakeSpeed")}>
              <div className="grid grid-cols-4 gap-2">
                {SPEEDS.map((s) => {
                  const on = settings.speed === s.id;
                  const label = t(`speed${s.name[0]}${s.name.slice(1).toLowerCase()}` as keyof Dict);
                  return (
                    <button
                      key={s.id}
                      onClick={() => set("speed", s.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 transition-all ${
                        on
                          ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/10 shadow-[0_0_18px_rgba(166,255,77,0.16)]"
                          : "border-white/10 bg-white/[0.02] hover:border-cyan-300/35 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex h-4 items-end gap-0.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className="w-1 rounded-sm"
                            style={{
                              height: `${5 + i * 3.4}px`,
                              background:
                                i <= SPEEDS.indexOf(s)
                                  ? on
                                    ? "#a6ff4d"
                                    : "rgba(159,178,216,0.5)"
                                  : "rgba(159,178,216,0.14)",
                            }}
                          />
                        ))}
                      </span>
                      <span className={`font-display text-[9px] tracking-[0.1em] ${on ? "text-[#a6ff4d]" : "text-[#9fb2d8]"}`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section icon={Sparkles} title={t("gameplayFeel")}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label={t("speedRamp")} desc={t("speedRampDesc")} on={settings.ramp} onChange={(v) => set("ramp", v)} />
                <Toggle label={t("wallWrap")} desc={t("wallWrapDesc")} on={settings.wrap} onChange={(v) => set("wrap", v)} />
                <Toggle label={t("countdown")} desc={t("countdownDesc")} on={settings.countdown} onChange={(v) => set("countdown", v)} />
                <Toggle label={t("screenShake")} desc={t("screenShakeDesc")} on={settings.shake} onChange={(v) => set("shake", v)} />
              </div>
            </Section>

            <Section icon={Gamepad2} title={t("touchControls")}>
              <Choice
                cols={2}
                value={settings.touchMode}
                onChange={(v) => set("touchMode", v)}
                options={[
                  { id: "swipe", label: t("swipeMode"), sub: t("swipeModeDesc") },
                  { id: "dpad", label: t("dpadMode"), sub: t("dpadModeDesc") },
                ]}
              />
            </Section>

            <Section icon={Vibrate} title={t("vibration")}>
              <Choice
                cols={3}
                value={settings.haptics}
                onChange={(v) => set("haptics", v)}
                options={[
                  { id: "off", label: t("vibrationOff") },
                  { id: "light", label: t("vibrationLight") },
                  { id: "strong", label: t("vibrationStrong") },
                ]}
              />
              <p className="mt-2 text-center text-[9px] text-[#6d7ea6]">
                {hapticsAvailable ? t("vibrationDesc") : t("vibrationUnsupported")}
              </p>
            </Section>
          </>
        )}

        {/* ---------------- AUDIO ---------------- */}
        {tab === "audio" && (
          <>
            <Section icon={muted ? VolumeX : Volume2} title={t("volumes")}>
              <div className="flex flex-col gap-2">
                <Slider label={t("masterVol")} value={settings.masterVol} onChange={(v) => set("masterVol", v)} icon={Volume2} />
                <Slider label={t("musicVol")} value={settings.musicVol} onChange={(v) => set("musicVol", v)} icon={Music4} />
                <Slider label={t("sfxVol")} value={settings.sfxVol} onChange={(v) => set("sfxVol", v)} icon={Sparkles} />
                <Toggle label={t("silentMode")} desc={t("silentModeDesc")} on={muted} onChange={onToggleMute} />
              </div>
            </Section>

            <Section icon={Music4} title={t("soundtrack")}>
              <Choice
                cols={2}
                value={settings.music}
                onChange={(v) => set("music", v)}
                options={[
                  { id: "off", label: t("off") },
                  ...TRACKS.map((tr) => ({ id: tr.id, label: tr.name, sub: `${tr.bpm} BPM` })),
                ]}
              />
            </Section>
          </>
        )}

        {/* ---------------- VISUAL ---------------- */}
        {tab === "visual" && (
          <>
            <Section icon={Palette} title={t("arenaColors")}>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((th) => {
                  const on = settings.theme === th.id;
                  return (
                    <button
                      key={th.id}
                      onClick={() => set("theme", th.id)}
                      className={`relative flex flex-col gap-1.5 rounded-xl border p-1.5 transition-all ${
                        on ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/8" : "border-white/10 bg-white/[0.02] hover:border-cyan-300/35"
                      }`}
                    >
                      <ThemeSwatch theme={th} selected={on} />
                      <span className={`font-display text-[9px] tracking-[0.14em] ${on ? "text-[#a6ff4d]" : "text-[#9fb2d8]"}`}>
                        {th.name}
                      </span>
                      {on && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#a6ff4d]">
                          <Check size={10} strokeWidth={3.5} className="text-[#04050c]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section icon={Sparkles} title={t("gameplayFeel")}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label={t("particles")} desc={t("particlesDesc")} on={settings.particles} onChange={(v) => set("particles", v)} />
                <Toggle label={t("scanlines")} desc={t("scanlinesDesc")} on={settings.scanlines} onChange={(v) => set("scanlines", v)} />
                <Toggle label={t("gridLines")} desc={t("gridLinesDesc")} on={settings.grid} onChange={(v) => set("grid", v)} />
                <Toggle label={t("screenShake")} desc={t("screenShakeDesc")} on={settings.shake} onChange={(v) => set("shake", v)} />
              </div>
            </Section>
          </>
        )}

        {/* ---------------- LANGUAGE + DATA ---------------- */}
        {tab === "lang" && (
          <>
            <Section icon={playerName ? UserRound : Ghost} title={t("account")}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
                <span className="flex flex-col">
                  <span className="text-[9px] tracking-[0.2em] text-[#6d7ea6]">{t("signedInAs")}</span>
                  <span className="font-display text-sm tracking-[0.1em] text-[#e8f4ff]">
                    {playerName ?? t("guest")}
                  </span>
                </span>
                {playerName ? (
                  <UserRound size={18} className="text-[#a6ff4d]" />
                ) : (
                  <Ghost size={18} className="text-[#6d7ea6]" />
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {playerName && (
                  <button
                    onClick={onChangeCode}
                    className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold"
                  >
                    <KeyRound size={13} /> {t("changeCode")}
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  className={`btn-ghost flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold ${
                    playerName ? "" : "sm:col-span-2"
                  }`}
                >
                  <LogOut size={13} /> {playerName ? t("signOut") : t("switchProfile")}
                </button>
              </div>
              {playerName && (
                <button
                  onClick={() => {
                    if (confirmDelete) {
                      onDeleteAccount();
                      setConfirmDelete(false);
                    } else setConfirmDelete(true);
                  }}
                  className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-display text-[10px] tracking-[0.16em] transition-all ${
                    confirmDelete
                      ? "border-[#ff4d6d]/70 bg-[#ff4d6d]/15 text-[#ff4d6d]"
                      : "border-white/10 bg-white/[0.02] text-[#6d7ea6] hover:border-[#ff4d6d]/40 hover:text-[#ff8a9f]"
                  }`}
                >
                  <UserX size={13} />
                  {confirmDelete ? t("eraseConfirm") : t("deleteAccount")}
                </button>
              )}
            </Section>

            <Section icon={Languages} title={t("language")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[{ id: "auto", name: t("auto"), flag: "🌐" }, ...LANGS].map((l) => {
                  const on = settings.lang === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => set("lang", l.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all ${
                        on
                          ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/10 shadow-[0_0_16px_rgba(166,255,77,0.15)]"
                          : "border-white/10 bg-white/[0.02] hover:border-cyan-300/35 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-sm">{l.flag}</span>
                      <span className={`text-[10px] ${on ? "text-[#a6ff4d]" : "text-[#9fb2d8]"}`}>{l.name}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section icon={BarChart3} title={t("stats")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { k: t("statsRuns"), v: String(stats.runs) },
                  { k: t("statsOrbs"), v: String(stats.orbs) },
                  { k: t("statsBestLevel"), v: String(stats.bestLevel) },
                  { k: t("statsTime"), v: hhmm(stats.seconds) },
                ].map((s) => (
                  <div key={s.k} className="flex flex-col items-center rounded-xl border border-white/8 bg-white/[0.025] px-2 py-2.5">
                    <span
                      className="font-display text-base text-[#e8f4ff]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {s.v}
                    </span>
                    <span className="text-center text-[8px] tracking-[0.14em] text-[#6d7ea6]">{s.k}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (confirmErase) {
                    onErase();
                    setConfirmErase(false);
                  } else setConfirmErase(true);
                }}
                className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-display text-[10px] tracking-[0.16em] transition-all ${
                  confirmErase
                    ? "border-[#ff4d6d]/70 bg-[#ff4d6d]/15 text-[#ff4d6d]"
                    : "border-white/10 bg-white/[0.02] text-[#6d7ea6] hover:border-[#ff4d6d]/40 hover:text-[#ff8a9f]"
                }`}
              >
                <Trash2 size={13} />
                {confirmErase ? t("eraseConfirm") : t("eraseData")}
              </button>
            </Section>
          </>
        )}

        <span className="pb-2 text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
          {t("escToGoBack", { esc: "ESC" })} · {t("savedAutomatically")}
        </span>
      </div>
    </div>
  );
}
