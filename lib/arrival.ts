/** Registration saves first; arrival only stages the already prepared world actor. */
export async function dropIntoHall({
  prepare,
  reduced,
  onDone,
  signal: ownerSignal,
}: {
  prepare: () => Promise<{ player: HTMLElement; world: HTMLElement }>;
  reduced: boolean;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const abort = new AbortController(),
    signal = abort.signal;
  const cancelOwner = () => abort.abort();
  if (ownerSignal?.aborted) abort.abort();
  ownerSignal?.addEventListener("abort", cancelOwner, { once: true });
  let target: HTMLElement | null = null;
  const animations = new Set<Animation>();
  const stop = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      abort.abort();
    }
  };
  const hidden = () => {
    if (document.hidden) abort.abort();
  };
  const cancelAnimations = () =>
    animations.forEach((animation) => animation.cancel());
  signal.addEventListener("abort", cancelAnimations, { once: true });
  document.addEventListener("keydown", stop, true);
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("blur", cancelOwner);
  const animate = async (
    element: Element,
    frames: Keyframe[],
    duration: number,
    easing: string,
  ) => {
    if (signal.aborted) throw new DOMException("Interrupted", "AbortError");
    const animation = element.animate(frames, {
      duration,
      easing,
      fill: "both",
    });
    animations.add(animation);
    await animation.finished;
  };
  try {
    if (signal.aborted) return;
    const destination = await prepare();
    target = destination.player;
    target.dataset.arriving = "true";
    target.style.opacity = "0";
    const room = destination.world;
    if (!room.closest(".is-handheld")) {
      // Use the bottom of the floor as the framing anchor, not the moving sprite.
      window.scrollTo({
        top: Math.max(
          0,
          scrollY + room.getBoundingClientRect().bottom - innerHeight + 24,
        ),
        behavior: reduced ? "instant" : "smooth",
      });
    }
    if (reduced || signal.aborted) return;
    document.documentElement.dataset.arrival = "navigation";
    let old = Infinity,
      steady = 0;
    const began = performance.now();
    while (performance.now() - began < 1400) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (signal.aborted) return;
      const y = room.getBoundingClientRect().top;
      steady = Math.abs(y - old) < 0.5 ? steady + 1 : 0;
      old = y;
      if (steady > 4 && performance.now() - began > 160) break;
    }
    const rect = target.getBoundingClientRect();
    const distance = Math.max(
      96,
      Math.min(
        420,
        rect.top - Math.max(0, room.getBoundingClientRect().top) + rect.height,
      ),
    );
    const look = target.querySelector<HTMLElement>(".player-facing")!;
    document.documentElement.dataset.arrival = "drop";
    const fall = animate(
      look,
      [{ translate: `0 -${distance}px` }, { translate: "0 0" }],
      520,
      "cubic-bezier(.45,0,.9,.65)",
    );
    target.style.opacity = "1";
    await fall;
    document.documentElement.dataset.arrival = "land";
    await animate(
      look,
      [
        { translate: "0 0" },
        { translate: "0 -8px", offset: 0.45 },
        { translate: "0 0" },
      ],
      180,
      "ease-out",
    );
  } catch {
    // Skipping or losing focus finishes at the saved ground position.
  } finally {
    cancelAnimations();
    if (target) {
      target.style.opacity = "";
      delete target.dataset.arriving;
    }
    signal.removeEventListener("abort", cancelAnimations);
    ownerSignal?.removeEventListener("abort", cancelOwner);
    document.removeEventListener("keydown", stop, true);
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("blur", cancelOwner);
    document.documentElement.dataset.arrival = "complete";
    onDone();
  }
}
