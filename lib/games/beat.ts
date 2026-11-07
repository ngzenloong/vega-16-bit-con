import { rhythmJudgement, clamp } from "../math.ts";
import { BEAT_CHART, SONG } from "./beat-chart.ts";
import {
  COLORS as C,
  drawCharacter,
  drawBrand,
  pixelText,
  finishOnce,
  type GameFactory,
  type GameButton,
  type GameInput,
} from "./types.ts";
const lanes: GameButton[] = ["left", "down", "up", "right"];
const laneColors = [C.yellow, C.paper, C.lime, C.orange];
const weights = { perfect: 1, nice: 0.9, good: 0.75, bad: 0 };
export function createBeatState() {
  return {
    time: 0,
    score: 0,
    hits: 0,
    judged: 0,
    earned: 0,
    strays: 0,
    combo: 0,
    maxCombo: 0,
    feedback: "READY",
    feedbackUntil: 2,
    feedbackKind: "ready",
    held: [false, false, false, false],
    pressedAt: [-10, -10, -10, -10],
    hitAt: [-10, -10, -10, -10],
    laneGrade: ["", "", "", ""],
    notes: BEAT_CHART.map((note) => ({
      lane: note.lane as number,
      at: SONG.offset + (note.beat * 60) / SONG.bpm,
      state: "waiting" as "waiting" | "hit" | "miss",
      grade: "",
    })),
  };
}
export type BeatState = ReturnType<typeof createBeatState>;
export function beatAccuracy(state: BeatState) {
  return Math.round(
    (100 * state.earned) / Math.max(1, state.judged + state.strays),
  );
}
export function pressBeat(
  state: BeatState,
  key: GameButton,
  at = state.time,
  sound: (kind: string) => void = () => {},
  visualAt = at,
) {
  const lane = lanes.indexOf(key);
  if (lane < 0) return;
  state.pressedAt[lane] = visualAt;
  if (at < 1.5) {
    state.laneGrade[lane] = "ready";
    sound("click");
    return;
  }
  let candidate: BeatState["notes"][number] | undefined,
    distance = Infinity;
  for (const note of state.notes) {
    const gap = Math.abs(note.at - at);
    if (note.lane === lane && note.state === "waiting" && gap < distance) {
      candidate = note;
      distance = gap;
    }
  }
  const grade = candidate ? rhythmJudgement(at - candidate.at) : "miss";
  state.laneGrade[lane] = grade;
  state.feedbackKind = grade;
  state.feedbackUntil = visualAt + 0.55;
  if (candidate && grade !== "miss") {
    candidate.state = grade === "bad" ? "miss" : "hit";
    candidate.grade = grade;
    state.judged++;
    state.earned += weights[grade];
    if (grade === "bad") {
      state.combo = 0;
      state.feedback = "BAD";
      sound("hurt");
    } else {
      state.hits++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += grade === "perfect" ? 100 : grade === "nice" ? 80 : 50;
      state.hitAt[lane] = visualAt;
      state.feedback = grade.toUpperCase();
      sound(grade === "good" ? "click" : "collect");
    }
  } else {
    state.strays++;
    state.combo = 0;
    state.feedback = "BAD";
    state.feedbackKind = "bad";
    state.laneGrade[lane] = "bad";
    sound("hurt");
  }
}
export function updateBeat(
  state: BeatState,
  input: GameInput,
  time: number,
  tapOffset = 0,
) {
  state.time = time;
  state.held = lanes.map((key) => input[key]);
  for (const note of state.notes)
    if (note.state === "waiting" && time + tapOffset - note.at > 0.2) {
      note.state = "miss";
      note.grade = "miss";
      state.judged++;
      state.combo = 0;
      state.feedback = "MISS";
      state.feedbackKind = "miss";
      state.feedbackUntil = time + 0.4;
      state.laneGrade[note.lane] = "miss";
      state.pressedAt[note.lane] = time;
    }
}
function arrow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  lane: number,
  scale: number,
  color: string,
) {
  const bitmap = ["00100", "01110", "11111", "00100", "00100"];
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.rotate([-Math.PI / 2, Math.PI, 0, Math.PI / 2][lane]);
  c.fillStyle = color;
  bitmap.forEach((row, ry) =>
    [...row].forEach((pixel, rx) => {
      if (pixel === "1")
        c.fillRect((rx - 2.5) * scale, (ry - 2.5) * scale, scale, scale);
    }),
  );
  c.restore();
}
export const createGame: GameFactory = (env) => {
  const state = createBeatState(),
    end = finishOnce(env, "beat");
  let finished = false;
  let viewport = env.viewport || { width: 640, height: 400 };
  return {
    resize: (width, height) => {
      viewport = { width, height };
    },
    attractInput: (time) => {
      const due = state.notes.filter(
        (note) =>
          note.state === "waiting" && note.at <= time && time - note.at < 0.1,
      );
      const held: Partial<GameInput> = {};
      for (let lane = 0; lane < 4; lane++)
        held[lanes[lane]] = time - state.pressedAt[lane] < 0.12;
      return {
        held,
        press: due.map((note) => ({ key: lanes[note.lane], at: note.at })),
      };
    },
    press: (key, at) => {
      if (!finished)
        pressBeat(
          state,
          key,
          (at ?? state.time) + (env.tapOffset || 0),
          env.sound,
          at ?? state.time,
        );
    },
    update(_dt, input, time) {
      if (finished) return;
      updateBeat(state, input, time, env.tapOffset || 0);
      if (time >= SONG.duration) {
        finished = true;
        const accuracy = beatAccuracy(state);
        end(
          state.score,
          accuracy >= 70,
          `${accuracy}% accuracy. ${state.hits}/${state.notes.length} notes hit, ${state.strays} extra ${state.strays === 1 ? "tap" : "taps"}. ${accuracy >= 70 ? "Post-SIEM sync complete." : "Reach 70% accuracy to clear."}`,
        );
      }
    },
    draw(c, t) {
      const { width, height } = viewport,
        compact = width < 500;
      const fieldLeft = compact ? 18 : 178;
      const fieldWidth = compact ? width - 36 : 356;
      const fieldTop = compact ? 120 : 58;
      const target = height - 92;
      const center = compact ? width / 2 : 88;
      const feedbackY = compact ? 74 : 98;
      const xs = compact
        ? [0, 1, 2, 3].map(
            (lane) => fieldLeft + (fieldWidth * (lane + 0.5)) / 4,
          )
        : [216, 296, 376, 456];
      c.fillStyle = "#151514";
      c.fillRect(0, 0, width, height);
      c.fillStyle = "#24351c";
      c.fillRect(fieldLeft, fieldTop, fieldWidth, target - fieldTop + 50);
      drawBrand(c, env, 18, 14, 84, true);
      pixelText(
        c,
        "POST-SIEM SYNC",
        width - 18,
        31,
        compact ? 17 : 20,
        C.yellow,
        "right",
      );
      const beatPulse = env.reducedMotion ? 0 : Math.max(0, 1 - (t % 0.5) * 4);
      xs.forEach((x, lane) => {
        c.fillStyle = lane % 2 ? "#20351c" : "#1b2d18";
        c.fillRect(x - 31, fieldTop + 6, 62, target - fieldTop + 34);
        c.fillStyle = "#40543b";
        c.fillRect(x - 32, fieldTop + 6, 1, target - fieldTop + 34);
        const since = t - state.pressedAt[lane],
          recent = since >= 0 && since < 0.2,
          good = t - state.hitAt[lane] >= 0 && t - state.hitAt[lane] < 0.24;
        const amount = state.held[lane]
            ? 1
            : recent
              ? Math.exp(-since * 16)
              : 0,
          press = env.reducedMotion ? 0 : Math.round(6 * amount),
          bad = recent && ["bad", "miss"].includes(state.laneGrade[lane]);
        c.fillStyle = "#080e06";
        c.fillRect(x - 30, target - 15, 60, 42);
        c.fillStyle = bad
          ? C.orange
          : amount > 0.05 || good
            ? laneColors[lane]
            : "#62735a";
        c.fillRect(x - 29, target - 21 + press, 58, 34 - press);
        c.fillStyle = amount > 0.05 || good ? C.paper : "#88967c";
        c.fillRect(x - 28, target - 20 + press, 56, 3);
        arrow(
          c,
          x,
          target - 4 + press,
          lane,
          4,
          amount > 0.05 || good || bad ? C.ink : C.paper,
        );
        if (good && !env.reducedMotion) {
          const spread = Math.round((t - state.hitAt[lane]) * 75);
          c.fillStyle = laneColors[lane];
          for (const [dx, dy] of [
            [-32, -18],
            [32, -18],
            [-32, 16],
            [32, 16],
          ])
            c.fillRect(
              x + dx + Math.sign(dx) * spread,
              target + dy + Math.sign(dy) * spread,
              4,
              4,
            );
        }
      });
      for (const note of state.notes) {
        if (note.state !== "waiting") continue;
        const y = target - ((note.at - t) * (target - fieldTop)) / 1.72;
        if (y < fieldTop + 6 || y > target + 34) continue;
        const x = xs[note.lane];
        c.fillStyle = laneColors[note.lane];
        c.fillRect(x - 24, y - 18, 48, 35);
        c.fillStyle = C.ink;
        c.fillRect(x - 21, y - 15, 42, 29);
        arrow(c, x, y - 1, note.lane, 4, laneColors[note.lane]);
      }
      c.fillStyle = C.yellow;
      c.fillRect(fieldLeft + 1, target + 17, fieldWidth - 2, 2);
      if (!compact) {
        c.fillStyle = "#3c3b38";
        c.fillRect(32, 264, 112, 78);
        c.fillStyle = C.paper;
        c.fillRect(40, 271, 96, 12);
        pixelText(c, "SIEM", 88, 316, 27, C.paper, "center");
        const sync = state.hits / state.notes.length;
        c.fillStyle = C.green;
        c.fillRect(32, 342, 112 * sync, 6);
        drawCharacter(
          c,
          env,
          40,
          162 - Math.round(beatPulse * 5),
          96,
          "idle",
          t,
        );
      } else {
        drawCharacter(
          c,
          env,
          18,
          56 - Math.round(beatPulse * 3),
          56,
          "idle",
          t,
        );
        if (t >= 2 && t >= state.feedbackUntil) {
          c.fillStyle = "#3c3b38";
          c.fillRect(center - 39, 73, 78, 28);
          pixelText(c, "SIEM", center, 93, 19, C.paper, "center");
        }
      }
      pixelText(
        c,
        `${state.combo}`,
        compact ? width - 42 : 588,
        compact ? 84 : 138,
        34,
        C.yellow,
        "center",
      );
      pixelText(
        c,
        "COMBO",
        compact ? width - 42 : 588,
        compact ? 105 : 159,
        13,
        C.paper,
        "center",
      );
      if (t < 2) {
        pixelText(c, "READY", center, feedbackY, 24, C.paper, "center");
        pixelText(
          c,
          "MATCH THE ARROWS",
          center,
          feedbackY + 29,
          12,
          C.yellow,
          "center",
        );
      } else if (t < state.feedbackUntil) {
        const bad = ["bad", "miss"].includes(state.feedbackKind),
          color = bad ? C.orange : C.yellow;
        pixelText(c, state.feedback, center, feedbackY, 24, color, "center");
        const badge =
          state.feedbackKind === "perfect"
            ? "POST-SIEM"
            : bad
              ? "SIEM NOISE"
              : state.feedbackKind === "nice"
                ? "SIGNAL LOCKED"
                : "IN SYNC";
        c.fillStyle = bad ? "#3c3b38" : C.green;
        c.fillRect(center - 66, feedbackY + 12, 132, 22);
        pixelText(c, badge, center, feedbackY + 28, 14, C.paper, "center");
      }
      c.fillStyle = "#45533e";
      c.fillRect(20, height - 22, width - 40, 5);
      c.fillStyle = C.yellow;
      c.fillRect(
        20,
        height - 22,
        (width - 40) * clamp(t / SONG.duration, 0, 1),
        5,
      );
      pixelText(
        c,
        `${state.hits}/${state.notes.length} SYNCED`,
        22,
        height - 32,
        13,
        C.paper,
      );
      pixelText(
        c,
        state.judged || state.strays
          ? `${beatAccuracy(state)}% ACCURACY`
          : "FOLLOW THE SIGNAL",
        width - 20,
        height - 32,
        13,
        C.paper,
        "right",
      );
      if (t >= 31 && state.feedbackUntil < t)
        pixelText(c, "FINAL SIGNAL", center, feedbackY, 26, C.yellow, "center");
    },
    hud: () => ({
      score: state.score,
      time: Math.max(0, SONG.duration - Math.floor(state.time)),
      progress: state.hits / state.notes.length,
      message: `${state.judged || state.strays ? beatAccuracy(state) : "--"}% · ${state.combo} combo`,
    }),
  };
};
