import { clamp } from "../math.ts";
import { GAME_DURATION } from "../types.ts";
import {
  carContactWidth,
  RIVAL_CARS,
  PLAYER_PROFILE,
  SPEED_UNITS,
} from "./cars.ts";
import { createRivals, updateRivals } from "./rivals.ts";
import { advanceImpact } from "./impact.ts";
import { drawFacade, FACADE_CROPS } from "./city-art.ts";
import {
  TRACK_LENGTH,
  PLAYER_DEPTH,
  ROAD_DEPTH,
  trackCurve,
  buildRoad,
  projectRoad,
  isOffRoad,
  roadZoom,
} from "./track.ts";
import {
  COLORS as C,
  drawDuskSky,
  drawSam,
  drawBrand,
  pixelText,
  finishOnce,
  type GameFactory,
} from "./types.ts";
const MAX_SPEED = PLAYER_PROFILE.topSpeed * SPEED_UNITS,
  COUNTDOWN = 1.5;
export const createGame: GameFactory = (env) => {
  let distance = 0,
    speed = 0,
    lateral = 0,
    time = 0,
    steer = 0,
    braking = false,
    throttle = false,
    heading = 0,
    impact = 0,
    impactSide = 1,
    impactFront = true,
    viewHeight = 400,
    demoLane = 0;
  let collisionUntil = 0,
    boostUntil = 0,
    lastMotor = 0,
    passes = 0,
    checkpoint = 0,
    callout = "",
    calloutUntil = 0,
    finished = false;
  const rivals = createRivals(env.rivalCars || RIVAL_CARS);
  const gridSize = rivals.length + 1;
  const pads = [
    { at: 14500, lane: -0.52, used: false },
    { at: 31000, lane: 0.52, used: false },
    { at: 47000, lane: -0.52, used: false },
  ];
  const end = finishOnce(env, "kart"),
    rank = () => 1 + rivals.filter((r) => r.distance > distance).length;
  const say = (text: string, duration = 1.1) => {
    callout = text;
    calloutUntil = time + duration;
  };
  const raceTime = () => Math.max(0, time - COUNTDOWN);
  function drawCar(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    index: number,
    turn: number,
  ) {
    const image = env.cars?.[index];
    if (!image) return;
    const frame = turn < -0.18 ? 1 : turn > 0.18 ? 2 : 0;
    c.drawImage(
      image,
      frame * 96,
      0,
      96,
      96,
      Math.round(x - 48 * scale),
      Math.round(y - 90 * scale),
      96 * scale,
      96 * scale,
    );
  }
  return {
    attractInput: () => {
      const nextBoost = pads.find(
        (pad) => !pad.used && pad.at > distance && pad.at - distance < 5000,
      );
      const traffic = rivals.filter(
        (r) => Math.abs(r.distance - distance) < 1500,
      );
      if (
        nextBoost &&
        !traffic.some((r) => Math.abs(r.lane - nextBoost.lane) < 0.4)
      )
        demoLane = nextBoost.lane;
      if (
        traffic.some(
          (r) =>
            Math.abs(r.lane - demoLane) < carContactWidth(r.bodyWidth) + 0.02,
        )
      ) {
        const clearance = (lane: number) =>
          Math.min(...traffic.map((r) => Math.abs(r.lane - lane)));
        demoLane = clearance(-0.98) > clearance(0.98) ? -0.98 : 0.98;
      }
      const lane = demoLane,
        ratio = speed / MAX_SPEED;
      return {
        held: {
          up: true,
          axis: clamp(
            (lane - lateral) * 4 +
              (trackCurve(distance) * ratio * 0.68) /
                (0.6 + ratio * (1.4 + PLAYER_PROFILE.handling * 0.25)),
            -1,
            1,
          ),
        },
      };
    },
    press: (key) => {
      if (key === "action") env.sound("accelerate");
    },
    update(dt, input, t) {
      if (finished) return;
      time = t;
      throttle = input.up || input.action;
      braking = input.down || input.secondary;
      steer = clamp(
        (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.axis,
        -1,
        1,
      );
      if (t < COUNTDOWN) {
        if (t - lastMotor > 0.08) {
          env.motor?.(throttle ? 0.4 : 0.1);
          lastMotor = t;
        }
        return;
      }
      const curve = trackCurve(distance),
        activeBoost = time < boostUntil,
        cap = activeBoost ? 1650 : MAX_SPEED;
      speed = clamp(
        speed +
          (throttle ? PLAYER_PROFILE.acceleration : -290) * dt -
          (braking ? PLAYER_PROFILE.braking * dt : 0),
        0,
        cap,
      );
      const ratio = speed / MAX_SPEED;
      const knock = advanceImpact(impact, dt);
      lateral = clamp(
        lateral +
          steer * dt * (0.6 + ratio * (1.4 + PLAYER_PROFILE.handling * 0.25)) -
          curve * ratio * 0.68 * dt +
          knock.offset,
        -1.25,
        1.25,
      );
      impact = knock.velocity;
      if (isOffRoad(lateral)) {
        speed = Math.min(speed, Math.max(350, speed - 1900 * dt));
        if (time > calloutUntil) say("OFF ROAD", 0.45);
      }
      distance += speed * dt;
      heading += (curve * speed * dt) / 6000;
      updateRivals(rivals, dt, raceTime(), { distance, lane: lateral, speed });
      for (let i = 0; i < rivals.length; i++) {
        const r = rivals[i];
        if (
          Math.abs(r.distance - distance) < 110 &&
          Math.abs(r.lane - lateral) < carContactWidth(r.bodyWidth) &&
          time > collisionUntil
        ) {
          speed *= 0.48;
          impactSide = lateral < r.lane ? -1 : 1;
          impactFront = r.distance >= distance;
          impact = impactSide * 0.72;
          r.impact = -impactSide * 0.36;
          r.speed *= 0.92;
          collisionUntil = time + 1.1;
          env.sound("hurt");
          say(r.faction ? "SIEM BUMP!" : "BUMPER TAP!");
        }
        if (distance > r.distance && !r.passed) {
          r.passed = true;
          passes++;
          env.sound("pass");
          say(`PASSED ${r.name}`);
        }
      }
      for (const pad of pads)
        if (
          !pad.used &&
          Math.abs(distance - pad.at) < 90 &&
          Math.abs(lateral - pad.lane) < 0.25
        ) {
          pad.used = true;
          boostUntil = time + 1.6;
          speed = 1650;
          env.sound("boost");
          say("POST-SIEM BOOST", 1.6);
        }
      const reached = Math.min(3, Math.floor(distance / 20000));
      if (reached > checkpoint) {
        checkpoint = reached;
        env.sound("collect");
        say(`POST-SIEM ${checkpoint}/3`, 1.5);
      }
      if (t - lastMotor > 0.08) {
        env.motor?.(speed / MAX_SPEED);
        lastMotor = t;
      }
      if (distance >= TRACK_LENGTH) {
        finished = true;
        const place = rank();
        env.motor?.(0);
        end(
          Math.max(
            0,
            Math.round((GAME_DURATION.kart - raceTime()) * 120) +
              passes * 250 +
              (gridSize + 1 - place) * 200,
          ),
          place === 1 && raceTime() <= GAME_DURATION.kart,
          `Finished ${place}${place < 4 ? ["", "st", "nd", "rd"][place] : "th"} in ${raceTime().toFixed(2)} seconds. ${place === 1 && raceTime() <= GAME_DURATION.kart ? "Post-SIEM victory." : "Finish first within 55 seconds to clear."}`,
        );
      } else if (raceTime() >= GAME_DURATION.kart) {
        finished = true;
        env.motor?.(0);
        end(
          Math.round((distance / TRACK_LENGTH) * 1000) + passes * 250,
          false,
          `Time's up. ${Math.round((distance / TRACK_LENGTH) * 100)}% of the route completed.`,
        );
      }
    },
    draw(c, t) {
      viewHeight = c.canvas?.height || 400;
      const portrait = viewHeight > 500;
      const zoom = roadZoom(viewHeight);
      const horizon = Math.round(viewHeight * 0.28),
        roadHeight = viewHeight - horizon,
        road = buildRoad(distance);
      const project = (z: number, lane = 0) =>
        projectRoad(road, lateral, z, lane, viewHeight);
      drawDuskSky(c, horizon + 20);
      c.fillStyle = "#FFE1B2";
      for (let i = 0; i < 6; i++) {
        const x = ((((i * 150 - heading * 75) % 900) + 900) % 900) - 120;
        c.fillRect(x, 38 + (i % 2) * 16, 78, 9);
        c.fillRect(x + 18, 29 + (i % 2) * 16, 35, 10);
      }
      if (env.backdrop) {
        const h = Math.max(48, horizon - 24),
          w = Math.round((env.backdrop.width * h) / env.backdrop.height),
          x = -((((heading * 80) % w) + w) % w);
        for (let i = -1; i < Math.ceil(640 / w) + 1; i++)
          c.drawImage(env.backdrop, x + i * w, horizon - h, w, h);
      }
      c.fillStyle = "#8b7889";
      c.fillRect(0, horizon, 640, 4);
      for (let y = horizon + 2; y < viewHeight; y += 2) {
        const p = (y - horizon) / roadHeight,
          z = ROAD_DEPTH / p - ROAD_DEPTH,
          world = distance + z - PLAYER_DEPTH,
          q = project(z),
          band = Math.floor(world / 180) % 2;
        c.fillStyle = band ? "#c7b3a4" : "#bca89d";
        c.fillRect(0, y, 640, 2);
        c.fillStyle = band ? "#e5d7c7" : "#a18d8b";
        c.fillRect(q.center - q.half - 12 * p, y, q.half * 2 + 24 * p, 2);
        c.fillStyle = band ? "#504b55" : "#55505a";
        c.fillRect(q.center - q.half, y, q.half * 2, 2);
        if (Math.floor(world / 145) % 2 === 0) {
          c.fillStyle = "#f6edc8";
          for (const lane of [-1 / 3, 1 / 3])
            c.fillRect(
              q.center + q.half * lane - 2 * p,
              y,
              Math.max(1, 4 * p),
              2,
            );
        }
        if (world > TRACK_LENGTH && world < TRACK_LENGTH + 190)
          for (let k = 0; k < 12; k++) {
            c.fillStyle = (k + Math.floor(world / 45)) % 2 ? C.paper : C.ink;
            c.fillRect(
              q.center - q.half + (k * q.half) / 6,
              y,
              q.half / 6 + 1,
              2,
            );
          }
      }
      for (let i = 15; i >= 0; i--) {
        const at = Math.floor(distance / 500) * 500 + i * 500 + 500,
          z = at - distance + PLAYER_DEPTH;
        if (z < 30) continue;
        for (const lane of [-1.22, 1.22]) {
          const q = project(z, lane),
            w = Math.max(2, 16 * q.p * zoom),
            h = 46 * q.p * zoom;
          c.fillStyle = C.paper;
          c.fillRect(q.x - w / 2, q.y - h, w, h);
          c.fillStyle = "#8b7889";
          c.fillRect(q.x - w / 2, q.y - h, w, h * 0.35);
        }
      }
      const blocks: {
        at: number;
        z: number;
        row: number;
        side: number;
        index: number;
      }[] = [];
      if (env.cityBlocks) {
        for (const row of [0, 1])
          for (let i = 0; i < 15; i++) {
            const at = Math.floor(distance / 760) * 760 + i * 760 + row * 380;
            const z = at - distance + PLAYER_DEPTH;
            if (z < 5 || z > 8000) continue;
            for (const side of [-1, 1])
              blocks.push({
                at,
                z,
                row,
                side,
                index:
                  (((Math.floor(at / 760) + (side > 0 ? 2 : 0)) %
                    FACADE_CROPS.length) +
                    FACADE_CROPS.length) %
                  FACADE_CROPS.length,
              });
          }
      }
      for (const pad of pads) {
        const z = pad.at - distance + PLAYER_DEPTH;
        if (z < PLAYER_DEPTH - 100 || z > 7000) continue;
        const a = project(Math.max(1, z - 60), pad.lane - 0.25),
          b = project(Math.max(1, z - 60), pad.lane + 0.25),
          d = project(z + 60, pad.lane + 0.25),
          e = project(z + 60, pad.lane - 0.25);
        c.fillStyle = C.yellow;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.lineTo(d.x, d.y);
        c.lineTo(e.x, e.y);
        c.closePath();
        c.fill();
      }
      const player = project(PLAYER_DEPTH, lateral),
        playerScale = 1.1 * zoom;
      const roadCars = rivals
        .map((r) => ({ r, z: r.distance - distance + PLAYER_DEPTH }))
        .filter(({ z }) => z > -750 && z < 8000)
        .sort((a, b) => b.z - a.z);
      const ratio = speed / MAX_SPEED;
      if (!env.reducedMotion && ratio > 0.68) {
        c.strokeStyle = time < boostUntil ? C.yellow : C.paper;
        c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const phase = (t * (3 + ratio * 3) + i / 6) % 1,
            y = horizon + 50 + phase * (roadHeight - 60),
            x = 320 + (i % 2 ? 1 : -1) * (175 + phase * 170);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + (i % 2 ? 1 : -1) * 15 * ratio, y + 18 * ratio);
          c.stroke();
        }
      }
      if (braking && speed > 100) {
        c.fillStyle = "#292e23";
        c.fillRect(player.x - 29 * zoom, player.y, 5 * zoom, 36 * zoom);
        c.fillRect(player.x + 24 * zoom, player.y, 5 * zoom, 36 * zoom);
      }
      const objects = [
        ...blocks.map((block) => ({
          kind: "building" as const,
          z: block.z,
          block,
        })),
        ...roadCars.map((car) => ({ kind: "rival" as const, z: car.z, car })),
        { kind: "player" as const, z: PLAYER_DEPTH },
      ].sort((a, b) => b.z - a.z);
      for (const object of objects) {
        if (object.kind === "building") {
          const { z, row, side, index, at } = object.block;
          const q = project(z, side * (row ? 2.4 : 1.7));
          const h = (row ? 540 : 390 + index * 24) * q.p * zoom;
          const w = (row ? 250 : 240) * q.p * zoom;
          if (q.x + w < 0 || q.x - w > 640) continue;
          const number = Math.floor(at / 760);
          const advert =
            !row && number % 3 === 0 ? (number + (side > 0 ? 1 : 0)) % 4 : null;
          drawFacade(c, env, q.x - w / 2, q.y - h, w, h, index, advert, {
            flip: side < 0,
            distant: !!row,
          });
        } else if (object.kind === "player") {
          drawCar(c, player.x, player.y, playerScale, 0, steer);
        } else {
          const { r, z } = object.car;
          const q = project(z, r.lane),
            behind = Math.max(0, -z);
          q.y += behind * 0.65 * zoom;
          const scale =
            (q.p / player.p) * playerScale * (1 + Math.min(0.6, behind / 1000));
          drawCar(c, q.x, q.y, scale, r.car, r.displayTurn);
        }
      }
      const contactAge = time - (collisionUntil - 1.1);
      if (collisionUntil > 0 && contactAge >= 0 && contactAge < 0.38) {
        const x = player.x - impactSide * 37 * playerScale;
        const y = player.y - (impactFront ? 68 : 16) * playerScale;
        for (let i = 0; i < 6; i++) {
          const spread = env.reducedMotion ? 4 : 6 + contactAge * (28 + i * 7);
          const angle = -Math.PI / 2 + (i - 2.5) * 0.42;
          c.fillStyle = i % 2 ? C.yellow : C.paper;
          c.fillRect(
            Math.round(x + Math.cos(angle) * spread),
            Math.round(y + Math.sin(angle) * spread),
            3 * zoom,
            3 * zoom,
          );
        }
      }
      if (portrait)
        pixelText(
          c,
          "PostSIEM.com",
          player.x,
          Math.min(viewHeight - 24, player.y + 26),
          26,
          C.paper,
          "center",
        );
      c.fillStyle = C.ink;
      c.fillRect(14, 13, portrait ? 110 : 100, portrait ? 76 : 58);
      pixelText(
        c,
        `${rank()}/${gridSize}`,
        portrait ? 69 : 64,
        portrait ? 66 : 52,
        portrait ? 36 : 28,
        C.paper,
        "center",
      );
      c.fillStyle = C.paper;
      c.fillRect(
        portrait ? 138 : 130,
        13,
        portrait ? 76 : 56,
        portrait ? 76 : 58,
      );
      drawSam(c, env.sprite, portrait ? 142 : 134, 17, portrait ? 68 : 48);
      c.fillStyle = C.paper;
      c.fillRect(
        portrait ? 380 : 442,
        13,
        portrait ? 246 : 184,
        portrait ? 76 : 58,
      );
      pixelText(
        c,
        `${Math.round(speed / SPEED_UNITS)} KM/H`,
        614,
        portrait ? 42 : 32,
        portrait ? 34 : 20,
        C.ink,
        "right",
      );
      pixelText(
        c,
        "POST-SIEM RUN",
        614,
        portrait ? 76 : 54,
        portrait ? 25 : 15,
        C.ink,
        "right",
      );
      c.fillStyle = C.ink;
      c.fillRect(12, 84, 16, 96);
      c.fillStyle = C.paper;
      rivals.forEach((r, i) => {
        c.fillRect(
          14 + (i % 3) * 4,
          176 - Math.min(1, r.distance / TRACK_LENGTH) * 90,
          3,
          4,
        );
      });
      c.fillStyle = C.yellow;
      c.fillRect(10, 176 - Math.min(1, distance / TRACK_LENGTH) * 90, 20, 4);
      if (t < COUNTDOWN) {
        pixelText(
          c,
          String(Math.max(1, 3 - Math.floor(t * 2))),
          320,
          horizon + roadHeight * 0.35,
          64,
          C.paper,
          "center",
        );
        pixelText(
          c,
          env.inputMode === "touch"
            ? "HOLD A · GET READY"
            : "HOLD ↑ · GET READY",
          320,
          horizon + roadHeight * 0.35 + 32,
          18,
          C.paper,
          "center",
        );
      } else if (t < COUNTDOWN + 0.6)
        pixelText(
          c,
          "GO!",
          320,
          horizon + roadHeight * 0.35,
          48,
          C.yellow,
          "center",
        );
      else if (time < calloutUntil) {
        c.fillStyle = time < boostUntil ? C.ink : C.paper;
        c.fillRect(170, horizon - 39, 300, 32);
        pixelText(
          c,
          callout,
          320,
          horizon - 17,
          20,
          time < boostUntil ? C.yellow : C.ink,
          "center",
        );
      } else if (speed < 20)
        pixelText(
          c,
          env.inputMode === "touch"
            ? "HOLD A TO ACCELERATE"
            : "HOLD ↑ / SPACE TO ACCELERATE",
          320,
          horizon + roadHeight * 0.35,
          18,
          C.paper,
          "center",
        );
      pixelText(
        c,
        braking ? "BRAKE" : throttle ? "THROTTLE" : "COAST",
        624,
        viewHeight - 17,
        portrait ? 25 : 15,
        braking ? C.orange : C.paper,
        "right",
      );
    },
    hud: () => ({
      score: Math.round((distance / TRACK_LENGTH) * 1000) + passes * 250,
      time: Math.max(0, GAME_DURATION.kart - Math.floor(raceTime())),
      progress: Math.min(1, distance / TRACK_LENGTH),
      message: `${rank()}/${gridSize} · CP ${checkpoint}/3`,
    }),
  };
};
