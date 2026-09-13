/* Local account system — unique username + secret code.
   Each account gets its own namespaced save slot (scores, stats, unlocks, settings). */

const ACCOUNTS_KEY = "neon-serpent:accounts:v1";
const SESSION_KEY = "neon-serpent:session:v1";

export const CODE_LENGTH = 4;
export const NAME_MIN = 3;
export const NAME_MAX = 14;

export interface Account {
  /** lowercase canonical id, used for the storage namespace */
  id: string;
  /** display name as typed */
  name: string;
  /** hashed code — never stored in clear */
  hash: string;
  created: number;
  lastSeen: number;
}

/* ---------------- hashing ---------------- */

/** FNV-1a — not cryptography, just avoids storing the code in clear text. */
function hashCode(id: string, code: string): string {
  let h = 0x811c9dc5;
  const input = `neon::${id}::${code}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // second pass for a longer digest
  let h2 = 0x9e3779b9;
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h.toString(36) + "-" + h2.toString(36);
}

/* ---------------- validation ---------------- */

export type NameError = "short" | "long" | "chars" | "taken" | null;

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

export function validateName(name: string, accounts: Account[]): NameError {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) return "short";
  if (trimmed.length > NAME_MAX) return "long";
  if (!NAME_RE.test(trimmed)) return "chars";
  if (accounts.some((a) => a.id === trimmed.toLowerCase())) return "taken";
  return null;
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

/* ---------------- persistence ---------------- */

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Account =>
        typeof a === "object" && a !== null && typeof (a as Account).id === "string",
    );
  } catch {
    return [];
  }
}

function writeAccounts(list: Account[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

export type AuthResult =
  | { ok: true; account: Account }
  | { ok: false; error: "taken" | "short" | "long" | "chars" | "badCode" | "noUser" | "wrongCode" };

export function createAccount(name: string, code: string): AuthResult {
  const accounts = loadAccounts();
  const nameErr = validateName(name, accounts);
  if (nameErr) return { ok: false, error: nameErr };
  if (!isValidCode(code)) return { ok: false, error: "badCode" };

  const trimmed = name.trim();
  const account: Account = {
    id: trimmed.toLowerCase(),
    name: trimmed,
    hash: hashCode(trimmed.toLowerCase(), code),
    created: Date.now(),
    lastSeen: Date.now(),
  };
  accounts.push(account);
  writeAccounts(accounts);
  return { ok: true, account };
}

export function login(name: string, code: string): AuthResult {
  const accounts = loadAccounts();
  const id = name.trim().toLowerCase();
  const account = accounts.find((a) => a.id === id);
  if (!account) return { ok: false, error: "noUser" };
  if (account.hash !== hashCode(id, code)) return { ok: false, error: "wrongCode" };
  account.lastSeen = Date.now();
  writeAccounts(accounts);
  return { ok: true, account };
}

/** Change the secret code (requires the current one). */
export function changeCode(id: string, oldCode: string, newCode: string): AuthResult {
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return { ok: false, error: "noUser" };
  if (account.hash !== hashCode(id, oldCode)) return { ok: false, error: "wrongCode" };
  if (!isValidCode(newCode)) return { ok: false, error: "badCode" };
  account.hash = hashCode(id, newCode);
  writeAccounts(accounts);
  return { ok: true, account };
}

/** Deletes the account and every save slot belonging to it. */
export function deleteAccount(id: string) {
  writeAccounts(loadAccounts().filter((a) => a.id !== id));
  try {
    const prefix = `neon-serpent:u:${id}:`;
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/* ---------------- session ---------------- */

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode */
  }
}

/* ---------------- cross-profile leaderboard ---------------- */

export interface RankRow {
  id: string;
  name: string;
  score: number;
  level: number;
}

function readNumberField(key: string, pick: (v: unknown) => number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    return pick(JSON.parse(raw));
  } catch {
    return 0;
  }
}

/** Best score + best level of every local profile, ranked. */
export function loadLeaderboard(): RankRow[] {
  const rows = loadAccounts().map((a) => {
    const base = `neon-serpent:u:${a.id}:`;
    const score = readNumberField(base + "neon-serpent:scores:v1", (v) =>
      Array.isArray(v) && v.length > 0 && typeof v[0]?.score === "number" ? v[0].score : 0,
    );
    const level = readNumberField(base + "neon-serpent:stats:v1", (v) =>
      typeof v === "object" && v !== null && typeof (v as { bestLevel?: number }).bestLevel === "number"
        ? (v as { bestLevel: number }).bestLevel
        : 1,
    );
    return { id: a.id, name: a.name, score, level: Math.max(1, level) };
  });
  return rows.sort((x, y) => y.score - x.score);
}

/* ---------------- active namespace ---------------- */

/** null = guest (legacy global keys, so existing progress is preserved) */
let activeId: string | null = null;

export function setActiveAccount(id: string | null) {
  activeId = id;
}

export function getActiveAccount(): string | null {
  return activeId;
}

/** Namespaces a storage key for the signed-in player. */
export function nsKey(base: string): string {
  return activeId === null ? base : `neon-serpent:u:${activeId}:${base}`;
}
