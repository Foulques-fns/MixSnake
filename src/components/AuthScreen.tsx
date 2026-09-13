import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, LogIn, User, Delete, ChevronLeft, Crown, Users, Ghost } from "lucide-react";
import {
  CODE_LENGTH,
  NAME_MAX,
  createAccount,
  loadAccounts,
  loadLeaderboard,
  login,
  type Account,
} from "../game/accounts";
import type { TFunc } from "../i18n";

type Mode = "pick" | "signin" | "signup";

/** Segmented PIN display — filled dots + a caret on the active slot. */
function CodeDots({ value, error }: { value: string; error: boolean }) {
  return (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <span
            key={i}
            className="flex h-12 w-11 items-center justify-center rounded-xl border font-display text-xl transition-all duration-150"
            style={{
              borderColor: error
                ? "rgba(255,77,109,0.7)"
                : active
                  ? "rgba(166,255,77,0.75)"
                  : filled
                    ? "rgba(56,232,255,0.5)"
                    : "rgba(159,178,216,0.22)",
              background: filled ? "rgba(56,232,255,0.08)" : "rgba(255,255,255,0.02)",
              boxShadow: active ? "0 0 16px rgba(166,255,77,0.25)" : undefined,
              color: "#e8f4ff",
            }}
          >
            {filled ? "•" : active ? <span className="blink text-[#a6ff4d]">|</span> : ""}
          </span>
        );
      })}
    </div>
  );
}

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  return (
    <div className="mx-auto grid max-w-[15rem] grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onKey(k)}
          className="btn-icon flex h-12 items-center justify-center rounded-xl font-display text-base"
        >
          {k === "back" ? <Delete size={16} /> : k === "clear" ? <span className="text-[10px]">CLR</span> : k}
        </button>
      ))}
    </div>
  );
}

