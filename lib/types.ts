export type GameId = "breaker" | "runner" | "kart" | "beat";
export type OutfitPart =
  | "hat"
  | "glasses"
  | "shirt"
  | "neck"
  | "bag"
  | "shoes"
  | "item"
  | "companion";
export interface Appearance {
  hat: number;
  glasses: number;
  shirt: number;
  neck?: number;
  bag?: number;
  shoes?: number;
  item?: number;
  companion?: number;
}
export interface Player {
  name: string;
  email?: string;
  appearance: Appearance;
  interests: number[];
}
export interface GameResult {
  id: GameId;
  score: number;
  won: boolean;
  detail: string;
}
export type Scores = Partial<Record<GameId, number>>;
export const GAME_DURATION = {
  breaker: 60,
  runner: 60,
  kart: 55,
  beat: 32,
} as const;
export const DEFAULT_APPEARANCE: Appearance = {
  hat: 0,
  glasses: 0,
  shirt: 0,
  neck: 0,
  bag: 0,
  shoes: 0,
  item: 0,
  companion: 0,
};
export const GAMES: {
  id: GameId;
  machine: string;
  name: string;
  instructions: string;
  controls: string;
  action: string;
  secondary: string;
}[] = [
  {
    id: "breaker",
    machine: "16-BIT ARCADE / SYSTEM 16",
    name: "Daisy Breaker",
    instructions:
      "Break all 24 Legacy Stack blocks with three balls. The 60-second timer runs while your ball is in play.",
    controls: "← → Move · Space Launch",
    action: "LAUNCH",
    secondary: "PAUSE",
  },
  {
    id: "runner",
    machine: "16-BIT / MEGA DRIVE",
    name: "Cartridge Run",
    instructions:
      "Bring five query cartridges to Booth 630 in 60 seconds. You have three lives. Stomp a SIEM bot for a Post-SIEM badge and 50 points. The halfway flag saves a checkpoint.",
    controls: "← → Move · Space Jump",
    action: "JUMP",
    secondary: "PAUSE",
  },
  {
    id: "kart",
    machine: "16-BIT / SNES",
    name: "Sam Circuit",
    instructions:
      "Beat all 11 rivals in 55 seconds. Drive the PostSIEM.com Fiat, use yellow boosts to catch S-Cargo, and avoid heavy collision slowdowns.",
    controls: "← → Steer · ↑ / Space Gas · ↓ Brake",
    action: "GAS",
    secondary: "BRAKE",
  },
  {
    id: "beat",
    machine: "16-BIT / MEGA DRIVE + MEGA-CD",
    name: "Sam’s Beat",
    instructions:
      "Follow 24 notes at an easy pace. Tap the matching direction when an arrow reaches its target. Reach 60% accuracy for a Post-SIEM clear.",
    controls: "← ↓ ↑ → or A S W D · Follow the visual pulse",
    action: "PAUSE",
    secondary: "PAUSE",
  },
];
export const SESSIONS = [
  { time: "10:00 AM", title: "The Future of Retro", kind: "Opening keynote" },
  {
    time: "2:00 PM",
    title: "Pixel Art in the Age of AI",
    kind: "Panel discussion",
  },
  { time: "6:00 PM", title: "Vega After Party", kind: "Booth 630" },
];
