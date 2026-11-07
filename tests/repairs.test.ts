import test from "node:test";
import assert from "node:assert/strict";
import { SimulationClock } from "../lib/games/clock.ts";
import { sweepRect } from "../lib/games/collision.ts";
import {
  createBreakerState,
  updateBreaker,
  launchBall,
  breakerElapsed,
  resizeBreaker,
} from "../lib/games/breaker.ts";
import { gameViewport } from "../lib/games/viewport.ts";
import {
  createRunnerState,
  updateRunner,
  queueJump,
} from "../lib/games/runner.ts";
import {
  createBeatState,
  pressBeat,
  updateBeat,
  beatAccuracy,
} from "../lib/games/beat.ts";
import {
  buildRoad,
  projectRoad,
  isOffRoad,
  PLAYER_DEPTH,
  TRACK,
  TRACK_LENGTH,
  trackCurve,
} from "../lib/games/track.ts";
import { BEAT_CHART } from "../lib/games/beat-chart.ts";
import type { GameInput, GameButton } from "../lib/games/types.ts";
const input: GameInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  action: false,
  secondary: false,
  axis: 0,
};

test("physics and deadlines consume the same time at 10,30,60 and120 FPS", () => {
  const positions = [10, 30, 60, 120].map((fps) => {
    const state = createRunnerState(),
      clock = new SimulationClock();
    for (let i = 0; i < fps; i++)
      clock.advance(1 / fps, (dt, t) =>
        updateRunner(state, dt, { ...input, right: true }, t),
      );
    return { x: state.x, time: state.time };
  });
  for (const p of positions) {
    assert.ok(Math.abs(p.x - positions[0].x) < 1e-6);
    assert.ok(Math.abs(p.time - 1) < 1e-6);
  }
});
test("an excessive frame stall consumes only simulated catch-up time", () => {
  const clock = new SimulationClock();
  let simulation = 0;
  clock.advance(2, (dt) => (simulation += dt));
  assert.ok(Math.abs(clock.elapsed - 0.25) < 1e-6);
  assert.ok(Math.abs(simulation - clock.elapsed) < 1e-6);
});
test("swept collision identifies side, top and corner normals", () => {
  const box = { x: 20, y: 20, w: 20, h: 20 };
  assert.deepEqual(sweepRect(10, 30, 100, 0, 2, box, 0.2), {
    time: 0.08,
    nx: -1,
    ny: 0,
  });
  assert.deepEqual(sweepRect(30, 10, 0, 100, 2, box, 0.2), {
    time: 0.08,
    nx: 0,
    ny: -1,
  });
  assert.deepEqual(sweepRect(10, 10, 100, 100, 2, box, 0.2), {
    time: 0.08,
    nx: -1,
    ny: -1,
  });
  assert.equal(sweepRect(0, 0, 100, 0, 2, box, 0.2), null);
});
test("a side contact reverses Breaker horizontal velocity and removes one block", () => {
  const state = createBreakerState();
  Object.assign(state, {
    x: 42,
    y: 90,
    vx: 170,
    vy: -230,
    launched: true,
    startedAt: 0,
  });
  updateBreaker(state, 1 / 60, input, 1 / 60);
  assert.ok(state.vx < 0);
  assert.equal(state.vy, -230);
  assert.equal(state.bricks.filter((b) => !b.alive).length, 1);
  assert.equal(state.score, 100);
});
test("Breaker does not consume its deadline while waiting to serve", () => {
  const state = createBreakerState();
  updateBreaker(state, 1 / 60, input, 20);
  assert.equal(breakerElapsed(state), 0);
  launchBall(state);
  updateBreaker(state, 1 / 60, input, 20.5);
  assert.equal(breakerElapsed(state), 0.5);
  Object.assign(state, { y: 411, vy: 1000 });
  updateBreaker(state, 1 / 60, input, 21);
  assert.equal(state.lives, 2);
  updateBreaker(state, 1 / 60, input, 50);
  assert.equal(breakerElapsed(state), 1);
  launchBall(state);
  assert.equal(state.y, 324);
});
test("Runner accepts a jump one simulation step after a ledge", () => {
  const state = createRunnerState();
  state.x = 471;
  updateRunner(state, 1 / 120, input, 0.1);
  assert.equal(state.grounded, false);
  queueJump(state);
  updateRunner(state, 1 / 120, { ...input, action: true }, 0.1 + 1 / 120);
  assert.ok(state.vy < 0);
});
test("Runner preserves a buffered jump through landing", () => {
  const state = createRunnerState();
  Object.assign(state, { y: 335, vy: 250, grounded: false, coyote: 0 });
  queueJump(state);
  updateRunner(state, 1 / 60, { ...input, action: true }, 1 / 60);
  assert.equal(state.grounded, true);
  updateRunner(state, 1 / 120, { ...input, action: true }, 0.025);
  assert.ok(state.vy < 0);
});
test("early jump release creates a lower arc", () => {
  const high = createRunnerState(),
    short = createRunnerState();
  queueJump(high);
  queueJump(short);
  let highY = 338,
    shortY = 338;
  for (let i = 0; i < 100; i++) {
    updateRunner(high, 1 / 120, { ...input, action: true }, i / 120);
    updateRunner(short, 1 / 120, { ...input, action: i < 3 }, i / 120);
    highY = Math.min(highY, high.y);
    shortY = Math.min(shortY, short.y);
  }
  assert.ok(shortY - highY > 20);
});
test("a defeated Runner bot cannot reward a second stomp", () => {
  const state = createRunnerState();
  Object.assign(state, {
    x: 820 + Math.sin(1.5) * 80,
    y: 314,
    vy: 320,
    grounded: false,
  });
  updateRunner(state, 1 / 120, input, 1);
  assert.equal(state.enemies[0].alive, false);
  assert.equal(state.score, 50);
  Object.assign(state, {
    x: 820 + Math.sin(3) * 80,
    y: 314,
    vy: 320,
    grounded: false,
    invulnerable: 0,
  });
  updateRunner(state, 1 / 120, input, 2);
  assert.equal(state.score, 50);
});
test("a fall still resets safely during enemy-hit immunity", () => {
  const state = createRunnerState();
  Object.assign(state, {
    x: 500,
    y: 450,
    grounded: false,
    invulnerable: 0.5,
    checkpoint: 1010,
  });
  updateRunner(state, 1 / 120, input, 1);
  assert.equal(state.x, 1010);
  assert.equal(state.y, 338);
  assert.equal(state.lives, 2);
});
test("rhythm judges input time rather than the previous rendered frame", () => {
  const state = createBeatState();
  updateBeat(state, input, 1.9);
  pressBeat(state, "left", 2);
  assert.equal(state.score, 100);
  assert.equal(state.feedback, "PERFECT");
});
test("all-lane mashing cannot clear the rhythm round", () => {
  const state = createBeatState();
  let last = -1;
  const keys: GameButton[] = ["left", "down", "up", "right"];
  for (let i = 0; i <= 32 * 120; i++) {
    const t = i / 120;
    updateBeat(state, input, t);
    if (Math.floor(t / 0.3) > last) {
      last = Math.floor(t / 0.3);
      keys.forEach((key) => pressBeat(state, key, t));
    }
  }
  assert.ok(beatAccuracy(state) < 70);
  assert.ok(state.strays > 100);
});
test("repeated taps cannot score the same rhythm note more than once", () => {
  const state = createBeatState();
  pressBeat(state, "left", 2);
  pressBeat(state, "left", 2);
  pressBeat(state, "left", 2);
  assert.equal(state.score, 100);
  assert.equal(state.strays, 2);
  assert.ok(beatAccuracy(state) < 100);
});
test("every rhythm lane retains independent held feedback", () => {
  const state = createBeatState();
  updateBeat(state, { ...input, left: true, right: true }, 2);
  assert.deepEqual(state.held, [true, false, false, true]);
});
test("the chart has valid increasing note times and a deliberate outro", () => {
  assert.equal(BEAT_CHART.length, 52);
  for (let i = 0; i < BEAT_CHART.length; i++) {
    const note = BEAT_CHART[i];
    assert.ok(note.lane >= 0 && note.lane < 4);
    if (i) assert.ok(note.beat > BEAT_CHART[i - 1].beat);
  }
  assert.equal(BEAT_CHART[0].beat, 4);
  assert.equal(BEAT_CHART.at(-1)!.beat, 62);
});
test("racing off-road boundaries and rendered tarmac agree at player depth", () => {
  for (const height of [320, 400, 622, 760, 1021, 1200])
    for (const distance of [0, 9000, 25000, 40000])
      for (const lane of [-1.01, -0.99, 0.99, 1.01]) {
        const road = buildRoad(distance),
          q = projectRoad(road, lane, PLAYER_DEPTH, 0, height),
          player = projectRoad(road, lane, PLAYER_DEPTH, lane, height),
          inside =
            player.x >= q.center - q.half && player.x <= q.center + q.half;
        assert.equal(inside, !isOffRoad(lane));
        assert.ok(Math.abs(player.x - 320) < 1e-6);
      }
});
test("authored track length and eased curve boundaries remain coherent", () => {
  assert.equal(
    TRACK.reduce((n, s) => n + s.length, 0),
    TRACK_LENGTH,
  );
  let boundary = 0;
  for (const segment of TRACK) {
    boundary += segment.length;
    assert.ok(
      Math.abs(trackCurve(boundary - 1) - trackCurve(boundary + 1)) < 0.001,
    );
  }
  for (const distance of [0, 12000, 27000, 59000])
    for (const z of [0, 90, 1000, 8000, 50000]) {
      const q = projectRoad(buildRoad(distance), 0, z, 0, 400);
      assert.ok(Object.values(q).every(Number.isFinite));
    }
});

