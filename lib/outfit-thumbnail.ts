import type { OutfitPart } from "./types";
import {
  decorateOutfit,
  GLASS_COLORS,
  SHOE_COLORS,
  shirtPixel,
} from "./outfit-art";
import { DEFAULT_APPEARANCE } from "./types";
import { loadImage } from "./character";
import { COMPANIONS } from "./companions";
import { SPRITES } from "./assets";
const thumbnails = new Map<string, Promise<string>>();
export function outfitThumbnail(part: OutfitPart, index: number) {
  const key = `${part}:${index}`;
  let pending = thumbnails.get(key);
  if (!pending) {
    pending = (async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 72;
      const c = canvas.getContext("2d")!;
      c.imageSmoothingEnabled = false;
      if (part === "companion" && index) {
        const pet = COMPANIONS[index]!,
          asset = SPRITES[pet.idle];
        const scale = asset.width > 30 ? 1 : 2;
        c.drawImage(
          await loadImage(asset.src),
          0,
          0,
          asset.width,
          asset.height,
          (72 - asset.width * scale) / 2,
          (72 - asset.height * scale) / 2,
          asset.width * scale,
          asset.height * scale,
        );
      } else if (!index && part !== "glasses") {
        c.strokeStyle = "#647958";
        c.lineWidth = 2;
        c.strokeRect(24, 24, 24, 24);
        c.beginPath();
        c.moveTo(25, 47);
        c.lineTo(47, 25);
        c.stroke();
      } else if (part === "shirt") {
        const anchor = { x: 36, y: 13, bottom: 18, feet: 60 };
        for (let y = 27; y < 60; y++)
          for (let x = 13; x < 59; x++) {
            if (y > 39 && (x < 22 || x > 49)) continue;
            c.fillStyle =
              x === 13 ||
              x === 58 ||
              y === 27 ||
              y === 59 ||
              (y > 39 && (x === 22 || x === 49))
                ? "#151514"
                : shirtPixel(index, x, y, anchor) || "#B87421";
            c.fillRect(x, y, 1, 1);
          }
      } else if (part === "shoes") {
        for (const x of [13, 39]) {
          c.fillStyle = "#151514";
          c.fillRect(x, 29, 20, 17);
          c.fillStyle = SHOE_COLORS[index];
          c.fillRect(x + 2, 31, 16, 12);
          c.fillStyle = "#FFFAEB";
          c.fillRect(x + 2, 40, 16, 3);
        }
      } else if (part === "glasses" && index < 5) {
        c.fillStyle = "#151514";
        c.fillRect(12, 25, 21, 19);
        c.fillRect(39, 25, 21, 19);
        c.fillRect(32, 30, 8, 3);
        c.fillStyle = GLASS_COLORS[index] || "#75a70d";
        c.fillRect(14, 27, 17, 15);
        c.fillRect(41, 27, 17, 15);
        c.fillStyle = "#151514";
        c.fillRect(24, 30, 3, 8);
        c.fillRect(51, 30, 3, 8);
      } else {
        const anchor = {
          x: 36,
          y: part === "hat" ? 37 : 25,
          bottom: part === "bag" ? 17 : 23,
          feet: 62,
        };
        decorateOutfit(c, { ...DEFAULT_APPEARANCE, [part]: index }, anchor);
      }
      {
        const data = c.getImageData(0, 0, 72, 72).data;
        let left = 72,
          top = 72,
          right = 0,
          bottom = 0;
        for (let y = 0; y < 72; y++)
          for (let x = 0; x < 72; x++)
            if (data[(y * 72 + x) * 4 + 3]) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
        const width = right - left + 1,
          height = bottom - top + 1;
        if (width > 0 && height > 0) {
          const scale = Math.max(
            1,
            Math.min(3, Math.floor(60 / Math.max(width, height))),
          );
          const icon = document.createElement("canvas");
          icon.width = icon.height = 72;
          const context = icon.getContext("2d")!;
          context.imageSmoothingEnabled = false;
          context.drawImage(
            canvas,
            left,
            top,
            width,
            height,
            Math.floor((72 - width * scale) / 2),
            Math.floor((72 - height * scale) / 2),
            width * scale,
            height * scale,
          );
          return icon.toDataURL("image/png");
        }
      }
      return canvas.toDataURL("image/png");
    })();
    thumbnails.set(key, pending);
    pending.catch(() => thumbnails.delete(key));
  }
  return pending;
}
