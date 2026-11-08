"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { GameId, GameResult, Player, Scores } from "@/lib/types";
import { DEFAULT_APPEARANCE, SESSIONS } from "@/lib/types";
import type { WorldController, WorldTarget } from "@/lib/world";
import type { LoreAction } from "@/lib/lore";
import { MACHINES, SCENE } from "@/lib/scene";
import { lockPageScroll } from "@/lib/dialog-focus";
import { safePlayer } from "@/lib/math";
import { audio } from "@/lib/audio";
import { dropIntoHall } from "@/lib/arrival";
import World from "./World";
import Registration from "./Registration";
import Dialogue from "./Dialogue";
import ScheduleDialog from "./ScheduleDialog";
import GameHost from "./GameHost";
import SoundControl from "./SoundControl";
import { readScoreProgress, SCORE_RULES } from "@/lib/scores";
import SiteHeader from "./SiteHeader";
import {
  prepareHandheld,
  awaitHandheldAssets,
  animateHandheldEntry,
} from "@/lib/handheld-entry";
import { hallAudioShouldPlay } from "@/lib/ambience";

const STORE = "vega-16-bit-con-v1";
type Panel =
  | { kind: "register"; interest: number | null }
  | { kind: "game"; id: GameId }
  | { kind: "npc"; id: string }
  | { kind: "schedule" }
  | null;
