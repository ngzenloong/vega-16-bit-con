import type { Appearance } from "./types";
export type CharacterSheets = { idle: string; run: string; jump: string };
const cache = new Map<string, Promise<CharacterSheets>>();
const images = new Map<string, Promise<HTMLImageElement>>();
const portraits = new Map<string, Promise<string>>();
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
    p.catch(() => images.delete(src));
  }
  return p;
}
function color(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function compose(image: HTMLImageElement, appearance: Appearance) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  c.drawImage(image, 0, 0);
  const glassesColor = appearance.glasses
    ? color(["", "#ffd11b", "#fffaeb", "#32402d"][appearance.glasses])
    : null;
  const shirtColor = appearance.shirt
    ? color(["", "#276219", "#ffd11b", "#e5e0ce"][appearance.shirt])
    : null;
  const data = c.getImageData(0, 0, canvas.width, canvas.height),
    p = data.data;
  const frames = Math.floor(image.width / 60),
    eyes: { x: number; y: number; bottom: number }[] = [];
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
    };
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
        )
          target = shirtColor;
        if (target) {
          const shade = Math.max(0.5, Math.min(1.15, (r + g + b) / 300));
          p[k] = Math.min(255, target[0] * shade);
          p[k + 1] = Math.min(255, target[1] * shade);
          p[k + 2] = Math.min(255, target[2] * shade);
        }
      }
  }
  c.putImageData(data, 0, 0);
  if (appearance.hat)
    eyes.forEach((a, frame) => {
      const x = frame * 60 + a.x - 11,
        y = Math.max(2, a.y - 9);
      c.fillStyle = "#151514";
      if (appearance.hat === 1) {
        c.fillRect(x, y + 3, 22, 7);
        c.fillRect(x + 1, y, 16, 6);
        c.fillStyle = "#ff9823";
        c.fillRect(x + 3, y + 2, 12, 6);
        c.fillRect(x + 1, y + 7, 20, 2);
      }
      if (appearance.hat === 2) {
        c.fillRect(x + 3, y, 15, 8);
        c.fillRect(x, y + 6, 22, 4);
        c.fillStyle = "#fffaeb";
        c.fillRect(x + 5, y + 1, 11, 6);
        c.fillRect(x + 1, y + 7, 20, 2);
        c.fillStyle = "#0d5500";
        c.fillRect(x + 4, y + 5, 13, 2);
      }
      if (appearance.hat === 3) {
        c.fillRect(x + 1, y + 2, 21, 3);
        c.fillRect(x, y + 3, 4, 14);
        c.fillRect(x + 19, y + 3, 4, 14);
        c.fillStyle = "#ffd11b";
        c.fillRect(x + 2, y + 6, 4, 8);
        c.fillRect(x + 17, y + 6, 4, 8);
      }
    });
  return canvas.toDataURL("image/png");
}
export function characterSheets(
  appearance: Appearance,
): Promise<CharacterSheets> {
  const key = JSON.stringify(appearance);
  let pending = cache.get(key);
  if (!pending) {
    pending = Promise.all(
      ["idle", "run", "jump"].map(async (pose) => {
        const src = `/assets/vega/sam-${pose}.png`;
        if (!appearance.hat && !appearance.glasses && !appearance.shirt)
          return src;
        return compose(await loadImage(src), appearance);
      }),
    ).then(([idle, run, jump]) => ({ idle, run, jump }));
    cache.set(key, pending);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    pending.catch(() => cache.delete(key));
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
          return compose(await loadImage(canvas.toDataURL()), appearance);
        },
      );
    }
    portraits.set(key, pending);
    pending.catch(() => portraits.delete(key));
  }
  return pending;
}
