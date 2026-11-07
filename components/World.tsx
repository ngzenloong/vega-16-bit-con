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
import { GAMES, SESSIONS, DEFAULT_APPEARANCE, type Player } from "@/lib/types";
import { characterSheets, type CharacterSheets } from "@/lib/character";
import { CHARACTERS, AMBIENT_CONVERSATIONS } from "@/lib/lore";
import Sprite from "./Sprite";
import Controls from "./Controls";
import NpcSprite from "./NpcSprite";
import AttractScreen from "./AttractScreen";
import Icon from "./Icon";
import Companion from "./Companion";
import { SCENE, MACHINES } from "@/lib/scene";

const positions: Record<string, number> = {
  host: 1510,
  collector: 1200,
  racer: 1740,
  artist: 2310,
  analyst: 2020,
  coffee: 1620,
  pingpong_jules: 2400,
  chess_nico: 820,
};
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
  onExitHandheld: () => void;
  onToggleMotion: () => void;
};
const World = forwardRef<WorldController, Props>(function World(
  {
    player,
    paused,
    arriving = false,
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
    onExitHandheld,
    onToggleMotion,
    soundControl,
  },
  ref,
) {
  const root = useRef<HTMLDivElement>(null),
    engine = useRef<WorldController | null>(null),
    callbacks = useRef({ onTarget, onAnnounce, onSession, onEnterScene });
  callbacks.current = { onTarget, onAnnounce, onSession, onEnterScene };
  const [sheets, setSheets] = useState<CharacterSheets>(defaultSheets),
    [chatter, setChatter] = useState<{ index: number; turn: number } | null>(
      null,
    );
  const ambientState = useRef({ paused, reduced, ambientPaused }),
    conversationCursor = useRef(0);
  ambientState.current = { paused, reduced, ambientPaused };
  useEffect(() => {
    let active = true;
    void characterSheets(player?.appearance || DEFAULT_APPEARANCE)
      .then((value) => {
        if (active) setSheets(value);
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
      reveal: (f, x) => engine.current?.reveal(f, x),
      control: (f) => engine.current?.control(f),
      release: () => engine.current?.release(),
      focus: () => engine.current?.focus(),
      refresh: () => engine.current?.refresh(),
      destroy: () => engine.current?.destroy(),
      position: () => engine.current?.position() || { floor: 0, x: 1400 },
      setAmbient: (v) => engine.current?.setAmbient(v),
    }),
    [],
  );
  const target = (
    kind: WorldTarget["kind"],
    id: string,
    label: string,
    el: HTMLElement,
  ) => onTarget({ kind, id, label, element: el });
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
    at = positions[id],
    flip = false,
    roam = 0,
  ) => {
    const c = CHARACTERS.find((c) => c.id === id)!;
    return (
      <button
        key={id}
        className={`npc npc-${id}`}
        style={
          {
            left: at,
            bottom: 88 + (id === "host" ? 60 : 0),
            "--npc-world-x": `${at}px`,
          } as CSSProperties
        }
        data-target={id}
        data-kind="npc"
        data-label={c.name}
        data-x={at}
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
      >
        <span className="player-name">{player?.name || "Sam"}</span>
        <div className="player-facing">
          <Sprite name="sam-idle" src={sheets.idle} className="pose-idle" />
          <Sprite name="sam-run" src={sheets.run} className="pose-run" />
          <Sprite name="sam-jump" src={sheets.jump} className="pose-jump" />
        </div>
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
        {floor === 1 && (
          <Sprite name="elevator-floor-2" className="lift-floor-label" />
        )}
      </div>
      <button
        className="world-lift"
        data-kind="lift"
        data-target={`lift-${floor}`}
        data-label={floor ? "Main hall upstairs" : "Social floor downstairs"}
        data-x="520"
        onClick={() => engine.current?.travel(floor ? 0 : 1)}
        aria-label={
          floor
            ? "Take the lift to the main hall"
            : "Take the lift to the social floor"
        }
      >
        <span className="sr-only">
          {floor ? "↑ MAIN HALL" : "↓ SOCIAL FLOOR"}
        </span>
        <Sprite name="elevator-doors" />
      </button>
    </>
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
      inert={arriving}
      className={`world-stage ${handheld ? "is-handheld" : ""} ${reduced ? "reduced-motion" : ""}`}
    >
      {handheld && (
        <div className="handheld-top">
          <span>16-Bit Con</span>
          <div className="window-actions">
            {soundControl}
            <button
              className="icon-button"
              onClick={onToggleMotion}
              aria-pressed={ambientPaused}
              aria-label={ambientPaused ? "Resume background motion" : "Pause background motion"}
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
                  engine.current?.reveal(1, 1440);
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
          <div
            className="platform-beam beam-left"
            data-platform
            aria-hidden="true"
          />
          <div
            className="platform-beam beam-right"
            data-platform
            aria-hidden="true"
          />
          <div
            className="upper-catwalk catwalk-left"
            data-platform
            aria-hidden="true"
          />
          <div
            className="upper-catwalk catwalk-right"
            data-platform
            aria-hidden="true"
          />
          {prop("plant-flowers", 840)}
          {prop("plant-flowers", 2000)}
          {prop("plant-2", 2580)}
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
            style={{ left: 1440 }}
            data-target="registration"
            data-kind="register"
            data-label="Make your player at Booth 630"
            data-x="1440"
            onClick={onRegister}
            aria-label="Register and create your player at Vega Booth 630"
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
          {npc("host", "sam-idle", 1510)}
          {npc("collector", "sam-idle", 1190, false, 65)}
          {npc("racer", "sam-idle", 1790, true, 60)}
          {npc("artist", "sam-idle", 2420, true, 70)}
          {npc("coffee", "mole-coffee", 1640)}
          {lift(0)}
          <div className="world-floor-art" aria-hidden="true" />
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
          <span className="desktop-controls">
            ← → Move Sam · Space Jump · Enter Interact · Esc Release
          </span>
          <span className="hall-hint">
            Walk left or right to find all four games.
          </span>
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
            <p>Plan a stop for a talk or the Vega After Party.</p>
            <div className="event-tickets">
              {SESSIONS.map((session, i) => (
                <article className="event-ticket" key={session.time}>
                  <div className="ticket-top">
                    <time>{session.time}</time>
                    <span>16-BIT CON</span>
                  </div>
                  <h3>{session.title}</h3>
                  <p>{session.kind}</p>
                  <button
                    className="ticket-action"
                    data-target={String(i)}
                    data-kind="session"
                    data-label={session.title}
                    data-x="1440"
                    onClick={() => onSession(i)}
                    aria-pressed={interests.includes(i)}
                    aria-label={`${interests.includes(i) ? "Remove" : "Add"} ${session.title} ${interests.includes(i) ? "from" : "to"} my list`}
                  >
                    {interests.includes(i)
                      ? "On my list ✓"
                      : "I’m interested ↗"}
                  </button>
                  <div className="ticket-perforation" aria-hidden="true" />
                </article>
              ))}
            </div>
            <small>Featured sessions · New York time</small>
          </div>
          {prop("window", 160, 180)}
          {prop("window", 2450, 180)}
          {prop("plant-2", 160)}
          {prop("plant-flowers", 1090)}
          {prop("plant-1", 1840)}
          {prop("deck-chair", 280, 0, true)}
          {npc("analyst", "mole-laptop", 2020)}
          {npc("pingpong_jules", "moles-ping-pong", 2400)}
          {npc("chess_nico", "moles-chess", 820)}
          <div
            className="world-prop pizza-guest"
            style={{ left: 1710, bottom: 88 }}
          >
            <Sprite name="mole-pizza" />
          </div>
          <div className="social-sign ping-sign">PING. PONG. REPEAT.</div>
          <div className="social-sign chess-sign">ONE MORE MOVE.</div>
          {lift(1)}
          <div className="world-floor-art" aria-hidden="true" />
          {actor(1)}
        </div>
        {prompt}
        <div className="hall-controls">
          <span>The schedule is in the middle of this floor.</span>
          <button
            className="text-link"
            onClick={() => engine.current?.reveal(0)}
          >
            Back to Booth 630 ↑
          </button>
        </div>
      </section>
      {handheld && (
        <Controls
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
