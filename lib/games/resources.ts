import { characterSheets, loadImage } from "../character";
import type { Appearance } from "../types";
import { selectRivalCars } from "./cars";
let fontReady: Promise<FontFace[]> | null = null;
let fontFailed = false;
function prepareGameFont() {
  if (!fontReady) {
    const load = fontFailed
      ? new FontFace("PP Mondwest", 'url("/fonts/mondwest.woff2")')
          .load()
          .then((face) => {
            document.fonts.add(face);
            return [face];
          })
      : document.fonts.load('16px "PP Mondwest"');
    fontReady = load.catch((error) => {
      fontFailed = true;
      fontReady = null;
      throw error;
    });
  }
  return fontReady;
}
export async function gameResources(
  appearance: Appearance,
  racing = false,
  grid = 0,
) {
  const rivalCars = racing ? selectRivalCars(grid) : [];
  const [sheets, logo, logoLight, backdrop, cars] = await Promise.all([
    characterSheets(appearance),
    loadImage("/assets/vega/logo.svg"),
    loadImage("/assets/vega/logo-light.svg"),
    loadImage("/assets/vega/city-far.png"),
    racing
      ? Promise.all(
          ["fiat-player.svg", ...rivalCars.map((car) => car.asset)].map(
            (asset) => loadImage(`/assets/vega/${asset}`),
          ),
        )
      : Promise.resolve([]),
    prepareGameFont(),
  ]);
  const [idle, run, jump] = await Promise.all(
    [sheets.idle, sheets.run, sheets.jump].map(loadImage),
  );
  return {
    sprite: idle,
    sprites: { idle, run, jump },
    logo,
    logoLight,
    backdrop,
    cars,
    rivalCars,
  };
}
