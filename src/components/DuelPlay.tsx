import { useCallback, useEffect, useRef, useState } from "react";
import { DuelGame, type BotLevel, type DirName, type DuelConfig, type Side, type Snapshot } from "../game/duel";
import { NetLink, makeRoomCode, sanitizeCode, type NetStatus } from "../net/peer";
import { recordDuel, loadDuel, type DuelRecord } from "../game/trophies";
import type { SoundFX } from "../game/audio";
import type { Haptics } from "../game/haptics";
import type { Settings } from "../game/settings";
import type { TFunc } from "../i18n";
import { MatchmakingScreen, DuelHud, DuelResultScreen, type DuelMode, type DuelOpponent } from "./DuelScreens";
import { DPad } from "./DPad";

type Stage = "matchmaking" | "playing" | "result";

type NetMsg = Partial<Omit<Snapshot, "t">> & {
  t: string;
  cfg?: DuelConfig;
  name?: string;
  d?: { x: number; y: number };
};

const MAZES = [0, 2, 3, 7];

function buildConfig(): DuelConfig {
  const portrait = window.innerHeight > window.innerWidth;
  return {
    cols: portrait ? 17 : 23,
    rows: portrait ? 21 : 17,
    maze: MAZES[Math.floor(Math.random() * MAZES.length)],
    seed: (Math.random() * 1e9) >>> 0,
    step: 118,
    wins: 2,
  };
}

