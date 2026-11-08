import test from "node:test";
import assert from "node:assert/strict";
import {
  landingSurface,
  overlaps,
  rhythmJudgement,
  safePlayer,
} from "../lib/math.ts";
import { HeldInput, isSceneTap } from "../lib/input.ts";
import { DEFAULT_APPEARANCE } from "../lib/types.ts";
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
    assert.equal(rhythmJudgement(0.14 * sign), "nice");
    assert.equal(rhythmJudgement(0.22 * sign), "good");
    assert.equal(rhythmJudgement(0.29 * sign), "bad");
    assert.equal(rhythmJudgement(0.35 * sign), "miss");
  }
});
test("scene entry accepts a deliberate tap but not scrolling, dragging or a long press", () => {
  const start = { x: 100, y: 200, scroll: 500, time: 1000 };
  assert.equal(
    isSceneTap(start, { x: 104, y: 204, scroll: 500, time: 1120 }),
    true,
  );
  assert.equal(
    isSceneTap(start, { x: 100, y: 250, scroll: 500, time: 1120 }),
    false,
  );
  assert.equal(
    isSceneTap(start, { x: 100, y: 200, scroll: 540, time: 1120 }),
    false,
  );
  assert.equal(isSceneTap(start, { ...start, time: 1700 }), false);
});
test("local player data validates cosmetic bounds and retains only supported profile fields", () => {
  const p = safePlayer({
    name: "  Alex  ",
    appearance: { hat: 2, glasses: 1, shirt: 3 },
    interests: [0, 2, 99, "1"],
    email: "alex@example.com",
    unrelated: "discard this",
  });
  assert.deepEqual(p, {
    name: "Alex",
    email: "alex@example.com",
    appearance: { ...DEFAULT_APPEARANCE, hat: 2, glasses: 1, shirt: 3 },
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

test("phone dialogue pages preserve every word while fitting the fixed text area", async () => {
  const { CHARACTERS, dialoguePages } = await import("../lib/lore.ts");
  for (const character of CHARACTERS)
    for (const line of character.lines) {
      const pages = dialoguePages(line);
      assert.equal(pages.join(" "), line);
      assert.ok(pages.every((page) => page.length <= 86));
    }
});

test("floor framing keeps the brick baseline at the bottom instead of centering Sam", async () => {
  const { floorFrameScroll } = await import("../lib/math.ts");
  for (const height of [650, 780, 900]) {
    const scroll = floorFrameScroll(1024, height, 2400);
    assert.equal(1024 - 24 - scroll, height);
    assert.equal(
      1024 - 88 - scroll,
      height - 64,
      "Sam's feet stay low in the viewport",
    );
  }
  assert.equal(floorFrameScroll(900, 1080, 1000), 0);
  assert.equal(floorFrameScroll(2400, 900, 1200), 1200);
});

test("simultaneous steering and gas keep separate owners through a directional change", () => {
  const input = new HeldInput();
  input.down("finger:1", "right");
  input.down("finger:2", "action");
  assert.equal(input.horizontal(), 1);
  assert.equal(input.has("action"), true);
  input.up("finger:1");
  input.down("finger:1", "left");
  assert.equal(input.horizontal(), -1);
  assert.equal(input.has("action"), true);
  input.up("finger:2");
  assert.equal(input.has("action"), false);
  assert.equal(input.horizontal(), -1);
  input.clear();
  assert.equal(input.horizontal(), 0);
});
test("mobile dialogue pagination avoids an orphan last word without dropping copy", async () => {
  const { dialoguePages } = await import("../lib/lore.ts");
  const line =
    "That yellow Fiat? PostSIEM.com on the back. Extremely subtle branding.";
  const pages = dialoguePages(line, 64);
  assert.equal(pages.join(" "), line);
  assert.ok(pages.every((page) => page.length <= 64));
  assert.notEqual(pages.at(-1), "branding.");
  assert.ok(pages.at(-1)!.length >= 20);
});
