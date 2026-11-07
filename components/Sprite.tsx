import type { CSSProperties } from "react";
import { SPRITES } from "@/lib/assets";
export default function Sprite({
  name,
  scale = 2,
  flip = false,
  className = "",
  style,
  src,
}: {
  name: string;
  scale?: number;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
  src?: string;
}) {
  const a = SPRITES[name];
  if (!a) return null;
  const variables = {
    "--sprite-width": `${a.width * scale}px`,
    "--sprite-height": `${a.height * scale}px`,
    "--sheet-width": `${a.width * a.frames * scale}px`,
    "--sprite-duration": `${a.frames / (a.fps || 1)}s`,
    "--sprite-steps": a.frames,
    "--sprite-end": `${-a.width * a.frames * scale}px`,
    backgroundImage: `url("${src || a.src}")`,
    transform: flip ? "scaleX(-1)" : undefined,
    ...style,
  } as CSSProperties;
  return (
    <span
      className={`sprite ${a.frames > 1 && a.fps ? "sprite-animated" : ""} ${className}`}
      style={variables}
      aria-hidden="true"
    />
  );
}
