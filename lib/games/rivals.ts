import { clamp } from "../math.ts";
import { trackCurve } from "./track.ts";
import { driverProfile, SPEED_UNITS, type RivalCar } from "./cars.ts";
import { advanceImpact } from "./impact.ts";

const LINES = [-0.7, -0.35, 0, 0.35, 0.7] as const;
export type Rival = ReturnType<typeof createRivals>[number];
type Traffic = {
  distance: number;
  lane: number;
  speed: number;
  targetLane: number;
};

export function createRivals(cars: readonly RivalCar[]) {
  return cars.map((car, i) => {
    const personality = [...car.id].reduce(
      (sum, letter) => sum + letter.charCodeAt(0),
      0,
    );
    const lane = [-0.7, 0, 0.7][i % 3];
    const profile = driverProfile(car.id);
    const pace = profile.topSpeed * SPEED_UNITS,
      acceleration = profile.acceleration,
      confidence = profile.handling,
      cornerLoss = 0.01 + (1 - profile.handling) * 0.25;
    return {
      id: car.id,
      name: car.label,
      faction: car.id === "scargo" || car.id === "fiat-player" ? "" : "SIEM",
      bodyWidth: car.bodyWidth,
      car: i + 1,
      passed: false,
      distance: 450 + (cars.length - 1 - i) * 145,
      lane: Number(lane),
      targetLane: Number(lane),
      racingLine: Number(lane),
      linePlanAt: (personality % 40) / 10,
      turn: 0,
      speed: 0,
      pace,
      acceleration,
      braking: profile.braking,
      cornerLoss,
      confidence,
      random: (personality + i * 137) >>> 0,
      displayTurn: 0,
      poseUntil: 0,
      blockedFor: 0,
      phase: personality * 0.17,
      decisionAt: (personality % 7) * 0.11,
      laneChanges: 0,
      impact: 0,
    };
  });
}

/** Drivers commit to passing lines, then choose a new line from actual traffic. */
export function updateRivals(
  rivals: Rival[],
  dt: number,
  time: number,
  player: { distance: number; lane: number; speed: number },
) {
  // Snapshot positions/speeds so iteration order cannot give a driver an advantage.
  const traffic: Traffic[] = rivals.map(
    ({ distance, lane, speed, targetLane }) => ({
      distance,
      lane,
      speed,
      targetLane,
    }),
  );
  traffic.push({ ...player, targetLane: player.lane });
  for (let index = 0; index < rivals.length; index++) {
    const car = rivals[index],
      own = traffic[index];
    const curve = trackCurve(car.distance + 700);
    const cruise =
      car.pace * (1 - Math.abs(curve) * car.cornerLoss) +
      Math.sin(time * 0.37 + car.phase) * 18;
    const frontOn = (line: number) => {
      let front: Traffic | undefined;
      for (let j = 0; j < traffic.length; j++) {
        const other = traffic[j];
        if (
          j !== index &&
          other.distance > own.distance &&
          Math.abs(other.lane - line) < 0.29 &&
          (!front || other.distance < front.distance)
        )
          front = other;
      }
      return front;
    };
    if (
      time >= car.decisionAt &&
      (Math.abs(car.lane - car.targetLane) < 0.06 || car.blockedFor > 0.35)
    ) {
      car.random = (Math.imul(car.random, 1664525) + 1013904223) >>> 0;
      const variation = car.random / 4294967296;
      if (time >= car.linePlanAt) {
        car.racingLine = LINES[Math.floor(variation * LINES.length)];
        car.linePlanAt = time + 3.5 + (1 - car.confidence) * 3 + variation * 3;
      }
      const preferred =
        Math.abs(curve) > 0.2
          ? Math.sign(curve) * 0.5 * car.confidence
          : car.racingLine;
      let best = car.targetLane,
        bestValue = -Infinity;
      for (const line of LINES) {
        if (Math.abs(line - car.lane) > 0.8) continue;
        const changing = Math.abs(line - car.lane) > 0.15;
        const blocked =
          changing &&
          traffic.some(
            (other, j) =>
              j !== index &&
              Math.abs(other.distance - own.distance) <
                180 + Math.max(0, other.speed - own.speed) * 0.4 &&
              (Math.abs(other.lane - line) < 0.29 ||
                Math.abs(other.targetLane - line) < 0.29),
          );
        if (blocked) continue;
        const front = frontOn(line);
        const gap = front ? front.distance - own.distance : 10000;
        const available = front
          ? Math.min(cruise, front.speed + Math.max(0, gap - 200) / 1.3)
          : cruise;
        const value =
          available - Math.abs(line - preferred) * 85 - (changing ? 25 : 0);
        if (value > bestValue) {
          bestValue = value;
          best = line;
        }
      }
      if (Math.abs(best - car.targetLane) > 0.1) {
        car.laneChanges++;
        car.targetLane = best;
        // Reserve this passing line for subsequent drivers in this decision step.
        own.targetLane = best;
      }
      car.decisionAt = time + 1.3 - car.confidence * 0.7 + variation * 0.8;
    }
    const steering = 0.5 + car.confidence * 0.45;
    let laneStep = clamp(
      car.targetLane - car.lane,
      -steering * dt,
      steering * dt,
    );
    const nextLane = car.lane + laneStep;
    if (
      traffic.some(
        (other, j) =>
          j !== index &&
          Math.abs(other.distance - own.distance) < 140 &&
          Math.abs(other.lane - nextLane) < 0.25 &&
          Math.abs(other.lane - nextLane) < Math.abs(other.lane - car.lane),
      )
    ) {
      laneStep = 0;
      car.blockedFor += dt;
    } else car.blockedFor = 0;
    const knock = advanceImpact(car.impact, dt);
    car.lane = clamp(car.lane + laneStep + knock.offset, -0.9, 0.9);
    car.impact = knock.velocity;
    car.turn = dt > 0 ? laneStep / dt : 0;
    if (Math.abs(car.turn) > 0.12) {
      car.displayTurn = Math.sign(car.turn);
      car.poseUntil = time + 0.14;
    } else if (time > car.poseUntil) car.displayTurn = 0;
    const ahead = frontOn(car.lane);
    let desiredSpeed = cruise;
    if (ahead) {
      const gap = ahead.distance - own.distance;
      // Match the leader near contact instead of applying a permanent speed penalty.
      desiredSpeed = Math.min(
        desiredSpeed,
        Math.max(0, ahead.speed + (gap - 150) * 2.2),
      );
    }
    car.speed += clamp(
      desiredSpeed - car.speed,
      -car.braking * dt,
      car.acceleration * dt,
    );
    car.distance += Math.max(0, car.speed) * dt;
  }
}
