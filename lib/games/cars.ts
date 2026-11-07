export type RivalCar = {
  id: string;
  label: string;
  model: string;
  bodyWidth: number;
  asset: string;
};
export const SPEED_UNITS = 8;
export type DriverProfile = {
  topSpeed: number;
  acceleration: number;
  handling: number;
  braking: number;
};
export const PLAYER_PROFILE: DriverProfile = {
  topSpeed: 165,
  acceleration: 900,
  handling: 0.8,
  braking: 1750,
};
// Fictional arcade ratings: one source for physics, speed displays and garage stats.
export const DRIVER_PROFILES: Record<string, DriverProfile> = {
  scargo: { topSpeed: 163, acceleration: 840, handling: 1, braking: 2050 },
  az1: { topSpeed: 161, acceleration: 1020, handling: 0.86, braking: 2300 },
  mini: { topSpeed: 156, acceleration: 980, handling: 1, braking: 2400 },
  figaro: { topSpeed: 159, acceleration: 650, handling: 0.74, braking: 1600 },
  be1: { topSpeed: 153, acceleration: 950, handling: 0.8, braking: 2050 },
  pao: { topSpeed: 149, acceleration: 730, handling: 0.9, braking: 2000 },
  "sambar-van": {
    topSpeed: 146,
    acceleration: 780,
    handling: 0.6,
    braking: 1700,
  },
  "sambar-truck": {
    topSpeed: 148,
    acceleration: 800,
    handling: 0.66,
    braking: 1800,
  },
  midget: { topSpeed: 141, acceleration: 1050, handling: 0.8, braking: 2200 },
  isetta: { topSpeed: 137, acceleration: 900, handling: 0.84, braking: 2100 },
  p50: { topSpeed: 132, acceleration: 850, handling: 0.9, braking: 2200 },
};
export const RIVAL_CARS: readonly RivalCar[] = [
  {
    id: "mini",
    label: "MINI",
    model: "Classic Mini Cooper",
    bodyWidth: 59,
    asset: "car-mini.svg",
  },
  {
    id: "az1",
    label: "AZ-1",
    model: "Autozam AZ-1",
    bodyWidth: 64,
    asset: "car-az1.svg",
  },
  {
    id: "isetta",
    label: "ISETTA",
    model: "BMW Isetta",
    bodyWidth: 46,
    asset: "car-isetta.svg",
  },
  {
    id: "p50",
    label: "P50",
    model: "Peel P50",
    bodyWidth: 38,
    asset: "car-p50.svg",
  },
  {
    id: "sambar-van",
    label: "SAMBAR VAN",
    model: "Subaru Sambar van",
    bodyWidth: 60,
    asset: "car-sambar-van.svg",
  },
  {
    id: "sambar-truck",
    label: "SAMBAR TRK",
    model: "Subaru Sambar kei truck",
    bodyWidth: 60,
    asset: "car-sambar-truck.svg",
  },
  {
    id: "midget",
    label: "MIDGET II",
    model: "Daihatsu Midget II",
    bodyWidth: 46,
    asset: "car-midget.svg",
  },
  {
    id: "be1",
    label: "BE-1",
    model: "Nissan Be-1",
    bodyWidth: 64,
    asset: "car-be1.svg",
  },
  {
    id: "pao",
    label: "PAO",
    model: "Nissan Pao",
    bodyWidth: 63,
    asset: "car-pao.svg",
  },
  {
    id: "figaro",
    label: "FIGARO",
    model: "Nissan Figaro",
    bodyWidth: 67,
    asset: "car-figaro.svg",
  },
  {
    id: "scargo",
    label: "S-CARGO",
    model: "Nissan S-Cargo",
    bodyWidth: 68,
    asset: "car-scargo.svg",
  },
];
export function selectRivalCars(round: number) {
  const start = Math.floor(round) >>> 0;
  const grid = [...RIVAL_CARS];
  let seed = Math.imul(start + 1, 2654435761) >>> 0;
  for (let i = grid.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

/** Scale the previous two-Fiat contact width to the new rival's actual silhouette. */
export function carContactWidth(bodyWidth = 74) {
  return (0.27 * (74 + bodyWidth)) / 148;
}
