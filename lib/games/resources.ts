import { characterSheets, loadImage } from "../character";
import type { Appearance } from "../types";
import { selectRivalCars, ALL_CARS, FIAT } from "./cars";
import { daylightBackdrop } from "./scenery";
import { prepareGameFont } from "../game-font";
export async function gameResources(
  appearance: Appearance,
  racing = false,
  grid = 0,
  carId = FIAT.id,
) {
  const playerCar = ALL_CARS.find((car) => car.id === carId) || FIAT;
  const rivalCars = racing ? selectRivalCars(grid, playerCar.id) : [];
  const playerAsset =
    playerCar.id === FIAT.id || playerCar.id === "scargo"
      ? playerCar.asset
      : playerCar.asset.replace(".svg", "-player.svg");
  const [
    sheets,
    logo,
    logoLight,
    backdrop,
    cars,
    cityBlocks,
    cityBlocksDistant,
    mascot,
  ] = await Promise.all([
    characterSheets(appearance),
    loadImage("/assets/vega/logo.svg"),
    loadImage("/assets/vega/logo-light.svg"),
    daylightBackdrop(),
    racing
      ? Promise.all(
          [playerAsset, ...rivalCars.map((car) => car.asset)].map((asset) =>
            loadImage(`/assets/vega/${asset}`),
          ),
        )
      : Promise.resolve([]),
    daylightBackdrop(true),
    racing ? daylightBackdrop("street-far") : Promise.resolve(undefined),
    loadImage("/assets/vega/sam-portrait.png"),
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
    cityBlocks,
    cityBlocksDistant,
    mascot,
    cars,
    rivalCars,
    playerCar,
  };
}
