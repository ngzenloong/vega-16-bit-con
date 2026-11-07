import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_CARS,
  FIAT,
  selectRivalCars,
  driverProfile,
} from "../lib/games/cars.ts";
import {
  normalizeProgress,
  recordRaceResult,
  unlockedCars,
} from "../lib/games/progression.ts";
import { createGame } from "../lib/games/kart.ts";
import { PointerIntent } from "../lib/pointer-intent.ts";
import type { GameResult } from "../lib/types.ts";

test("a new garage opens only the Fiat and invalid storage cannot select a locked car", () => {
  assert.deepEqual(
    unlockedCars(0).map((car) => car.id),
    [FIAT.id],
  );
  for (const value of [
    null,
    {},
    { wins: NaN, selected: "scargo" },
    { wins: -1 },
    { wins: 0, selected: "mini" },
  ])
    assert.deepEqual(normalizeProgress(value), { wins: 0, selected: FIAT.id });
  assert.equal(normalizeProgress({ wins: 2, selected: "az1" }).selected, "az1");
});
test("only a completed first-place kart win progresses the garage", () => {
  const progress = normalizeProgress(null);
  const victory: GameResult = {
    id: "kart",
    score: 2000,
    won: true,
    detail: "Finished first",
    race: { carId: FIAT.id, place: 1, finished: true },
  };
  assert.equal(recordRaceResult(progress, victory).wins, 1);
  for (const result of [
    { ...victory, id: "beat" as const },
    { ...victory, won: false },
    { ...victory, race: undefined },
    { ...victory, race: { ...victory.race!, place: 2 } },
    { ...victory, race: { ...victory.race!, finished: false } },
  ])
    assert.equal(recordRaceResult(progress, result), progress);
  let next = progress;
  const sizes = [1];
  for (let i = 0; i < 4; i++) {
    next = recordRaceResult(next, victory);
    sizes.push(unlockedCars(next.wins).length);
  }
  assert.deepEqual(sizes, [1, 4, 7, 10, 12]);
});
test("every selectable car preserves the complete twelve-model field without a duplicate", () => {
  for (const car of ALL_CARS)
    for (const seed of [0, 1, 13]) {
      const rivals = selectRivalCars(seed, car.id);
      assert.equal(rivals.length, 11);
      assert.ok(!rivals.some((rival) => rival.id === car.id));
      assert.equal(
        new Set([car.id, ...rivals.map((rival) => rival.id)]).size,
        12,
      );
      assert.ok(driverProfile(car.id).topSpeed > 0);
    }
});
test("every selected car constructs a full race and reports its own time budget", () => {
  const limits = new Set<number>();
  for (const car of ALL_CARS) {
    const game = createGame({
      sprite: {} as HTMLImageElement,
      appearance: { hat: 0, glasses: 0, shirt: 0 },
      playerCar: car,
      rivalCars: selectRivalCars(3, car.id),
      sound() {},
      finish() {},
    });
    const time = game.hud().time;
    assert.equal(time, Math.ceil((55 * 165) / driverProfile(car.id).topSpeed));
    limits.add(time);
  }
  assert.ok(limits.size > 5);
});
test("keyboard suppression survives stationary pointer events while the world moves", () => {
  const pointer = new PointerIntent();
  pointer.move(300, 400, 20, 10);
  pointer.suppress();
  pointer.move(300, 400);
  assert.equal(pointer.active, false);
  pointer.move(301, 400);
  assert.equal(pointer.active, true);
  pointer.press(301, 400, false);
  assert.equal(
    pointer.active,
    false,
    "a touch press must not create mouse hover ownership",
  );
  pointer.press(301, 400, true);
  assert.equal(pointer.active, true);
});

test("saved wins and selections round-trip, while blocked or corrupt storage stays usable", async () => {
  const { readRaceProgress, saveRaceProgress } = await import(
    "../lib/games/progression.ts"
  );
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let stored = "";
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem() {
          return stored;
        },
        setItem(_key: string, value: string) {
          stored = value;
        },
      },
    });
    const progress = { wins: 4, selected: "scargo" };
    assert.equal(saveRaceProgress(progress), true);
    assert.deepEqual(readRaceProgress(), progress);
    stored = "broken JSON";
    assert.deepEqual(
      readRaceProgress(),
      progress,
      "the last valid visit state survives a storage failure",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem() {
          return null;
        },
        setItem() {
          throw Error("Quota exceeded");
        },
      },
    });
    assert.equal(saveRaceProgress(progress), false);
    assert.deepEqual(
      readRaceProgress(),
      progress,
      "reopening a garage must retain unsaved session wins",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw Error("Storage blocked");
      },
    });
    assert.equal(saveRaceProgress(progress), false);
    assert.deepEqual(
      readRaceProgress(),
      progress,
      "the last valid visit state survives a storage failure",
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