test("portrait playfields fill the available screen without squeezing widescreen art", () => {
  const kart = gameViewport("kart", 336, 536);
  assert.ok(Math.abs(kart.width / kart.height - 336 / 536) < 0.001);
  for (const id of ["breaker", "runner", "beat"] as const) {
    const portrait = gameViewport(id, 336, 536);
    assert.equal(portrait.width, 336);
    assert.equal(portrait.height, 536);
    assert.deepEqual(gameViewport(id, 290, 270), { width: 320, height: 400 });
    assert.deepEqual(gameViewport(id, 700, 420), { width: 640, height: 400 });
  }
});

test("rotating Breaker preserves progress and keeps every live block inside the board", () => {
  const state = createBreakerState();
  state.bricks[3].alive = false;
  state.score = 100;
  state.lives = 2;
  state.x = 610;
  resizeBreaker(state, 336, 536);
  assert.equal(state.bricks.filter((brick) => brick.alive).length, 23);
  assert.equal(state.score, 100);
  assert.equal(state.lives, 2);
  assert.ok(state.x < state.width);
  assert.ok(
    state.bricks.every(
      (brick) =>
        brick.x >= 0 &&
        brick.x + brick.w <= state.width &&
        brick.y + brick.h < state.height - 76,
    ),
  );
  launchBall(state);
  assert.equal(state.y, 460);
  resizeBreaker(state, 640, 400);
  assert.equal(state.bricks[3].alive, false);
});

