/** Layout moving under a stationary cursor is not a new pointer interaction. */
export class PointerIntent {
  active = true;
  private point: { x: number; y: number } | null = null;
  suppress() {
    this.active = false;
  }
  press(x: number, y: number, mouse = true) {
    this.point = { x, y };
    this.active = mouse;
  }
  move(x: number, y: number, movementX = 0, movementY = 0) {
    const moved = this.point
      ? x !== this.point.x || y !== this.point.y
      : movementX !== 0 || movementY !== 0;
    this.point = { x, y };
    if (moved) this.active = true;
    return moved;
  }
}
