"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createWorld,
  type WorldController,
  type WorldTarget,
} from "@/lib/world";
import { SPRITES } from "@/lib/assets";
import { GAMES, DEFAULT_APPEARANCE, type Player } from "@/lib/types";
import {
  characterSheets,
  ACTIVITY_PORTRAITS,
  type CharacterSheets,
} from "@/lib/character";
import { CHARACTERS, AMBIENT_CONVERSATIONS } from "@/lib/lore";
import Sprite from "./Sprite";
import Controls from "./Controls";
import NpcSprite from "./NpcSprite";
import AttractScreen from "./AttractScreen";
import Icon from "./Icon";
import Companion from "./Companion";
import VenueLife from "./VenueLife";
import SessionTickets from "./SessionTickets";
import { snackSheet } from "@/lib/snack-art";
import { SCENE, MACHINES } from "@/lib/scene";

const defaultSheets = {
  idle: "/assets/vega/sam-idle.png",
  run: "/assets/vega/sam-run.png",
  jump: "/assets/vega/sam-jump.png",
};
type Props = {
  soundControl: ReactNode;
  player: Player | null;
  paused: boolean;
  arriving?: boolean;
  entering?: boolean;
  handheld: boolean;
  reduced: boolean;
  ambientPaused: boolean;
  interests: number[];
  onTarget: (t: WorldTarget) => void;
  onRegister: () => void;
  onSession: (index: number) => void;
  onAnnounce: (text: string) => void;
  onHandheld: () => void;
  onEnterScene: (floor: number) => void;
  onViewFloorChange: (floor: number) => void;
  onExitHandheld: () => void;
  onToggleMotion: () => void;
};
const World = forwardRef<WorldController, Props>(function World(
  {
    player,
    paused,
    arriving = false,
    entering = false,
    handheld,
    reduced,
    ambientPaused,
    interests,
    onTarget,
    onRegister,
    onSession,
    onAnnounce,
    onHandheld,
    onEnterScene,
    onViewFloorChange,
    onExitHandheld,
    onToggleMotion,
    soundControl,
  },
  ref,
) {
  const root = useRef<HTMLDivElement>(null),
    engine = useRef<WorldController | null>(null),
    callbacks = useRef({
      onTarget,
      onAnnounce,
      onSession,
      onEnterScene,
      onViewFloorChange,
    });
  callbacks.current = {
    onTarget,
    onAnnounce,
    onSession,
    onEnterScene,
    onViewFloorChange,
  };
  const [sheets, setSheets] = useState<CharacterSheets>(defaultSheets),
    [snackSrc, setSnackSrc] = useState(""),
    [chatter, setChatter] = useState<{ index: number; turn: number } | null>(
      null,
    );
  const ambientState = useRef({ paused, reduced, ambientPaused }),
    conversationCursor = useRef(0);
  ambientState.current = { paused, reduced, ambientPaused };
  useEffect(() => {
    let active = true;
    const appearance = player?.appearance || DEFAULT_APPEARANCE;
    void Promise.all([characterSheets(appearance), snackSheet(appearance)])
      .then(([value, snack]) => {
        if (active) {
          setSheets(value);
          setSnackSrc(snack);
        }
      })
      .catch(() => {
        if (active) setSheets(defaultSheets);
      });
    return () => {
      active = false;
    };
  }, [player?.appearance]);
  useEffect(() => {
    const controller = createWorld(
      root.current!,
      (t) => {
        if (t.kind === "session") callbacks.current.onSession(Number(t.id));
        else callbacks.current.onTarget(t);
      },
      (text) => callbacks.current.onAnnounce(text),
      (floor) => callbacks.current.onEnterScene(floor),
      (floor) => callbacks.current.onViewFloorChange(floor),
    );
    engine.current = controller;
    return () => {
      controller.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => engine.current?.pause("overlay", paused), [paused]);
  useEffect(() => engine.current?.setAmbient(ambientPaused), [ambientPaused]);
  useEffect(() => {
    engine.current?.refresh();
  }, [handheld]);
  useEffect(() => {
    engine.current?.refresh();
  }, [player?.appearance.companion]);
  useEffect(() => {
    if (paused || reduced || ambientPaused) {
      setChatter(null);
      return;
    }
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const allowed = () =>
      !document.hidden &&
      document.hasFocus() &&
      !ambientState.current.paused &&
      !ambientState.current.reduced &&
      !ambientState.current.ambientPaused;
    const visible = (id: string) => {
      const actual =
        id === "pingpong_kit"
          ? "pingpong_jules"
          : id === "chess_ren"
            ? "chess_nico"
            : id;
      const el = root.current?.querySelector<HTMLElement>(
        `[data-target="${actual}"]`,
      );
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (
        r.right > 0 &&
        r.left < innerWidth &&
        r.bottom > 0 &&
        r.top < innerHeight
      );
    };
    const talk = () => {
      if (allowed()) {
        const candidates = AMBIENT_CONVERSATIONS.map((c, i) => ({
          c,
          i,
        })).filter(({ c }) => c.speakers.every(visible));
        if (candidates.length) {
          const index =
            candidates[conversationCursor.current++ % candidates.length].i;
          setChatter({ index, turn: 0 });
          later(() => {
            if (allowed()) setChatter({ index, turn: 1 });
            else setChatter(null);
          }, 2600);
          later(() => setChatter(null), 5700);
        }
      }
      later(talk, 9500);
    };
    later(talk, 1800);
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [paused, reduced, ambientPaused]);
  useImperativeHandle(
    ref,
    () => ({
      pause: (r, v) => engine.current?.pause(r, v),
      virtual: (k, d, source) => engine.current?.virtual(k, d, source),
      travel: (f) => engine.current?.travel(f),
      cancelTravel: () => engine.current?.cancelTravel(),
      goTo: (f, x, s) => engine.current!.goTo(f, x, s),
      interact: (t) => engine.current?.interact(t),
      eat: () => engine.current?.eat(),
      reveal: (f, x) => engine.current?.reveal(f, x),
      reframe: (f, x) => engine.current!.reframe(f, x),
      control: (f) => engine.current?.control(f),
      release: () => engine.current?.release(),
      restorePage: () => engine.current?.restorePage(),
      focus: () => engine.current?.focus(),
      refresh: () => engine.current?.refresh(),
      destroy: () => engine.current?.destroy(),
      position: () =>
        engine.current?.position() || { floor: 0, x: SCENE.booth },
      setAmbient: (v) => engine.current?.setAmbient(v),
    }),
    [],
  );
  const target = (
    kind: WorldTarget["kind"],
    id: string,
    label: string,
    el: HTMLElement,
  ) => engine.current?.interact({ kind, id, label, element: el });
  const prop = (
    name: string,
    x: number,
    elevation = 0,
    platform = false,
    extra = "",
  ) => {
    const a = SPRITES[name];
    if (!a) return null;
    return (
      <div
        key={`${name}-${x}`}
        className={`world-prop ${extra}`}
        style={{ left: x - a.width, bottom: 88 + elevation }}
        data-platform={platform ? "true" : undefined}
      >
        <Sprite name={name} />
      </div>
    );
  };
  const bubble = (id: string) => {
    if (!chatter || paused) return null;
    const c = AMBIENT_CONVERSATIONS[chatter.index],
      speaker = c.speakers[chatter.turn],
      pair =
        id === "pingpong_jules"
          ? ["pingpong_jules", "pingpong_kit"]
          : id === "chess_nico"
            ? ["chess_nico", "chess_ren"]
            : null;
    return speaker === id || pair?.includes(speaker) ? (
      <span
        className="ambient-bubble"
        style={
          pair
            ? ({
                "--speech-anchor": chatter.turn ? "90%" : "10%",
              } as CSSProperties)
            : undefined
        }
        aria-hidden="true"
      >
        {c.lines[chatter.turn]}
      </span>
    ) : null;
  };
  const npc = (
    id: string,
    sprite: string,
    at: number,
    flip = false,
    roam = 0,
  ) => {
    const c = CHARACTERS.find((c) => c.id === id)!;
    const head = ACTIVITY_PORTRAITS[id]?.crop;
    const headX = head
      ? (head[0] + head[2] / 2 - SPRITES[sprite].width / 2) * 2
      : 0;
    const headY = head ? head[1] * 2 : 16;
    return (
      <button
        key={id}
        className={`npc npc-${id}`}
        style={
          {
            left: at,
            bottom: 88 + (id === "host" ? 60 : 0),
            "--npc-world-x": `${at}px`,
            "--npc-head-x": `${headX}px`,
            "--npc-head-y": `${headY}px`,
          } as CSSProperties
        }
        data-target={id}
        data-kind="npc"
        data-label={c.name}
        data-x={at}
        data-head-x={headX}
        data-head-y={headY}
        data-home-x={at}
        data-roam={roam || undefined}
        data-pose="idle"
        data-facing={flip ? "left" : "right"}
        onClick={(e) => target("npc", id, c.name, e.currentTarget)}
        aria-label={`Talk to ${c.name}, ${c.role}`}
      >
        {sprite === "sam-idle" ? (
          <NpcSprite id={id} />
        ) : (
          <Sprite name={sprite} flip={flip} />
        )}{" "}
        {bubble(id)}
        <span className="npc-focus-name">
          {c.name}
          {id === "host" ? " · Vega crew" : " · Talk"}
        </span>
      </button>
    );
  };
  const actor = (floor: number) => (
    <>
      <div
        className="world-player"
        data-player
        data-pose="idle"
        data-facing="right"
        data-player-floor={floor}
        style={arriving ? { opacity: 0 } : undefined}
      >
        <span className="player-name">{player?.name || "Sam"}</span>
        <div className="player-facing">
          <Sprite name="sam-idle" src={sheets.idle} className="pose-idle" />
          <Sprite name="sam-run" src={sheets.run} className="pose-run" />
          <Sprite name="sam-jump" src={sheets.jump} className="pose-jump" />
          <span
            className="snack-pose"
            style={{
              backgroundImage: snackSrc ? `url("${snackSrc}")` : undefined,
            }}
            aria-hidden="true"
          />
        </div>
        <span className="snack-note" aria-hidden="true">
          Good slice.
        </span>
        <span className="player-shadow" />
      </div>
      <div
        className="world-companion"
        data-companion={player?.appearance.companion || 0}
        data-pose="idle"
        data-facing="right"
        hidden={!player?.appearance.companion}
      >
        <Companion kind={player?.appearance.companion} />
      </div>
    </>
  );
  const lift = (floor: number) => (
    <>
      <div className="service-wall" aria-hidden="true" />
      <div className="lift-bay" aria-hidden="true">
        <img src="/assets/vega/lift-bay.svg" width={416} height={288} alt="" />
        {floor === 0 && (
          <Sprite name="elevator-floor-2" className="lift-floor-label" />
        )}
      </div>
      <button
        className="world-lift"
        data-kind="lift"
        data-target={`lift-${floor}`}
        data-label={
          floor ? "2F · Main hall upstairs" : "1F · Social floor downstairs"
        }
        data-x={SCENE.lift}
        onClick={() => engine.current?.travel(floor ? 0 : 1)}
        aria-label={
          floor
            ? "Take the lift to 2F, the main hall"
            : "Take the lift to 1F, the social floor"
        }
      >
        <span className="sr-only">
          {floor ? "↑ 2F · MAIN HALL" : "↓ 1F · SOCIAL FLOOR"}
        </span>
        <Sprite name="elevator-doors" />
      </button>
    </>
  );
  const sceneTools = (
    <div className="scene-tools" aria-label="Game settings">
      {soundControl}
      <button
        type="button"
        className="icon-button"
        onClick={onToggleMotion}
        aria-pressed={ambientPaused}
        aria-label={
          ambientPaused ? "Resume venue ambience" : "Pause venue ambience"
        }
      >
        <Icon name={ambientPaused ? "play" : "pause"} />
      </button>
    </div>
  );
  const prompt = (
    <div className="world-prompt" data-world-prompt hidden aria-hidden="true">
      <strong data-prompt-title />
      <span data-prompt-action />
    </div>
  );
  return (
    <div
      ref={root}
      style={
        {
          "--world-center": `${SCENE.booth}px`,
          "--world-width": `${SCENE.width}px`,
        } as CSSProperties
      }
      inert={arriving}
      className={`world-stage ${handheld ? "is-handheld" : ""} ${reduced ? "reduced-motion" : ""}`}
    >
      <svg
        className="scene-color-filters"
        aria-hidden="true"
        width="0"
        height="0"
      >
        <defs>
          <filter id="sunset-city" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values=".90 0 .30 0 0 .15 .70 0 0 0 .15 0 .80 0 0 0 0 0 1 0"
            />
          </filter>
          <filter id="sunset-distance" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values=".68 0 .30 0 .13 .12 .64 0 0 .06 .12 0 .73 0 .05 0 0 0 1 0"
            />
          </filter>
          <filter id="sunset-clouds" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values=".80 0 0 0 .20 0 .65 0 0 .20 0 0 .60 0 .15 0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      {handheld && (
        <div className="handheld-top">
          <span>16-Bit Con</span>
          <div className="window-actions">
            {soundControl}
            <button
              className="icon-button"
              onClick={onToggleMotion}
              aria-pressed={ambientPaused}
              aria-label={
                ambientPaused ? "Resume venue ambience" : "Pause venue ambience"
              }
            >
              <Icon name={ambientPaused ? "play" : "pause"} />
            </button>
            <button
              className="icon-button"
              onClick={onExitHandheld}
              aria-label="Exit handheld mode and restore page scrolling"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      )}
      <section
        className="world-floor main-hall"
        id="main-hall"
        data-floor="0"
        tabIndex={0}
        aria-label="Javits main hall. Choose a game, talk to a guest, or explore with Sam."
      >
        <div className="sky-stack" aria-hidden="true">
          <div className="sky-layer skyline-far" />
          <div className="sky-layer skyline-towers" />
          <div className="sky-layer skyline-mid" />
          <div className="sky-cloud cloud-one" />
          <div className="sky-cloud cloud-two" />
          <div className="sky-cloud cloud-three" />
        </div>
        <div className="world-inner" data-world-inner>
          <div className="glass-wall" aria-hidden="true" />
          <div className="steel-roof" aria-hidden="true" />
          <div className="venue-sign">JAVITS CENTER · NEW YORK</div>
          <div className="event-board" data-platform>
            <div className="billboard-hardware" aria-hidden="true">
              <span className="billboard-clamp clamp-left" />
              <span className="billboard-clamp clamp-right" />
              <span className="billboard-bolt bolt-left" />
              <span className="billboard-bolt bolt-right" />
              <span className="billboard-light light-left">
                <i className="billboard-beam" />
                <i className="lamp-head" />
              </span>
              <span className="billboard-light light-right">
                <i className="billboard-beam" />
                <i className="lamp-head" />
              </span>
            </div>
            <h1>16-Bit Con</h1>
            <p>
              The retro gaming convention for people who never stopped playing.
            </p>
            <div className="event-date">October 3–5, 2026</div>
            <div className="button-row">
              <button className="pixel-button primary" onClick={onRegister}>
                {player ? "Edit my player" : "Register now"}
              </button>
              <a
                className="pixel-button lineup-link"
                href="#social-floor"
                onClick={(e) => {
                  e.preventDefault();
                  engine.current?.reveal(1, SCENE.booth);
                }}
              >
                See the lineup ↓
              </a>
              <button
                className="pixel-button hero-explore"
                onClick={onHandheld}
                aria-label="Explore the hall"
              >
                Explore
              </button>
            </div>
          </div>
          {prop("plant-flowers", 1050)}
          {prop("plant-flowers", 2550)}
          {prop("plant-2", 3470)}
          {MACHINES.map((machine) => {
            const game = GAMES.find((g) => g.id === machine.id)!;
            return (
              <button
                key={game.id}
                className={`game-machine machine-${game.id}`}
                style={
                  {
                    left: machine.x,
                    "--cabinet-width": `${machine.width * 2}px`,
                    "--cabinet-height": `${machine.height * 2}px`,
                  } as CSSProperties
                }
                data-target={game.id}
                data-kind="game"
                data-label={game.name}
                data-x={machine.x}
                onClick={(e) =>
                  target("game", game.id, game.name, e.currentTarget)
                }
                aria-label={`Play ${game.name} on ${game.machine}`}
              >
                <span className="machine-lightbox">{machine.label}</span>
                <span className="cabinet" data-platform>
                  <img
                    src={`/assets/vega/${machine.asset}`}
                    alt=""
                    width={machine.width * 2}
                    height={machine.height * 2}
                    draggable={false}
                  />
                  {game.id === "breaker" && (
                    <img
                      className="arcade-brand-overlay"
                      src="/assets/vega/arcade-logo-pair-overlay.svg"
                      width={106}
                      height={174}
                      alt=""
                    />
                  )}
                  <span
                    className="attract-screen"
                    aria-hidden="true"
                    style={{
                      left: machine.screen[0] * 2,
                      top: machine.screen[1] * 2,
                      width: machine.screen[2] * 2,
                      height: machine.screen[3] * 2,
                    }}
                  >
                    <AttractScreen
                      id={game.id}
                      paused={paused || ambientPaused}
                      reduced={reduced}
                    />
                  </span>
                </span>
                <span className="machine-game-name">{game.name}</span>
                <span className="machine-key">ENTER · PLAY</span>
              </button>
            );
          })}
          <button
            className="vega-booth"
            style={{ left: SCENE.booth }}
            data-target="registration"
            data-kind="register"
            data-label={
              player
                ? "Edit your player at Booth 630"
                : "Make your player at Booth 630"
            }
            data-action-label={player ? "EDIT PLAYER" : "REGISTER"}
            data-x={SCENE.booth}
            onClick={onRegister}
            aria-label={
              player
                ? "Edit your player at Vega Booth 630"
                : "Register and create your player at Vega Booth 630"
            }
          >
            <img
              className="booth-volume"
              src="/assets/vega/booth.svg"
              width={296}
              height={272}
              alt=""
              draggable={false}
            />
            <div className="booth-marquee">
              <img src="/assets/vega/logo.svg" alt="Vega" />
              <span>BOOTH 630</span>
            </div>
            <span className="booth-entry-light" aria-hidden="true" />
            <span className="booth-counter" data-platform aria-hidden="true" />
          </button>
          {npc("host", "sam-idle", 1870)}
          {npc("collector", "sam-idle", 1480, false, 65)}
          {npc("racer", "sam-idle", 2200, true, 60)}
          {npc("artist", "sam-idle", 3070, true, 70)}
          {npc("coffee", "mole-coffee", 2070)}
          <VenueLife
            floor={0}
            onRegister={onRegister}
            onPizza={(el) => target("food", "pizza", "Pizza break", el)}
          />
          {lift(0)}
          <div className="world-floor-art" aria-hidden="true" />
          <div className="dust-layer" data-dust-layer aria-hidden="true" />
          {actor(0)}
        </div>
        <div className="foreground-life" aria-hidden="true">
          <Sprite
            name="plant-flowers"
            scale={3}
            style={{ position: "absolute", left: 130, bottom: 0 }}
          />
          <Sprite
            name="plant-2"
            scale={3}
            style={{ position: "absolute", left: 2590, bottom: 0 }}
          />
        </div>
        <div className="foreground-rail" aria-hidden="true" />
        {prompt}
        <div className="hall-controls">
          {sceneTools}
          <span className="desktop-controls">
            ← → Move Sam · Space Jump · Enter Interact · Esc Release · M Sound
          </span>
          <span className="hall-hint">Tap the hall to explore.</span>
        </div>
      </section>
      <section
        className="world-floor social-floor"
        id="social-floor"
        data-floor="1"
        tabIndex={0}
        aria-label="Social floor and event schedule"
      >
        <div className="world-inner" data-world-inner>
          <div className="concourse-wall" aria-hidden="true" />
          <div className="concourse-ceiling" aria-hidden="true" />
          <div className="schedule-board">
            <h2>The lineup.</h2>
            <p>Three highlights from 16-Bit Con.</p>
            <SessionTickets
              interests={interests}
              onSession={onSession}
              inWorld
            />
            <small>Featured sessions · October 3–5 · New York time</small>
          </div>
          <button
            className="handheld-lineup"
            data-target="schedule"
            data-kind="schedule"
            data-label="The lineup"
            data-x={SCENE.booth}
            data-active-mode="handheld"
            onClick={(event) =>
              target("schedule", "schedule", "The lineup", event.currentTarget)
            }
            aria-label="Open the event schedule"
          >
            <strong>The lineup.</strong>
            <span>View sessions</span>
          </button>
          {prop("window", 160, 180)}
          {prop("window", 3500, 230)}
          {prop("plant-2", 160)}
          {prop("plant-flowers", 1120)}
          {prop("plant-1", 2940)}
          {prop("deck-chair", 280, 0, true)}
          {npc("analyst", "mole-laptop", 2760)}
          {npc("pingpong_jules", "moles-ping-pong", 3180)}
          {npc("chess_nico", "moles-chess", 930)}
          <div
            className="world-prop pizza-guest"
            style={{ left: 1930, bottom: 88 }}
          >
            <Sprite name="mole-pizza" />
          </div>
          <div className="social-sign ping-sign">PING. PONG. REPEAT.</div>
          <div className="social-sign chess-sign">ONE MORE MOVE.</div>
          <VenueLife floor={1} />
          {lift(1)}
          <div className="world-floor-art" aria-hidden="true" />
          <div className="dust-layer" data-dust-layer aria-hidden="true" />
          {actor(1)}
        </div>
        {prompt}
        <div className="hall-controls">
          {sceneTools}
          <span className="desktop-controls">
            ← → Move Sam · Space Jump · Enter Interact · Esc Release · M Sound
          </span>
          <span className="hall-hint">Tap the hall to explore.</span>
        </div>
      </section>
      {handheld && (
        <Controls
          disabled={paused || arriving || entering}
          onPress={(key, down, source) =>
            engine.current?.virtual(key, down, source)
          }
          action="INTERACT"
          secondary="JUMP"
        />
      )}
    </div>
  );
});
export default World;
