import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RIVAL_CARS,
  selectRivalCars,
  carContactWidth,
} from "../lib/games/cars.ts";
import { readScoreProgress, SCORE_RULES } from "../lib/scores.ts";
import { createGame } from "../lib/games/kart.ts";
import type { GameInput } from "../lib/games/types.ts";
import type { GameResult } from "../lib/types.ts";

test("every replay grid contains all twelve unique rival microcars", () => {
  const grids = [0, 1, 2, 3].map(selectRivalCars);
  assert.equal(new Set(grids.flat().map((car) => car.id)).size, 12);
  assert.ok(
    grids.every(
      (grid) =>
        grid.length === 12 && new Set(grid.map((car) => car.id)).size === 12,
    ),
  );
  assert.deepEqual(selectRivalCars(12), selectRivalCars(0));
  assert.ok(
    ["be1", "pao", "figaro", "scargo"].every((id) =>
      RIVAL_CARS.some((car) => car.id === id),
    ),
  );
});

test("only the player's Fiat carries the campaign URL", () => {
  const player = readFileSync(
    new URL("../public/assets/vega/fiat-player.svg", import.meta.url),
    "utf8",
  );
  assert.match(player, /PostSIEM\.com/);
  for (const car of RIVAL_CARS) {
    const svg = readFileSync(
      new URL(`../public/assets/vega/${car.asset}`, import.meta.url),
      "utf8",
    );
    assert.match(svg, /width="288" height="96"/);
    if (car.id === "scargo") { assert.match(svg, /茶|\\u8336/); assert.doesNotMatch(svg, /SIEM/i); }
    else assert.match(svg, /SIEM/);
    assert.doesNotMatch(svg, /PostSIEM|Fiat/i);
    assert.doesNotMatch(svg, /<image\b/);
  }
});

test("narrow microcars use smaller contact widths than the player's original body", () => {
  assert.ok(carContactWidth(38) < carContactWidth(59));
  assert.ok(
    RIVAL_CARS.every(
      (car) =>
        carContactWidth(car.bodyWidth) > 0.18 &&
        carContactWidth(car.bodyWidth) <= 0.27,
    ),
  );
});

test("difficulty changes preserve previous bests without comparing incompatible rounds", () => {
  const migrated = readScoreProgress({
    scores: { breaker: 2200, runner: 1700, kart: 4385, beat: 4160 },
  });
  assert.deepEqual(migrated.scores, { breaker: 2200, runner: 1700 });
  assert.equal(migrated.previousScores.beat, 4160);
  const current = readScoreProgress({
    scoreRules: SCORE_RULES,
    scores: { beat: 2400 },
    previousScores: migrated.previousScores,
  });
  assert.equal(current.scores.beat, 2400);
  assert.equal(current.previousScores.beat, 4160);
});

test("the tougher first-place race remains winnable on a clean controlled line", () => {
  let result: GameResult | undefined;
  const game = createGame({
    sprite: {} as HTMLImageElement,
    rivalCars: selectRivalCars(0),
    appearance: { hat: 0, glasses: 0, shirt: 0 },
    sound: () => {},
    finish: (value) => {
      result = value;
    },
  });
  const neutral: GameInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
    axis: 0,
  };
  assert.match(game.hud().message!, /^13\/13/);
  for (let i = 0; i < 57 * 120 && !result; i++) {
    const time = i / 120;
    game.update(
      1 / 120,
      { ...neutral, ...game.attractInput!(time).held },
      time,
    );
  }
  assert.equal(result?.won, true);
  assert.match(result!.detail, /Finished 1st/);
});
