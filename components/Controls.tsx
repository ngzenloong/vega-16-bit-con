"use client";
import { useEffect, useRef, useState } from "react";
import type { GameButton } from "@/lib/games/types";
export type ControlPress = (
  key: GameButton,
  down: boolean,
  source?: string,
  timeStamp?: number,
) => void;
export default function Controls({
  onPress,
  action = "INTERACT",
  secondary = "JUMP",
  disabled = false,
}: {
  onPress: ControlPress;
  action?: string;
  secondary?: string;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState<Set<GameButton>>(new Set());
  const callback = useRef(onPress);
  callback.current = onPress;
  const owners = useRef(new Map<string, GameButton>());
  const sync = () => setPressed(new Set(owners.current.values()));
  const release = (source: string, stamp?: number) => {
    const key = owners.current.get(source);
    if (!key) return;
    owners.current.delete(source);
    callback.current(key, false, source, stamp);
    sync();
  };
  const releaseAll = () => {
    for (const [source, key] of owners.current)
      callback.current(key, false, source);
    owners.current.clear();
    sync();
  };
  useEffect(() => {
    const clear = () => releaseAll();
    const up = (e: KeyboardEvent) => release(`pad-key:${e.code}`, e.timeStamp);
    window.addEventListener("blur", clear);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", clear);
      for (const [source, key] of owners.current)
        callback.current(key, false, source);
      owners.current.clear();
    };
    // Ownership is held in refs; callbacks always resolve to the latest controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled]);
  const press = (key: GameButton, source: string, stamp: number) => {
    if (owners.current.has(source)) return;
    owners.current.set(source, key);
    sync();
    callback.current(key, true, source, stamp);
  };
  const button = (key: GameButton, label: string, content: string) => (
    <button
      type="button"
      key={key}
      className={`pad-button pad-${key}`}
      aria-label={label}
      disabled={disabled}
      data-pressed={pressed.has(key)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(key, `pad-pointer:${e.pointerId}`, e.timeStamp);
      }}
      onPointerUp={(e) => release(`pad-pointer:${e.pointerId}`, e.timeStamp)}
      onPointerCancel={(e) =>
        release(`pad-pointer:${e.pointerId}`, e.timeStamp)
      }
      onLostPointerCapture={(e) =>
        release(`pad-pointer:${e.pointerId}`, e.timeStamp)
      }
      onKeyDown={(e) => {
        if (e.key === "Tab") releaseAll();
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          press(key, `pad-key:${e.code}`, e.timeStamp);
        }
      }}
      onBlur={() => {
        for (const source of [...owners.current.keys()])
          if (source.startsWith("pad-key:")) release(source);
      }}
    >
      {content}
    </button>
  );
  return (
    <div className="handheld-controls">
      <div className="dpad" role="group" aria-label="Directional controls">
        {button("up", "Up", "↑")}
        {button("left", "Left", "←")}
        {button("right", "Right", "→")}
        {button("down", "Down", "↓")}
      </div>
      <div className="ab-controls">
        <div>
          {button("secondary", secondary, "B")}
          <span>{secondary}</span>
        </div>
        <div>
          {button("action", action, "A")}
          <span>{action}</span>
        </div>
      </div>
    </div>
  );
}