export function AuthScreen({
  onAuthed,
  onGuest,
  onBack,
  canGoBack,
  t,
}: {
  onAuthed: (a: Account) => void;
  onGuest: () => void;
  onBack: () => void;
  canGoBack: boolean;
  t: TFunc;
}) {
  const [mode, setMode] = useState<Mode>("pick");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const accounts = useMemo(() => loadAccounts(), [mode]);
  const board = useMemo(() => loadLeaderboard().slice(0, 5), [mode]);

  useEffect(() => {
    if (mode !== "pick") setTimeout(() => nameRef.current?.focus(), 60);
    setCode("");
    setErr(null);
  }, [mode]);

  const submit = (theCode = code) => {
    if (theCode.length !== CODE_LENGTH) return;
    const res = mode === "signup" ? createAccount(name, theCode) : login(name, theCode);
    if (res.ok) {
      onAuthed(res.account);
      return;
    }
    setErr(res.error);
    setCode("");
  };

  const pressKey = (k: string) => {
    setErr(null);
    if (k === "back") return setCode((c) => c.slice(0, -1));
    if (k === "clear") return setCode("");
    setCode((c) => {
      if (c.length >= CODE_LENGTH) return c;
      const next = c + k;
      if (next.length === CODE_LENGTH) setTimeout(() => submit(next), 90);
      return next;
    });
  };

  const errMsg = err
    ? t(
        (
          {
            taken: "errTaken",
            short: "errShort",
            long: "errLong",
            chars: "errChars",
            badCode: "errBadCode",
            noUser: "errNoUser",
            wrongCode: "errWrongCode",
          } as const
        )[err as "taken"] ?? "errWrongCode",
        { n: CODE_LENGTH },
      )
    : null;

  return (
    <div className="overlay-fade absolute inset-0 z-40 flex items-center justify-center bg-[#04050c]/80 p-4 backdrop-blur-lg">
      <div className="flex max-h-full w-full max-w-sm flex-col gap-4 overflow-y-auto py-3">
        {/* header */}
        <div className="flex items-center justify-between">
          {canGoBack || mode !== "pick" ? (
            <button
              onClick={() => (mode === "pick" ? onBack() : setMode("pick"))}
              className="btn-icon flex h-9 w-9 items-center justify-center rounded-xl"
              aria-label="Back"
            >
              <ChevronLeft size={17} />
            </button>
          ) : (
            <span className="w-9" />
          )}
          <div className="flex flex-col items-center">
            <h2 className="font-display stroke-title text-xl font-black tracking-[0.22em] sm:text-2xl">
              {mode === "signup" ? t("createAccount") : mode === "signin" ? t("signIn") : t("profiles")}
            </h2>
            <span className="text-[9px] tracking-[0.3em] text-[#6d7ea6]">{t("profileSub")}</span>
          </div>
          <span className="w-9" />
        </div>

        {/* ------- pick ------- */}
        {mode === "pick" && (
          <>
            {accounts.length > 0 && (
              <div className="pop-in rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-2 text-cyan-200/50">
                  <Users size={12} />
                  <span className="font-display text-[10px] tracking-[0.3em]">{t("localPlayers")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {board.map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setName(r.name);
                        setMode("signin");
                      }}
                      className="score-row flex items-center justify-between rounded-lg px-2 py-1.5 text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`font-display w-4 text-center text-[10px] ${
                            i === 0 ? "text-[#ffd23f]" : "text-[#6d7ea6]"
                          }`}
                        >
                          {i === 0 ? <Crown size={11} className="mx-auto" /> : i + 1}
                        </span>
                        <span className="text-xs text-[#e8f4ff]">{r.name}</span>
                      </span>
                      <span
                        className="font-display text-[10px] text-[#38e8ff]/80"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {String(r.score).padStart(6, "0")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setMode("signup")}
                className="btn-neon flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-xs font-bold"
              >
                <UserPlus size={15} strokeWidth={3} /> {t("createAccount")}
              </button>
              {accounts.length > 0 && (
                <button
                  onClick={() => setMode("signin")}
                  className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[11px] font-bold"
                >
                  <LogIn size={14} /> {t("signIn")}
                </button>
              )}
              <button
                onClick={onGuest}
                className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[11px] font-bold"
              >
                <Ghost size={14} /> {t("playAsGuest")}
              </button>
            </div>
            <p className="text-center text-[9px] leading-relaxed text-[#6d7ea6]">{t("authHint")}</p>
          </>
        )}

        {/* ------- sign in / sign up ------- */}
        {mode !== "pick" && (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 focus-within:border-cyan-300/50">
              <User size={15} className="shrink-0 text-cyan-200/60" />
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, NAME_MAX));
                  setErr(null);
                }}
                placeholder={t("username")}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                list={mode === "signin" ? "known-users" : undefined}
                className="w-full bg-transparent font-display text-sm tracking-[0.1em] text-[#e8f4ff] outline-none placeholder:text-[#4d5a7d]"
              />
              {mode === "signin" && (
                <datalist id="known-users">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
              )}
            </label>

            <div className="flex flex-col gap-2.5">
              <span className="text-center font-display text-[9px] tracking-[0.3em] text-[#6d7ea6]">
                {t("secretCode", { n: CODE_LENGTH })}
              </span>
              <CodeDots value={code} error={!!err} />
            </div>

            {errMsg && (
              <p className="pop-in text-center font-display text-[10px] tracking-[0.14em] text-[#ff4d6d]">
                {errMsg}
              </p>
            )}

            <Keypad onKey={pressKey} />

            <button
              onClick={() => submit()}
              disabled={code.length !== CODE_LENGTH || name.trim().length === 0}
              className="btn-neon flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35"
            >
              {mode === "signup" ? <UserPlus size={15} strokeWidth={3} /> : <LogIn size={15} strokeWidth={3} />}
              {mode === "signup" ? t("createAccount") : t("signIn")}
            </button>

            <p className="text-center text-[9px] leading-relaxed text-[#6d7ea6]">
              {mode === "signup" ? t("signupHint") : t("signinHint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
