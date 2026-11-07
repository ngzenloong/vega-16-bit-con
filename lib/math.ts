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
  return distance <= 0.045
    ? "perfect"
    : distance <= 0.085
      ? "nice"
      : distance <= 0.13
        ? "good"
        : distance <= 0.18
          ? "bad"
          : "miss";
}
export function safePlayer(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>,
    a = p.appearance as Record<string, unknown> | undefined;
  if (typeof p.name !== "string" || !p.name.trim() || !a) return null;
  if (
    !["hat", "glasses", "shirt"].every(
      (k) => Number.isInteger(a[k]) && Number(a[k]) >= 0 && Number(a[k]) <= 3,
    )
  )
    return null;
  return {
    name: p.name.trim().slice(0, 24),
    appearance: {
      hat: Number(a.hat),
      glasses: Number(a.glasses),
      shirt: Number(a.shirt),
    },
    interests: Array.isArray(p.interests)
      ? p.interests.filter(
          (i): i is number => Number.isInteger(i) && i >= 0 && i < 3,
        )
      : [],
  };
}
