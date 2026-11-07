"use client";
import { memo, useEffect, useRef } from "react";
import { gameLoaders } from "@/lib/games/loaders";
import { gameResources } from "@/lib/games/resources";
import { DEFAULT_APPEARANCE, type GameId } from "@/lib/types";
import type { GameController, GameInput } from "@/lib/games/types";

/** Silent previews share the actual game controllers. Only visible screens run. */
const AttractScreen = memo(function AttractScreen({
  id,
  paused,
  reduced,
}: {
  id: GameId;
  paused: boolean;
  reduced: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    settings = useRef({ paused, reduced }),
    wake = useRef<() => void>(() => {});
  settings.current = { paused, reduced };
  useEffect(() => {
    const element = canvas.current!,
      ctx = element.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let disposed = false,
      visible = false,
      pending = false,
      frame = 0,
      last = 0,
      time = 0,
      lastJump = -2,
      ended = false,
      controller: GameController | null = null,
      create: (() => GameController) | null = null;
    const draw = () => {
      if (!controller) return;
      ctx.fillStyle = "#102719";
      ctx.fillRect(0, 0, 640, 480);
      ctx.save();
      if (id !== "kart") ctx.translate(0, 40);
      controller.draw(ctx, time);
      ctx.restore();
    };
    const step = (dt: number) => {
      const input: GameInput = {
        left: false,
        right: false,
        up: false,
        down: false,
        action: false,
        secondary: false,
        axis: 0,
      };
      time += dt;
      const demo = controller!.attractInput?.(time);
      if (demo) {
        Object.assign(input, demo.held);
        for (const event of demo.press || [])
          controller!.press(event.key, event.at ?? time);
      }
      controller!.update(dt, input, time);
    };
    const tick = (now: number) => {
      frame = 0;
      if (
        disposed ||
        !visible ||
        document.hidden ||
        settings.current.paused ||
        settings.current.reduced
      )
        return;
      if (now - last >= 125) {
        const dt = Math.min(0.2, (now - last) / 1000);
        last = now;
        if (ended || time > 12) {
          controller = create!();
          time = 0;
          lastJump = -2;
          ended = false;
        }
        let left = dt;
        while (left > 0) {
          const part = Math.min(left, 1 / 60);
          step(part);
          left -= part;
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (
        !frame &&
        controller &&
        visible &&
        !document.hidden &&
        !settings.current.paused &&
        !settings.current.reduced
      ) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (settings.current.paused || settings.current.reduced) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const load = async () => {
      if (pending || controller) return;
      pending = true;
      try {
        const [{ createGame }, resources] = await Promise.all([
          gameLoaders[id](),
          gameResources(DEFAULT_APPEARANCE, id === "kart"),
        ]);
        if (disposed) return;
        create = () =>
          createGame({
            ...resources,
            appearance: DEFAULT_APPEARANCE,
            reducedMotion: true,
            sound: () => {},
            finish: () => {
              ended = true;
            },
          });
        controller = create();
        for (let i = 0; i < 180; i++) step(1 / 60);
        draw();
        start();
      } catch {
        ctx.fillStyle = "#102719";
        ctx.fillRect(0, 0, 640, 480);
      } finally {
        pending = false;
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) {
          void load();
          start();
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else start();
    };
    document.addEventListener("visibilitychange", visibility);
    wake.current = start;
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      wake.current = () => {};
    };
  }, [id]);
  useEffect(() => wake.current(), [paused, reduced]);
  return <canvas ref={canvas} width={640} height={480} aria-hidden="true" />;
});
export default AttractScreen;
