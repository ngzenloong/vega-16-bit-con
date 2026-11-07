import type { GameId } from "./types";

export const SCENE = {
  width: 2880,
  scale: 2,
  walkline: 88,
  booth: 1440,
  lift: 520,
} as const;
export type Machine = {
  id: GameId;
  x: number;
  label: string;
  asset: string;
  width: number;
  height: number;
  screen: readonly [number, number, number, number];
};
export const MACHINES: readonly Machine[] = [
  {
    id: "breaker",
    x: 720,
    label: "16-BIT ARCADE",
    asset: "arcade-machine.png",
    width: 53,
    height: 87,
    screen: [14, 24, 20, 15],
  },
  {
    id: "runner",
    x: 1040,
    label: "MEGA DRIVE",
    asset: "mega-drive-machine.svg",
    width: 58,
    height: 90,
    screen: [21, 12, 28, 21],
  },
  {
    id: "kart",
    x: 1860,
    label: "SNES",
    asset: "snes-machine.svg",
    width: 72,
    height: 82,
    screen: [24, 11, 36, 27],
  },
  {
    id: "beat",
    x: 2240,
    label: "MEGA-CD",
    asset: "mega-cd-machine.svg",
    width: 68,
    height: 94,
    screen: [25, 14, 32, 24],
  },
];
