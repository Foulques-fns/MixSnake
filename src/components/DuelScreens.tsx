import { useEffect, useRef, useState } from "react";
import {
  Swords,
  Trophy,
  Bot,
  Users,
  Globe,
  ChevronLeft,
  Copy,
  Check,
  Loader2,
  Crown,
  X,
  Wifi,
  WifiOff,
  Dices,
  Medal,
} from "lucide-react";
import { TIERS, tierFor, nextTier, loadLadder, type DuelRecord } from "../game/trophies";
import type { BotLevel } from "../game/duel";
import type { TFunc } from "../i18n";

export type DuelMode = "ranked" | "casual";
export type DuelOpponent = "bot" | "friend" | "random";

/* ---------------- rank badge ---------------- */

export function RankBadge({ trophies, size = "md" }: { trophies: number; size?: "sm" | "md" | "lg" }) {
  const tier = tierFor(trophies);
  const px = size === "lg" ? 46 : size === "md" ? 32 : 22;
  return (
    <span
      className="relative flex items-center justify-center rounded-xl"
      style={{
        width: px,
        height: px,
        background: `linear-gradient(145deg, ${tier.color}33, ${tier.color}12)`,
        border: `1px solid ${tier.color}88`,
        boxShadow: `0 0 ${px / 2.6}px ${tier.glow}`,
      }}
    >
      <Medal size={px * 0.55} style={{ color: tier.color }} />
    </span>
  );
}

export function TrophyPill({ trophies }: { trophies: number }) {
  const tier = tierFor(trophies);
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: `${tier.color}18`, border: `1px solid ${tier.color}55` }}
    >
      <Trophy size={11} style={{ color: tier.color }} />
      <span className="font-display text-[10px]" style={{ color: tier.color, fontVariantNumeric: "tabular-nums" }}>
        {trophies}
      </span>
    </span>
  );
}

/* ---------------- lobby ---------------- */

