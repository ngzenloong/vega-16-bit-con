import type { Appearance } from "./types";
export const NPC_APPEARANCES: Record<string, Appearance> = {
  host: { hat: 2, glasses: 2, shirt: 1 },
  collector: { hat: 1, glasses: 1, shirt: 3 },
  racer: { hat: 3, glasses: 3, shirt: 2 },
  artist: { hat: 2, glasses: 1, shirt: 3 },
  merch: { hat: 8, glasses: 6, shirt: 6, neck: 3 },
  guide: { hat: 1, glasses: 2, shirt: 1 },
  coffee: { hat: 0, glasses: 3, shirt: 3 },
  analyst: { hat: 0, glasses: 2, shirt: 1 },
  pingpong_jules: { hat: 3, glasses: 0, shirt: 3 },
  chess_nico: { hat: 1, glasses: 3, shirt: 1 },
};
