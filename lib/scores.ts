import { GAMES, type Scores } from "./types.ts";
export const SCORE_RULES = "easy-24-championship-55-grid13";
function cleanScores(value: unknown): Scores {
  const result: Scores = {};
  if (!value || typeof value !== "object") return result;
  const source = value as Record<string, unknown>;
  for (const { id } of GAMES) {
    const score = source[id];
    if (typeof score === "number" && Number.isFinite(score) && score >= 0)
      result[id] = score;
  }
  return result;
}
/** Keep earlier records, but do not compare scores from different game rules. */
export function readScoreProgress(value: unknown) {
  const stored =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const saved = cleanScores(stored.scores);
  const previousScores = cleanScores(stored.previousScores);
  if (stored.scoreRules === SCORE_RULES)
    return { scores: saved, previousScores };
  const archive = { ...previousScores };
  for (const { id } of GAMES)
    if (saved[id] !== undefined)
      archive[id] = Math.max(archive[id] ?? 0, saved[id]!);
  return {
    scores: {
      ...(saved.breaker !== undefined ? { breaker: saved.breaker } : {}),
      ...(saved.runner !== undefined ? { runner: saved.runner } : {}),
    },
    previousScores: archive,
  };
}
