import { drawFacade } from "./city-art.ts";
import { clamp } from "../math.ts";
import { sweepRect, type Contact, type Rect } from "./collision.ts";
import {
  COLORS as C,
  drawCharacter,
  drawBrand,
  pixelText,
  finishOnce,
  type GameFactory,
  type GameInput,
} from "./types.ts";

function brickLayout(width: number) {
  const columns = width < 500 ? 4 : 8;
  const gap = (width - 88) / columns;
  return Array.from({ length: 24 }, (_, i) => ({
    x: 48 + (i % columns) * gap,
    y: 82 + Math.floor(i / columns) * 31,
    w: gap - 8,
    h: 21,
    alive: true,
    zone: Math.floor(i / 8),
  }));
}
export function createBreakerState(width = 640, height = 400) {
  return {
    width,
    height,
    paddle: width / 2,
    x: width / 2,
    y: height - 76,
    vx: 170,
    vy: -260,
    launched: false,
    lives: 3,
    score: 0,
    wallTime: 0,
    startedAt: null as number | null,
    waitStartedAt: null as number | null,
    waitingTime: 0,
    aim: 0.38,
    flash: 0,
    bricks: brickLayout(width),
  };
}
export type BreakerState = ReturnType<typeof createBreakerState>;
export function resizeBreaker(
  state: BreakerState,
  width: number,
  height: number,
) {
  const speedRatio = Math.sqrt(width / state.width);
  const ceiling = 53;
  const oldPaddleTop = state.height - 71;
  const newPaddleTop = height - 71;
  state.paddle = clamp((state.paddle * width) / state.width, 54, width - 54);
  state.x = clamp((state.x * width) / state.width, 6, width - 6);
  if (!state.launched) state.x = state.paddle;
  state.y = state.launched
    ? ceiling +
      ((state.y - ceiling) / (oldPaddleTop - ceiling)) *
        (newPaddleTop - ceiling)
    : height - 76;
  state.vx *= speedRatio;
  state.vy *= speedRatio;
  const next = brickLayout(width);
  state.bricks = next.map((brick, i) => ({
    ...brick,
    alive: state.bricks[i].alive,
  }));
  if (
    state.bricks.some(
      (brick) =>
        brick.alive &&
        state.x >= brick.x - 5 &&
        state.x <= brick.x + brick.w + 5 &&
        state.y >= brick.y - 5 &&
        state.y <= brick.y + brick.h + 5,
    )
  ) {
    state.y = Math.max(...state.bricks.map((brick) => brick.y + brick.h)) + 12;
  }
  state.width = width;
  state.height = height;
}
export function breakerElapsed(state: BreakerState) {
  if (state.startedAt === null) return 0;
  return Math.max(
    0,
    (state.waitStartedAt ?? state.wallTime) -
      state.startedAt -
      state.waitingTime,
  );
}
export function launchBall(state: BreakerState) {
  if (state.launched || state.lives <= 0) return false;
  if (state.startedAt === null) state.startedAt = state.wallTime;
  if (state.waitStartedAt !== null) {
    state.waitingTime += state.wallTime - state.waitStartedAt;
    state.waitStartedAt = null;
  }
  state.x = state.paddle;
  state.y = state.height - 76;
  state.launched = true;
  const speed = 320 * Math.sqrt(state.width / 640);
  state.vx = Math.sin(state.aim) * speed;
  state.vy = -Math.cos(state.aim) * speed;
  return true;
}
/** Nearest-contact reflection and remaining-step handling follow Jake Gordon's MIT Breakout approach. */
export function updateBreaker(
  state: BreakerState,
  dt: number,
  input: GameInput,
  time: number,
  sound: (kind: string) => void = () => {},
) {
  state.wallTime = time;
  state.flash = Math.max(0, state.flash - dt);
  const direction = clamp(
    (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.axis,
    -1,
    1,
  );
  state.paddle = clamp(
    state.paddle + direction * 440 * Math.sqrt(state.width / 640) * dt,
    54,
    state.width - 54,
  );
  if (!state.launched) {
    if (direction) state.aim = clamp(direction * 0.65, -0.65, 0.65);
    state.x = state.paddle;
    state.y = state.height - 76;
    return;
  }
  let remaining = dt;
  for (let iteration = 0; iteration < 5 && remaining > 1e-6; iteration++) {
    let closest: {
      contact: Contact;
      brick?: BreakerState["bricks"][number];
      paddle?: boolean;
    } | null = null;
    const consider = (
      rect: Rect,
      brick?: BreakerState["bricks"][number],
      paddle = false,
    ) => {
      const contact = sweepRect(
        state.x,
        state.y,
        state.vx,
        state.vy,
        5,
        rect,
        remaining,
      );
      if (contact && (!closest || contact.time < closest.contact.time))
        closest = { contact, brick, paddle };
    };
    consider({ x: -30, y: 0, w: 30, h: state.height + 30 });
    consider({ x: state.width, y: 0, w: 30, h: state.height + 30 });
    consider({ x: 0, y: -30, w: state.width, h: 78 });
    if (state.vy > 0 && state.y < state.height - 60)
      consider(
        { x: state.paddle - 52, y: state.height - 66, w: 104, h: 10 },
        undefined,
        true,
      );
    for (const brick of state.bricks) if (brick.alive) consider(brick, brick);
    const hit = closest as {
      contact: Contact;
      brick?: BreakerState["bricks"][number];
      paddle?: boolean;
    } | null;
    if (!hit) {
      state.x += state.vx * remaining;
      state.y += state.vy * remaining;
      break;
    }
    state.x += state.vx * hit.contact.time;
    state.y += state.vy * hit.contact.time;
    remaining -= hit.contact.time;
    if (hit.brick) {
      hit.brick.alive = false;
      state.score += 100;
      state.flash = 0.1;
      sound("collect");
    } else sound("hit");
    if (hit.paddle && hit.contact.ny === -1) {
      const angle = clamp((state.x - state.paddle) / 52, -0.95, 0.95) * 1.05,
        speed =
          Math.sqrt(state.width / 640) *
          Math.min(
            410,
            320 + (24 - state.bricks.filter((b) => b.alive).length) * 3,
          );
      state.vx = Math.sin(angle) * speed;
      state.vy = -Math.cos(angle) * speed;
    } else {
      if (hit.contact.nx) state.vx = -state.vx;
      if (hit.contact.ny) state.vy = -state.vy;
    }
    state.x += hit.contact.nx * 0.05;
    state.y += hit.contact.ny * 0.05;
  }
  if (state.y > state.height + 10) {
    state.lives--;
    state.launched = false;
    state.waitStartedAt = time;
    sound("hurt");
  }
}
export const createGame: GameFactory = (env) => {
  const state = createBreakerState(env.viewport?.width, env.viewport?.height),
    end = finishOnce(env, "breaker");
  let finished = false;
  return {
    resize: (width, height) => resizeBreaker(state, width, height),
    attractInput: () => {
      const target = state.bricks.find((brick) => brick.alive),
        angle = target
          ? Math.atan2(
              target.x + target.w / 2 - state.x,
              state.height - 66 - target.y,
            )
          : 0;
      const desired = state.x - clamp(angle / 1.05, -0.9, 0.9) * 52;
      return {
        held: {
          axis: clamp(
            (state.vx + (desired - state.paddle) * 16) /
              (440 * Math.sqrt(state.width / 640)),
            -1,
            1,
          ),
        },
        press: state.launched ? [] : [{ key: "action" }],
      };
    },
    press: (key) => {
      if ((key === "action" || key === "up") && launchBall(state))
        env.sound("start");
    },
    update(dt, input, time) {
      if (finished) return;
      updateBreaker(state, dt, input, time, env.sound);
      const cleared = state.bricks.filter((b) => !b.alive).length,
        elapsed = breakerElapsed(state);
      if (cleared === 24) {
        finished = true;
        end(
          state.score + Math.max(0, Math.ceil(60 - elapsed)) * 10,
          true,
          "Legacy Stack cleared. Welcome to the Post-SIEM era.",
        );
      } else if (state.lives <= 0 || elapsed >= 60) {
        finished = true;
        end(
          state.score,
          false,
          `${state.lives <= 0 ? "Out of balls." : "Time's up."} ${cleared}/24 Legacy Stack blocks cleared.`,
        );
      }
    },
    draw(c, t) {
      const { width, height } = state,
        compact = width < 500;
      c.fillStyle = "#211b14";
      c.fillRect(0, 0, width, height);
      c.save();
      c.globalAlpha = 0.34;
      drawFacade(c, env, 6, height - 278, 130, 225, 1, 0);
      drawFacade(c, env, width - 136, height - 316, 130, 263, 3, 1, {
        flip: true,
      });
      c.restore();
      drawBrand(c, env, 18, 12, 84, true);
      pixelText(
        c,
        compact ? "LEGACY STACK" : "BREAK THE LEGACY STACK",
        width - 18,
        31,
        17,
        C.paper,
        "right",
      );
      const cleared = state.bricks.filter((b) => !b.alive).length;
      pixelText(
        c,
        `${cleared}/24 BLOCKS`,
        width / 2,
        compact ? 63 : 30,
        13,
        C.yellow,
        "center",
      );
      c.strokeStyle = "#453b2b";
      c.lineWidth = 2;
      for (let row = 0; row < (compact ? 6 : 3); row++) {
        c.beginPath();
        c.moveTo(30, 92 + row * 31);
        c.lineTo(width - 30, 92 + row * 31);
        c.stroke();
      }
      for (const [i, brick] of state.bricks.entries()) {
        if (!brick.alive) {
          c.fillStyle = C.green;
          c.fillRect(brick.x + 27, brick.y + 8, 6, 6);
          continue;
        }
        c.fillStyle = [C.orange, C.yellow, C.paper][brick.zone];
        c.fillRect(brick.x, brick.y, brick.w, brick.h);
        pixelText(
          c,
          brick.zone === 0 ? "SIEM" : brick.zone === 1 ? "INGEST" : "SILOS",
          brick.x + brick.w / 2,
          brick.y + 16,
          14,
          C.ink,
          "center",
        );
        c.fillStyle = "#ffffff55";
        c.fillRect(brick.x + 3, brick.y + 2, brick.w - 6, 2);
      }
      const completeZones = [0, 1, 2].filter((zone) =>
        state.bricks.filter((b) => b.zone === zone).every((b) => !b.alive),
      );
      if (!compact || height >= 460)
        ["SIEM", "INGEST", "SILOS"].forEach((label, i) =>
          pixelText(
            c,
            label,
            (width * (i + 0.5)) / 3,
            compact ? 292 : 202,
            12,
            completeZones.includes(i) ? C.yellow : "#c6b69c",
            "center",
          ),
        );
      c.fillStyle = C.paper;
      c.fillRect(state.paddle - 52, height - 65, 104, 10);
      c.fillStyle = C.yellow;
      c.fillRect(state.paddle - 47, height - 69, 94, 6);
      if (!state.launched) {
        c.fillStyle = "#c79655";
        for (let n = 1; n < 7; n++)
          c.fillRect(
            state.x + Math.sin(state.aim) * n * 10 - 1,
            state.y - Math.cos(state.aim) * n * 10 - 1,
            3,
            3,
          );
        pixelText(
          c,
          env.inputMode === "touch" ? "A TO LAUNCH" : "SPACE / ↑ TO LAUNCH",
          width / 2,
          height - (compact && height < 460 ? 100 : 130),
          14,
          C.paper,
          "center",
        );
        if (!compact || height >= 460)
          pixelText(
            c,
            state.startedAt === null
              ? "The timer starts with your first ball."
              : "Ready for the next ball.",
            width / 2,
            height - 108,
            11,
            C.paper,
            "center",
          );
      }
      c.fillStyle = C.yellow;
      c.fillRect(state.x - 5, state.y - 5, 10, 10);
      drawCharacter(c, env, state.paddle - 24, height - 50, 48, "idle", t);
    },
    hud: () => ({
      score: state.score,
      time: Math.max(0, 60 - Math.floor(breakerElapsed(state))),
      lives: state.lives,
      progress: state.bricks.filter((b) => !b.alive).length / 24,
      message: state.launched ? "Keep the signal moving" : "Ready to launch",
    }),
  };
};
