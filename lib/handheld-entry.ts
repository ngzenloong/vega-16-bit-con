import { characterSheets, loadImage } from "./character";
import type { Appearance } from "./types";

const padAssets = ["dpad.png", "a-button.png", "b-button.png"];
let readyPad: Promise<void> | null = null;
export async function prepareHandheld(appearance: Appearance) {
  if (!readyPad) {
    const loading = Promise.all(
      padAssets.map(async (name) => {
        const image = await loadImage(`/assets/vega/${name}`);
        await image.decode();
      }),
    ).then(() => {});
    readyPad = loading;
    loading.catch(() => {
      if (readyPad === loading) readyPad = null;
    });
  }
  await Promise.all([
    readyPad,
    characterSheets(appearance).then((sheets) =>
      Promise.all(
        Object.values(sheets).map(async (src) => {
          const image = await loadImage(src);
          await image.decode();
        }),
      ),
    ),
  ]);
}
export function awaitHandheldAssets(
  appearance: Appearance,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(new DOMException("Entry cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error("Controls could not load"));
    }, 10000);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    prepareHandheld(appearance).then(
      () => {
        cleanup();
        resolve();
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}
export async function animateHandheldEntry(
  frame: HTMLElement,
  from: DOMRect,
  reduced: boolean,
  signal: AbortSignal,
) {
  if (signal.aborted || reduced || typeof frame.animate !== "function") return;
  const target = frame.getBoundingClientRect();
  if (!target.width || !target.height) return;
  const root = frame.closest<HTMLElement>(".is-handheld")!;
  const controls = root.querySelector<HTMLElement>(".handheld-controls");
  const header = root.querySelector<HTMLElement>(".handheld-top");
  const easing = "cubic-bezier(.22,1,.36,1)";
  const animations = [
    frame.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${from.x - target.x}px,${from.y - target.y}px) scale(${from.width / target.width},${from.height / target.height})`,
        },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 360, easing, fill: "both" },
    ),
  ];
  if (controls)
    animations.push(
      controls.animate(
        [
          { opacity: 0, transform: "translateY(44px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, delay: 80, easing, fill: "both" },
      ),
    );
  if (header)
    animations.push(
      header.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        delay: 100,
        easing,
        fill: "both",
      }),
    );
  const cancel = () => animations.forEach((animation) => animation.cancel());
  signal.addEventListener("abort", cancel, { once: true });
  const resize = () =>
    animations.forEach((animation) => {
      try {
        animation.finish();
      } catch {}
    });
  window.addEventListener("resize", resize, { once: true });
  try {
    await Promise.all(
      animations.map((animation) => animation.finished.catch(() => {})),
    );
  } finally {
    cancel();
    signal.removeEventListener("abort", cancel);
    window.removeEventListener("resize", resize);
  }
}
