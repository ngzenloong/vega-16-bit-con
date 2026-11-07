import test from "node:test";
import assert from "node:assert/strict";
import { advanceWalk } from "../lib/walk.ts";

test("held movement ramps to its cap instead of starting at full speed", () => {
  let state = { velocity: 0, held: 0 },
    previous = 0;
  for (let i = 0; i < 90; i++) {
    state = advanceWalk(state.velocity, state.held, 1, 1 / 60, 400);
    assert.ok(state.velocity >= previous && state.velocity <= 400);
    if (i < 10) assert.ok(state.velocity < 165);
    previous = state.velocity;
  }
  assert.equal(state.velocity, 400);
});

test("release settles and reversal builds speed in the new direction", () => {
  const reverse = advanceWalk(400, 2, -1, 1 / 60, 400);
  assert.ok(reverse.velocity < 0 && reverse.velocity > -150);
  let state = { velocity: 400, held: 2 };
  for (let i = 0; i < 30; i++)
    state = advanceWalk(state.velocity, state.held, 0, 1 / 60, 400);
  assert.equal(state.velocity, 0);
  assert.equal(state.held, 0);
});