export default function Convention() {
  const [player, setPlayer] = useState<Player | null>(null),
    [scenePlayer, setScenePlayer] = useState<Player | null>(null),
    [scores, setScores] = useState<Scores>({}),
    [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(false),
    [soundStatus, setSoundStatus] = useState<
      "off" | "loading" | "ready" | "error"
    >("off"),
    [soundError, setSoundError] = useState("");
  const [handheld, setHandheld] = useState(false),
    [touch, setTouch] = useState(false),
    [coarseInput, setCoarseInput] = useState(false),
    [reduced, setReduced] = useState(false),
    [ambientPaused, setAmbientPaused] = useState(false),
    [arrival, setArrival] = useState(false),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState<"saved" | "session">("saved");
  const [handheldPending, setHandheldPending] = useState(false),
    [handheldError, setHandheldError] = useState(false),
    [footerVisible, setFooterVisible] = useState(false),
    [hintObscured, setHintObscured] = useState(false);
  const handheldEntry = useRef<AbortController | null>(null),
    handheldExit = useRef(false),
    entryHint = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState({ text: "", id: 0 });
  const world = useRef<WorldController>(null),
    panelRef = useRef(panel),
    handheldRef = useRef(handheld),
    arrivalRef = useRef(arrival),
    pendingScene = useRef<Player | null>(null),
    ambienceRef = useRef(ambientPaused),
    trigger = useRef<HTMLElement | null>(null);
  panelRef.current = panel;
  handheldRef.current = handheld;
  arrivalRef.current = arrival;
  ambienceRef.current = ambientPaused;
  const desiredSound = useRef(false),
    soundIntent = useRef(0),
    handoff = useRef(0),
    frames = useRef<number[]>([]),
    entrance = useRef<AbortController | null>(null);
  const [viewedFloor, setViewedFloor] = useState(0);
  const viewedFloorRef = useRef(0);
  const floorViewed = useCallback((floor: number) => {
    viewedFloorRef.current = floor;
    setViewedFloor(floor);
  }, []);
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
  const cancelHandheldEntry = useCallback(() => {
    const active = handheldEntry.current;
    handheldEntry.current = null;
    active?.abort();
    world.current?.pause("handheld-entry", false);
    setHandheldPending(false);
  }, []);
  const close = useCallback(() => {
    const kind = panelRef.current?.kind,
      target = trigger.current;
    setPanel(null);
    if (pendingScene.current) {
      setScenePlayer(pendingScene.current);
      pendingScene.current = null;
    }
    afterLayout(() => {
      world.current?.refresh();
      if (kind === "register" && target?.isConnected)
        target.focus({ preventScroll: true });
      else world.current?.focus();
    });
  }, [afterLayout]);
  const open = useCallback(
    (next: Panel, source?: HTMLElement) => {
      if (arrivalRef.current) return;
      cancelHandheldEntry();
      handoff.current++;
      frames.current.forEach(cancelAnimationFrame);
      world.current?.cancelTravel();
      trigger.current =
        source || (document.activeElement as HTMLElement | null);
      audio.effect("click");
      setPanel(next);
    },
    [cancelHandheldEntry],
  );
  const register = useCallback(
    () => open({ kind: "register", interest: null }),
    [open],
  );
  const navigate = useCallback(
    (floor: number, x?: number) => {
      if (arrivalRef.current) return;
      cancelHandheldEntry();
      setPanel(null);
      afterLayout(() => {
        world.current?.refresh();
        world.current?.reveal(floor, x);
      });
    },
    [afterLayout, cancelHandheldEntry],
  );
  const exitHandheld = useCallback(() => {
    cancelHandheldEntry();
    // Stop travel and held controls before switching back to page geometry.
    world.current?.cancelTravel();
    world.current?.release();
    handheldExit.current = handheldRef.current;
    handheldRef.current = false;
    setHandheld(false);
  }, [cancelHandheldEntry]);
  const startHandheld = useCallback(
    async (floor: number) => {
      if (handheldRef.current) return true;
      if (handheldEntry.current) return false;
      const entry = new AbortController();
      handheldEntry.current = entry;
      handoff.current++;
      frames.current.forEach(cancelAnimationFrame);
      setHandheldPending(true);
      setHandheldError(false);
      try {
        await awaitHandheldAssets(
          scenePlayer?.appearance || DEFAULT_APPEARANCE,
          entry.signal,
        );
        if (
          entry.signal.aborted ||
          document.hidden ||
          !document.hasFocus() ||
          panelRef.current
        )
          return false;
        world.current?.cancelTravel();
        const frame = document.getElementById(
          floor ? "social-floor" : "main-hall",
        )!;
        const rect = frame.getBoundingClientRect();
        const from = new DOMRect(
          0,
          Math.max(0, rect.top),
          innerWidth,
          Math.max(
            1,
            Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top),
          ),
        );
        handheldRef.current = true;
        setHandheld(true);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (entry.signal.aborted) return false;
        world.current?.refresh();
        world.current?.control(floor);
        world.current?.pause("handheld-entry", true);
        await animateHandheldEntry(frame, from, reduced, entry.signal);
        return !entry.signal.aborted;
      } catch (error) {
        if (!entry.signal.aborted) {
          setHandheldError(true);
          announce("The controls could not load. Tap again to retry.");
        }
        return false;
      } finally {
        if (handheldEntry.current === entry) {
          handheldEntry.current = null;
          world.current?.pause("handheld-entry", false);
          setHandheldPending(false);
        }
      }
    },
    [scenePlayer?.appearance, reduced, announce],
  );
  useEffect(() => {
    if (touch)
      void prepareHandheld(scenePlayer?.appearance || DEFAULT_APPEARANCE).catch(
        () => {},
      );
  }, [touch, scenePlayer?.appearance]);
  useEffect(() => {
    const footer = document.querySelector(".venue-footer");
    const footerObserver = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    if (footer) footerObserver.observe(footer);
    const boards = [
      ...document.querySelectorAll(".event-board,.schedule-board"),
    ];
    let bandObserver: IntersectionObserver;
    const observeHintBand = () => {
      bandObserver?.disconnect();
      const overlapping = new Set<Element>();
      bandObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) overlapping.add(entry.target);
            else overlapping.delete(entry.target);
          }
          setHintObscured(overlapping.size > 0);
        },
        { rootMargin: `-${Math.max(0, innerHeight - 76)}px 0px -8px 0px` },
      );
      boards.forEach((board) => bandObserver.observe(board));
    };
    observeHintBand();
    window.addEventListener("resize", observeHintBand);
    return () => {
      footerObserver.disconnect();
      bandObserver.disconnect();
      window.removeEventListener("resize", observeHintBand);
    };
  }, []);
  useEffect(() => {
    if (!handheldPending || handheld) return;
    const cancel = () => cancelHandheldEntry();
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    return () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
    };
  }, [handheldPending, handheld, cancelHandheldEntry]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE) || "null");
      const savedPlayer = safePlayer(stored?.player);
      setPlayer(savedPlayer);
      setScenePlayer(savedPlayer);
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
      setTouch(narrow.matches || coarse.matches);
      setCoarseInput(coarse.matches);
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
      const activeHandheld = handheldEntry.current;
      handheldEntry.current = null;
      activeHandheld?.abort();
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
          active?.kind === "game"
            ? active.id
            : viewedFloorRef.current === 1
              ? "office"
              : "hall",
        );
      }
      if (token !== soundIntent.current) return;
      if (next && !audio.enabled) throw Error("Sound unavailable");
      if (
        hallAudioShouldPlay({
          enabled: next,
          paused: ambienceRef.current,
          hidden: document.hidden,
          focused: document.hasFocus(),
          gameOpen: panelRef.current?.kind === "game",
        })
      )
        await audio.play(viewedFloorRef.current === 1 ? "office" : "hall");
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
      if (document.hidden || !document.hasFocus()) {
        audio.pause();
        return;
      }
      const intent = soundIntent.current;
      if (panelRef.current?.kind === "game") return;
      if (
        !hallAudioShouldPlay({
          enabled: desiredSound.current,
          paused: ambienceRef.current,
          hidden: document.hidden,
          focused: document.hasFocus(),
          gameOpen: false,
        })
      ) {
        audio.pause();
        return;
      }
      if (desiredSound.current)
        void audio
          .play(viewedFloorRef.current === 1 ? "office" : "hall")
          .catch(() => {
            if (
              !active ||
              intent !== soundIntent.current ||
              !desiredSound.current ||
              panelRef.current?.kind === "game"
            )
              return;
            setSoundStatus("error");
            setSoundError(
              "Music could not load. Turn sound off and on to retry.",
            );
          });
    };
    reconcile();
    document.addEventListener("visibilitychange", reconcile);
    const suspend = () => audio.pause();
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", reconcile);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", reconcile);
    };
  }, [panel, sound, ambientPaused, viewedFloor]);
  useLayoutEffect(() => {
    if (!handheld) {
      if (handheldExit.current) {
        handheldExit.current = false;
        world.current?.restorePage();
      }
      return;
    }
    handheldExit.current = false;
    const unlockPage = lockPageScroll();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      unlockPage();
      document.body.style.overflow = old;
    };
  }, [handheld]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.repeat &&
        (handheldRef.current || handheldEntry.current) &&
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
        void startHandheld(floor);
      } else world.current?.control(floor);
    },
    [touch, startHandheld],
  );
  const openTarget = useCallback(
    (target: WorldTarget) => {
      const show = () => {
        if (target.kind === "food") world.current?.eat();
        else if (target.kind === "schedule")
          open({ kind: "schedule" }, target.element);
        else if (target.kind === "register")
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
        void startHandheld(floor).then((entered) => {
          if (entered) show();
        });
      } else show();
    },
    [open, touch, startHandheld],
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
    async (next: Player, updating = player !== null) => {
      if (arrivalRef.current) return;
      const location = world.current?.position() || {
        floor: 0,
        x: SCENE.booth,
      };
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
      await dropIntoHall({
        reduced,
        signal: owner.signal,
        prepare: async () => {
          setPlayer(next);
          setScenePlayer(next);
          pendingScene.current = null;
          setPanel(null);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          if (updating) world.current?.refresh();
          const floor = updating ? location.floor : 0;
          // Arrival owns page framing; don't launch a competing world scroll flight.
          const actor = world.current!.goTo(
            floor,
            updating ? location.x : SCENE.booth,
            false,
          );
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
    else if (action === "schedule") navigate(1, SCENE.booth);
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
      data-handheld-entry={handheldPending}
    >
      <a
        className="skip-link"
        href="#social-floor"
        onClick={(e) => {
          e.preventDefault();
          navigate(1, SCENE.booth);
        }}
      >
        Skip to schedule
      </a>
      <SiteHeader
        registered={!!player}
        inactive={handheld || arrival}
        onExplore={explore}
        onSchedule={() => navigate(1, SCENE.booth)}
        onRegister={register}
      />
      {ready && touch && !handheld && !panel && !arrival && !footerVisible && (
        <button
          ref={entryHint}
          className="scene-entry-hint"
          aria-busy={handheldPending}
          disabled={handheldPending}
          hidden={hintObscured}
          onClick={() => enterScene(viewedFloorRef.current)}
        >
          {handheldPending
            ? "Preparing the hall…"
            : handheldError
              ? "Tap to try exploring again"
              : coarseInput
                ? "Tap the scene to explore"
                : "Click the scene to explore"}
        </button>
      )}
      <div className="global-notices">
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
      </div>
      <World
        ref={world}
        player={scenePlayer}
        paused={!!panel || arrival}
        arriving={arrival}
        entering={handheldPending}
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
        onViewFloorChange={floorViewed}
        onExitHandheld={exitHandheld}
        onToggleMotion={() => {
          const next = !ambienceRef.current;
          ambienceRef.current = next;
          setAmbientPaused(next);
          audio.effect("click");
          if (next) audio.pause();
          announce(
            next
              ? "Venue music and background motion paused."
              : "Venue ambience resumed.",
          );
        }}
        soundControl={soundControl}
      />
      <footer className="site-footer venue-footer" inert={handheld || arrival}>
        <div className="footer-identity">
          <img src="/assets/vega/logo.svg" alt="Vega" width={110} height={36} />
          <div>
            <h2>Meet Vega at Booth 630.</h2>
            <p className="footer-details">
              <time dateTime="2026-10-03">October 3–5, 2026</time>
              <span>Javits Center, New York</span>
            </p>
          </div>
        </div>
        <div className="footer-actions">
          <button
            className="pixel-button primary"
            onClick={register}
            disabled={arrival}
          >
            {player ? "Edit my player" : "Register now"} ↗
          </button>
          <button
            className="text-link"
            onClick={() => navigate(0, SCENE.booth)}
          >
            Back to Booth 630 ↑
          </button>
        </div>
        <p className="footer-note">
          16-Bit Con is a fictional event and interactive demo.
        </p>
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
          onSave={(next) => {
            pendingScene.current = next;
            setPlayer(next);
          }}
          sessionOnly={saveStatus === "session"}
          soundControl={soundControl}
        />
      )}
      {panel?.kind === "schedule" && (
        <ScheduleDialog
          interests={player?.interests || []}
          onSession={session}
          onClose={close}
          soundControl={soundControl}
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
