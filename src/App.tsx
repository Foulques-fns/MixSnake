import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { SnakeGame, type GameMode } from "./game/engine";
import {
  loadScores,
  saveScore,
  loadStats,
  loadLevelBests,
  recordLevelScore,
  eraseAllData,
  type ScoreEntry,
  type Stats,
} from "./game/storage";
import { loadSkinId, saveSkinId, isUnlocked, getSkin } from "./game/skins";
import { LEVELS, isLevelUnlocked } from "./game/levels";
import { loadSettings, saveSettings, type Settings } from "./game/settings";
import { SettingsScreen } from "./components/SettingsScreen";
import { DPad } from "./components/DPad";
import { makeT, resolveLang } from "./i18n";
import { AuthScreen } from "./components/AuthScreen";
import { ChangeCodeModal } from "./components/ChangeCodeModal";
import { DuelLobby, type DuelMode, type DuelOpponent } from "./components/DuelScreens";
import { DuelPlay } from "./components/DuelPlay";
import { loadDuel } from "./game/trophies";
import type { BotLevel } from "./game/duel";
import {
  deleteAccount,
  loadAccounts,
  loadSession,
  saveSession,
  setActiveAccount,
  type Account,
} from "./game/accounts";
import { Hud } from "./components/Hud";
import {
  StartScreen,
  PauseScreen,
  GameOverScreen,
  SkinScreen,
  LevelScreen,
  type RunResult,
} from "./components/Screens";

type Screen = "auth" | "menu" | "skins" | "levels" | "settings" | "duel" | "duelPlay" | "playing" | "paused" | "over";

/** Restore the signed-in profile before any storage read happens. */
const bootAccount: Account | null = (() => {
  const id = loadSession();
  if (!id) return null;
  const acc = loadAccounts().find((a) => a.id === id) ?? null;
  setActiveAccount(acc ? acc.id : null);
  return acc;
})();

