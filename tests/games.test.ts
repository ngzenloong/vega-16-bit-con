import test from "node:test";
import assert from "node:assert/strict";
import { createGame as breaker } from "../lib/games/breaker.ts";
import { createGame as runner } from "../lib/games/runner.ts";
import { createGame as kart } from "../lib/games/kart.ts";
import { createGame as beat } from "../lib/games/beat.ts";
import { BEAT_CHART, SONG } from "../lib/games/beat-chart.ts";
import type { GameFactory, GameInput, GameButton } from "../lib/games/types.ts";
import type { GameResult } from "../lib/types.ts";
const neutral: GameInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  action: false,
  secondary: false,
  axis: 0,
};
function round(factory: GameFactory) {
  const results: GameResult[] = [];
  return {
    results,
    game: factory({
      sprite: {} as HTMLImageElement,
      appearance: { hat: 0, glasses: 0, shirt: 0 },
      sound: () => {},
      finish: (r) => results.push(r),
    }),
  };
}
for (const [name, factory] of Object.entries({ breaker, runner, kart, beat }))
  test(`${name} emits one terminal result when its active clock expires`, () => {
    const { game, results } = round(factory);
    if (name === "breaker") game.press("action");
    game.update(1 / 60, neutral, 62);
    game.update(1 / 60, neutral, 63);
    assert.equal(results.length, 1);
    assert.equal(results[0].won, false);
    assert.equal(game.hud().time, 0);
  });
test("the score-aligned rhythm chart can be cleared at its actual note timestamps", () => {
  const { game, results } = round(beat),
    keys: GameButton[] = ["left", "down", "up", "right"];
  for (const note of BEAT_CHART) {
    const time = SONG.offset + note.beat * 0.5;
    game.update(1 / 60, neutral, time);
    game.press(keys[note.lane], time);
  }
  game.update(1 / 60, neutral, 32);
  assert.equal(results[0].won, true);
  assert.equal(results[0].score, BEAT_CHART.length * 100);
});
test("racing throttle accelerates after countdown and braking reduces travel", () => {
  const fast = round(kart).game,
    braking = round(kart).game;
  for (let i = 0; i < 180; i++) {
    const time = 1.5 + i / 60;
    fast.update(1 / 60, { ...neutral, up: true }, time);
    braking.update(1 / 60, { ...neutral, up: true, down: i > 75 }, time);
  }
  assert.ok(fast.hud().progress! > 0.025);
  assert.ok(fast.hud().progress! > braking.hud().progress!);
});
test("the beginner rhythm round tolerates ordinary early and late taps", () => {
  const { game, results } = round(beat);
  const keys: GameButton[] = ["left", "down", "up", "right"];
  BEAT_CHART.forEach((note, i) => {
    const time = note.beat * 0.5 + (i % 2 ? 0.18 : -0.18);
    game.update(1 / 60, neutral, time);
    game.press(keys[note.lane], time);
  });
  game.update(1 / 60, neutral, 32);
  assert.equal(results[0].won, true);
  assert.match(results[0].detail, /75% accuracy/);
});
