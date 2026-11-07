import test from "node:test";
import assert from "node:assert/strict";
import { advanceImpact } from "../lib/games/impact.ts";

test("contact starts without teleporting and stays well inside one racing lane", () => {
  assert.equal(advanceImpact(0.72, 0).offset, 0);
  assert.ok(advanceImpact(0.72, 1 / 60).offset < 0.012);
  let velocity = 0.72,
    position = 0;
  for (let i = 0; i < 120; i++) {
    const next = advanceImpact(velocity, 1 / 60);
    position += next.offset;
    velocity = next.velocity;
  }
  assert.ok(
    position > 0.1 && position < 0.104,
    "total separation must remain less than one third of a lane",
  );
  assert.ok(velocity < 0.000001);
});

test("bumper separation is consistent at 30, 60 and 120 frames per second", () => {
  const positions = [30, 60, 120].map((fps) => {
    let velocity = -0.72,
      position = 0;
    for (let i = 0; i < fps; i++) {
      const next = advanceImpact(velocity, 1 / fps);
      position += next.offset;
      velocity = next.velocity;
    }
    return position;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-12);
});