export function DuelPlay({
  mode,
  opponent,
  botLevel,
  sound,
  haptics,
  settings,
  skinId,
  playerName,
  t,
  onExit,
  onLobby,
}: {
  mode: DuelMode;
  opponent: DuelOpponent;
  botLevel: BotLevel;
  sound: SoundFX;
  haptics: Haptics;
  settings: Settings;
  skinId: string;
  playerName: string;
  t: TFunc;
  onExit: () => void;
  onLobby: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<DuelGame | null>(null);
  const netRef = useRef<NetLink | null>(null);
  const startedRef = useRef(false);

  const [stage, setStage] = useState<Stage>(opponent === "bot" ? "playing" : "matchmaking");
  const [status, setStatus] = useState<NetStatus>("idle");
  const [friendTab, setFriendTab] = useState<"create" | "join">("create");
  const [hostCode, setHostCode] = useState(() => makeRoomCode());
  const [hosting, setHosting] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [outcome, setOutcome] = useState<"win" | "loss" | "draw">("draw");
  const [delta, setDelta] = useState(0);
  const [record, setRecord] = useState<DuelRecord>(() => loadDuel());
  const [scoreLine, setScoreLine] = useState({ me: 0, foe: 0 });
  const [foeName, setFoeName] = useState(t("foe"));
  const [useBot, setUseBot] = useState(opponent === "bot");

  const ranked = mode === "ranked";

  /* ---------------- finish ---------------- */

  const finish = useCallback(
    (winner: Side | "draw", mySide: Side, abandoned = false) => {
      const g = gameRef.current;
      const res: "win" | "loss" | "draw" =
        winner === "draw" ? "draw" : winner === mySide ? "win" : "loss";
      const { record: rec, delta: d } = recordDuel(res, ranked);
      setRecord(rec);
      setDelta(d);
      setOutcome(res);
      if (g) setScoreLine({ me: g.hud.myWins, foe: g.hud.foeWins });
      if (abandoned) setFoeName(t("opponentLeft"));
      if (res === "win") sound.newBest();
      else sound.die();
      setStage("result");
    },
    [ranked, sound, t],
  );

  /* ---------------- boot the match ---------------- */

  const startGame = useCallback(
    (side: Side, isHost: boolean, cfg: DuelConfig, bot: BotLevel | null) => {
      const canvas = canvasRef.current;
      if (!canvas || startedRef.current) return;
      startedRef.current = true;
      const g = new DuelGame(canvas, cfg, {
        sound,
        haptics,
        settings,
        side,
        isHost,
        botLevel: bot,
        skinA: side === "a" ? skinId : "sakura",
        skinB: side === "a" ? "sakura" : skinId,
      });
      g.onSnapshot = (s) => netRef.current?.send(s);
      g.onMatchEnd = (w) => finish(w, side);
      gameRef.current = g;
      setStage("playing");
    },
    [finish, haptics, settings, skinId, sound],
  );

  /* ---------------- networking ---------------- */

  /** Builds a link with the full handler set (used by every connection path). */
  const makeLink = useCallback(() => {
    const cfg = buildConfig();
    const link: NetLink = new NetLink({
      onStatus: (st) => {
        setStatus(st);
        // a taken code / dead room drops you back to the form so you can retry
        if (st === "failed") setHosting(false);
      },
      onOpen: (role) => {
        if (role === "host") {
          link.send({ t: "cfg", cfg, name: playerName, ranked });
          startGame("a", true, cfg, null);
        }
      },
      onData: (raw) => {
        const msg = raw as unknown as NetMsg;
        if (msg.t === "cfg" && msg.cfg) {
          setFoeName(msg.name || t("foe"));
          startGame("b", false, msg.cfg, null);
          link.send({ t: "hi", name: playerName });
        } else if (msg.t === "hi") {
          setFoeName(msg.name || t("foe"));
        } else if (msg.t === "s") {
          gameRef.current?.applySnapshot(msg as Snapshot);
        } else if (msg.t === "i" && msg.d) {
          gameRef.current?.applyRemoteDir(msg.d);
        }
      },
      onClose: () => {
        const g = gameRef.current;
        if (g && !g.matchWinner) finish(g.side, g.side, true);
      },
    });
    netRef.current = link;
    return link;
  }, [finish, playerName, ranked, startGame, t]);

  /** Host a room under the code shown on screen. */
  const createRoom = useCallback(() => {
    const code = sanitizeCode(hostCode);
    if (code.length < 4) return;
    setHostCode(code);
    netRef.current?.destroy();
    setHosting(true);
    void makeLink().host(code);
  }, [hostCode, makeLink]);

  /** Join a friend's room. */
  const joinRoom = useCallback(() => {
    const code = sanitizeCode(joinCode);
    if (code.length < 4) return;
    netRef.current?.destroy();
    setHosting(false);
    void makeLink().join(code);
  }, [joinCode, makeLink]);

  /** Drop the link and fall back to a bot. */
  const fallbackToBot = useCallback(() => {
    netRef.current?.destroy();
    netRef.current = null;
    setUseBot(true);
    setHosting(false);
    startGame("a", true, buildConfig(), botLevel);
  }, [botLevel, startGame]);

  // bot: start straight away. random: auto-search. friend: wait for the user.
  useEffect(() => {
    if (opponent === "bot") {
      startGame("a", true, buildConfig(), botLevel);
      return;
    }
    if (opponent !== "random") return;
    let cancelled = false;
    const link = makeLink();
    void link.findRandom(15000).then((found) => {
      if (cancelled || found) return;
      link.destroy();
      netRef.current = null;
      setUseBot(true);
      startGame("a", true, buildConfig(), botLevel);
    });
    return () => {
      cancelled = true;
      link.destroy();
      netRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent]);

  /* ---------------- lifecycle ---------------- */

  useEffect(() => {
    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
      startedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => gameRef.current?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  /* ---------------- input ---------------- */

  const steer = useCallback((d: DirName) => {
  const g = gameRef.current;
  if (!g) return;

  const vec = g.steer(d);
  if (!vec) return;

  if (!g.isHost) {
    netRef.current?.send({ t: "i", d: vec });
  }
}, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, DirName> = {
        arrowup: "up",
        w: "up",
        arrowdown: "down",
        s: "down",
        arrowleft: "left",
        a: "left",
        arrowright: "right",
        d: "right",
      };
      if (map[k]) {
        e.preventDefault();
        steer(map[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steer]);

  useEffect(() => {
    if (stage !== "playing" || settings.touchMode === "dpad") return;
    let sx = 0;
    let sy = 0;
    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? "right" : "left");
      else steer(dy > 0 ? "down" : "up");
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
    };
  }, [stage, settings.touchMode, steer]);

  /* ---------------- actions ---------------- */

  const quitMatch = () => {
    const g = gameRef.current;
    if (g && !g.matchWinner) {
      finish(g.side === "a" ? "b" : "a", g.side);
    } else onExit();
  };

  const rematch = () => {
    gameRef.current?.destroy();
    gameRef.current = null;
    startedRef.current = false;
    setFoeName(t("foe"));
    if (useBot || opponent === "bot") {
      startGame("a", true, buildConfig(), botLevel);
    } else {
      onLobby();
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block" />

      {stage === "playing" && (
        <>
          <DuelHud
            gameRef={gameRef}
            meName={playerName}
            foeName={useBot ? `${t("playBot")} · ${t(`bot${botLevel[0].toUpperCase()}${botLevel.slice(1)}` as "botEasy")}` : foeName}
            ranked={ranked}
            onQuit={quitMatch}
            t={t}
          />
          {settings.touchMode === "dpad" && <DPad onDir={steer} />}
        </>
      )}

      {stage === "matchmaking" && (
        <MatchmakingScreen
          status={status}
          opponent={opponent}
          friendTab={friendTab}
          onFriendTab={setFriendTab}
          hostCode={hostCode}
          onHostCodeChange={(v) => setHostCode(sanitizeCode(v))}
          onReroll={() => setHostCode(makeRoomCode())}
          onCreateRoom={createRoom}
          hosting={hosting}
          joinCode={joinCode}
          onJoinCodeChange={(v) => setJoinCode(sanitizeCode(v))}
          onJoin={joinRoom}
          onCancel={onExit}
          onUseBot={fallbackToBot}
          t={t}
        />
      )}

      {stage === "result" && (
        <DuelResultScreen
          outcome={outcome}
          ranked={ranked}
          delta={delta}
          record={record}
          myWins={scoreLine.me}
          foeWins={scoreLine.foe}
          onRematch={rematch}
          onLobby={onLobby}
          onQuit={onExit}
          t={t}
        />
      )}
    </>
  );
}
