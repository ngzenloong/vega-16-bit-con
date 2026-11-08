import test from "node:test";
import assert from "node:assert/strict";
import { guardGameGestures } from "../lib/gesture-guard.ts";

test("a custom game pad owns long press selection and context menus only while mounted", () => {
  const pad = new EventTarget();
  const page = new EventTarget();
  const release = guardGameGestures(pad as unknown as HTMLElement);
  for (const name of ["touchstart", "selectstart", "contextmenu"]) {
    const local = new Event(name, { cancelable: true });
    pad.dispatchEvent(local);
    assert.equal(local.defaultPrevented, true);
    const outside = new Event(name, { cancelable: true });
    page.dispatchEvent(outside);
    assert.equal(
      outside.defaultPrevented,
      false,
      "page scrolling and form gestures retain their defaults",
    );
  }
  release();
  const after = new Event("touchstart", { cancelable: true });
  pad.dispatchEvent(after);
  assert.equal(after.defaultPrevented, false);
});
test("non-cancelable gesture events remain safe", () => {
  const pad = new EventTarget();
  const release = guardGameGestures(pad as unknown as HTMLElement);
  const event = new Event("touchstart");
  assert.doesNotThrow(() => pad.dispatchEvent(event));
  assert.equal(event.defaultPrevented, false);
  release();
});
