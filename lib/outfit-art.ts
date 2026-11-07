import type { Appearance } from "./types";
export type OutfitAnchor = {
  x: number;
  y: number;
  bottom: number;
  feet: number;
};
export const GLASS_COLORS = [
  "",
  "#ffd11b",
  "#fffaeb",
  "#32402d",
  "#ff9823",
  "#151514",
  "#fffaeb",
  "#d5fb19",
];
const SHIRTS = [
  "",
  "#276219",
  "#ffd11b",
  "#e5e0ce",
  "#ff9823",
  "#0d5500",
  "#fffaeb",
  "#457d07",
  "#ffd11b",
  "#75a70d",
  "#fffaeb",
  "#ff7b07",
];
export const SHOE_COLORS = ["", "#fffaeb", "#ff9823", "#0d5500", "#bcbfb6"];

export function shirtPixel(
  style: number,
  x: number,
  y: number,
  anchor: OutfitAnchor,
) {
  const dx = x - anchor.x,
    dy = y - anchor.bottom;
  let fill = SHIRTS[style];
  if (style === 3 && Math.abs(dx) > 9) fill = "#0d5500";
  if (style === 3 && dy > 19) fill = "#ffd11b";
  if (style === 4 && dx >= -6 && dx <= -3) fill = "#fffaeb";
  if (style === 4 && dx === -2) fill = "#151514";
  if (style === 5 && dy < 13 && Math.abs(dx) < 5) return null;
  if (style === 5 && dy === 14 && Math.abs(dx) < 8) fill = "#ffd11b";
  if (style === 6 && Math.abs(dx) <= 1)
    fill = dy % 5 < 2 ? "#ffd11b" : "#0d5500";
  if (style === 7 && dy > 16 && dy < 22 && Math.abs(dx) < 8) fill = "#0d5500";
  if (style === 8 && (Math.abs(dx) > 9 || dy === 18)) fill = "#fffaeb";
  if (
    style === 9 &&
    dy > 10 &&
    dy < 15 &&
    Math.abs(dx) > 4 &&
    Math.abs(dx) < 10
  )
    fill = "#0d5500";
  if (style === 10 && dy > 10 && dy < 17 && Math.abs(dx) < 7)
    fill = dx < 0 ? "#0d5500" : "#ffd11b";
  if (style === 10 && dy > 21) fill = "#8a8880";
  if (style === 11 && Math.abs(dx) < 3) return null;
  if (style === 11 && dy > 16 && Math.abs(dx) > 5) fill = "#0d5500";
  return fill;
}

