/** Integrate a brief bumper impulse without moving the car at contact time. */
export function advanceImpact(velocity: number, dt: number) {
  const decay = Math.exp(-7 * Math.max(0, dt));
  return { offset: (velocity * (1 - decay)) / 7, velocity: velocity * decay };
}