export function DuelLobby({
  record,
  playerName,
  onStart,
  onBack,
  t,
}: {
  record: DuelRecord;
  playerName: string | null;
  onStart: (mode: DuelMode, opp: DuelOpponent, bot: BotLevel) => void;
  onBack: () => void;
  t: TFunc;
}) {
  const [mode, setMode] = useState<DuelMode>("ranked");
  const [bot, setBot] = useState<BotLevel>("normal");
  const [showLadder, setShowLadder] = useState(false);
  const tier = tierFor(record.trophies);
  const nxt = nextTier(record.trophies);
  const ladder = showLadder ? loadLadder() : [];
  const total = record.wins + record.losses + record.draws;
  const winRate = total > 0 ? Math.round((record.wins / total) * 100) : 0;

  return (
    <div className="overlay-fade absolute inset-0 z-30 flex items-center justify-center bg-[#04050c]/72 p-4 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-lg flex-col gap-3.5 overflow-y-auto py-2">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl" aria-label="Back">
            <ChevronLeft size={17} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-display stroke-title text-2xl font-black tracking-[0.22em] sm:text-3xl">
              {t("duel")}
            </h2>
            <span className="text-[10px] tracking-[0.3em] text-[#6d7ea6]">{t("duelSub")}</span>
          </div>
          <button
            onClick={() => setShowLadder((v) => !v)}
            className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label={t("worldRanking")}
          >
            <Globe size={16} />
          </button>
        </div>

        {/* rank card */}
        <div className="pop-in flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
          <RankBadge trophies={record.trophies} size="lg" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-sm tracking-[0.14em]" style={{ color: tier.color }}>
                {tier.name}
              </span>
              <span className="flex items-center gap-1 font-display text-sm text-[#e8f4ff]">
                <Trophy size={12} style={{ color: tier.color }} />
                {record.trophies}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: nxt
                    ? `${Math.min(100, ((record.trophies - tier.min) / (nxt.min - tier.min)) * 100)}%`
                    : "100%",
                  background: `linear-gradient(90deg, ${tier.color}, #ffffff88)`,
                  boxShadow: `0 0 8px ${tier.glow}`,
                }}
              />
            </div>
            <span className="text-[9px] tracking-wider text-[#6d7ea6]">
              {nxt ? t("toNextTier", { n: nxt.min - record.trophies, tier: nxt.name }) : t("maxTier")}
            </span>
          </div>
        </div>

        {/* record strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { k: t("wins"), v: record.wins, c: "#a6ff4d" },
            { k: t("losses"), v: record.losses, c: "#ff4d6d" },
            { k: t("winRate"), v: `${winRate}%`, c: "#38e8ff" },
            { k: t("peak"), v: record.peak, c: "#ffd23f" },
          ].map((s) => (
            <div key={s.k} className="flex flex-col items-center rounded-xl border border-white/8 bg-white/[0.025] py-2">
              <span className="font-display text-sm" style={{ color: s.c, fontVariantNumeric: "tabular-nums" }}>
                {s.v}
              </span>
              <span className="text-[8px] tracking-[0.12em] text-[#6d7ea6]">{s.k}</span>
            </div>
          ))}
        </div>

        {showLadder ? (
          <div className="pop-in rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <div className="mb-2 flex items-center gap-2 text-cyan-200/60">
              <Globe size={12} />
              <span className="font-display text-[10px] tracking-[0.3em]">{t("worldRanking")}</span>
            </div>
            {ladder.length === 0 ? (
              <p className="py-3 text-center text-xs text-[#6d7ea6]">{t("noRanked")}</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {ladder.slice(0, 10).map((r, i) => (
                  <div
                    key={r.id}
                    className={`score-row flex items-center justify-between rounded-lg px-2 py-1.5 ${
                      r.name === playerName ? "bg-[#a6ff4d]/10 outline outline-1 outline-[#a6ff4d]/35" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`font-display w-5 text-center text-[10px] ${i === 0 ? "text-[#ffd23f]" : "text-[#6d7ea6]"}`}>
                        {i === 0 ? <Crown size={11} className="mx-auto" /> : i + 1}
                      </span>
                      <RankBadge trophies={r.trophies} size="sm" />
                      <span className="text-xs text-[#e8f4ff]">{r.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[9px] text-[#6d7ea6]">
                        {r.wins}W / {r.losses}L
                      </span>
                      <TrophyPill trophies={r.trophies} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-center text-[9px] leading-relaxed text-[#6d7ea6]">{t("ladderNote")}</p>
          </div>
        ) : (
          <>
            {/* ranked vs casual */}
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(
                [
                  { id: "ranked" as DuelMode, label: t("ranked"), icon: Trophy },
                  { id: "casual" as DuelMode, label: t("casual"), icon: Swords },
                ]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 font-display text-[10px] tracking-[0.16em] transition-all ${
                    mode === m.id
                      ? "bg-[#a6ff4d]/15 text-[#a6ff4d] shadow-[0_0_16px_rgba(166,255,77,0.15)]"
                      : "text-[#6d7ea6] hover:text-[#9fb2d8]"
                  }`}
                >
                  <m.icon size={13} />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="-mt-1.5 text-center text-[10px] text-[#6d7ea6]">
              {mode === "ranked" ? t("rankedHint") : t("casualHint")}
            </p>

            {/* opponent */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onStart(mode, "random", bot)}
                className="btn-neon flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-xs font-bold"
              >
                <Globe size={16} strokeWidth={3} /> {t("findOpponent")}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onStart(mode, "friend", bot)}
                  className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold"
                >
                  <Users size={14} /> {t("playFriend")}
                </button>
                <button
                  onClick={() => onStart(mode, "bot", bot)}
                  className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-bold"
                >
                  <Bot size={14} /> {t("playBot")}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center gap-2 text-cyan-200/60">
                <Bot size={12} />
                <span className="font-display text-[10px] tracking-[0.3em]">{t("botLevel")}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "easy" as BotLevel, label: t("botEasy") },
                    { id: "normal" as BotLevel, label: t("botNormal") },
                    { id: "hard" as BotLevel, label: t("botHard") },
                  ]
                ).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBot(b.id)}
                    className={`rounded-xl border px-2 py-2 font-display text-[9px] tracking-[0.12em] transition-all ${
                      bot === b.id
                        ? "border-[#a6ff4d]/60 bg-[#a6ff4d]/10 text-[#a6ff4d]"
                        : "border-white/10 bg-white/[0.02] text-[#9fb2d8] hover:border-cyan-300/35"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <span className="pb-2 text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
          {t("escToGoBack", { esc: "ESC" })}
        </span>
      </div>
    </div>
  );
}

