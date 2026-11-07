import { ALL_CARS, FIAT } from "./cars.ts";
import type { GameResult } from "../types.ts";

export type RaceProgress = { wins: number; selected: string };
export const RACE_STORE = "vega-sam-circuit-v1";
export const UNLOCK_WINS: Record<string, number> = {
  "fiat-player": 0,
  mini: 1,
  be1: 1,
  pao: 1,
  az1: 2,
  figaro: 2,
  isetta: 2,
  "sambar-van": 3,
  "sambar-truck": 3,
  midget: 3,
  p50: 4,
  scargo: 4,
};
export function unlockedCars(wins: number) {
  return ALL_CARS.filter((car) => wins >= UNLOCK_WINS[car.id]);
}
export function normalizeProgress(value: unknown): RaceProgress {
  const data =
    value && typeof value === "object" ? (value as Partial<RaceProgress>) : {};
  const wins =
    typeof data.wins === "number" && Number.isFinite(data.wins)
      ? Math.max(0, Math.min(9999, Math.floor(data.wins)))
      : 0;
  const selected = unlockedCars(wins).some((car) => car.id === data.selected)
    ? data.selected!
    : FIAT.id;
  return { wins, selected };
}
export function recordRaceResult(
  progress: RaceProgress,
  result: GameResult,
): RaceProgress {
  if (
    result.id !== "kart" ||
    !result.won ||
    !result.race?.finished ||
    result.race.place !== 1
  )
    return progress;
  return normalizeProgress({ ...progress, wins: progress.wins + 1 });
}
// Keep progress for this tab even when browser storage is unavailable.
let visitProgress: RaceProgress = { wins: 0, selected: FIAT.id };
let visitUnsaved = false;
export function readRaceProgress(): RaceProgress {
  if (visitUnsaved) return { ...visitProgress };
  try {
    visitProgress = normalizeProgress(
      JSON.parse(localStorage.getItem(RACE_STORE) || "null"),
    );
  } catch {}
  return { ...visitProgress };
}
export function saveRaceProgress(progress: RaceProgress) {
  visitProgress = normalizeProgress(progress);
  try {
    localStorage.setItem(RACE_STORE, JSON.stringify(visitProgress));
    visitUnsaved = false;
    return true;
  } catch {
    visitUnsaved = true;
    return false;
  }
}
