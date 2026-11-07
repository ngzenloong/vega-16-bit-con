"use client";
import { useEffect, useState } from "react";
import { characterSheets, type CharacterSheets } from "@/lib/character";
import Sprite from "./Sprite";
import { NPC_APPEARANCES } from "@/lib/characters";
export { NPC_APPEARANCES } from "@/lib/characters";
export default function NpcSprite({ id }: { id: string }) {
  const [sheets, setSheets] = useState<CharacterSheets>({
    idle: "/assets/vega/sam-idle.png",
    run: "/assets/vega/sam-run.png",
    jump: "/assets/vega/sam-jump.png",
  });
  useEffect(() => {
    let active = true;
    void characterSheets(NPC_APPEARANCES[id] || NPC_APPEARANCES.guide)
      .then((s) => {
        if (active) setSheets(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <span className="npc-facing">
      <Sprite name="sam-idle" src={sheets.idle} className="npc-pose-idle" />
      <Sprite name="sam-run" src={sheets.run} className="npc-pose-run" />
    </span>
  );
}
