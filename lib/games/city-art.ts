import { CITY_COLORS, type GameEnvironment } from "./types.ts";

// Original facade crop, side-face width and the first front-wall row.
export const FACADE_CROPS = [
  [118, 166, 34, 58],
  [334, 180, 28, 134],
  [543, 159, 24, 72],
  [729, 192, 26, 48],
  [947, 132, 30, 96],
] as const;
const murals = new WeakMap<GameEnvironment, Map<number, HTMLCanvasElement>>();

function cityMural(env: GameEnvironment, variant: number) {
  let set = murals.get(env);
  if (!set) {
    set = new Map();
    murals.set(env, set);
  }
  const saved = set.get(variant);
  if (saved) return saved;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  if (variant % 2 === 0 && env.logoLight) {
    const image = env.logoLight;
    c.drawImage(
      image,
      image.width * 0.712,
      0,
      image.width * 0.288,
      image.height * 0.81,
      0,
      8,
      64,
      70,
    );
    c.fillStyle = "#FFD11B";
    c.fillRect(10, 76, 2, 12);
    c.fillRect(48, 71, 2, 19);
  } else {
    const image = env.mascot || env.sprite;
    const mask = document.createElement("canvas");
    mask.width = 64;
    mask.height = 96;
    const m = mask.getContext("2d")!;
    m.imageSmoothingEnabled = false;
    m.drawImage(image, 0, 0, image.width, image.height * 0.72, 1, 10, 62, 68);
    m.globalCompositeOperation = "source-in";
    m.fillStyle = "#FFFAEB";
    m.fillRect(0, 0, 64, 96);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      c.drawImage(mask, dx, dy);
    c.drawImage(image, 0, 0, image.width, image.height * 0.72, 1, 10, 62, 68);
  }
  // Pixel overspray and small drips make the mark part of the painted wall.
  c.fillStyle = "#FFFAEB";
  for (const [x, y] of [
    [3, 18],
    [59, 28],
    [8, 55],
    [54, 61],
    [18, 66],
  ])
    c.fillRect(x, y, 2, 2);
  set.set(variant, canvas);
  return canvas;
}

type FacadeOptions = { flip?: boolean; distant?: boolean };
/** A glazed front and a blank side wall share a roof and ground plane. */
export function drawFacade(
  c: CanvasRenderingContext2D,
  env: GameEnvironment,
  x: number,
  y: number,
  width: number,
  height: number,
  facade: number,
  mural: number | null,
  options: FacadeOptions = {},
) {
  const { flip = false, distant = false } = options;
  const texture = distant
    ? env.cityBlocksDistant || env.cityBlocks
    : env.cityBlocks;
  if (!texture) return;
  const [sx, sw, sourceSide, frontTop] =
    FACADE_CROPS[facade % FACADE_CROPS.length];
  const side = width * 0.34,
    front = width - side,
    slant = side * 0.36;
  const frontX = x + (flip ? 0 : side),
    sideX = x + (flip ? front : 0);
  const points = flip
    ? [
        [sideX, y + slant],
        [x + width, y],
        [x + width, y + height],
        [sideX, y + height],
      ]
    : [
        [x, y],
        [x + side, y + slant],
        [x + side, y + height],
        [x, y + height],
      ];
  const path = (vertices: number[][]) => {
    c.beginPath();
    vertices.forEach(([px, py], i) =>
      i
        ? c.lineTo(Math.round(px), Math.round(py))
        : c.moveTo(Math.round(px), Math.round(py)),
    );
    c.closePath();
  };
  path(points);
  c.fillStyle = distant ? CITY_COLORS.sideDistant : CITY_COLORS.side;
  c.fill();
  c.drawImage(
    texture,
    sx + sourceSide,
    frontTop,
    sw - sourceSide,
    texture.height - frontTop,
    Math.round(frontX),
    Math.round(y + slant),
    Math.round(front),
    Math.round(height - slant),
  );
  path(
    flip
      ? [
          [x, y + slant],
          [x + side, y],
          [x + width, y],
          [x + front, y + slant],
        ]
      : [
          [x, y],
          [x + front, y],
          [x + width, y + slant],
          [x + side, y + slant],
        ],
  );
  c.fillStyle = distant ? CITY_COLORS.roofDistant : CITY_COLORS.roof;
  c.fill();
  if (mural !== null) {
    const art = cityMural(env, mural);
    const w = side * 0.9,
      h = (w / 0.66) * 1.5,
      margin = side * 0.05;
    c.save();
    path(points);
    c.clip();
    const top =
      y + height * 0.19 + (flip ? slant - margin * 0.36 : margin * 0.36);
    // The mural is painted only inside the blank side wall.
    c.transform(
      w / art.width,
      ((flip ? -1 : 1) * w * 0.36) / art.width,
      0,
      h / art.height,
      sideX + margin,
      top,
    );
    c.drawImage(art, 0, 0);
    c.restore();
  }
}
