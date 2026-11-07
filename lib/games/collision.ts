export type Rect = { x: number; y: number; w: number; h: number };
export type Contact = { time: number; nx: number; ny: number };
/** Earliest contact of a moving square against an expanded rectangle. */
export function sweepRect(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  rect: Rect,
  duration: number,
): Contact | null {
  const left = rect.x - radius,
    right = rect.x + rect.w + radius,
    top = rect.y - radius,
    bottom = rect.y + rect.h + radius;
  if (
    (vx === 0 && (x < left || x > right)) ||
    (vy === 0 && (y < top || y > bottom))
  )
    return null;
  const tx1 = vx === 0 ? -Infinity : (left - x) / vx,
    tx2 = vx === 0 ? Infinity : (right - x) / vx;
  const ty1 = vy === 0 ? -Infinity : (top - y) / vy,
    ty2 = vy === 0 ? Infinity : (bottom - y) / vy;
  const enterX = Math.min(tx1, tx2),
    exitX = Math.max(tx1, tx2),
    enterY = Math.min(ty1, ty2),
    exitY = Math.max(ty1, ty2),
    enter = Math.max(enterX, enterY),
    exit = Math.min(exitX, exitY);
  if (enter < -1e-8 || enter > duration || exit < Math.max(0, enter))
    return null;
  const corner = Math.abs(enterX - enterY) < 1e-7;
  return {
    time: Math.max(0, enter),
    nx: corner || enterX > enterY ? -Math.sign(vx) : 0,
    ny: corner || enterY > enterX ? -Math.sign(vy) : 0,
  };
}