export default function App() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);

  const [account, setAccount] = useState<Account | null>(bootAccount);
  const [screen, setScreen] = useState<Screen>(
    bootAccount || loadSession() === "guest" ? "menu" : "auth",
  );
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [skinId, setSkinId] = useState<string>(() => loadSkinId());
  const [bestLevel, setBestLevel] = useState<number>(() => loadStats().bestLevel);
  const [levelBests, setLevelBests] = useState<Record<number, number>>(() => loadLevelBests());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [showChangeCode, setShowChangeCode] = useState(false);
  const [duelRecord, setDuelRecord] = useState(() => loadDuel());
  const [duelCfg, setDuelCfg] = useState<{ mode: DuelMode; opp: DuelOpponent; bot: BotLevel }>({
    mode: "ranked",
    opp: "bot",
    bot: "normal",
  });

  const t = useMemo(() => makeT(resolveLang(settings.lang)), [settings.lang]);

  /** the run config the player last chose — retried by "instant restart" */
  const runCfg = useRef<{ level: number; mode: GameMode }>({ level: 1, mode: "arena" });

  const screenRef = useRef(screen);
  screenRef.current = screen;
  const touchModeRef = useRef(settings.touchMode);
  touchModeRef.current = settings.touchMode;

  /* ---------------- actions ---------------- */

  /** Replay the currently chosen arena + mode. */
  const startGame = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.start(runCfg.current);
    setScreen("playing");
  }, []);

  /** Pick an arena from the select screen and dive in. */
  const pickLevel = useCallback((level: number, mode: GameMode) => {
    const g = gameRef.current;
    if (!g) return;
    runCfg.current = { level, mode };
    g.start(runCfg.current);
    setScreen("playing");
  }, []);

  const openLevels = useCallback(() => {
    const g = gameRef.current;
    g?.sound.unlock();
    g?.sound.ui();
    setLevelBests(loadLevelBests());
    setBestLevel(loadStats().bestLevel);
    setScreen("levels");
  }, []);

  const pauseGame = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.phase !== "playing") return;
    g.pause();
    setScreen("paused");
  }, []);

  const resumeGame = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.resume();
    setScreen("playing");
  }, []);

  const quitToMenu = useCallback(() => {
    gameRef.current?.toIdle();
    setScreen("menu");
  }, []);

  const toggleMute = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.sound.unlock();
    setMuted(g.sound.toggleMuted());
  }, []);

  const changeSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    const g = gameRef.current;
    if (!g) return;
    g.sound.unlock();
    g.applySettings(s);
    g.sound.ui();
    // audition the soundtrack while browsing settings
    if (screenRef.current === "settings" && g.phase === "idle") {
      if (s.music === "off") g.music.stop();
      else g.music.play();
    }
  }, []);

  /** remembers where SETTINGS was opened from, so BACK returns there */
  const settingsFrom = useRef<Screen>("menu");

  /** Re-read every profile-scoped slice after a profile switch. */
  const reloadProfile = useCallback(() => {
    const g = gameRef.current;
    const fresh = loadSettings();
    setSettings(fresh);
    setStats(loadStats());
    setScores(loadScores());
    setLevelBests(loadLevelBests());
    setBestLevel(loadStats().bestLevel);
    setSkinId(loadSkinId());
    setDuelRecord(loadDuel());
    runCfg.current = { level: 1, mode: "arena" };
    if (g) {
      g.applySettings(fresh);
      g.setSkin(loadSkinId());
      g.hud.best = loadScores()[0]?.score ?? 0;
      g.reloadMuted();
      setMuted(g.sound.muted);
    }
  }, []);

  const signIn = useCallback(
    (acc: Account) => {
      setActiveAccount(acc.id);
      saveSession(acc.id);
      setAccount(acc);
      reloadProfile();
      gameRef.current?.sound.unlock();
      gameRef.current?.sound.start();
      setScreen("menu");
    },
    [reloadProfile],
  );

  const playAsGuest = useCallback(() => {
    setActiveAccount(null);
    saveSession("guest");
    setAccount(null);
    reloadProfile();
    gameRef.current?.sound.unlock();
    setScreen("menu");
  }, [reloadProfile]);

  const signOut = useCallback(() => {
    gameRef.current?.toIdle();
    setActiveAccount(null);
    saveSession(null);
    setAccount(null);
    reloadProfile();
    setScreen("auth");
  }, [reloadProfile]);

  const removeAccount = useCallback(() => {
    if (!account) return;
    deleteAccount(account.id);
    gameRef.current?.toIdle();
    setActiveAccount(null);
    saveSession(null);
    setAccount(null);
    reloadProfile();
    setScreen("auth");
  }, [account, reloadProfile]);

  const eraseData = useCallback(() => {
    eraseAllData();
    const fresh = loadSettings();
    setSettings(fresh);
    setStats(loadStats());
    setScores([]);
    setLevelBests({});
    setBestLevel(1);
    setSkinId(loadSkinId());
    const g = gameRef.current;
    g?.applySettings(fresh);
    g?.setSkin(loadSkinId());
    g?.sound.setMuted(false);
    setMuted(false);
  }, []);

  const openDuel = useCallback(() => {
    const g = gameRef.current;
    g?.toIdle();
    g?.sound.unlock();
    g?.sound.ui();
    setDuelRecord(loadDuel());
    setScreen("duel");
  }, []);

  const openSettings = useCallback(() => {
    const g = gameRef.current;
    g?.sound.unlock();
    g?.sound.ui();
    settingsFrom.current = screenRef.current === "paused" ? "paused" : "menu";
    setScreen("settings");
  }, []);

  const closeSettings = useCallback(() => {
    const g = gameRef.current;
    // stop the preview unless a real run is underway
    if (g && g.phase === "idle") g.music.stop();
    setScreen(settingsFrom.current === "paused" ? "paused" : "menu");
  }, []);

  const openSkins = useCallback(() => {
    const g = gameRef.current;
    g?.sound.unlock();
    g?.sound.ui();
    setBestLevel(loadStats().bestLevel);
    setScreen("skins");
  }, []);

  const selectSkin = useCallback((id: string) => {
    const g = gameRef.current;
    const best = loadScores()[0]?.score ?? 0;
    if (!isUnlocked(getSkin(id), best, loadStats().bestLevel)) return;
    saveSkinId(id);
    g?.setSkin(id);
    g?.sound.unlock();
    g?.sound.ui();
    setSkinId(id);
  }, []);

  /* keep the document language in sync for screen readers */
  useEffect(() => {
    document.documentElement.lang = resolveLang(settings.lang);
  }, [settings.lang]);

  /* ---------------- engine lifecycle ---------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new SnakeGame(canvas, ({ score, len, level, startLevel, mode }) => {
      const { list, rank } = saveScore(score, len, level);
      const prevBests = loadLevelBests();
      const st = loadStats();
      // credit the arena you actually played
      const bests = recordLevelScore(startLevel, score);
      const nextLevel = startLevel + 1;
      const wasLocked =
        nextLevel <= LEVELS.length && !isLevelUnlocked(nextLevel, prevBests, st.bestLevel);
      const nowUnlocked =
        nextLevel <= LEVELS.length && isLevelUnlocked(nextLevel, bests, st.bestLevel);
      const unlockedNext = wasLocked && nowUnlocked ? LEVELS[nextLevel - 1].name : undefined;

      setScores(list);
      setLevelBests(bests);
      setResult({ score, len, level, startLevel, mode, rank, unlockedNext });
      setBestLevel(st.bestLevel);
      setStats(loadStats());
      if ((rank === 0 && score > 0) || unlockedNext) game.sound.newBest();
      setScreen("over");
    });
    gameRef.current = game;
    game.applySettings(loadSettings());
    setMuted(game.sound.muted);
    setScores(loadScores());

    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const onVis = () => {
      if (document.hidden && game.phase === "playing") {
        game.pause();
        setScreen("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVis);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      g.sound.unlock();

      const s = screenRef.current;
      if (s === "playing") {
        switch (key) {
          case "arrowup":
          case "w":
            g.setDirection("up");
            return;
          case "arrowdown":
          case "s":
            g.setDirection("down");
            return;
          case "arrowleft":
          case "a":
            g.setDirection("left");
            return;
          case "arrowright":
          case "d":
            g.setDirection("right");
            return;
          case "p":
          case "escape":
            pauseGame();
            return;
        }
      } else if (s === "paused") {
        if (key === "p" || key === "escape" || key === "enter" || key === " ") resumeGame();
      } else if (s === "settings") {
        if (key === "escape") closeSettings();
      } else if (s === "skins" || s === "levels" || s === "duel") {
        if (key === "escape") setScreen("menu");
      } else if (s === "menu") {
        if (key === "enter" || key === " ") startGame();
        if (key === "l") openLevels();
        if (key === "o") openSettings();
        if (key === "v") openDuel();
      } else if (s === "over") {
        if (key === "enter" || key === " ") startGame();
        if (key === "l") openLevels();
        if (key === "o") openSettings();
        if (key === "escape") quitToMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pauseGame, resumeGame, startGame, quitToMenu, openLevels, openSettings, closeSettings, openDuel]);

  /* ---------------- touch (swipe steering) ---------------- */

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    const THRESHOLD = 18;

    const onStart = (e: TouchEvent) => {
      gameRef.current?.sound.unlock();
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
  if (screenRef.current !== "playing") return;
  if (touchModeRef.current === "dpad") return;

  e.preventDefault();
      const g = gameRef.current;
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) g.setDirection(dx > 0 ? "right" : "left");
      else g.setDirection(dy > 0 ? "down" : "up");
      // re-arm so continuous swipes can steer repeatedly
      sx = t.clientX;
      sy = t.clientY;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, []);

  /* ---------------- ui ---------------- */

  const bestScoreValue = scores[0]?.score ?? 0;

  return (
   <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#04050c]">
      <canvas ref={canvasRef} className="absolute inset-0 block" style={{ visibility: screen === "duelPlay" ? "hidden" : "visible" }} />
      <div className="vignette pointer-events-none absolute inset-0 z-10" />
      {settings.scanlines && <div className="scanlines pointer-events-none absolute inset-0 z-10" />}

      {(screen === "playing" || screen === "paused") && (
        <Hud gameRef={gameRef} muted={muted} onPause={pauseGame} onToggleMute={toggleMute} />
      )}

      {showChangeCode && account && (
        <ChangeCodeModal
          accountId={account.id}
          t={t}
          onDone={() => setShowChangeCode(false)}
          onClose={() => setShowChangeCode(false)}
        />
      )}

      {screen === "duel" && (
        <DuelLobby
          record={duelRecord}
          playerName={account?.name ?? null}
          onStart={(mode, opp, bot) => {
            setDuelCfg({ mode, opp, bot });
            setScreen("duelPlay");
          }}
          onBack={() => setScreen("menu")}
          t={t}
        />
      )}

      {screen === "duelPlay" && (
        <DuelPlay
          mode={duelCfg.mode}
          opponent={duelCfg.opp}
          botLevel={duelCfg.bot}
          sound={gameRef.current!.sound}
          haptics={gameRef.current!.haptics}
          settings={settings}
          skinId={skinId}
          playerName={account?.name ?? t("you")}
          t={t}
          onExit={() => {
            setDuelRecord(loadDuel());
            setScreen("menu");
          }}
          onLobby={() => {
            setDuelRecord(loadDuel());
            setScreen("duel");
          }}
        />
      )}

      {screen === "auth" && (
        <AuthScreen
          onAuthed={signIn}
          onGuest={playAsGuest}
          onBack={() => setScreen("menu")}
          canGoBack={loadSession() !== null}
          t={t}
        />
      )}

      {screen === "playing" && settings.touchMode === "dpad" && (
        <DPad onDir={(d) => gameRef.current?.setDirection(d)} />
      )}

      {screen === "menu" && (
        <StartScreen
          scores={scores}
          onPlay={startGame}
          onSkins={openSkins}
          onLevels={openLevels}
          onSettings={openSettings}
          onDuel={openDuel}
          touchMode={settings.touchMode}
          playerName={account?.name ?? null}
          onProfile={() => setScreen("auth")}
          t={t}
        />
      )}
      {screen === "levels" && (
        <LevelScreen
          levelBests={levelBests}
          bestLevel={bestLevel}
          onPick={pickLevel}
          onBack={() => setScreen("menu")}
          t={t}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen
          settings={settings}
          stats={stats}
          muted={muted}
          playerName={account?.name ?? null}
          onSignOut={signOut}
          onChangeCode={() => setShowChangeCode(true)}
          onDeleteAccount={removeAccount}
          hapticsAvailable={gameRef.current?.haptics.available ?? false}
          t={t}
          onChange={changeSettings}
          onToggleMute={toggleMute}
          onErase={eraseData}
          onBack={closeSettings}
        />
      )}
      {screen === "skins" && (
        <SkinScreen
          bestScore={bestScoreValue}
          bestLevel={bestLevel}
          selectedId={skinId}
          onSelect={selectSkin}
          onBack={() => setScreen("menu")}
          t={t}
        />
      )}
      {screen === "paused" && (
        <PauseScreen
          onResume={resumeGame}
          onRestart={startGame}
          onQuit={quitToMenu}
          onSettings={openSettings}
          t={t}
        />
      )}
      {screen === "over" && result && (
        <GameOverScreen
          result={result}
          scores={scores}
          onRestart={startGame}
          onQuit={quitToMenu}
          onLevels={openLevels}
          t={t}
        />
      )}

      {screen !== "playing" && screen !== "paused" && screen !== "auth" && screen !== "duelPlay" && (
        <button
          onClick={toggleMute}
          aria-label="Toggle sound"
          className="btn-icon absolute right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
      )}
    </div>
  );
}
