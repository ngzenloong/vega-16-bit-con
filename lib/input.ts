import type { GameButton } from "./games/types";
export class HeldInput {
  private keys = new Map<string, GameButton>();
  down(source: string, button: GameButton) {
    if (this.keys.has(source)) return false;
    this.keys.set(source, button);
    return true;
  }
  up(source: string) {
    const button = this.keys.get(source);
    this.keys.delete(source);
    return button;
  }
  has(button: GameButton) {
    for (const value of this.keys.values()) if (value === button) return true;
    return false;
  }
  horizontal() {
    let direction = 0;
    for (const value of this.keys.values()) {
      if (value === "left") direction = -1;
      if (value === "right") direction = 1;
    }
    return direction;
  }
  clear() {
    this.keys.clear();
  }
}
export type ScenePress = { x: number; y: number; scroll: number; time: number };
export function isSceneTap(start: ScenePress, end: ScenePress) {
  return (
    end.time - start.time <= 500 &&
    Math.hypot(end.x - start.x, end.y - start.y) <= 10 &&
    Math.abs(end.scroll - start.scroll) <= 6
  );
}
