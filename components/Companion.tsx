import type { CSSProperties } from "react";
import Sprite from "./Sprite";
import { COMPANIONS } from "@/lib/companions";
import { SPRITES } from "@/lib/assets";

export default function Companion({
  kind = 0,
  className = "",
}: {
  kind?: number;
  className?: string;
}) {
  const pet = COMPANIONS[kind];
  if (!pet) return null;
  const asset = SPRITES[pet.idle];
  const runAsset = SPRITES[pet.run];
  return (
    <span
      className={`companion ${pet.run !== pet.idle ? "companion-walker" : ""} ${className}`}
      data-floating={pet.floating}
      style={
        {
          width: Math.max(asset.width, runAsset.width) * pet.scale,
          height: Math.max(asset.height, runAsset.height) * pet.scale,
          "--pet-baseline": `${(asset.height - pet.ground) * pet.scale}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <Sprite
        name={pet.idle}
        scale={pet.scale}
        className="companion-idle"
        pose={pet.run !== pet.idle ? "idle" : undefined}
        style={{ position: "absolute", bottom: 0, left: "50%", marginLeft: -asset.width * pet.scale / 2 }}
      />
      {pet.run !== pet.idle && (
        <Sprite
          name={pet.run}
          scale={pet.scale}
          className="companion-run"
          pose="run"
          style={{ position: "absolute", bottom: 0, left: "50%", marginLeft: -runAsset.width * pet.scale / 2 }}
        />
      )}
    </span>
  );
}
