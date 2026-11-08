/** Ignore scroll-snap padding when deciding whether real content is hidden. */
export function updateHorizontalOverflow(element: HTMLElement) {
  const style = getComputedStyle(element);
  const startInset = parseFloat(style.paddingLeft) || 0;
  const endInset = parseFloat(style.paddingRight) || 0;
  element.dataset.overflowStart = String(element.scrollLeft > startInset + 2);
  element.dataset.overflowEnd = String(
    element.scrollWidth - element.clientWidth - element.scrollLeft >
      endInset + 2,
  );
}
