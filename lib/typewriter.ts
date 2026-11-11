/** Vega's lore-window cadence: 65 characters/second, 250ms between paragraphs. */
export function revealWindowText(
  root: HTMLElement,
  output: HTMLElement,
  text: string,
  complete: () => void,
  options: { delay?: number; skipHidden?: boolean; skipPast?: boolean } = {},
) {
  let active = true,
    visible = false,
    frame = 0,
    last = 0,
    position = 0,
    hold = options.delay || 0,
    finished = false;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (root.dataset.typeState === "typing") root.dataset.typeState = "paused";
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    position = text.length;
    output.textContent = text;
    root.dataset.typeState = "complete";
    complete();
  };
  const tick = (now: number) => {
    frame = 0;
    if (!active || !visible || document.hidden || !document.hasFocus()) {
      stop();
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (hold > 0) hold = Math.max(0, hold - dt);
    else {
      const previous = Math.floor(position),
        next = Math.min(text.length, position + dt * 65);
      const paragraph = text.indexOf("\n\n", previous);
      if (paragraph >= 0 && next >= paragraph) {
        position = paragraph + 2;
        hold = 0.25;
      } else position = next;
      if (Math.floor(position) !== previous)
        output.textContent = text.slice(0, Math.floor(position));
    }
    if (position >= text.length) finish();
    else frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (
      !active ||
      !visible ||
      frame ||
      position >= text.length ||
      document.hidden ||
      !document.hasFocus()
    )
      return;
    root.dataset.typeState = "typing";
    frame = requestAnimationFrame(tick);
  };
  output.textContent = "";
  root.dataset.typeState = "waiting";
  if (!text.length) finish();
  let scrollFrame: HTMLElement | null = null;
  if (options.skipPast) {
    for (
      let parent = root.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        scrollFrame = parent;
        break;
      }
    }
  }
  const skipped = () =>
    (options.skipHidden && !root.getClientRects().length) ||
    (options.skipPast &&
      root.getClientRects().length > 0 &&
      root.getBoundingClientRect().bottom <=
        Math.max(0, scrollFrame?.getBoundingClientRect().top || 0));
  if (skipped()) {
    finish();
    return () => {
      active = false;
    };
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!active || finished) return;
      if (skipped()) {
        stop();
        finish();
        return;
      }
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.4;
      if (visible) start();
      else stop();
    },
    { threshold: [0, 0.4, 1] },
  );
  observer.observe(root);
  const pass = () => {
    if (active && !finished && skipped()) {
      stop();
      finish();
    }
  };
  // A large scroll can pass a waiting item without crossing an IO threshold.
  if (options.skipPast)
    document.addEventListener("scroll", pass, { capture: true, passive: true });
  if (options.skipPast || options.skipHidden)
    window.addEventListener("resize", pass);
  const visibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", stop);
  window.addEventListener("focus", start);
  return () => {
    active = false;
    stop();
    observer.disconnect();
    document.removeEventListener("scroll", pass, true);
    window.removeEventListener("resize", pass);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("blur", stop);
    window.removeEventListener("focus", start);
  };
}
