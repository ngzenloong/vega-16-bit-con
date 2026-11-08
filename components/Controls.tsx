"use client";
import { useEffect, useRef, useState } from "react";
import { guardGameGestures } from "@/lib/gesture-guard";
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
  const root = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, GameButton>());
  const pulses = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
    pointers.current.clear();
    for (const timer of pulses.current.values()) clearTimeout(timer);
    pulses.current.clear();
    for (const [source, key] of owners.current)
      callback.current(key, false, source);
    owners.current.clear();
    sync();
  };
  useEffect(() => {
    const unguard = guardGameGestures(root.current!);
    const clear = () => releaseAll();
    const up = (e: KeyboardEvent) => release(`pad-key:${e.code}`, e.timeStamp);
    window.addEventListener("blur", clear);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", clear);
    return () => {
      unguard();
      for (const timer of pulses.current.values()) clearTimeout(timer);
      pulses.current.clear();
      pointers.current.clear();
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
      data-control={key}
      onPointerDown={(e) => {
        if (e.button !== 0 || disabled) return;
        e.preventDefault();
        pointers.current.set(e.pointerId, key);
        e.currentTarget.setPointerCapture(e.pointerId);
        press(key, `pad-pointer:${e.pointerId}`, e.timeStamp);
      }}
      onPointerMove={(e) => {
        const origin = pointers.current.get(e.pointerId);
        if (!origin) return;
        const source = `pad-pointer:${e.pointerId}`;
        const hit = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLButtonElement>(".pad-button");
        const next =
          hit && root.current?.contains(hit)
            ? (hit.dataset.control as GameButton)
            : undefined;
        const directional = ["left", "right", "up", "down"].includes(origin);
        const allowed =
          next &&
          (directional
            ? ["left", "right", "up", "down"].includes(next)
            : next === origin);
        if (owners.current.get(source) === next && allowed) return;
        release(source, e.timeStamp);
        if (allowed) press(next, source, e.timeStamp);
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        release(`pad-pointer:${e.pointerId}`, e.timeStamp);
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        release(`pad-pointer:${e.pointerId}`, e.timeStamp);
      }}
      onLostPointerCapture={(e) => {
        pointers.current.delete(e.pointerId);
        release(`pad-pointer:${e.pointerId}`, e.timeStamp);
      }}
      onClick={(event) => {
        if (event.detail !== 0 || disabled) return;
        const source = `pad-activate:${key}`;
        clearTimeout(pulses.current.get(source));
        press(key, source, event.timeStamp);
        pulses.current.set(
          source,
          setTimeout(() => {
            pulses.current.delete(source);
            release(source);
          }, 120),
        );
      }}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Tab") releaseAll();
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.repeat) return;
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
    <div ref={root} className="handheld-controls">
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
