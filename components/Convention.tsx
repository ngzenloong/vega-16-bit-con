"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameId, GameResult, Player, Scores } from "@/lib/types";
import { DEFAULT_APPEARANCE, GAMES, SESSIONS } from "@/lib/types";
import type { WorldController, WorldTarget } from "@/lib/world";
import type { LoreAction } from "@/lib/lore";
import { MACHINES, SCENE } from "@/lib/scene";
import { safePlayer } from "@/lib/math";
import { audio } from "@/lib/audio";
import { enterFromPass } from "@/lib/arrival";
import World from "./World";
import Registration from "./Registration";
import Dialogue from "./Dialogue";
import GameHost from "./GameHost";
import SoundControl from "./SoundControl";
import Icon from "./Icon";
import { readScoreProgress, SCORE_RULES } from "@/lib/scores";

const STORE = "vega-16-bit-con-v1";
type Panel =
  | { kind: "register"; interest: number | null }
  | { kind: "game"; id: GameId }
  | { kind: "npc"; id: string }
  | null;
export default function Convention() {
  const [player, setPlayer] = useState<Player | null>(null),
    [scores, setScores] = useState<Scores>({}),
    [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(false),
    [soundStatus, setSoundStatus] = useState<
      "off" | "loading" | "ready" | "error"
    >("off"),
    [soundError, setSoundError] = useState("");
  const [handheld, setHandheld] = useState(false),
    [touch, setTouch] = useState(false),
    [reduced, setReduced] = useState(false),
    [ambientPaused, setAmbientPaused] = useState(false),
    [arrival, setArrival] = useState(false),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState<"saved" | "session">("saved");
  const [announcement, setAnnouncement] = useState({ text: "", id: 0 });
  const world = useRef<WorldController>(null),
    panelRef = useRef(panel),
    handheldRef = useRef(handheld),
    arrivalRef = useRef(arrival),
    trigger = useRef<HTMLElement | null>(null);
  panelRef.current = panel;
  handheldRef.current = handheld;
  arrivalRef.current = arrival;
  const desiredSound = useRef(false),
    soundIntent = useRef(0),
    handheldScroll = useRef(0),
    handoff = useRef(0),
    frames = useRef<number[]>([]),
    entrance = useRef<AbortController | null>(null);
  const previousScores = useRef<Scores>({});
  const announce = useCallback(
    (text: string) => setAnnouncement((s) => ({ text, id: s.id + 1 })),
    [],
  );
  const afterLayout = useCallback((action: () => void) => {
    const token = ++handoff.current;
    frames.current.forEach(cancelAnimationFrame);
    frames.current = [
      requestAnimationFrame(() => {
        frames.current = [
          requestAnimationFrame(() => {
            if (token === handoff.current) action();
          }),
        ];
      }),
    ];
  }, []);
  const close = useCallback(() => {
    const kind = panelRef.current?.kind,
      target = trigger.current;
    setPanel(null);
    afterLayout(() => {
      if (kind === "register" && target?.isConnected)
        target.focus({ preventScroll: true });
      else world.current?.focus();
    });
  }, [afterLayout]);
  const open = useCallback((next: Panel, source?: HTMLElement) => {
    if (arrivalRef.current) return;
    handoff.current++;
    frames.current.forEach(cancelAnimationFrame);
    world.current?.cancelTravel();
    trigger.current = source || (document.activeElement as HTMLElement | null);
    audio.effect("click");
    setPanel(next);
  }, []);
  const register = useCallback(
    () => open({ kind: "register", interest: null }),
    [open],
  );
  const navigate = useCallback(
    (floor: number, x?: number) => {
      if (arrivalRef.current) return;
      setPanel(null);
      afterLayout(() => {
        world.current?.refresh();
        world.current?.reveal(floor, x);
      });
    },
    [afterLayout],
  );
  const exitHandheld = useCallback(() => {
    handheldRef.current = false;
    setHandheld(false);
    afterLayout(() => world.current?.release());
  }, [afterLayout]);
  const startHandheld = useCallback(() => {
    if (handheldRef.current) return;
    handheldScroll.current = scrollY;
    handheldRef.current = true;
    setHandheld(true);
  }, []);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE) || "null");
      setPlayer(safePlayer(stored?.player));
      const progress = readScoreProgress(stored);
      setScores(progress.scores);
      previousScores.current = progress.previousScores;
    } catch {
      setSaveStatus("session");
    }
    const motion = matchMedia("(prefers-reduced-motion: reduce)"),
      narrow = matchMedia("(max-width:700px)"),
      coarse = matchMedia("(pointer:coarse)");
    const update = () => {
      setReduced(motion.matches);
      if (motion.matches) setAmbientPaused(true);
      setTouch(narrow.matches || coarse.matches);
    };
    update();
    motion.addEventListener("change", update);
    narrow.addEventListener("change", update);
    coarse.addEventListener("change", update);
    setReady(true);
    return () => {
      motion.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      handoff.current++;
      frames.current.forEach(cancelAnimationFrame);
      const activeEntrance = entrance.current;
      entrance.current = null;
      activeEntrance?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({
          player,
          scores,
          scoreRules: SCORE_RULES,
          previousScores: previousScores.current,
        }),
      );
      setSaveStatus("saved");
    } catch {
      setSaveStatus("session");
    }
  }, [player, scores, ready]);
  const toggleSound = useCallback(async () => {
    const next = !desiredSound.current,
      token = ++soundIntent.current;
    desiredSound.current = next;
    setSound(next);
    setSoundError("");
    setSoundStatus(next ? "loading" : "off");
    try {
      await audio.setEnabled(next);
      if (next && audio.enabled) {
        const active = panelRef.current;
        await audio.prepare(
          active?.kind === "game" ? active.id : "hall",
        );
      }
      if (token !== soundIntent.current) return;
      if (next && !audio.enabled) throw Error("Sound unavailable");
      if (next && panelRef.current?.kind !== "game" && !document.hidden)
        await audio.play("hall");
      if (token !== soundIntent.current) return;
      setSoundStatus(next ? "ready" : "off");
      if (next) audio.effect("click");
    } catch {
      if (token === soundIntent.current) {
        desiredSound.current = false;
        void audio.setEnabled(false);
        setSound(false);
        setSoundStatus("error");
        setSoundError("Sound could not load. Try again.");
      }
    }
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyM" ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        panelRef.current?.kind === "game"
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      event.preventDefault();
      void toggleSound();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [toggleSound]);
  useEffect(() => {
    let active = true;
    const reconcile = () => {
      if (document.hidden) {
        audio.pause();
        return;
      }
      const intent = soundIntent.current;
      if (desiredSound.current && panelRef.current?.kind !== "game")
        void audio.play("hall").catch(() => {
          if (!active || intent !== soundIntent.current || !desiredSound.current || panelRef.current?.kind === "game") return;
          setSoundStatus("error");
          setSoundError(
            "Music could not load. Turn sound off and on to retry.",
          );
        });
    };
    reconcile();
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [panel, sound]);
  useEffect(() => {
    if (!handheld) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      const html = document.documentElement,
        before = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo({ top: handheldScroll.current, behavior: "auto" });
      html.style.scrollBehavior = before;
    };
  }, [handheld]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.repeat &&
        handheldRef.current &&
        !panelRef.current &&
        !arrivalRef.current
      ) {
        event.preventDefault();
        exitHandheld();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [exitHandheld]);
  const enterScene = useCallback(
    (floor: number) => {
      if (arrivalRef.current || panelRef.current) return;
      audio.effect("click");
      if (touch && !handheldRef.current) {
        startHandheld();
        afterLayout(() => {
          world.current?.refresh();
          world.current?.control(floor);
        });
      } else world.current?.control(floor);
    },
    [touch, afterLayout, startHandheld],
  );
  const openTarget = useCallback(
    (target: WorldTarget) => {
      const show = () => {
        if (target.kind === "register")
          open({ kind: "register", interest: null }, target.element);
        else if (target.kind === "game")
          open({ kind: "game", id: target.id as GameId }, target.element);
        else if (target.kind === "npc")
          open({ kind: "npc", id: target.id }, target.element);
      };
      if (touch && !handheldRef.current) {
        const floor = Number(
          target.element.closest<HTMLElement>("[data-floor]")?.dataset.floor ||
            0,
        );
        startHandheld();
        afterLayout(() => {
          world.current?.refresh();
          world.current?.control(floor);
          show();
        });
      } else show();
    },
    [open, touch, afterLayout, startHandheld],
  );
  const onResult = useCallback(
    (result: GameResult) =>
      setScores((old) => ({
        ...old,
        [result.id]: Math.max(old[result.id] || 0, result.score),
      })),
    [],
  );
  const session = useCallback(
    (index: number) => {
      audio.effect("click");
      if (!player) {
        open({ kind: "register", interest: index });
        return;
      }
      const remove = player.interests.includes(index);
      setPlayer((p) =>
        p
          ? {
              ...p,
              interests: remove
                ? p.interests.filter((n) => n !== index)
                : [...p.interests, index],
            }
          : p,
      );
      announce(
        remove
          ? `Removed ${SESSIONS[index].title} from your list.`
          : `Added ${SESSIONS[index].title} to your list.`,
      );
    },
    [player, open, announce],
  );
  const submit = useCallback(
    async (next: Player, card: HTMLElement) => {
      if (arrivalRef.current) return;
      const updating = player !== null;
      const location = world.current?.position() || { floor: 0, x: SCENE.booth };
      entrance.current?.abort();
      const owner = new AbortController();
      entrance.current = owner;
      arrivalRef.current = true;
      setArrival(true);
      world.current?.pause("arrival", true);
      announce(
        updating
          ? "Updating your player."
          : touch
          ? "Entering the hall."
          : "Entering the hall. Press Escape to skip the animation.",
      );
      await enterFromPass({
        card,
        reduced,
        signal: owner.signal,
        prepare: async () => {
          setPlayer(next);
          setPanel(null);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          if (updating) world.current?.refresh();
          const floor = updating ? location.floor : 0;
          const actor = updating
            ? document.querySelector<HTMLElement>(
                `[data-player-floor="${floor}"]`,
              )!
            : world.current!.goTo(0, SCENE.booth, false);
          return {
            player: actor,
            world: document.querySelector<HTMLElement>(
              `[data-floor="${floor}"]`,
            )!,
          };
        },
        onDone: () => {
          if (entrance.current !== owner) return;
          entrance.current = null;
          arrivalRef.current = false;
          world.current?.pause("arrival", false);
          setArrival(false);
          afterLayout(() => world.current?.focus());
          audio.effect("win");
          announce(
            updating
              ? `${next.name}'s player is updated. Keep exploring.`
              : `${next.name} is at Booth 630. Choose a game or explore the hall.`,
          );
        },
      });
    },
    [player, reduced, touch, announce, afterLayout],
  );
  const explore = () => {
    enterScene(0);
  };
  const handleDialogue = (action: LoreAction) => {
    if (action.startsWith("find-")) {
      const machine = MACHINES.find((m) => m.id === action.slice(5));
      if (machine) open({ kind: "game", id: machine.id });
    } else if (action === "register") register();
    else if (action === "about")
      window.open(
        "https://vega.io/solutions/legacy-siem-augmentation",
        "_blank",
        "noopener,noreferrer",
      );
    else if (action === "schedule") navigate(1, 1440);
    else if (action === "explore") close();
    else close();
  };
  const soundControl = (
    <SoundControl
      enabled={sound}
      loading={soundStatus === "loading"}
      error={soundError}
      onToggle={toggleSound}
    />
  );
  return (
    <div
      className={`convention ${handheld ? "handheld-active" : ""}`}
      data-arrival={arrival ? "active" : "idle"}
    >
      <a
        className="skip-link"
        href="#social-floor"
        onClick={(e) => {
          e.preventDefault();
          navigate(1, 1440);
        }}
      >
        Skip to schedule
      </a>
      <header className="site-header" inert={handheld || arrival}>
        <a
          href="https://vega.io/"
          target="_blank"
          rel="noreferrer"
          aria-label="Visit Vega"
        >
          <img src="/assets/vega/logo.svg" alt="Vega" width={111} height={36} />
        </a>
        <nav aria-label="Convention navigation">
          <button onClick={explore} disabled={arrival}>
            Explore
          </button>
          <button onClick={() => navigate(1, 1440)} disabled={arrival}>
            Schedule
          </button>
          <button
            className="pixel-button primary"
            onClick={register}
            disabled={arrival}
            aria-label={player ? "My player" : "Register now"}
          >
            <span className="nav-wide">
              {player ? "My player" : "Register now"}
            </span>
            <span className="nav-narrow">{player ? "Player" : "RSVP"}</span>
          </button>
        </nav>
        <div className="access-controls">
          {soundControl}
          <button
            className="motion-toggle"
            onClick={() => setAmbientPaused((v) => !v)}
            aria-pressed={ambientPaused}
            aria-label={
              ambientPaused
                ? "Resume background motion"
                : "Pause background motion"
            }
          >
            <span className="motion-label">
              {ambientPaused
                ? "Resume background motion"
                : "Pause background motion"}
            </span>
            <span className="motion-symbol">
              <Icon name={ambientPaused ? "play" : "pause"} />
            </span>
          </button>
        </div>
      </header>
      {soundError && (
        <p className="global-notice" role="status">
          {soundError}
        </p>
      )}
      {saveStatus === "session" && (
        <p className="global-notice" role="status">
          Your player is available for this visit only. Browser storage is
          unavailable.
        </p>
      )}
      <World
        ref={world}
        player={player}
        paused={!!panel || arrival}
        arriving={arrival}
        handheld={handheld}
        reduced={reduced}
        ambientPaused={ambientPaused}
        interests={player?.interests || []}
        onTarget={openTarget}
        onRegister={register}
        onSession={session}
        onAnnounce={announce}
        onHandheld={explore}
        onEnterScene={enterScene}
        onExitHandheld={exitHandheld}
        onToggleMotion={() => setAmbientPaused((v) => !v)}
        soundControl={soundControl}
      />
      <footer className="site-footer" inert={handheld || arrival}>
        <div>
          <img src="/assets/vega/logo.svg" alt="Vega" width={110} height={36} />
          <p>Meet Vega at Booth 630.</p>
        </div>
        <button
          className="pixel-button primary"
          onClick={register}
          disabled={arrival}
        >
          {player ? "Edit my player" : "Make my player"} ↗
        </button>
        <small>
          16-Bit Con is a fictional event and interactive demo.
          <br />
          October 3–5, 2026 · Javits Center, New York
        </small>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
      {panel?.kind === "register" && (
        <Registration
          player={player}
          interest={panel.interest}
          onClose={close}
          onSubmit={submit}
          sessionOnly={saveStatus === "session"}
          soundControl={soundControl}
          mobile={touch || handheld}
        />
      )}
      {panel?.kind === "npc" && (
        <Dialogue
          id={panel.id}
          reduced={reduced}
          touch={touch}
          onClose={close}
          onAction={handleDialogue}
          soundControl={soundControl}
        />
      )}
      {panel?.kind === "game" && (
        <GameHost
          id={panel.id}
          appearance={player?.appearance || DEFAULT_APPEARANCE}
          sound={sound}
          onSound={toggleSound}
          onClose={close}
          onResult={onResult}
          reducedMotion={reduced}
          touchControls={touch || handheld}
          bestScore={scores[panel.id]}
        />
      )}
    </div>
  );
}
