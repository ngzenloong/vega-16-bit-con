import test from "node:test";
import assert from "node:assert/strict";
import {
  landingSurface,
  overlaps,
  rhythmJudgement,
  safePlayer,
} from "../lib/math.ts";
import { HeldInput } from "../lib/input.ts";
test("landing uses the first crossed platform, including fast downward steps", () => {
  const upper = { x: 20, y: 120, w: 100 },
    lower = { x: 0, y: 250, w: 300 };
  assert.equal(landingSurface(70, 280, 60, 16, [lower, upper]), upper);
});
test("jumping upward and missing a platform horizontally do not create a landing", () => {
  assert.equal(
    landingSurface(200, 100, 60, 16, [{ x: 20, y: 150, w: 100 }]),
    null,
  );
  assert.equal(
    landingSurface(70, 200, 200, 16, [{ x: 20, y: 120, w: 100 }]),
    null,
  );
});
test("touching edges is not an overlapping hitbox", () => {
  assert.equal(
    overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    false,
  );
  assert.equal(
    overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 }),
    true,
  );
});
test("rhythm windows treat early and late input symmetrically", () => {
  for (const sign of [-1, 1]) {
    assert.equal(rhythmJudgement(0.03 * sign), "perfect");
    assert.equal(rhythmJudgement(0.06 * sign), "nice");
    assert.equal(rhythmJudgement(0.11 * sign), "good");
    assert.equal(rhythmJudgement(0.16 * sign), "bad");
    assert.equal(rhythmJudgement(0.2 * sign), "miss");
  }
});
test("local player data validates cosmetic bounds and removes unrelated fields", () => {
  const p = safePlayer({
    name: "  Alex  ",
    appearance: { hat: 2, glasses: 1, shirt: 3 },
    interests: [0, 2, 99, "1"],
    email: "never-store@example.com",
  });
  assert.deepEqual(p, {
    name: "Alex",
    appearance: { hat: 2, glasses: 1, shirt: 3 },
    interests: [0, 2],
  });
  assert.equal(
    safePlayer({
      name: "Alex",
      appearance: { hat: 999, glasses: 0, shirt: 0 },
    }),
    null,
  );
  assert.equal(
    safePlayer({ name: " ", appearance: { hat: 0, glasses: 0, shirt: 0 } }),
    null,
  );
});
test("opposite directions use the newest held physical key", () => {
  const input = new HeldInput();
  input.down("KeyA", "left");
  assert.equal(input.horizontal(), -1);
  input.down("ArrowRight", "right");
  assert.equal(input.horizontal(), 1);
  input.up("ArrowRight");
  assert.equal(input.horizontal(), -1);
  input.up("KeyA");
  assert.equal(input.horizontal(), 0);
});
test("releasing a letter does not release a separately held arrow", () => {
  const input = new HeldInput();
  input.down("KeyA", "left");
  input.down("ArrowLeft", "left");
  input.up("KeyA");
  assert.equal(input.horizontal(), -1);
  input.up("ArrowLeft");
  assert.equal(input.horizontal(), 0);
});
test("physical key identity survives Shift changes and clears on release", () => {
  const input = new HeldInput();
  input.down("KeyA", "left");
  input.up("KeyA");
  assert.equal(input.horizontal(), 0);
  input.down("KeyD", "right");
  input.clear();
  assert.equal(input.horizontal(), 0);
});
