import test from "node:test";
import assert from "node:assert/strict";
import { drawFacade } from "../lib/games/city-art.ts";
import type { GameEnvironment } from "../lib/games/types.ts";

test("front glazing and both side-wall corners meet the same ground baseline", () => {
  for (const flip of [false, true])
    for (const width of [31, 160, 247]) {
      const paths: number[][][] = [],
        images: unknown[][] = [];
      let points: number[][] = [];
      const c = {
        beginPath() {
          points = [];
        },
        moveTo(x: number, y: number) {
          points.push([x, y]);
        },
        lineTo(x: number, y: number) {
          points.push([x, y]);
        },
        closePath() {},
        fill() {
          paths.push(points);
        },
        drawImage(...args: unknown[]) {
          images.push(args);
        },
        fillStyle: "",
      } as unknown as CanvasRenderingContext2D;
      const env = {
        cityBlocks: { width: 1151, height: 650 },
      } as unknown as GameEnvironment;
      drawFacade(c, env, 30, 40, width, 300, 0, null, { flip });
      assert.deepEqual(
        paths[0].slice(2).map((point) => point[1]),
        [340, 340],
      );
      const image = images[0];
      assert.ok(Math.abs(Number(image[6]) + Number(image[8]) - 340) <= 1);
    }
});
