export type RivalCar = {
  id: string;
  label: string;
  model: string;
  bodyWidth: number;
  asset: string;
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
    id: "smart",
    label: "SMART",
    model: "Smart Fortwo",
    bodyWidth: 62,
    asset: "car-smart.svg",
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
  const start =
    ((Math.floor(round) % RIVAL_CARS.length) + RIVAL_CARS.length) %
    RIVAL_CARS.length;
  return [...RIVAL_CARS.slice(start), ...RIVAL_CARS.slice(0, start)];
}

/** Scale the previous two-Fiat contact width to the new rival's actual silhouette. */
export function carContactWidth(bodyWidth = 74) {
  return (0.27 * (74 + bodyWidth)) / 148;
}
