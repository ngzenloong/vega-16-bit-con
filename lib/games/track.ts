import { clamp } from "../math.ts";
export const TRACK_LENGTH = 60000;
export const PLAYER_DEPTH = 90;
export const ROAD_DEPTH = 700;
export const ROAD_HALF = 340;
// Authored sections use eased curvature, following the segment model in Jake Gordon's MIT racer.
export const TRACK = [
  { length: 6000, curve: 0 },
  { length: 6000, curve: 0.65 },
  { length: 5000, curve: -0.45 },
  { length: 4000, curve: 0 },
  { length: 6500, curve: 0.95 },
  { length: 5000, curve: 0 },
  { length: 6500, curve: -0.85 },
  { length: 6000, curve: 0.45 },
  { length: 5000, curve: 0 },
  { length: 10000, curve: 0 },
] as const;
export function trackCurve(distance: number) {
  let start = 0;
  for (const segment of TRACK) {
    if (distance < start + segment.length) {
      const position = clamp((distance - start) / segment.length, 0, 1),
        edge = Math.min(1, position / 0.22, (1 - position) / 0.22);
      return (segment.curve * (1 - Math.cos(Math.PI * clamp(edge, 0, 1)))) / 2;
    }
    start += segment.length;
  }
  return 0;
}
export function buildRoad(distance: number) {
  const step = 100,
    offsets = [0];
  let heading = (-trackCurve(distance) * PLAYER_DEPTH) / 6000,
    offset = 0;
  for (let i = 1; i <= 80; i++) {
    heading +=
      (trackCurve(distance + (i - 0.5) * step - PLAYER_DEPTH) * step) / 6000;
    offset += heading * step;
    offsets.push(offset);
  }
  const at = (z: number) => {
    const index = Math.max(0, z / step),
      low = Math.min(offsets.length - 1, Math.floor(index));
    if (low === offsets.length - 1)
      return offsets[low] + heading * (z - low * step);
    return offsets[low] + (offsets[low + 1] - offsets[low]) * (index - low);
  };
  return { at, anchor: at(PLAYER_DEPTH) };
}
export type Road = ReturnType<typeof buildRoad>;
export const roadZoom = (height: number) => (height > 500 ? 1.7 : 1);
export function projectRoad(
  road: Road,
  lateral: number,
  z: number,
  lane: number,
  height: number,
) {
  const p = ROAD_DEPTH / (Math.max(0, z) + ROAD_DEPTH),
    zoom = roadZoom(height),
    half = ROAD_HALF * p * zoom,
    horizon = Math.round(height * 0.28);
  const center =
    320 + (road.at(z) - road.anchor) * p * 0.36 * zoom - lateral * half;
  return {
    p,
    half,
    center,
    x: center + lane * half,
    y: horizon + (height - horizon) * p,
  };
}
export function isOffRoad(lateral: number) {
  return Math.abs(lateral) > 1;
}