/* ---------------- matchmaking ---------------- */

export function MatchmakingScreen({
  status,
  opponent,
  friendTab,
  onFriendTab,
  hostCode,
  onHostCodeChange,
  onReroll,
  onCreateRoom,
  hosting,
  joinCode,
  onJoinCodeChange,
  onJoin,
  onCancel,
  onUseBot,
  t,
}: {
  status: string;
  opponent: DuelOpponent;
  friendTab: "create" | "join";
  onFriendTab: (v: "create" | "join") => void;
  hostCode: string;
  onHostCodeChange: (v: string) => void;
  onReroll: () => void;
  onCreateRoom: () => void;
  hosting: boolean;
  joinCode: string;
  onJoinCodeChange: (v: string) => void;
  onJoin: () => void;
  onCancel: () => void;
  onUseBot: () => void;
  t: TFunc;
}) {
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);

  const failed = status === "failed";
  const connected = status === "connected";
  const friend = opponent === "friend";
  /** the friend screen only spins once a room is actually live */
  const busy = friend ? hosting || friendTab === "join" : true;

  const headline = failed
    ? friend && hosting
      ? t("codeInUse")
      : t("connectFailed")
    : connected
      ? t("opponentFound")
      : friend
        ? hosting
          ? t("waitingFriend")
          : t("createOrJoin")
        : t("searchingWorld");

  const spinning = busy && !failed && !connected;

  return (
    <div className="overlay-fade absolute inset-0 z-40 flex items-center justify-center bg-[#04050c]/85 p-4 backdrop-blur-lg">
      <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-4 overflow-y-auto py-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {spinning && <span className="pulse-ring absolute inset-0 rounded-full border border-[#a6ff4d]/25" />}
          {failed ? (
            <WifiOff size={32} className="text-[#ff4d6d]" />
          ) : connected ? (
            <Wifi size={32} className="text-[#a6ff4d]" />
          ) : spinning ? (
            <Loader2 size={32} className="animate-spin text-[#38e8ff]" />
          ) : (
            <Users size={32} className="text-[#38e8ff]" />
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span
            className="text-center font-display text-sm tracking-[0.18em]"
            style={{ color: failed ? "#ff4d6d" : "#e8f4ff" }}
          >
            {headline}
            {spinning ? ".".repeat(dots) : ""}
          </span>
          {opponent === "random" && !failed && !connected && (
            <span className="text-center text-[10px] leading-relaxed text-[#6d7ea6]">{t("randomHint")}</span>
          )}
        </div>

        {/* ---------------- friend: create / join ---------------- */}
        {friend && !connected && (
          <>
            {!hosting && (
              <div className="flex w-full gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {(
                  [
                    { id: "create" as const, label: t("createTab") },
                    { id: "join" as const, label: t("joinTab") },
                  ]
                ).map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => onFriendTab(tb.id)}
                    className={`flex-1 rounded-lg px-3 py-2 font-display text-[10px] tracking-[0.16em] transition-all ${
                      friendTab === tb.id
                        ? "bg-[#a6ff4d]/15 text-[#a6ff4d] shadow-[0_0_14px_rgba(166,255,77,0.14)]"
                        : "text-[#6d7ea6] hover:text-[#9fb2d8]"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
            )}

            {/* CREATE */}
            {friendTab === "create" && (
              <div className="flex w-full flex-col items-center gap-2.5">
                <span className="font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
                  {hosting ? t("shareCode") : t("yourCode")}
                </span>

                {hosting ? (
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(hostCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-[#a6ff4d]/45 bg-[#a6ff4d]/8 px-6 py-3"
                  >
                    <span className="font-display text-3xl tracking-[0.35em] text-[#a6ff4d]">{hostCode}</span>
                    {copied ? (
                      <Check size={16} className="text-[#a6ff4d]" />
                    ) : (
                      <Copy size={16} className="text-[#6d7ea6]" />
                    )}
                  </button>
                ) : (
                  <>
                    <div className="flex w-full items-center gap-2">
                      <input
                        value={hostCode}
                        onChange={(e) => onHostCodeChange(e.target.value)}
                        placeholder="CODE"
                        maxLength={4}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-center font-display text-2xl tracking-[0.35em] text-[#e8f4ff] outline-none focus:border-[#a6ff4d]/60"
                      />
                      <button
                        onClick={onReroll}
                        title={t("reroll")}
                        aria-label={t("reroll")}
                        className="btn-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      >
                        <Dices size={18} />
                      </button>
                    </div>
                    <span className="text-center text-[9px] leading-relaxed text-[#6d7ea6]">{t("editCodeHint")}</span>
                    <button
                      onClick={onCreateRoom}
                      disabled={hostCode.length < 4}
                      className="btn-neon w-full rounded-xl px-5 py-3 text-[11px] font-bold disabled:opacity-35"
                    >
                      {t("createRoom")}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* JOIN */}
            {friendTab === "join" && !hosting && (
              <div className="flex w-full flex-col gap-2">
                <span className="text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
                  {t("friendCode")}
                </span>
                <input
                  value={joinCode}
                  onChange={(e) => onJoinCodeChange(e.target.value)}
                  placeholder="CODE"
                  maxLength={4}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-center font-display text-2xl tracking-[0.35em] text-[#e8f4ff] outline-none focus:border-[#a6ff4d]/60"
                />
                <button
                  onClick={onJoin}
                  disabled={joinCode.length < 4}
                  className="btn-neon rounded-xl px-5 py-3 text-[11px] font-bold disabled:opacity-35"
                >
                  {t("join")}
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex w-full flex-col gap-2">
          {(failed || opponent === "random") && !connected && (
            <button
              onClick={onUseBot}
              className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[10px] font-bold"
            >
              <Bot size={14} /> {t("playBotInstead")}
            </button>
          )}
          <button
            onClick={onCancel}
            className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[10px] font-bold"
          >
            <X size={14} /> {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ---------------- in-duel HUD ---------------- */

export function DuelHud({
  gameRef,
  meName,
  foeName,
  ranked,
  onQuit,
  t,
}: {
  gameRef: React.RefObject<import("../game/duel").DuelGame | null>;
  meName: string;
  foeName: string;
  ranked: boolean;
  onQuit: () => void;
  t: TFunc;
}) {
  const mine = useRef<HTMLSpanElement>(null);
  const foes = useRef<HTMLSpanElement>(null);
  const roundEl = useRef<HTMLSpanElement>(null);
  const cdEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tickFn = () => {
      const g = gameRef.current;
      if (g) {
        const h = g.hud;
        if (mine.current) mine.current.textContent = String(h.myWins);
        if (foes.current) foes.current.textContent = String(h.foeWins);
        if (roundEl.current) roundEl.current.textContent = String(h.round);
        if (cdEl.current) {
          const show = h.phase === "countdown" && h.cd > 0;
          cdEl.current.style.opacity = show ? "1" : "0";
          cdEl.current.textContent = show ? String(h.cd) : "";
        }
      }
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3.5">
        <div className="flex flex-col items-start">
          <span className="font-display text-[9px] tracking-[0.2em] text-[#a6ff4d]">{meName}</span>
          <span ref={mine} className="font-display text-2xl leading-none text-[#a6ff4d]">
            0
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`font-display rounded-full px-2.5 py-0.5 text-[8px] tracking-[0.2em] ${
              ranked ? "bg-[#ffd23f]/15 text-[#ffd23f]" : "bg-white/8 text-[#9fb2d8]"
            }`}
          >
            {ranked ? t("ranked") : t("casual")}
          </span>
          <span className="text-[8px] tracking-[0.2em] text-[#6d7ea6]">
            {t("round")} <span ref={roundEl}>1</span>
          </span>
          <button onClick={onQuit} className="btn-icon pointer-events-auto mt-1 flex h-7 w-7 items-center justify-center rounded-lg">
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-col items-end">
          <span className="font-display text-[9px] tracking-[0.2em] text-[#ff6ec7]">{foeName}</span>
          <span ref={foes} className="font-display text-2xl leading-none text-[#ff6ec7]">
            0
          </span>
        </div>
      </div>

      <div
        ref={cdEl}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center font-display text-7xl text-[#e8f4ff] transition-opacity duration-200"
        style={{ opacity: 0, textShadow: "0 0 30px rgba(166,255,77,0.5)" }}
      />
    </>
  );
}

/* ---------------- result ---------------- */

export function DuelResultScreen({
  outcome,
  ranked,
  delta,
  record,
  myWins,
  foeWins,
  onRematch,
  onLobby,
  onQuit,
  t,
}: {
  outcome: "win" | "loss" | "draw";
  ranked: boolean;
  delta: number;
  record: DuelRecord;
  myWins: number;
  foeWins: number;
  onRematch: () => void;
  onLobby: () => void;
  onQuit: () => void;
  t: TFunc;
}) {
  const isWin = outcome === "win";
  const isDraw = outcome === "draw";
  const title = isWin ? t("victory") : isDraw ? t("draw") : t("defeat");
  const color = isWin ? "#a6ff4d" : isDraw ? "#38e8ff" : "#ff4d6d";
  const tier = tierFor(record.trophies);

  return (
    <div className="overlay-fade absolute inset-0 z-40 flex items-center justify-center bg-[#04050c]/80 p-4 backdrop-blur-lg">
      <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-4 overflow-y-auto py-3">
        {isWin ? <Crown size={26} style={{ color }} /> : <Swords size={24} style={{ color }} />}
        <h2
          className="font-display text-4xl font-black tracking-[0.14em] sm:text-5xl"
          style={{ color, textShadow: `0 0 22px ${color}66, 0 0 70px ${color}33` }}
        >
          {title}
        </h2>

        <div className="flex items-center gap-4 font-display text-3xl">
          <span className="text-[#a6ff4d]">{myWins}</span>
          <span className="text-sm text-[#6d7ea6]">—</span>
          <span className="text-[#ff6ec7]">{foeWins}</span>
        </div>

        {ranked ? (
          <div className="pop-in flex w-full flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-3">
              <RankBadge trophies={record.trophies} size="md" />
              <div className="flex flex-col">
                <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: tier.color }}>
                  {tier.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <Trophy size={12} style={{ color: tier.color }} />
                  <span className="font-display text-base text-[#e8f4ff]">{record.trophies}</span>
                  {delta !== 0 && (
                    <span
                      className="font-display text-xs"
                      style={{ color: delta > 0 ? "#a6ff4d" : "#ff4d6d" }}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </span>
              </div>
            </div>
            {record.streak > 1 && (
              <span className="font-display text-[9px] tracking-[0.2em] text-[#ffd23f]">
                {t("winStreak", { n: record.streak })}
              </span>
            )}
          </div>
        ) : (
          <span className="font-display text-[9px] tracking-[0.24em] text-[#6d7ea6]">{t("casualNoTrophies")}</span>
        )}

        <div className="flex w-full flex-col gap-2.5">
          <button onClick={onRematch} className="btn-neon rounded-xl px-5 py-3.5 text-[11px] font-bold">
            {t("rematch")}
          </button>
          <div className="flex gap-2">
            <button onClick={onLobby} className="btn-ghost flex-1 rounded-xl px-4 py-3 text-[10px] font-bold">
              {t("duel")}
            </button>
            <button onClick={onQuit} className="btn-ghost flex-1 rounded-xl px-4 py-3 text-[10px] font-bold">
              {t("menu")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TIERS };