/** Coordinates are local to a clipped60×60 frame; details never bleed into a neighbor. */
export function decorateOutfit(
  c: CanvasRenderingContext2D,
  look: Appearance,
  a: OutfitAnchor,
  portrait = false,
) {
  const ink = "#151514",
    paper = "#fffaeb",
    leaf = "#0d5500",
    yellow = "#ffd11b",
    orange = "#ff9823";
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const x = a.x - 11,
    y = Math.max(2, a.y - 9);
  if (look.hat === 1 || look.hat === 5) {
    r(x, y + 3, 22, 7, ink);
    r(x + 1, y, 16, 6, ink);
    r(x + 3, y + 2, 12, 6, look.hat === 1 ? orange : yellow);
    r(
      look.hat === 1 ? x + 1 : x - 5,
      y + 7,
      20,
      2,
      look.hat === 1 ? orange : yellow,
    );
  }
  if (look.hat === 2) {
    r(x + 3, y, 15, 8, ink);
    r(x, y + 6, 22, 4, ink);
    r(x + 5, y + 1, 11, 6, paper);
    r(x + 1, y + 7, 20, 2, paper);
    r(x + 4, y + 5, 13, 2, leaf);
  }
  if (look.hat === 3) {
    r(x + 1, y + 2, 21, 3, ink);
    r(x, y + 3, 4, 14, ink);
    r(x + 19, y + 3, 4, 14, ink);
    r(x + 2, y + 6, 4, 8, yellow);
    r(x + 17, y + 6, 4, 8, yellow);
  }
  if (look.hat === 4) {
    r(x + 2, y, 18, 9, ink);
    r(x + 5, y - 2, 12, 3, ink);
    r(x + 4, y + 1, 14, 7, leaf);
    r(x + 2, y + 7, 19, 3, paper);
    r(x + 7, y - 3, 7, 3, yellow);
  }
  if (look.hat === 6) {
    r(x, y + 6, 24, 4, ink);
    r(x + 2, y + 7, 25, 2, yellow);
    r(x + 2, y + 3, 4, 4, leaf);
  }
  if (look.hat === 7) {
    r(x + 1, y + 2, 21, 8, ink);
    r(x + 3, y, 3, 9, yellow);
    r(x + 10, y - 2, 3, 11, yellow);
    r(x + 17, y, 3, 9, yellow);
    r(x + 3, y + 6, 17, 3, yellow);
    r(x + 10, y + 6, 3, 2, leaf);
  }
  if (look.hat === 8) {
    r(x + 6, y - 2, 7, 15, ink);
    r(x + 2, y + 2, 15, 7, ink);
    r(x + 5, y + 1, 9, 9, leaf);
    r(x + 7, y - 1, 5, 13, paper);
    r(x + 3, y + 3, 13, 5, paper);
    r(x + 7, y + 3, 5, 5, yellow);
  }
  if (look.hat === 9) {
    r(x - 5, y + 1, 32, 4, ink);
    r(x - 7, y + 5, 4, 18, ink);
    r(x + 25, y + 5, 3, 18, ink);
    r(x - 4, y + 2, 30, 3, paper);
    r(x - 6, y + 6, 3, 16, paper);
    r(x + 25, y + 6, 2, 16, paper);
    r(x - 4, y + 21, 31, 4, paper);
    r(x - 3, y + 23, 29, 2, leaf);
  }
  if (look.glasses === 5) {
    r(a.x - 12, a.y - 1, 25, 10, ink);
    r(a.x - 10, a.y + 1, 21, 6, leaf);
    r(a.x - 8, a.y + 2, 6, 2, yellow);
    r(a.x + 2, a.y + 2, 6, 2, yellow);
  }
  if (look.glasses === 6 || look.glasses === 7) {
    for (const dx of [-9, 2]) {
      r(a.x + dx, a.y, 9, 8, ink);
      if (look.glasses === 6) {
        r(a.x + dx + 1, a.y + 1, 7, 6, paper);
        r(a.x + dx + 4, a.y + 2, 2, 4, ink);
      } else {
        r(a.x + dx + 3, a.y - 1, 3, 10, yellow);
        r(a.x + dx - 1, a.y + 3, 11, 2, yellow);
        r(a.x + dx + 4, a.y + 3, 2, 2, ink);
      }
    }
    r(a.x, a.y + 3, 3, 2, ink);
  }
  const neckY = a.bottom + 4;
  if (look.neck === 1 || look.neck === 2) {
    r(a.x - 12, neckY, 23, 4, ink);
    r(a.x - 11, neckY + 1, 21, 3, look.neck === 1 ? paper : yellow);
    r(a.x - 12, neckY + 3, 5, 9, look.neck === 1 ? paper : yellow);
  }
  if (look.neck === 3 || look.neck === 6) {
    r(a.x - 5, neckY, 2, 7, yellow);
    r(a.x + 5, neckY, 2, 7, yellow);
    r(a.x - 3, neckY + 6, 8, 9, ink);
    r(a.x - 2, neckY + 7, 6, 7, look.neck === 3 ? paper : yellow);
    r(a.x, neckY + 9, 2, 3, leaf);
  }
  if (look.neck === 4) {
    r(a.x - 10, neckY + 1, 20, 3, ink);
    r(a.x - 12, neckY, 5, 7, paper);
    r(a.x + 7, neckY, 5, 7, paper);
  }
  if (look.neck === 5) {
    r(a.x - 6, neckY, 5, 5, leaf);
    r(a.x + 2, neckY, 5, 5, leaf);
    r(a.x - 1, neckY + 1, 3, 3, yellow);
  }
  if (!portrait && look.bag) {
    c.globalCompositeOperation = "destination-over";
    const bx = a.x - 25,
      by = a.bottom + 4;
    const fill = ["", leaf, paper, orange, "#8a8880", yellow][look.bag];
    // Paint front details first: destination-over places later fills behind them.
    if (look.bag === 5) {
      for (let row = 0; row < 22; row++) {
        const width = 6 + Math.floor(row / 4) * 2;
        r(bx + 11 - width, by + row, width - 2, 1, yellow);
        r(bx + 10 - width, by + row, width, 1, ink);
      }
    } else {
      r(bx + 2, by + 10, 7, 1, ink);
      r(bx + 8, by + 4, 2, 3, yellow);
      r(bx + 1, by + 2, 10, 17, fill);
      r(bx, by, 12, 21, ink);
    }
    c.globalCompositeOperation = "source-over";
    if (look.bag !== 5) r(a.x - 9, a.bottom + 6, 2, 15, fill);
  }
  if (!portrait && look.item) {
    const ix = Math.min(45, a.x + 12),
      iy = Math.min(43, a.bottom + 12);
    if (look.item === 1) {
      r(ix, iy, 10, 11, ink);
      r(ix + 1, iy + 1, 8, 8, paper);
      r(ix + 9, iy + 2, 3, 5, paper);
      r(ix + 3, iy - 4, 1, 3, paper);
    }
    if (look.item === 2) {
      r(ix - 3, iy, 17, 8, ink);
      r(ix - 2, iy + 1, 15, 5, paper);
      r(ix, iy + 2, 3, 2, leaf);
      r(ix + 8, iy + 2, 2, 2, orange);
      r(ix + 11, iy + 3, 2, 2, yellow);
    }
    if (look.item === 3) {
      r(ix, iy - 2, 10, 13, ink);
      r(ix + 1, iy, 8, 7, yellow);
      r(ix + 3, iy + 1, 4, 3, leaf);
    }
    if (look.item === 4) {
      r(ix - 5, iy, 20, 8, ink);
      r(ix - 4, iy + 1, 18, 6, paper);
      for (let n = 0; n < 6; n++) r(ix - 3 + n * 3, iy + 2, 1, 3, ink);
    }
    if (look.item === 5) {
      r(ix - 1, iy - 1, 13, 3, orange);
      r(ix, iy + 2, 10, 3, yellow);
      r(ix + 2, iy + 5, 6, 3, yellow);
      r(ix + 4, iy + 8, 2, 3, yellow);
      r(ix + 2, iy + 2, 2, 2, orange);
      r(ix + 6, iy + 4, 2, 2, orange);
    }
    if (look.item === 6) {
      r(ix, iy - 15, 2, 27, ink);
      r(ix + 2, iy - 15, 12, 10, leaf);
      r(ix + 6, iy - 13, 4, 6, paper);
      r(ix + 4, iy - 11, 8, 2, paper);
      r(ix + 7, iy - 11, 2, 2, yellow);
    }
    if (look.item === 7) {
      r(ix + 1, iy - 8, 2, 20, leaf);
      r(ix - 2, iy - 11, 8, 3, yellow);
      r(ix, iy - 14, 3, 9, yellow);
      r(ix + 1, iy - 10, 2, 2, paper);
    }
  }
}
