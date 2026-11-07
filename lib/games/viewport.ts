import type { GameId } from "../types.ts";

/** Portrait play uses a new field of view, never a squeezed widescreen image. */
export function gameViewport(id: GameId, width: number, height: number) {
  if (id === "kart") {
    return {
      width: 640,
      height: Math.max(
        320,
        Math.min(1200, Math.round((640 * height) / Math.max(1, width))),
      ),
    };
  }
  if (width < 500 && height > width * 0.85) {
    const logicalWidth = Math.max(320, Math.round(width));
    return {
      width: logicalWidth,
      height: Math.max(
        400,
        Math.min(740, Math.round((logicalWidth * height) / Math.max(1, width))),
      ),
    };
  }
  return { width: 640, height: 400 };
}
