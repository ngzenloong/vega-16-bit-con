import { drawFacade } from "./city-art.ts";
import { clamp, overlaps, landingSurface } from "../math.ts";
import {
  COLORS as C,
  drawDaySky,
  CITY_COLORS,
  drawCharacter,
  drawBrand,
  pixelText,
  finishOnce,
  type GameFactory,
  type GameInput,
} from "./types.ts";
const gaps = [
  [470, 555],
  [1140, 1230],
  [1720, 1810],
];
const platforms = [
  { x: 240, y: 302, w: 130 },
  { x: 600, y: 265, w: 180 },
  { x: 930, y: 304, w: 180 },
  { x: 1360, y: 274, w: 190 },
  { x: 1880, y: 305, w: 170 },
];
const allSurfaces = [...platforms, { x: 0, y: 338, w: 2250 }];
export function createRunnerState() {
  return {
    x: 70,
    y: 338,
    vx: 0,
    vy: 0,
    grounded: true,
    score: 0,
    lives: 3,
    time: 0,
    checkpoint: 70,
    invulnerable: 0,
    respawn: 0,
    facing: 1,
    coyote: 0.1,
    jumpBuffer: 0,
    checkpointNotice: 0,
    cards: [
      { x: 315, y: 275 },
      { x: 690, y: 224 },
      { x: 1050, y: 276 },
      { x: 1460, y: 232 },
      { x: 1990, y: 276 },
    ].map((card) => ({ ...card, collected: false })),
    enemies: [
      { base: 820, range: 80 },
      { base: 1900, range: 50 },
    ].map((enemy) => ({ ...enemy, alive: true, defeatedAt: -Infinity })),
  };
}
export type RunnerState = ReturnType<typeof createRunnerState>;
export function queueJump(state: RunnerState) {
  state.jumpBuffer = 0.12;
}
export function updateRunner(
  state: RunnerState,
  dt: number,
  input: GameInput,
  time: number,
  sound: (kind: string) => void = () => {},
) {
  state.time = time;
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.checkpointNotice = Math.max(0, state.checkpointNotice - dt);
  if (state.respawn > 0) {
    state.respawn = Math.max(0, state.respawn - dt);
    return;
  }
  const axis = clamp(
      (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.axis,
      -1,
      1,
    ),
    desired = axis * 200;
  state.vx += clamp(desired - state.vx, -1600 * dt, 1600 * dt);
  if (axis) state.facing = Math.sign(axis);
  state.coyote = state.grounded ? 0.1 : Math.max(0, state.coyote - dt);
  if (state.jumpBuffer > 0 && state.coyote > 0) {
    state.vy = -455;
    state.grounded = false;
    state.coyote = 0;
    state.jumpBuffer = 0;
    sound("jump");
  }
  state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  if (!input.action && !input.up && state.vy < -225) state.vy = -225;
  state.x = clamp(state.x + state.vx * dt, 20, 2170);
  const before = state.y;
  state.vy += 1100 * dt;
  state.y += state.vy * dt;
  const hurt = (fall = false) => {
    if (state.invulnerable > 0 && !fall) return;
    state.lives--;
    sound("hurt");
    state.x = state.checkpoint;
    state.y = 338;
    state.vx = 0;
    state.vy = 0;
    state.grounded = true;
    state.coyote = 0.1;
    state.jumpBuffer = 0;
    state.invulnerable = 1.2;
    state.respawn = 0.3;
  };
  let stomped = false;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const x = enemy.base + Math.sin(time * 1.5) * enemy.range;
    if (
      state.invulnerable === 0 &&
      overlaps(
        { x: state.x - 12, y: state.y - 44, w: 24, h: 44 },
        { x: x - 13, y: 315, w: 26, h: 23 },
      )
    ) {
      if (state.vy > 0 && before <= 319) {
        enemy.alive = false;
        enemy.defeatedAt = time;
        state.y = 315;
        state.vy = -330;
        state.grounded = false;
        state.score += 50;
        stomped = true;
        sound("hit");
      } else {
        hurt();
        return;
      }
    }
  }
  if (!stomped) {
    const surfaces = gaps.some(([a, b]) => state.x > a && state.x < b)
      ? platforms
      : allSurfaces;
    const surface =
      state.vy >= 0
        ? landingSurface(before, state.y, state.x, 12, surfaces)
        : null;
    if (surface) {
      state.y = surface.y;
      state.vy = 0;
      state.grounded = true;
    } else state.grounded = false;
  }
  if (state.y > 440) {
    hurt(true);
    return;
  }
  if (
    state.checkpoint === 70 &&
    state.grounded &&
    state.x > 1080 &&
    state.x < 1135
  ) {
    state.checkpoint = 1010;
    state.checkpointNotice = 1.7;
    sound("collect");
  }
  for (const card of state.cards)
    if (
      !card.collected &&
      overlaps(
        { x: state.x - 12, y: state.y - 46, w: 24, h: 46 },
        { x: card.x - 9, y: card.y - 12, w: 18, h: 24 },
      )
    ) {
      card.collected = true;
      state.score += 200;
      sound("collect");
    }
}
export const createGame: GameFactory = (env) => {
  const state = createRunnerState(),
    end = finishOnce(env, "runner");
  let finished = false;
  let viewport = env.viewport || { width: 640, height: 400 };
  return {
    resize: (width, height) => {
      viewport = { width, height };
    },
    attractInput: () => {
      const goal = state.cards.find((card) => !card.collected),
        target = goal?.x ?? 2140,
        axis = Math.abs(target - state.x) < 5 ? 0 : Math.sign(target - state.x);
      const gap = gaps.some(
        ([start, end]) =>
          axis > 0 &&
          start - state.x < 54 &&
          end > state.x &&
          start > state.x - 5,
      );
      const enemy = state.enemies.some(
        (e) =>
          e.alive &&
          Math.abs(e.base + Math.sin(state.time * 1.5) * e.range - state.x) <
            65,
      );
      const jump =
        state.grounded &&
        (gap ||
          enemy ||
          (goal !== undefined && Math.abs(goal.x - state.x) < 55));
      return {
        held: { axis, action: jump || state.vy < 0 },
        press: jump ? [{ key: "action" }] : [],
      };
    },
    press: (key) => {
      if (key === "action" || key === "up") queueJump(state);
    },
    update(dt, input, time) {
      if (finished) return;
      updateRunner(state, dt, input, time, env.sound);
      const count = state.cards.filter((c) => c.collected).length;
      if (state.x >= 2130 && count === 5) {
        finished = true;
        end(
          state.score + Math.max(0, Math.ceil(60 - time)) * 10,
          true,
          "All five query cartridges reached Booth 630.",
        );
      } else if (state.lives <= 0 || time >= 60) {
        finished = true;
        end(
          state.score,
          false,
          `${state.lives <= 0 ? "Out of lives." : "Time's up."} ${count}/5 query cartridges collected.`,
        );
      }
    },
    draw(c, t) {
      const { width, height } = viewport;
      drawDaySky(c, height, width);
      const cam = clamp(state.x - width * 0.35, 0, 2250 - width);
      if (env.backdrop) {
        const w = env.backdrop.width,
          x = -((cam * 0.18) % w);
        c.drawImage(env.backdrop, x, height - 62 - env.backdrop.height);
        c.drawImage(env.backdrop, x + w, height - 62 - env.backdrop.height);
      }
      for (let i = 0; i < 5; i++) {
        const x = i * 390 + 90 - cam * 0.32;
        drawFacade(c, env, x, height - 362, 160, 300, i, i % 2, {
          flip: i % 2 === 0,
        });
      }
      c.fillStyle = CITY_COLORS.metal;
      for (let i = 0; i < 12; i++)
        c.fillRect(i * 140 - cam * 0.45, 52, 3, height - 112);
      c.fillRect(0, height - 215, width, 3);
      c.save();
      c.translate(-cam, height - 400);
      c.fillStyle = "#d2bea1";
      c.fillRect(0, 338, 2250, 62);
      c.fillStyle = CITY_COLORS.metal;
      c.fillRect(0, 338, 2250, 8);
      c.fillStyle = "#b99863";
      for (let i = 0; i < 45; i++)
        c.fillRect(i * 50, 370 + (i % 2) * 12, 44, 2);
      for (const [a, b] of gaps) {
        c.fillStyle = C.ink;
        c.fillRect(a, 338, b - a, 80);
        c.fillStyle = C.orange;
        c.fillRect(a, 338, 6, 8);
        c.fillRect(b - 6, 338, 6, 8);
      }
      for (const p of platforms) {
        c.fillStyle = C.ink;
        c.fillRect(p.x, p.y, p.w, 12);
        c.fillStyle = C.yellow;
        c.fillRect(p.x + 2, p.y, p.w - 4, 4);
        c.fillStyle = "#bba888";
        c.fillRect(p.x + 4, p.y + 6, p.w - 8, 3);
      }
      state.cards.forEach((card, i) => {
        c.fillStyle = C.ink;
        c.fillRect(card.x - 15, card.y - 14, 30, 31);
        c.fillStyle = card.collected ? C.green : C.paper;
        c.fillRect(card.x - 12, card.y - 11, 24, 22);
        if (card.collected) {
          c.fillStyle = C.lime;
          c.fillRect(card.x - 7, card.y, 4, 4);
          c.fillRect(card.x - 3, card.y + 3, 4, 4);
          c.fillRect(card.x + 1, card.y - 5, 4, 8);
        } else {
          c.fillStyle = C.yellow;
          c.fillRect(card.x - 7, card.y - 7, 14, 13);
          c.fillStyle = C.ink;
          c.fillRect(card.x - 4, card.y - 4, 8, 5);
        }
        c.fillStyle = C.paper;
        c.fillRect(card.x - 48, card.y - 39, 96, 20);
        pixelText(
          c,
          card.collected ? "POST-SIEM" : `SOURCE ${i + 1}`,
          card.x,
          card.y - 23,
          width < 500 ? 16 : 12,
          C.ink,
          "center",
        );
      });
      c.fillStyle = C.paper;
      c.fillRect(1100, 246, 3, 92);
      c.fillStyle = state.checkpoint > 70 ? C.yellow : C.green;
      c.fillRect(1103, 248, 32, 20);
      for (const enemy of state.enemies) {
        const x = enemy.base + Math.sin(t * 1.5) * enemy.range;
        if (!enemy.alive) {
          if (t - enemy.defeatedAt < 0.8) {
            c.fillStyle = C.yellow;
            c.fillRect(x - 47, 265, 94, 32);
            c.fillStyle = C.ink;
            c.fillRect(x - 43, 268, 86, 26);
            pixelText(c, "+50 POST-SIEM", x, 286, 14, C.paper, "center");
          }
          if (t - enemy.defeatedAt < 0.25 && !env.reducedMotion) {
            c.fillStyle = C.yellow;
            c.fillRect(x - 17, 310, 5, 5);
            c.fillRect(x + 13, 318, 5, 5);
          }
          continue;
        }
        c.fillStyle = C.ink;
        c.fillRect(x - 13, 315, 26, 19);
        c.fillRect(x - 17, 320, 4, 10);
        c.fillRect(x + 13, 320, 4, 10);
        c.fillStyle = C.orange;
        c.fillRect(x - 8, 320, 5, 5);
        c.fillRect(x + 4, 320, 5, 5);
        c.fillStyle = C.ink;
        c.fillRect(x - 11, 334, 6, 4);
        c.fillRect(x + 5, 334, 6, 4);
        c.fillStyle = C.paper;
        c.fillRect(x - 24, 293, 48, 20);
        pixelText(c, "SIEM", x, 309, 13, C.ink, "center");
      }
      c.fillStyle = C.green;
      c.fillRect(2132, 220, 82, 118);
      c.fillStyle = C.yellow;
      c.fillRect(2136, 224, 74, 38);
      drawBrand(c, env, 2141, 229, 64);
      pixelText(c, "630", 2173, 306, 20, C.paper, "center");
      c.save();
      if (state.invulnerable > 0)
        c.globalAlpha = env.reducedMotion
          ? 0.65
          : Math.floor(t * 12) % 2
            ? 0.45
            : 1;
      drawCharacter(
        c,
        env,
        state.x - 30,
        state.y - 60,
        60,
        state.grounded ? (Math.abs(state.vx) > 15 ? "run" : "idle") : "jump",
        t,
        state.facing < 0,
      );
      c.restore();
      c.restore();
      c.fillStyle = C.paper;
      c.fillRect(0, 0, width, 47);
      drawBrand(c, env, 12, 9, 78);
      pixelText(
        c,
        `${width < 500 ? "CARTRIDGES" : "QUERY CARTRIDGES"} ${state.cards.filter((card) => card.collected).length}/5`,
        width - 18,
        29,
        14,
        C.ink,
        "right",
      );
      if (state.checkpointNotice > 0)
        pixelText(c, "CHECKPOINT SAVED", width / 2, 87, 16, C.ink, "center");
      if (state.x > 2070 && !state.cards.every((card) => card.collected))
        pixelText(
          c,
          "FIND ALL FIVE CARTRIDGES",
          width / 2,
          110,
          15,
          C.ink,
          "center",
        );
    },
    hud: () => ({
      score: state.score,
      time: Math.max(0, 60 - Math.floor(state.time)),
      lives: state.lives,
      progress: state.cards.filter((c) => c.collected).length / 5,
      message:
        state.checkpoint > 70 ? "Checkpoint saved" : "Five sources · One route",
    }),
  };
};
