import test from "node:test";
import assert from "node:assert/strict";
import { SnackSequence } from "../lib/snack.ts";

test("repeated interaction cannot restart a bite or leave the scene action locked", () => {
  const snack = new SnackSequence();
  assert.equal(snack.start(), true);
  for (let n = 0; n < 10; n++) snack.advance(0.1);
  const elapsed = snack.elapsed;
  assert.equal(snack.start(), false);
  assert.equal(snack.elapsed, elapsed);
  let completed = false;
  for (let n = 0; n < 30; n++) completed = snack.advance(0.1) || completed;
  assert.equal(completed, true);
  assert.equal(snack.active, false);
  assert.equal(snack.start(), true);
  assert.equal(snack.step, 0);
});

test("interrupted eating is cancellable and delayed frames cannot skip both visible bites", () => {
  const snack = new SnackSequence();
  snack.start();
  snack.advance(60);
  assert.equal(snack.step, 0);
  snack.cancel();
  assert.equal(snack.active, false);
  assert.equal(snack.advance(1), false);
  snack.start();
  const seen = new Set<number>();
  for (let n = 0; n < 31; n++) {
    seen.add(snack.step);
    snack.advance(0.1);
  }
  assert.deepEqual([...seen], [0, 1, 2, 3, 4]);
  assert.equal(snack.active, false);
});
