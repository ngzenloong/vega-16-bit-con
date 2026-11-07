/** A held direction builds speed; release coasts briefly without changing intent. */
export function advanceWalk(
  velocity: number,
  held: number,
  direction: number,
  dt: number,
  maximum: number,
) {
  if (!direction) {
    const next = velocity * Math.exp(-18 * dt);
    return { velocity: Math.abs(next) < 2 ? 0 : next, held: 0 };
  }
  const continuing = Math.sign(velocity) === direction;
  const duration = (continuing ? held : 0) + dt;
  const t = Math.min(1, duration / 1.05);
  const target = 140 + (maximum - 140) * t * t * (3 - 2 * t);
  return {
    velocity: direction * Math.max(continuing ? Math.abs(velocity) : 0, target),
    held: duration,
  };
}
