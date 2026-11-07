import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SpriteClock } from "../lib/sprite-clock.ts";
import { SPRITES } from "../lib/assets.ts";

test("Sam's full idle loop visits every complete frame without a blank endpoint", () => {
  const clock = new SpriteClock(33, 8);
  const seen = new Set([clock.advance(0, true)]);
  for (let step = 0; step < 495; step++) {
    const frame = clock.advance(1 / 120, true);
    assert.ok(Number.isInteger(frame) && frame >= 0 && frame < 33);
    seen.add(frame);
  }
  assert.equal(seen.size, 33);
  assert.equal(clock.frame, 0);
});

test("leaving a floor freezes its frame and re-entry preserves the unfinished frame interval", () => {
  const clock = new SpriteClock(33, 8);
  clock.advance(0, true);
  clock.advance(0.1, true);
  clock.advance(0.05, true);
  assert.equal(clock.frame, 1);
  clock.advance(0, false);
  assert.equal(clock.advance(90, false), 1);
  assert.equal(clock.advance(90, true), 1);
  assert.equal(clock.advance(0.09, true), 1);
  assert.equal(clock.advance(0.01, true), 2);
});

test("a delayed visible frame does not fast-forward an entire animation cycle", () => {
  const clock = new SpriteClock(4, 10);
  clock.advance(0, true);
  assert.equal(clock.advance(30, true), 1);
  assert.equal(clock.advance(30, true), 2);
});

test("two floors and idle/run poses keep independent playback state", () => {
  const hall = new SpriteClock(33, 8);
  const social = new SpriteClock(33, 8);
  const run = new SpriteClock(4, 10);
  hall.advance(0, true);
  social.advance(0, false);
  for (let i = 0; i < 30; i++) {
    hall.advance(1 / 60, true);
    social.advance(1 / 60, false);
  }
  assert.equal(hall.frame, 4);
  assert.equal(social.advance(60, true), 0);
  assert.equal(run.advance(60, true), 0);
  assert.equal(run.advance(0.1, true), 1);
  hall.advance(0, false);
  assert.equal(hall.advance(60, true), 4);
});

test("reduced motion has a stable first-frame poster", () => {
  const clock = new SpriteClock(33, 8);
  clock.advance(0, true);
  clock.advance(0.1, true);
  clock.advance(0.1, true);
  clock.reset();
  assert.equal(clock.advance(100, false), 0);
  assert.equal(clock.advance(100, true), 0);
});

test("animated source sheets match their declared frame geometry", () => {
  for (const [name, asset] of Object.entries(SPRITES)) {
    if (asset.frames < 2 || !asset.fps) continue;
    const png = readFileSync(new URL(`../public${asset.src}`, import.meta.url));
    if (asset.src.endsWith(".svg")) {
      const source = png.toString();
      assert.match(source, new RegExp(`width="${asset.width * asset.frames}"`), `${name} sheet width`);
      assert.match(source, new RegExp(`height="${asset.height}"`), `${name} frame height`);
      continue;
    }
    assert.equal(
      png.readUInt32BE(16),
      asset.width * asset.frames,
      `${name} sheet width`,
    );
    assert.equal(png.readUInt32BE(20), asset.height, `${name} frame height`);
  }
});
