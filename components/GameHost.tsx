"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameId, GameResult, Appearance } from "@/lib/types";
import { GAMES, GAME_DURATION } from "@/lib/types";
import type {
  GameController,
  GameInput,
  GameButton,
  GameHUD,
} from "@/lib/games/types";
import { gameLoaders } from "@/lib/games/loaders";
import { gameResources } from "@/lib/games/resources";
import { SimulationClock } from "@/lib/games/clock";
import { gameViewport } from "@/lib/games/viewport";
import { audio } from "@/lib/audio";
import { HeldInput } from "@/lib/input";
import Controls from "./Controls";
import Icon from "./Icon";
import RaceGarage from "./RaceGarage";
import { retainDialogFocus } from "@/lib/dialog-focus";

type Mode =
  | "loading"
  | "intro"
  | "starting"
  | "playing"
  | "paused"
  | "result"
  | "error";
const keyMap: Record<string, GameButton> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "action",
};
const freshInput = (): GameInput => ({
  left: false,
  right: false,
  up: false,
  down: false,
  action: false,
  secondary: false,
  axis: 0,
});
const touchHelp: Record<GameId, string> = {
  breaker: "← → Move · A Launch · B Pause",
  runner: "← → Move · A Jump · B Pause",
  kart: "← → Steer · A Gas · B Brake",
  beat: "Match the D-pad arrows · A or B Pause",
};

