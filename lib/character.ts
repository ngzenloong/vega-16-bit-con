import type { Appearance } from "./types";
import { completeAppearance } from "./appearance";
import {
  decorateOutfit,
  GLASS_COLORS,
  SHOE_COLORS,
  shirtPixel,
  type OutfitAnchor,
} from "./outfit-art";
export type CharacterSheets = { idle: string; run: string; jump: string };
const cache = new Map<string, Promise<CharacterSheets>>();
const images = new Map<string, Promise<HTMLImageElement>>();
const portraits = new Map<string, Promise<string>>();
const colors = new Map<string, number[]>();
export function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(Error(`Could not load ${src}`));
      i.src = src;
    });
    images.set(src, p);
    if (images.size > 128) {
      const oldest = [...images.keys()].find((key) => key.startsWith("data:"));
      if (oldest && oldest !== src) images.delete(oldest);
    }
    p.catch(() => {
      if (images.get(src) === p) images.delete(src);
    });
  }
  return p;
}
function color(hex: string) {
  const cached = colors.get(hex);
  if (cached) return cached;
  const rgb = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  colors.set(hex, rgb);
  return rgb;
}
function compose(
  image: HTMLImageElement,
  appearance: Appearance,
  portrait = false,
) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  c.drawImage(image, 0, 0);
  const glassesColor = appearance.glasses
    ? color(GLASS_COLORS[appearance.glasses])
    : null;
  const shoeColor = appearance.shoes
    ? color(SHOE_COLORS[appearance.shoes])
    : null;
  const data = c.getImageData(0, 0, canvas.width, canvas.height),
    p = data.data;
  const frames = Math.floor(image.width / 60),
    eyes: OutfitAnchor[] = [];
  for (let frame = 0; frame < frames; frame++) {
    let minX = 60,
      maxX = 0,
      minY = 60,
      maxY = 0;
    for (let y = 0; y < 38; y++)
      for (let x = 0; x < 60; x++) {
        const k = (y * canvas.width + frame * 60 + x) * 4,
          r = p[k],
          g = p[k + 1],
          b = p[k + 2];
        if (p[k + 3] > 80 && g > 85 && g > r * 0.93 && g > b * 1.35) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    const anchor = {
      x: maxX ? Math.round((minX + maxX) / 2) : 32,
      y: maxY ? minY : 17,
      bottom: maxY || 24,
      feet: 59,
    };
    feet: for (let fy = 59; fy >= 38; fy--) {
      for (let fx = 0; fx < 60; fx++)
        if (p[(fy * canvas.width + frame * 60 + fx) * 4 + 3] > 100) {
          anchor.feet = fy;
          break feet;
        }
    }
    eyes.push(anchor);
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < 60; x++) {
        const k = (y * canvas.width + frame * 60 + x) * 4,
          r = p[k],
          g = p[k + 1],
          b = p[k + 2];
        if (p[k + 3] < 100) continue;
        let target: number[] | null = null;
        if (
          appearance.glasses &&
          g > 85 &&
          g > r * 0.93 &&
          g > b * 1.35 &&
          y < 38
        )
          target = glassesColor;
        if (
          appearance.shirt &&
          y > anchor.bottom + 7 &&
          y < Math.min(50, anchor.bottom + 22) &&
          r > g * 1.12 &&
          r > b * 1.6 &&
          x > 10 &&
          x < 51
        ) {
          const fill = shirtPixel(appearance.shirt, x, y, anchor);
          target = fill ? color(fill) : null;
        }
        if (
          !portrait &&
          shoeColor &&
          y >= anchor.feet - 4 &&
          r > g * 1.12 &&
          r > b * 1.6
        )
          target = shoeColor;
        if (target) {
          const shade = Math.max(0.5, Math.min(1.15, (r + g + b) / 300));
          p[k] = Math.min(255, target[0] * shade);
          p[k + 1] = Math.min(255, target[1] * shade);
          p[k + 2] = Math.min(255, target[2] * shade);
        }
      }
  }
  c.putImageData(data, 0, 0);
  eyes.forEach((anchor, frame) => {
    c.save();
    c.beginPath();
    c.rect(frame * 60, 0, 60, 60);
    c.clip();
    c.translate(frame * 60, 0);
    decorateOutfit(c, appearance, anchor, portrait);
    c.restore();
  });
  return canvas.toDataURL("image/png");
}
export function characterSheets(
  appearance: Appearance,
): Promise<CharacterSheets> {
  const { companion: _companion, ...look } = completeAppearance(appearance);
  const key = JSON.stringify(look);
  let pending = cache.get(key);
  if (!pending) {
    pending = Promise.all(
      ["idle", "run", "jump"].map(async (pose) => {
        const src = `/assets/vega/sam-${pose}.png`;
        if (Object.values(look).every((value) => !value)) return src;
        return compose(await loadImage(src), look);
      }),
    ).then(([idle, run, jump]) => ({ idle, run, jump }));
    cache.set(key, pending);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
  }
  return pending;
}
const activityPortraits: Record<
  string,
  { sprite: string; crop: [number, number, number, number] }
> = {
  coffee: { sprite: "mole-coffee", crop: [17, 5, 22, 28] },
  analyst: { sprite: "mole-laptop", crop: [13, 0, 30, 31] },
  pingpong_jules: { sprite: "moles-ping-pong", crop: [33, 41, 25, 29] },
  chess_nico: { sprite: "moles-chess", crop: [18, 41, 24, 29] },
};
export function characterPortrait(
  appearance: Appearance,
  characterId?: string,
): Promise<string> {
  const activity = characterId ? activityPortraits[characterId] : undefined;
  const key = activity ? `activity:${characterId}` : JSON.stringify(appearance);
  let pending = portraits.get(key);
  if (!pending) {
    if (activity) {
      pending = loadImage(`/assets/vega/${activity.sprite}.png`).then(
        (image) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 40;
          const c = canvas.getContext("2d")!;
          c.imageSmoothingEnabled = false;
          const [x, y, width, height] = activity.crop;
          c.drawImage(
            image,
            x,
            y,
            width,
            height,
            Math.floor((40 - width) / 2),
            Math.floor((40 - height) / 2),
            width,
            height,
          );
          return canvas.toDataURL("image/png");
        },
      );
    } else {
      pending = loadImage("/assets/vega/sam-portrait.png").then(
        async (image) => {
          const canvas = document.createElement("canvas");
          canvas.width = 60;
          canvas.height = 60;
          canvas.getContext("2d")!.drawImage(image, 7, 8);
          return compose(await loadImage(canvas.toDataURL()), appearance, true);
        },
      );
    }
    portraits.set(key, pending);
    if (portraits.size > 32) portraits.delete(portraits.keys().next().value!);
    pending.catch(() => {
      if (portraits.get(key) === pending) portraits.delete(key);
    });
  }
  return pending;
}
