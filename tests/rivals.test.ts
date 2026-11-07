import test from "node:test";
import assert from "node:assert/strict";
import { createRivals, updateRivals } from "../lib/games/rivals.ts";
import { RIVAL_CARS, selectRivalCars } from "../lib/games/cars.ts";

test("the grid races independently, changes lines and exchanges places", () => {
  const cars = createRivals(RIVAL_CARS);
  const before = [...cars]
    .sort((a, b) => b.distance - a.distance)
    .map((c) => c.id);
  for (let i = 0; i < 45 * 120; i++)
    updateRivals(cars, 1 / 120, i / 120, {
      distance: -10000,
      lane: 0,
      speed: 0,
    });
  const after = [...cars]
    .sort((a, b) => b.distance - a.distance)
    .map((c) => c.id);
  assert.ok(after.filter((id, i) => before[i] !== id).length >= 8);
  assert.ok(
    cars.every((c) => c.laneChanges >= 3),
    "drivers must not stay in a permanent queue",
  );
  assert.ok(
    cars.find((c) => c.id === "az1")!.distance >
      cars.find((c) => c.id === "p50")!.distance + 6000,
  );
  assert.ok(cars.every((c) => c.speed > 0 && Math.abs(c.lane) <= 0.71));
});

test("a blocked passing line gets reconsidered rather than trapping a driver forever", () => {
  const cars = createRivals(RIVAL_CARS.slice(0, 3));
  cars[0].distance = 0;
  cars[0].lane = 0.16;
  cars[0].targetLane = 0.35;
  cars[1].distance = 90;
  cars[1].lane = 0.35;
  cars[1].targetLane = 0.35;
  cars[1].pace = 750;
  cars[2].distance = 3000;
  for (let i = 0; i < 15 * 120; i++)
    updateRivals(cars, 1 / 120, i / 120, {
      distance: -10000,
      lane: 0,
      speed: 0,
    });
  assert.ok(cars[0].distance > cars[1].distance + 300);
  assert.ok(cars[0].speed > 1000);
});

test("S-Cargo is the leading rival across most shuffled starting grids", () => {
  let leads = 0;
  for (let grid = 0; grid < RIVAL_CARS.length; grid++) {
    const cars = createRivals(selectRivalCars(grid));
    for (let i = 0; i < 45 * 60; i++)
      updateRivals(cars, 1 / 60, i / 60, {
        distance: -10000,
        lane: 0,
        speed: 0,
      });
    if (cars.sort((a, b) => b.distance - a.distance)[0].id === "scargo")
      leads++;
  }
  assert.ok(leads >= 8, `Boss led ${leads} of ${RIVAL_CARS.length} grids`);
});