export default function GameHost({
  id,
  appearance,
  sound,
  onSound,
  onClose,
  onResult,
  reducedMotion = false,
  touchControls = false,
  bestScore,
}: {
  id: GameId;
  appearance: Appearance;
  sound: boolean;
  onSound: () => Promise<void>;
  onClose: () => void;
  onResult: (r: GameResult) => void;
  reducedMotion?: boolean;
  touchControls?: boolean;
  bestScore?: number;
}) {
  const info = GAMES.find((g) => g.id === id)!;
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    controller = useRef<GameController | null>(null);
  const input = useRef(freshInput()),
    held = useRef(new HeldInput()),
    clock = useRef(new SimulationClock());
  const [mode, setMode] = useState<Mode>("loading"),
    [round, setRound] = useState(0),
    [result, setResult] = useState<GameResult | null>(null),
    [hud, setHud] = useState<GameHUD>({
      score: 0,
      time: GAME_DURATION[id],
    });
  const [gridSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [pressed, setPressed] = useState<GameButton[]>([]),
    [touch, setTouch] = useState(touchControls),
    [keyboardHelp, setKeyboardHelp] = useState(false),
    [timingOffset, setTimingOffset] = useState(0),
    [best, setBest] = useState(bestScore),
    [newBest, setNewBest] = useState(false),
    [audioError, setAudioError] = useState("");
  const modeRef = useRef<Mode>("loading"),
    elapsed = useRef(0),
    done = useRef(false),
    replay = useRef(false),
    launch = useRef(0),
    record = useRef(bestScore),
    soundRequest = useRef(0);
  const lastFrame = useRef(0),
    raf = useRef(0),
    paint = useRef<() => void>(() => {}),
    run = useRef<() => void>(() => {});
  const song = useRef({ offset: 0, started: 0 }),
    settings = useRef({ reducedMotion, touch, keyboardHelp, timingOffset });
  settings.current = { reducedMotion, touch, keyboardHelp, timingOffset };
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const changeMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setMode(next);
  }, []);
  const clearInput = useCallback(() => {
    held.current.clear();
    input.current = freshInput();
    setPressed([]);
  }, []);
  const readTime = useCallback(
    (stamp = performance.now()) => {
      if (id !== "beat" || modeRef.current !== "playing")
        return elapsed.current;
      const timeStamp = stamp > 1e12 ? performance.now() : stamp;
      return (
        audio.position("beat", timeStamp) ??
        Math.max(
          0,
          song.current.offset + (timeStamp - song.current.started) / 1000,
        )
      );
    },
    [id],
  );
  const pause = useCallback(() => {
    launch.current++;
    if (modeRef.current === "playing" || modeRef.current === "starting") {
      elapsed.current = readTime();
      changeMode("paused");
      lastFrame.current = 0;
      clock.current.clearRemainder();
      clearInput();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      audio.pause();
      audio.effect("click");
      paint.current();
    }
  }, [readTime, changeMode, clearInput]);
  const exit = useCallback(() => {
    soundRequest.current++;
    launch.current++;
    audio.effect("click");
    onClose();
  }, [onClose]);
  const start = useCallback(async () => {
    if (!["intro", "paused"].includes(modeRef.current)) return;
    if (document.hidden || !document.hasFocus()) {
      changeMode("paused");
      clearInput();
      return;
    }
    const resuming = modeRef.current === "paused";
    const offset = resuming ? elapsed.current : 0,
      ticket = ++launch.current;
    changeMode("starting");
    clearInput();
    audio.duck(1);
    setAudioError("");
    try {
      await audio.play(id, id === "beat" || !resuming ? offset : undefined);
    } catch {
      setAudioError(
        "Music is unavailable. You can keep playing with visual cues.",
      );
    }
    if (ticket !== launch.current || !dialog.current?.open || document.hidden)
      return;
    song.current = { offset, started: performance.now() };
    elapsed.current = offset;
    lastFrame.current = 0;
    audio.effect("start");
    changeMode("playing");
  }, [id, changeMode, clearInput]);
  const restart = useCallback(() => {
    soundRequest.current++;
    launch.current++;
    audio.pause();
    audio.effect("click");
    replay.current = true;
    clearInput();
    setResult(null);
    setNewBest(false);
    setRound((n) => n + 1);
  }, [clearInput]);
  const toggleSound = useCallback(async () => {
    const request = ++soundRequest.current;
    const enabling = !audio.enabled;
    const before = readTime();
    song.current = { offset: before, started: performance.now() };
    elapsed.current = before;
    await onSound();
    if (request !== soundRequest.current || !dialog.current?.open) return;
    if (enabling && !audio.enabled) {
      setAudioError(
        "Music is unavailable. You can keep playing with visual cues.",
      );
      canvas.current?.focus({ preventScroll: true });
      return;
    }
    setAudioError("");
    if (modeRef.current === "playing") {
      const time = readTime();
      song.current = { offset: time, started: performance.now() };
      try {
        await audio.play(id, id === "beat" ? time : undefined);
        setAudioError("");
      } catch {
        setAudioError(
          audio.enabled
            ? "Music could not load. Turn sound off, then on to retry."
            : "Music could not load. Turn sound on to retry.",
        );
      }
      canvas.current?.focus({ preventScroll: true });
    } else if (modeRef.current === "paused") audio.pause();
    else if (audio.enabled)
      void audio
        .play(id)
        .catch(() =>
          setAudioError(
            "Music could not load. Turn sound off, then on to retry.",
          ),
        );
    if (modeRef.current !== "playing")
      dialog.current?.focus({ preventScroll: true });
  }, [id, onSound, readTime]);

  useEffect(() => {
    const narrow = matchMedia("(max-width:700px)"),
      coarse = matchMedia("(pointer:coarse)"),
      update = () =>
        setTouch(touchControls || narrow.matches || coarse.matches);
    update();
    narrow.addEventListener("change", update);
    coarse.addEventListener("change", update);
    return () => {
      narrow.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
    };
  }, [touchControls]);
  useEffect(() => {
    const d = dialog.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    d.showModal();
    const releaseFocus = retainDialogFocus(d);
    d.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    audio.duck(0.25);
    const cancel = (e: Event) => {
      e.preventDefault();
      exit();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      launch.current++;
      cancelAnimationFrame(raf.current);
      d.removeEventListener("cancel", cancel);
      releaseFocus();
      d.close();
      document.body.style.overflow = overflow;
      audio.motor(0);
      audio.duck(1);
      previous?.focus({ preventScroll: true });
    };
  }, [exit]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "playing") {
        canvas.current?.focus({ preventScroll: true });
        run.current();
      } else {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        paint.current();
        dialog.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);
  useEffect(() => {
    const element = canvas.current!,
      resize = new ResizeObserver(() => {
        const rect = element.parentElement!.getBoundingClientRect();
        const size = gameViewport(id, rect.width, rect.height);
        if (element.width !== size.width || element.height !== size.height) {
          if (
            controller.current &&
            ["playing", "starting"].includes(modeRef.current)
          )
            pause();
          else clearInput();
          element.width = size.width;
          element.height = size.height;
          controller.current?.resize?.(size.width, size.height);
        }
        element.getContext("2d")!.imageSmoothingEnabled = false;
        paint.current();
      });
    resize.observe(element.parentElement!);
    return () => resize.disconnect();
  }, [id, pause, clearInput]);
  useEffect(() => {
    let disposed = false,
      lastHUD = 0,
      lastSignature = "";
    changeMode("loading");
    elapsed.current = 0;
    clock.current.reset();
    lastFrame.current = 0;
    done.current = false;
    clearInput();
    const load = async () => {
      try {
        const [{ createGame }, resources] = await Promise.all([
          gameLoaders[id](),
          gameResources(appearance, id === "kart", gridSeed + round),
        ]);
        if (disposed) return;
        const context = canvas.current!.getContext("2d")!;
        context.imageSmoothingEnabled = false;
        const finish = (next: GameResult) => {
          if (done.current) return;
          done.current = true;
          setResult(next);
          setHud({ ...controller.current!.hud(), score: next.score });
          setNewBest(next.score > 0 && next.score > (record.current ?? 0));
          record.current = Math.max(record.current ?? 0, next.score);
          setBest(record.current);
          clearInput();
          audio.pause();
          audio.duck(0.3);
          void audio.play(id).catch(() => {});
          changeMode("result");
          resultCallback.current(next);
        };
        controller.current = createGame({
          ...resources,
          viewport: {
            width: canvas.current!.width,
            height: canvas.current!.height,
          },
          appearance,
          sound: (kind) => audio.effect(kind),
          motor: (ratio) => audio.motor(ratio),
          finish,
          get reducedMotion() {
            return settings.current.reducedMotion;
          },
          get inputMode() {
            return settings.current.touch && !settings.current.keyboardHelp
              ? "touch"
              : "keyboard";
          },
          get tapOffset() {
            return settings.current.timingOffset / 1000;
          },
        });
        const draw = () => {
          if (!disposed && !document.hidden && controller.current)
            controller.current.draw(context, elapsed.current);
        };
        paint.current = draw;
        const tick = (now: number) => {
          raf.current = 0;
          if (disposed || document.hidden || modeRef.current !== "playing")
            return;
          const raw = lastFrame.current
            ? Math.max(0, (now - lastFrame.current) / 1000)
            : 0;
          lastFrame.current = now;
          try {
            if (id === "beat") {
              elapsed.current = readTime(now);
              controller.current!.update(
                Math.min(raw, 0.25),
                input.current,
                elapsed.current,
              );
            } else {
              clock.current.advance(raw, (dt, time) => {
                if (!done.current)
                  controller.current!.update(dt, input.current, time);
              });
              elapsed.current = clock.current.elapsed;
            }
            if (!done.current && now - lastHUD >= 100) {
              const next = controller.current!.hud(),
                signature = JSON.stringify(next);
              if (signature !== lastSignature) {
                setHud(next);
                lastSignature = signature;
              }
              lastHUD = now;
            }
            draw();
            if (modeRef.current === "playing")
              raf.current = requestAnimationFrame(tick);
          } catch {
            clearInput();
            audio.pause();
            changeMode("error");
          }
        };
        run.current = () => {
          if (
            !raf.current &&
            !disposed &&
            modeRef.current === "playing" &&
            !document.hidden
          ) {
            lastFrame.current = 0;
            raf.current = requestAnimationFrame(tick);
          }
        };
        setHud(controller.current.hud());
        draw();
        changeMode("intro");
        if (replay.current) {
          replay.current = false;
          void start();
        }
      } catch {
        if (!disposed) changeMode("error");
      }
    };
    void load();
    return () => {
      disposed = true;
      launch.current++;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      controller.current = null;
      paint.current = () => {};
      run.current = () => {};
      held.current.clear();
      input.current = freshInput();
      audio.motor(0);
    };
  }, [
    id,
    appearance,
    round,
    gridSeed,
    changeMode,
    clearInput,
    readTime,
    start,
  ]);

  const control = useCallback(
    (
      button: GameButton,
      down: boolean,
      source = `touch:${button}`,
      stamp = performance.now(),
    ) => {
      const current = modeRef.current;
      if (current !== "playing") {
        if (!down) return;
        if (button === "secondary") {
          exit();
          return;
        }
        if (button === "action") {
          if (current === "intro" || current === "paused") void start();
          else if (current === "result" || current === "error") restart();
        }
        return;
      }
      if (
        (button === "secondary" && id !== "kart") ||
        (button === "action" && id === "beat")
      ) {
        if (down) pause();
        return;
      }
      if (down) {
        if (!held.current.down(source, button)) return;
      } else held.current.up(source);
      input.current[button] = held.current.has(button);
      input.current.left =
        id === "beat"
          ? held.current.has("left")
          : held.current.horizontal() < 0;
      input.current.right =
        id === "beat"
          ? held.current.has("right")
          : held.current.horizontal() > 0;
      setPressed(
        (
          ["left", "right", "up", "down", "action", "secondary"] as GameButton[]
        ).filter((key) => held.current.has(key)),
      );
      if (down) {
        if (
          id !== "beat" &&
          ["left", "right", "up", "down", "secondary"].includes(button)
        )
          audio.effect(
            id === "kart"
              ? button === "down" || button === "secondary"
                ? "brake"
                : button === "up"
                  ? "accelerate"
                  : "steer"
              : "steer",
          );
        controller.current?.press(button, readTime(stamp));
      }
    },
    [id, pause, exit, start, restart, readTime],
  );
  useEffect(() => {
    const d = dialog.current!;
    const down = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Escape"
      )
        return;
      setKeyboardHelp(true);
      if (e.key === "Tab") {
        clearInput();
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      if (
        target?.closest(
          'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="slider"]',
        )
      )
        return;
      if (
        (e.code === "Enter" || e.code === "Space") &&
        target?.closest("button,a,summary")
      )
        return;
      const current = modeRef.current;
      if (e.code === "KeyM") {
        e.preventDefault();
        if (!e.repeat) void toggleSound();
        return;
      }
      if (
        current !== "playing" &&
        e.code === "Space" &&
        target?.closest(".race-garage ul")
      )
        return;
      if (e.code === "KeyX") {
        e.preventDefault();
        if (!e.repeat) exit();
        return;
      }
      if (
        e.code === "KeyR" &&
        ["playing", "paused", "result", "error"].includes(current)
      ) {
        e.preventDefault();
        if (!e.repeat) restart();
        return;
      }
      if (e.code === "KeyP" || (e.code === "Enter" && current === "playing")) {
        e.preventDefault();
        if (!e.repeat) {
          if (current === "playing") pause();
          else if (current === "paused") void start();
        }
        return;
      }
      if (current === "playing") {
        const key = keyMap[e.code];
        if (key) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) control(key, true, e.code, e.timeStamp);
        }
        return;
      }
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        if (target?.closest(".race-garage")) return;
        if (
          target?.closest(".game-message-content") &&
          [
            "ArrowUp",
            "ArrowDown",
            "PageUp",
            "PageDown",
            "Home",
            "End",
          ].includes(e.code)
        )
          return;
        const buttons = [
          ...d.querySelectorAll<HTMLButtonElement>(
            ".game-message .menu-actions button",
          ),
        ].filter((button) => button.getClientRects().length > 0);
        if (!buttons.length) return;
        e.preventDefault();
        if (e.repeat) return;
        audio.effect("click");
        const index = Math.max(
            0,
            buttons.indexOf(document.activeElement as HTMLButtonElement),
          ),
          direction = ["ArrowUp", "ArrowLeft"].includes(e.code) ? -1 : 1;
        buttons[(index + direction + buttons.length) % buttons.length].focus();
        return;
      }
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (current === "intro" || current === "paused") void start();
        else if (current === "result") restart();
        else if (current === "error") setRound((n) => n + 1);
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = keyMap[e.code];
      if (key) control(key, false, e.code, e.timeStamp);
    };
    const visibility = () => {
      if (document.hidden) {
        pause();
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      } else paint.current();
    };
    d.addEventListener("keydown", down);
    d.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", pause);
    window.screen.orientation?.addEventListener("change", pause);
    return () => {
      d.removeEventListener("keydown", down);
      d.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
      window.screen.orientation?.removeEventListener("change", pause);
    };
  }, [control, exit, toggleSound, pause, restart, start, clearInput]);

  const isTouch = touch && !keyboardHelp;
  const menuHint =
    mode === "result"
      ? "Enter / R Play again"
      : mode === "paused"
        ? "Enter / P Resume"
        : mode === "error"
          ? "Enter Retry"
          : "Enter Start";
  const action =
    mode === "playing"
      ? info.action
      : mode === "paused"
        ? "RESUME"
        : mode === "result" || mode === "error"
          ? "RETRY"
          : "START";
  const lifeLabel =
    hud.lives === undefined
      ? hud.message
      : `${hud.lives} ${id === "breaker" ? (hud.lives === 1 ? "BALL" : "BALLS") : hud.lives === 1 ? "LIFE" : "LIVES"}`;
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className={`game-dialog game-${id} ${touch ? "is-touch" : ""}`}
      aria-labelledby="game-title"
      data-mode={mode}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") setKeyboardHelp(false);
      }}
    >
      <div className="game-shell">
        <header className="game-top">
          <button
            className="pixel-button quiet"
            onClick={exit}
            aria-label="Exit game and return to the hall"
          >
            ← Hall <kbd>Esc</kbd>
          </button>
          <h2 id="game-title">{info.name}</h2>
          <div>
            <button
              className="icon-button"
              onClick={() => void toggleSound()}
              aria-label={sound ? "Mute sound (M)" : "Enable sound (M)"}
              aria-pressed={sound}
            >
              <Icon name={sound ? "sound" : "muted"} />
            </button>
            <button
              className="icon-button"
              onClick={pause}
              disabled={mode !== "playing"}
              aria-label="Pause game (P)"
            >
              <Icon name="pause" />
            </button>
            <button
              className="icon-button"
              onClick={exit}
              aria-label="Close game"
            >
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="game-screen">
          <canvas
            ref={canvas}
            width={640}
            height={400}
            tabIndex={0}
            aria-label={
              isTouch
                ? `${info.name}. ${touchHelp[id]}. Use the Pause and Close game buttons above.`
                : `${info.name}. ${info.controls}. Enter or P pauses. R restarts. Escape returns to the hall.`
            }
          />
          {mode !== "playing" && (
            <div className="game-overlay">
              <div className="game-message">
                <div
                  className="game-message-content"
                  role="region"
                  aria-label="Game instructions and results"
                  tabIndex={0}
                >
                  {(mode === "loading" || mode === "starting") && (
                    <>
                      <h3>
                        {mode === "loading"
                          ? "Loading game…"
                          : "Starting round…"}
                      </h3>
                      <p>You can return to the hall while this loads.</p>
                    </>
                  )}
                  {mode === "intro" && (
                    <>
                      <h3>{info.name}</h3>
                      <p>{info.instructions}</p>
                      <p className="control-legend">
                        {isTouch ? touchHelp[id] : info.controls}
                      </p>
                      {id === "kart" && <RaceGarage />}
                      {best !== undefined && (
                        <p className="best-score">
                          Personal best: {best.toLocaleString()} points
                        </p>
                      )}
                    </>
                  )}
                  {mode === "paused" && (
                    <>
                      <h3>Paused</h3>
                      <p>Your round will continue where you left off.</p>
                    </>
                  )}
                  {mode === "result" && result && (
                    <>
                      <h3>{result.won ? "Round cleared" : "Round over"}</h3>
                      <p>{result.detail}</p>
                      <strong className="result-score">
                        {result.score.toLocaleString()} points
                      </strong>
                      <p className="best-score">
                        {newBest
                          ? "New personal best"
                          : `Personal best: ${(best ?? 0).toLocaleString()} points`}
                      </p>
                    </>
                  )}
                  {mode === "error" && (
                    <>
                      <h3>Game unavailable</h3>
                      <p>
                        The game could not load or continue. Try again, or
                        return to the hall.
                      </p>
                    </>
                  )}
                  {id === "beat" && (mode === "intro" || mode === "paused") && (
                    <details className="timing-settings">
                      <summary>Timing adjustment</summary>
                      <label>
                        Tap offset: {timingOffset} ms
                        <input
                          type="range"
                          min={-150}
                          max={150}
                          step={10}
                          value={timingOffset}
                          onChange={(e) =>
                            setTimingOffset(Number(e.target.value))
                          }
                        />
                      </label>
                      <p>
                        Positive values treat your tap as later. Negative values
                        treat it as earlier. The music and arrows stay
                        unchanged.
                      </p>
                    </details>
                  )}
                </div>
                <div className="menu-actions button-row">
                  <button
                    className={`pixel-button ${mode === "loading" || mode === "starting" ? "" : "primary"}`}
                    onClick={
                      mode === "intro" || mode === "paused"
                        ? () => void start()
                        : mode === "result"
                          ? restart
                          : mode === "error"
                            ? () => setRound((n) => n + 1)
                            : exit
                    }
                  >
                    {mode === "intro"
                      ? "Start playing"
                      : mode === "paused"
                        ? "Resume"
                        : mode === "result"
                          ? "Play again"
                          : mode === "error"
                            ? "Try again"
                            : "Back to the hall"}
                    {!isTouch && !["loading", "starting"].includes(mode) && (
                      <kbd>↵</kbd>
                    )}
                  </button>
                  {["paused", "result", "error"].includes(mode) && (
                    <button className="pixel-button" onClick={exit}>
                      Back to the hall
                    </button>
                  )}
                </div>
                {!isTouch && !["loading", "starting"].includes(mode) && (
                  <p className="game-menu-hint">
                    {menuHint} · ↑ ↓ Choose · Esc Hall · M Sound
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        {audioError && (
          <div className="game-audio-status" role="status">
            <span>{audioError}</span>
            <button className="text-link" onClick={() => void toggleSound()}>
              {sound ? "Mute sound" : "Retry sound"}
            </button>
          </div>
        )}
        <footer className="game-hud" aria-live="off">
          <span>{hud.score.toLocaleString()} PTS</span>
          <span>{lifeLabel}</span>
          <span>{hud.time}s</span>
        </footer>
        <div className="game-mobile-controls">
          <Controls
            onPress={control}
            action={action}
            secondary={mode === "playing" ? info.secondary : "BACK"}
            disabled={mode === "loading" || mode === "starting"}
          />
        </div>
        <div className="desktop-game-help">
          <span className="input-feedback" aria-hidden="true">
            {(["left", "down", "up", "right", "action"] as GameButton[]).map(
              (key, i) => (
                <kbd key={key} data-pressed={pressed.includes(key)}>
                  {["←", "↓", "↑", "→", "Space"][i]}
                </kbd>
              ),
            )}
          </span>
          <span>
            {info.controls} · Enter / P Pause · R Restart · Esc Hall · M Sound
          </span>
        </div>
        <span className="sr-only" role="status">
          {mode === "result" && result
            ? `${result.won ? "Round cleared" : "Round over"}. ${result.score} points. ${newBest ? "New personal best." : ""}`
            : mode === "paused"
              ? "Game paused."
              : ""}
        </span>
      </div>
    </dialog>
  );
}
