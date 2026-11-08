/** Keep an open modal's input ownership across tab and application switches. */
export function retainDialogFocus(dialog: HTMLDialogElement) {
  let frame = 0;
  let previous = dialog as HTMLElement;
  const ownsFocus = () => {
    const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    return dialog.open && open[open.length - 1] === dialog;
  };
  const available = (element: HTMLElement) =>
    element === dialog ||
    (element.isConnected &&
      dialog.contains(element) &&
      !element.hasAttribute("disabled") &&
      !element.closest("[hidden],[inert]") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility === "visible");
  const restore = () => {
    if (!ownsFocus() || document.hidden || !document.hasFocus()) return;
    if (dialog.contains(document.activeElement)) return;
    const target = available(previous) ? previous : dialog;
    target.focus({ preventScroll: true });
  };
  const wake = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(restore);
  };
  const remember = (event: FocusEvent) => {
    if (dialog.contains(event.target as Node))
      previous = event.target as HTMLElement;
  };
  const route = (event: KeyboardEvent) => {
    if (
      !ownsFocus() ||
      dialog.contains(event.target as Node) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (
      !/^(Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Key[WASDPRMX])$/.test(
        event.code,
      )
    )
      return;
    restore();
    const active = document.activeElement as HTMLElement | null;
    if (
      active?.matches("input,textarea,select") &&
      !["Escape", "Tab"].includes(event.code)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === "Escape")
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (event.code === "Tab") {
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ),
      ].filter(available);
      const target = event.shiftKey
        ? controls[controls.length - 1]
        : controls[0];
      target?.focus({ preventScroll: true });
    } else if (
      ["Enter", "Space"].includes(event.code) &&
      active?.matches("button,summary")
    )
      active.click();
    else
      (active && dialog.contains(active) ? active : dialog).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          repeat: event.repeat,
          shiftKey: event.shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
  };
  const scroll = lockPageScroll();
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  document.addEventListener("focusin", remember);
  dialog.addEventListener("focusout", wake);
  document.addEventListener("keydown", route, true);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", wake);
    document.removeEventListener("focusin", remember);
    dialog.removeEventListener("focusout", wake);
    document.removeEventListener("keydown", route, true);
    scroll();
  };
}
let locks = 0,
  previousOverflow = "";
export function lockPageScroll() {
  let released = false;
  if (locks++ === 0) {
    previousOverflow = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = "hidden";
  }
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0)
      document.documentElement.style.overflowY = previousOverflow;
  };
}
