/* WebRTC transport over the public PeerJS broker.
   Three ways in: host a room code, join a room code, or auto-match a stranger.

   Random matchmaking trick: everyone races to claim a well-known queue id.
   Winner of the race becomes the host and waits; anyone who finds the id
   already taken connects straight to that waiting host. */

import Peer, { type DataConnection } from "peerjs";

export type NetRole = "host" | "guest";
export type NetStatus = "idle" | "searching" | "connecting" | "connected" | "failed" | "closed";

const PREFIX = "neonserpent-v1-";
const QUEUE_SLOTS = 6; // parallel lobbies to reduce collisions
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CODE_LEN = 4;

export function makeRoomCode(len = CODE_LEN): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/** Keeps only characters valid in a room code (any A-Z 0-9 typed by hand). */
export function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LEN);
}

export interface NetHandlers {
  onStatus: (s: NetStatus, info?: string) => void;
  onOpen: (role: NetRole) => void;
  onData: (msg: unknown) => void;
  onClose: () => void;
}

export class NetLink {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private h: NetHandlers;
  private dead = false;
  private timers: number[] = [];
  role: NetRole = "host";

  constructor(h: NetHandlers) {
    this.h = h;
  }

  private newPeer(id?: string): Promise<Peer> {
    return new Promise((resolve, reject) => {
      const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
      const to = window.setTimeout(() => reject(new Error("timeout")), 12000);
      p.on("open", () => {
        clearTimeout(to);
        resolve(p);
      });
      p.on("error", (e) => {
        clearTimeout(to);
        reject(e);
      });
    });
  }

  private bind(conn: DataConnection) {
    this.conn = conn;
    conn.on("data", (d) => this.h.onData(d));
    conn.on("close", () => {
      if (!this.dead) {
        this.h.onStatus("closed");
        this.h.onClose();
      }
    });
    conn.on("error", () => {
      if (!this.dead) this.h.onStatus("failed");
    });
    if (conn.open) {
      this.h.onStatus("connected");
      this.h.onOpen(this.role);
    } else {
      conn.on("open", () => {
        this.h.onStatus("connected");
        this.h.onOpen(this.role);
      });
    }
  }

  /** Host a private room. Resolves with the code friends should type. */
  async host(code: string): Promise<void> {
    this.role = "host";
    this.h.onStatus("searching", code);
    try {
      this.peer = await this.newPeer(PREFIX + code);
    } catch {
      this.h.onStatus("failed");
      return;
    }
    this.peer.on("connection", (c) => {
      if (this.conn) {
        c.close();
        return;
      }
      this.h.onStatus("connecting");
      this.bind(c);
    });
  }

  /** Join a friend's room code. */
  async join(code: string): Promise<void> {
    this.role = "guest";
    this.h.onStatus("connecting", code);
    try {
      this.peer = await this.newPeer();
    } catch {
      this.h.onStatus("failed");
      return;
    }
    const c = this.peer.connect(PREFIX + code, { reliable: true });
    const to = window.setTimeout(() => {
      if (!this.conn?.open) this.h.onStatus("failed");
    }, 12000);
    this.timers.push(to);
    c.on("error", () => this.h.onStatus("failed"));
    this.bind(c);
  }

  /**
   * Look for any stranger currently queueing.
   * Resolves false if nobody showed up before `waitMs` (caller falls back to a bot).
   */
  async findRandom(waitMs = 15000): Promise<boolean> {
    this.h.onStatus("searching");
    const slot = Math.floor(Math.random() * QUEUE_SLOTS);
    const order = [slot, ...Array.from({ length: QUEUE_SLOTS }, (_, i) => i).filter((i) => i !== slot)];

    // 1) try to connect to someone already waiting
    let scout: Peer;
    try {
      scout = await this.newPeer();
    } catch {
      this.h.onStatus("failed");
      return false;
    }
    for (const i of order.slice(0, 3)) {
      if (this.dead) return false;
      const target = `${PREFIX}q${i}`;
      const got = await new Promise<boolean>((resolve) => {
        const c = scout.connect(target, { reliable: true });
        const to = window.setTimeout(() => {
          try {
            c.close();
          } catch {
            /* noop */
          }
          resolve(false);
        }, 2600);
        c.on("open", () => {
          clearTimeout(to);
          resolve(true);
        });
        c.on("error", () => {
          clearTimeout(to);
          resolve(false);
        });
      });
      if (got) {
        this.peer = scout;
        this.role = "guest";
        const all = scout.connections as unknown as Record<string, DataConnection[]>;
        const c = all[target]?.[0];
        if (c) {
          this.h.onStatus("connecting");
          this.bind(c);
          return true;
        }
      }
    }
    scout.destroy();
    if (this.dead) return false;

    // 2) nobody waiting — become the host of a queue slot and wait
    for (const i of order) {
      if (this.dead) return false;
      try {
        this.peer = await this.newPeer(`${PREFIX}q${i}`);
        break;
      } catch {
        this.peer = null; // slot taken, try the next
      }
    }
    if (!this.peer) {
      this.h.onStatus("failed");
      return false;
    }
    this.role = "host";
    this.h.onStatus("searching");
    return new Promise<boolean>((resolve) => {
      const to = window.setTimeout(() => resolve(false), waitMs);
      this.timers.push(to);
      this.peer!.on("connection", (c) => {
        clearTimeout(to);
        if (this.conn) {
          c.close();
          return;
        }
        this.h.onStatus("connecting");
        this.bind(c);
        resolve(true);
      });
    });
  }

  send(msg: unknown) {
    if (this.conn?.open) {
      try {
        this.conn.send(msg);
      } catch {
        /* dropped frame */
      }
    }
  }

  get connected() {
    return !!this.conn?.open;
  }

  destroy() {
    this.dead = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    try {
      this.conn?.close();
    } catch {
      /* noop */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* noop */
    }
    this.conn = null;
    this.peer = null;
  }
}
