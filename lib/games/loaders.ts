import type { GameId } from "../types";
export const gameLoaders = {
  breaker: () => import("./breaker"),
  runner: () => import("./runner"),
  kart: () => import("./kart"),
  beat: () => import("./beat"),
} satisfies Record<GameId, () => Promise<unknown>>;
