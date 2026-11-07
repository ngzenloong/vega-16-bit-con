import { clamp } from "../math.ts";
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
  drawSam,
  drawBrand,
  pixelText,
  finishOnce,
  type GameFactory,
} from "./types.ts";
const MAX_SPEED = 1320,
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
    viewHeight = 400;
  let collisionUntil = 0,
    boostUntil = 0,
    lastMotor = 0,
    passes = 0,
    checkpoint = 0,
    callout = "",
    calloutUntil = 0,
    finished = false;
  const rivals = [
    {
      name: "INGEST",
      distance: 760,
      lane: -0.58,
      home: -0.58,
      pace: 1105,
      passed: false,
      car: 1,
    },
    {
      name: "SILO",
      distance: 400,
      lane: 0.02,
      home: 0.02,
      pace: 1000,
      passed: false,
      car: 2,
    },
    {
      name: "MIGRATE",
      distance: 1120,
      lane: 0.58,
      home: 0.58,
      pace: 1045,
      passed: false,
      car: 3,
    },
  ];
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
    legacy = false,
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
    if (legacy && scale > 0.25) {
      c.fillStyle = C.ink;
      c.fillRect(x - 17 * scale, y - 61 * scale, 34 * scale, 12 * scale);
      pixelText(
        c,
        "SIEM",
        x,
        y - 51 * scale,
        Math.max(7, 13 * scale),
        C.paper,
        "center",
      );
    }
  }
  return {
    attractInput: () => {
      const ahead = rivals.find(
        (r) =>
          r.distance > distance &&
          r.distance - distance < 850 &&
          Math.abs(r.lane - lateral) < 0.32,
      );
      const lane = ahead ? (ahead.lane <= 0 ? 0.65 : -0.65) : 0,
        ratio = speed / MAX_SPEED;
      return {
        held: {
          up: true,
          axis: clamp(
            (lane - lateral) * 1.8 +
              (trackCurve(distance) * ratio * 0.68) / (0.6 + ratio * 1.6),
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
        speed + (throttle ? 850 : -290) * dt - (braking ? 1750 * dt : 0),
        0,
        cap,
      );
      const ratio = speed / MAX_SPEED;
      lateral = clamp(
        lateral + steer * dt * (0.6 + ratio * 1.6) - curve * ratio * 0.68 * dt,
        -1.55,
        1.55,
      );
      if (isOffRoad(lateral)) {
        speed = Math.min(speed, Math.max(350, speed - 1900 * dt));
        if (time > calloutUntil) say("OFF ROAD", 0.45);
      }
      distance += speed * dt;
      heading += (curve * speed * dt) / 6000;
      for (let i = 0; i < rivals.length; i++) {
        const r = rivals[i],
          traffic = [
            ...rivals.filter((other) => other !== r),
            { distance, lane: lateral },
          ],
          ahead = traffic
            .filter(
              (other) =>
                other.distance > r.distance &&
                other.distance - r.distance < 650 &&
                Math.abs(other.lane - r.lane) < 0.35,
            )
            .sort((a, b) => a.distance - b.distance)[0];
        let desired = r.home;
        if (ahead) {
          const left = r.lane <= 0 ? 0.62 : -0.62;
          desired = traffic.some(
            (other) =>
              Math.abs(other.distance - r.distance) < 400 &&
              Math.abs(other.lane - left) < 0.35,
          )
            ? r.home
            : left;
        }
        r.lane += clamp(desired - r.lane, -0.7 * dt, 0.7 * dt);
        r.lane = clamp(r.lane, -0.78, 0.78);
        r.distance +=
          r.pace *
          (1 - Math.abs(trackCurve(r.distance)) * 0.17) *
          (ahead && Math.abs(desired - r.home) < 0.05 ? 0.88 : 1) *
          dt;
        if (
          Math.abs(r.distance - distance) < 110 &&
          Math.abs(r.lane - lateral) < 0.27 &&
          time > collisionUntil
        ) {
          speed *= 0.55;
          lateral = clamp(
            lateral + (lateral < r.lane ? -0.2 : 0.2),
            -1.55,
            1.55,
          );
          collisionUntil = time + 1.1;
          env.sound("hurt");
          say("SIEM BUMP!");
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
            Math.round((60 - raceTime()) * 120) +
              passes * 250 +
              (5 - place) * 500,
          ),
          place <= 3,
          `Finished ${["", "1st", "2nd", "3rd", "4th"][place]} in ${raceTime().toFixed(2)} seconds. ${place <= 3 ? "Post-SIEM finish reached." : "Finish in the top three to clear."}`,
        );
      } else if (raceTime() >= 60) {
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
      c.fillStyle = C.sky;
      c.fillRect(0, 0, 640, horizon + 20);
      c.fillStyle = C.paper;
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
      c.fillStyle = "#476b56";
      c.fillRect(0, horizon, 640, 4);
      for (let y = horizon + 2; y < viewHeight; y += 2) {
        const p = (y - horizon) / roadHeight,
          z = ROAD_DEPTH / p - ROAD_DEPTH,
          world = distance + z - PLAYER_DEPTH,
          q = project(z),
          band = Math.floor(world / 180) % 2;
        c.fillStyle = band ? "#92ae40" : "#829d33";
        c.fillRect(0, y, 640, 2);
        c.fillStyle = band ? C.paper : C.orange;
        c.fillRect(q.center - q.half - 12 * p, y, q.half * 2 + 24 * p, 2);
        c.fillStyle = band ? "#575b54" : "#60645b";
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
          c.fillStyle = C.green;
          c.fillRect(q.x - w / 2, q.y - h, w, h * 0.35);
        }
      }
      for (const at of [19000, 39000, 58000]) {
        const z = at - distance + PLAYER_DEPTH;
        if (z < 30 || z > 6500) continue;
        const q = project(z, 1.43),
          w = 172 * q.p * zoom,
          h = 74 * q.p * zoom;
        c.fillStyle = C.ink;
        c.fillRect(q.x - w / 2, q.y - h, w, h);
        c.fillStyle = C.yellow;
        c.fillRect(q.x - w / 2 + 2, q.y - h + 2, w - 4, h - 4);
        if (q.p > 0.13) {
          drawBrand(c, env, q.x - w * 0.37, q.y - h * 0.78, w * 0.74);
          pixelText(
            c,
            "POST-SIEM",
            q.x,
            q.y - h * 0.15,
            Math.max(8, 17 * q.p),
            C.ink,
            "center",
          );
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
      rivals
        .map((r) => ({ r, z: r.distance - distance + PLAYER_DEPTH }))
        .filter(({ z }) => z > 25 && z < 8000)
        .sort((a, b) => b.z - a.z)
        .forEach(({ r, z }) => {
          const q = project(z, r.lane),
            scale = (q.p / player.p) * playerScale;
          drawCar(c, q.x, q.y, scale, r.car, r.lane - r.home, true);
          if (q.p > 0.15)
            pixelText(
              c,
              `SIEM · ${r.name}`,
              q.x,
              q.y - 100 * scale,
              Math.max(portrait ? 22 : 10, 14 * scale),
              C.paper,
              "center",
            );
        });
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
      const shake =
        !env.reducedMotion && time < collisionUntil ? Math.sin(t * 65) * 3 : 0;
      drawCar(c, player.x + shake, player.y, playerScale, 0, steer, false);
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
      if (time < collisionUntil) {
        c.strokeStyle = C.orange;
        c.lineWidth = 4;
        c.strokeRect(2, 2, 636, viewHeight - 4);
      }
      c.fillStyle = C.ink;
      c.fillRect(14, 13, portrait ? 110 : 74, portrait ? 76 : 58);
      pixelText(
        c,
        `${rank()}/4`,
        portrait ? 69 : 51,
        portrait ? 66 : 52,
        portrait ? 44 : 32,
        C.paper,
        "center",
      );
      c.fillStyle = C.paper;
      c.fillRect(
        portrait ? 138 : 100,
        13,
        portrait ? 76 : 56,
        portrait ? 76 : 58,
      );
      drawSam(c, env.sprite, portrait ? 142 : 104, 17, portrait ? 68 : 48);
      pixelText(
        c,
        "P1",
        portrait ? 176 : 128,
        portrait ? 115 : 85,
        portrait ? 22 : 14,
        C.ink,
        "center",
      );
      pixelText(
        c,
        `${Math.round((speed / MAX_SPEED) * 320)} KM/H`,
        624,
        portrait ? 42 : 32,
        portrait ? 34 : 20,
        C.ink,
        "right",
      );
      pixelText(
        c,
        "POST-SIEM RUN",
        624,
        portrait ? 76 : 54,
        portrait ? 25 : 15,
        C.ink,
        "right",
      );
      c.fillStyle = C.ink;
      c.fillRect(18, 84, 5, 96);
      c.fillStyle = C.yellow;
      c.fillRect(16, 176 - Math.min(1, distance / TRACK_LENGTH) * 90, 9, 4);
      rivals.forEach((r, i) => {
        c.fillStyle = [C.yellow, C.green, C.paper][i];
        c.fillRect(
          15 + i * 3,
          176 - Math.min(1, r.distance / TRACK_LENGTH) * 90,
          4,
          4,
        );
      });
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
      else if (time < calloutUntil)
        pixelText(
          c,
          callout,
          320,
          horizon - 17,
          20,
          time < boostUntil ? C.yellow : C.ink,
          "center",
        );
      else if (speed < 20)
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
      time: Math.max(0, 60 - Math.floor(raceTime())),
      progress: Math.min(1, distance / TRACK_LENGTH),
      message: `${rank()} / 4 · ${checkpoint}/3 checkpoints`,
    }),
  };
};
