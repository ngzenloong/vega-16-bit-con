import {
  OUTFIT_OPTIONS,
  OUTFIT_PARTS,
  completeAppearance,
} from "./appearance.ts";

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function landingSurface<T extends { x: number; y: number; w: number }>(
  previousFeet: number,
  nextFeet: number,
  x: number,
  halfWidth: number,
  surfaces: readonly T[],
): T | null {
  if (nextFeet < previousFeet) return null;
  let result: T | null = null;
  for (const surface of surfaces)
    if (
      previousFeet <= surface.y + 2 &&
      nextFeet >= surface.y &&
      x + halfWidth > surface.x &&
      x - halfWidth < surface.x + surface.w &&
      (!result || surface.y < result.y)
    )
      result = surface;
  return result;
}
export function rhythmJudgement(
  delta: number,
): "perfect" | "nice" | "good" | "bad" | "miss" {
  const distance = Math.abs(delta);
  return distance <= 0.09
    ? "perfect"
    : distance <= 0.16
      ? "nice"
      : distance <= 0.24
        ? "good"
        : distance <= 0.32
          ? "bad"
          : "miss";
}
export function safePlayer(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>,
    a = p.appearance as Record<string, unknown> | undefined;
  if (typeof p.name !== "string" || !p.name.trim() || !a) return null;
  if (
    !OUTFIT_PARTS.every(
      (k) =>
        Number.isInteger(a[k] ?? 0) &&
        Number(a[k] ?? 0) >= 0 &&
        Number(a[k] ?? 0) < OUTFIT_OPTIONS[k].length,
    )
  )
    return null;
  const appearance = completeAppearance({ hat: 0, glasses: 0, shirt: 0 });
  for (const part of OUTFIT_PARTS) appearance[part] = Number(a[part] ?? 0);
  return {
    name: p.name.trim().slice(0, 24),
    appearance,
    interests: Array.isArray(p.interests)
      ? p.interests.filter(
          (i): i is number => Number.isInteger(i) && i >= 0 && i < 3,
        )
      : [],
  };
}
