/** A custom game pad owns long presses; the surrounding page and forms keep native gestures. */
export function guardGameGestures(surface: HTMLElement) {
  const prevent = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  // React's delegated touch listeners can be passive. Safari's loupe needs an active listener.
  surface.addEventListener("touchstart", prevent, { passive: false });
  surface.addEventListener("selectstart", prevent);
  surface.addEventListener("contextmenu", prevent);
  return () => {
    surface.removeEventListener("touchstart", prevent);
    surface.removeEventListener("selectstart", prevent);
    surface.removeEventListener("contextmenu", prevent);
  };
}
