import { characterSheets, loadImage } from "./character";
import { shirtPixel } from "./outfit-art";
import type { Appearance } from "./types";

const cache = new Map<string, Promise<string>>();
/** Draw the arm, head and slice together so they share one native pixel frame. */
export function snackSheet(appearance: Appearance) {
  const key = JSON.stringify(appearance);
  let result = cache.get(key);
  if (result) return result;
  result = (async () => {
    const sheets = await characterSheets({ ...appearance, item: 0 });
    const source = await loadImage(sheets.idle);
    const base = document.createElement("canvas");
    base.width = base.height = 60;
    const b = base.getContext("2d")!;
    b.imageSmoothingEnabled = false;
    b.drawImage(source, 0, 0, 60, 60, 0, 0, 60, 60);
    const pixels = b.getImageData(0, 0, 60, 60);
    // Cover only the original resting arm with adjacent torso pixels.
    for (let y = 37; y < 54; y++)
      for (let x = 18; x < 30; x++) {
        const at = (y * 60 + x) * 4,
          from = (y * 60 + 31) * 4;
        if (pixels.data[at + 3] && pixels.data[from + 3])
          for (let k = 0; k < 3; k++)
            pixels.data[at + k] = pixels.data[from + k];
      }
    b.putImageData(pixels, 0, 0);
    const output = document.createElement("canvas");
    output.width = 600;
    output.height = 60;
    const c = output.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    const sleeve =
      shirtPixel(appearance.shirt, 26, 38, {
        x: 31,
        y: 17,
        bottom: 24,
        feet: 59,
      }) || "#A56125";
    const poses = [
      [0, 0, 39, 45, 39, 39, 0],
      [1, 0, 42, 40, 41, 34, 0],
      [2, 1, 44, 35, 41, 29, 0],
      [1, 1, 44, 35, 43, 30, 1],
      [0, 0, 41, 42, 40, 36, 1],
      [1, 0, 43, 38, 42, 32, 1],
      [2, 1, 44, 35, 41, 29, 1],
      [1, 0, 43, 36, 0, 0, 2],
      [0, 1, 38, 44, 0, 0, 2],
      [0, 0, 28, 49, 0, 0, 2],
    ];
    const block = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
    ) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    const limb = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      width: number,
      color: string,
    ) => {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let i = 0; i <= steps; i++) {
        const t = steps ? i / steps : 0;
        block(
          Math.round(x1 + (x2 - x1) * t) - Math.floor(width / 2),
          Math.round(y1 + (y2 - y1) * t) - Math.floor(width / 2),
          width,
          width,
          color,
        );
      }
    };
    poses.forEach(
      ([headX, headY, handX, handY, sliceX, sliceY, bites], frame) => {
        c.save();
        c.translate(frame * 60, 0);
        c.drawImage(base, 0, 33, 60, 27, 0, 33, 60, 27);
        c.drawImage(base, 0, 0, 60, 33, headX, headY, 60, 33);
        const elbowX = frame === 9 ? 24 : 30,
          elbowY = frame === 9 ? 45 : 45 - headX * 2;
        limb(25, 37, elbowX, elbowY, 8, "#864514");
        limb(25, 37, elbowX, elbowY, 6, sleeve);
        limb(elbowX, elbowY, handX, handY, 6, "#864514");
        limb(elbowX, elbowY, handX, handY, 4, "#B87421");
        block(handX - 2, handY - 2, 5, 5, "#FF9823");
        if (bites < 2) {
          // The point meets the mouth; the hand holds the crust throughout.
          for (let x = bites ? 4 : 0; x < 12; x++) {
            const half = Math.floor(x / 2);
            block(sliceX + x, sliceY - half, 1, half * 2 + 1, "#B87421");
            if (half > 0)
              block(sliceX + x, sliceY - half + 1, 1, half * 2 - 1, "#FFD11B");
          }
          block(sliceX + 11, sliceY - 5, 2, 11, "#B87421");
          block(sliceX + 7, sliceY - 2, 2, 2, "#B65319");
          block(sliceX + 9, sliceY + 2, 2, 2, "#B65319");
        }
        if ([3, 7, 8].includes(frame)) {
          block(35 + headX, 30 + headY, 5, 1, "#864514");
          block(39 + headX, 29 + headY, 1, 1, "#FF9823");
        }
        c.restore();
      },
    );
    return output.toDataURL("image/png");
  })();
  cache.set(key, result);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  result.catch(() => {
    if (cache.get(key) === result) cache.delete(key);
  });
  return result;
}
