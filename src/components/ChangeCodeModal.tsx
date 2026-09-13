import { useState } from "react";
import { KeyRound, X, Check } from "lucide-react";
import { CODE_LENGTH, changeCode } from "../game/accounts";
import type { TFunc } from "../i18n";

function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-[9px] tracking-[0.25em] text-[#6d7ea6]">{label}</span>
      <input
        inputMode="numeric"
        pattern="\d*"
        value={value}
        maxLength={CODE_LENGTH}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-center font-display text-lg tracking-[0.5em] text-[#e8f4ff] outline-none focus:border-[#a6ff4d]/60"
      />
    </label>
  );
}

export function ChangeCodeModal({
  accountId,
  t,
  onDone,
  onClose,
}: {
  accountId: string;
  t: TFunc;
  onDone: () => void;
  onClose: () => void;
}) {
  const [oldCode, setOld] = useState("");
  const [newCode, setNew] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = () => {
    const res = changeCode(accountId, oldCode, newCode);
    if (res.ok) {
      setOk(true);
      setErr(null);
      setTimeout(onDone, 850);
    } else {
      setErr(res.error === "badCode" ? t("errBadCode", { n: CODE_LENGTH }) : t("errWrongCode"));
      setOld("");
      setNew("");
    }
  };

  return (
    <div className="overlay-fade absolute inset-0 z-50 flex items-center justify-center bg-[#04050c]/85 p-4 backdrop-blur-lg">
      <div className="pop-in flex w-full max-w-xs flex-col gap-4 rounded-2xl border border-white/10 bg-[#080b18]/90 p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-[11px] tracking-[0.22em] text-[#e8f4ff]">
            <KeyRound size={14} className="text-[#a6ff4d]" /> {t("changeCode")}
          </span>
          <button onClick={onClose} className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {ok ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#a6ff4d]">
              <Check size={22} strokeWidth={3} className="text-[#04050c]" />
            </span>
            <span className="font-display text-[10px] tracking-[0.22em] text-[#a6ff4d]">{t("codeChanged")}</span>
          </div>
        ) : (
          <>
            <CodeField label={t("currentCode")} value={oldCode} onChange={(v) => (setOld(v), setErr(null))} />
            <CodeField label={t("newCode")} value={newCode} onChange={(v) => (setNew(v), setErr(null))} />
            {err && (
              <p className="text-center font-display text-[10px] tracking-[0.14em] text-[#ff4d6d]">{err}</p>
            )}
            <button
              onClick={submit}
              disabled={oldCode.length !== CODE_LENGTH || newCode.length !== CODE_LENGTH}
              className="btn-neon rounded-xl px-5 py-3 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-35"
            >
              {t("changeCode")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
