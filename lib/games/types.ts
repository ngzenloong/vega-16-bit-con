import type { GameId, GameResult } from "../types";
export type GameButton =
  | "left"
  | "right"
  | "up"
  | "down"
  | "action"
  | "secondary";
export interface GameInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  secondary: boolean;
  axis: number;
}
export interface GameHUD {
  score: number;
  time: number;
  lives?: number;
  progress?: number;
  message?: string;
}
export interface GameEnvironment {
  viewport?: { width: number; height: number };
  sprite: HTMLImageElement;
  rivals?: HTMLImageElement[];
  cars?: HTMLImageElement[];
  tapOffset?: number;
  sprites?: {
    idle: HTMLImageElement;
    run: HTMLImageElement;
    jump: HTMLImageElement;
  };
  logo?: HTMLImageElement;
  logoLight?: HTMLImageElement;
  backdrop?: HTMLImageElement;
  reducedMotion?: boolean;
  inputMode?: "keyboard" | "touch";
  motor?: (speed: number) => void;
  sound: (effect: string) => void;
  finish: (result: GameResult) => void;
  appearance: { hat: number; glasses: number; shirt: number };
}
export interface GameController {
  resize?: (width: number, height: number) => void;
  update: (dt: number, input: GameInput, time: number) => void;
  draw: (ctx: CanvasRenderingContext2D, time: number) => void;
  press: (button: GameButton, at?: number) => void;
  hud: () => GameHUD;
  attractInput?: (time: number) => {
    held: Partial<GameInput>;
    press?: { key: GameButton; at?: number }[];
  };
}
export type GameFactory = (env: GameEnvironment) => GameController;
export const WIDTH = 640,
  HEIGHT = 400;
export const COLORS = {
  ink: "#0f3301",
  paper: "#fffaeb",
  yellow: "#ffd11b",
  green: "#0d5500",
  lime: "#d5fb19",
  orange: "#ff9823",
  sky: "#8dcaff",
};
export function drawSam(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size = 48,
  flip = false,
  frame = 0,
) {
  ctx.save();
  ctx.translate(x + size / 2, y);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(
    image,
    (frame % Math.max(1, Math.floor((image.width || 60) / 60))) * 60,
    0,
    60,
    60,
    -size / 2,
    0,
    size,
    size,
  );
  ctx.restore();
}
export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 16,
  color = COLORS.ink,
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "PP Mondwest",serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
export function finishOnce(env: GameEnvironment, id: GameId) {
  let finished = false;
  return (score: number, won: boolean, detail: string) => {
    if (!finished) {
      finished = true;
      env.sound(won ? "win" : "lose");
      env.finish({ id, score, won, detail });
    }
  };
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  env: GameEnvironment,
  x: number,
  y: number,
  size: number,
  pose: "idle" | "run" | "jump",
  time: number,
  flip = false,
) {
  const image = env.sprites?.[pose] || env.sprite;
  drawSam(
    ctx,
    image,
    x,
    y,
    size,
    flip,
    env.reducedMotion && pose === "idle"
      ? 0
      : Math.floor(time * (pose === "run" ? 10 : 8)),
  );
}
export function drawBrand(
  ctx: CanvasRenderingContext2D,
  env: GameEnvironment,
  x: number,
  y: number,
  width = 78,
  light = false,
) {
  const image = light ? env.logoLight : env.logo;
  if (image)
    ctx.drawImage(image, x, y, width, width * (image.height / image.width));
}