test("negative rhythm calibration keeps a still-valid late input eligible", () => {
  const state = createBeatState();
  updateBeat(state, input, 2.22, -0.15);
  assert.equal(state.notes[0].state, "waiting");
  pressBeat(state, "left", 2.22 - 0.15, () => {}, 2.22);
  assert.equal(state.hits, 1);
  assert.equal(state.strays, 0);
  assert.equal(state.notes[0].grade, "nice");
});

test("rotating a descending Breaker ball preserves its upcoming paddle contact", () => {
  const state = createBreakerState(336, 536);
  state.launched = true;
  state.x = state.paddle = 168;
  state.y = 450;
  state.vx = 0;
  state.vy = 300;
  resizeBreaker(state, 640, 400);
  assert.ok(state.y < 329);
  for (let frame = 0; frame < 40; frame++)
    updateBreaker(state, 1 / 60, input, frame / 60);
  assert.equal(state.lives, 3);
  const waiting = createBreakerState(336, 536);
  resizeBreaker(waiting, 640, 400);
  assert.equal(waiting.y, 324);
  assert.equal(waiting.x, waiting.paddle);
  waiting.x = waiting.paddle = 586;
  resizeBreaker(waiting, 336, 536);
  assert.equal(waiting.x, waiting.paddle);
  assert.equal(waiting.y, 460);
});
