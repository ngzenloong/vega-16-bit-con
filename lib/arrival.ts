export async function enterFromPass({
  card,
  prepare,
  reduced,
  onDone,
  signal: ownerSignal,
}: {
  card: HTMLElement;
  prepare: () => Promise<{ player: HTMLElement; world: HTMLElement }>;
  reduced: boolean;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const source = card.getBoundingClientRect(),
    clone = card.cloneNode(true) as HTMLElement,
    abort = new AbortController();
  const signal = abort.signal;
  const cancelOwner = () => abort.abort();
  if (ownerSignal?.aborted) abort.abort();
  ownerSignal?.addEventListener("abort", cancelOwner, { once: true });
  let ghost: HTMLElement | null = null,
    target: HTMLElement | null = null;
  const stop = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      abort.abort();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", stop, true);
  const hidden = () => {
    if (document.hidden) abort.abort();
  };
  document.addEventListener("visibilitychange", hidden);
  const animate = async (el: Element, frames: Keyframe[], duration: number) => {
    if (signal.aborted) throw new DOMException("Interrupted", "AbortError");
    const a = el.animate(frames, {
      duration,
      easing: "cubic-bezier(.22,1,.36,1)",
      fill: "forwards",
    });
    const cancel = () => a.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await a.finished;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
  const next = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  try {
    if (signal.aborted) throw new DOMException("Interrupted", "AbortError");
    const destination = await prepare();
    target = destination.player;
    target.dataset.arriving = "true";
    target.style.opacity = "0";
    if (reduced) {
      destination.world.scrollIntoView({
        behavior: "instant",
        block: "center",
      });
      return;
    }
    const w = Math.min(220, innerWidth - 48),
      h = 300,
      left = (innerWidth - w) / 2,
      top = Math.max(24, (innerHeight - h) / 2);
    clone.classList.add("arrival-pass");
    clone.setAttribute("aria-hidden", "true");
    Object.assign(clone.style, {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    document.body.append(clone);
    document.documentElement.dataset.arrival = "card";
    const visible = source.bottom > 0 && source.top < innerHeight;
    await animate(
      clone,
      [
        {
          transform: visible
            ? `translate(${source.left - left}px,${source.top - top}px) scale(${source.width / w},${source.height / h})`
            : "translateY(30px)",
          opacity: 0.6,
        },
        { transform: "translate(0,0) scale(1)", opacity: 1 },
      ],
      340,
    );
    document.documentElement.dataset.arrival = "flip";
    await animate(
      clone.querySelector(".pass-inner")!,
      [{ transform: "rotateY(0)" }, { transform: "rotateY(180deg)" }],
      480,
    );
    destination.world.scrollIntoView({ behavior: "smooth", block: "center" });
    document.documentElement.dataset.arrival = "navigation";
    let old = Infinity,
      steady = 0;
    const began = performance.now();
    while (performance.now() - began < 1400) {
      await next();
      if (signal.aborted) throw new DOMException("Interrupted", "AbortError");
      const y = destination.world.getBoundingClientRect().top;
      steady = Math.abs(y - old) < 0.5 ? steady + 1 : 0;
      old = y;
      if (steady > 4 && performance.now() - began > 160) break;
    }
    const to = target.getBoundingClientRect(),
      from = clone
        .querySelector(".pass-back .pass-character")!
        .getBoundingClientRect();
    ghost = clone
      .querySelector(".pass-back .pass-character")!
      .cloneNode(true) as HTMLElement;
    ghost.classList.add("arrival-ghost");
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      margin: "0",
    });
    document.body.append(ghost);
    document.documentElement.dataset.arrival = "morph";
    await Promise.all([
      animate(
        clone,
        [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(.4)", opacity: 0 },
        ],
        360,
      ),
      animate(
        ghost,
        [
          { transform: "translate(0,0)", opacity: 0.3 },
          {
            transform: `translate(${to.left - from.left}px,${to.top - from.top - 90}px)`,
            opacity: 1,
          },
        ],
        440,
      ),
    ]);
    clone.remove();
    ghost.remove();
    target.style.opacity = "1";
    document.documentElement.dataset.arrival = "drop";
    const look = target.querySelector(".player-facing")!;
    await animate(
      look,
      [
        { translate: "0 -90px", offset: 0 },
        { translate: "0 0", offset: 0.7 },
        { translate: "0 -10px", offset: 0.85 },
        { translate: "0 0", offset: 1 },
      ],
      500,
    );
  } catch {
    /* Keep the player update if the entrance animation is interrupted. */
  } finally {
    clone.remove();
    ghost?.remove();
    if (target) {
      target.style.opacity = "";
      delete target.dataset.arriving;
      target
        .querySelector(".player-facing")
        ?.getAnimations()
        .forEach((a) => a.cancel());
    }
    ownerSignal?.removeEventListener("abort", cancelOwner);
    document.removeEventListener("keydown", stop, true);
    document.removeEventListener("visibilitychange", hidden);
    document.documentElement.dataset.arrival = "complete";
    onDone();
  }
}
