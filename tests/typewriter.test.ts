import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { revealWindowText } from "../lib/typewriter.ts";

function fixture(t: TestContext, text: string) {
  let now = 0,
    next = 0,
    focused = true,
    done = 0;
  const frames = new Map<number, FrameRequestCallback>();
  let notify: (
    entries: { isIntersecting: boolean; intersectionRatio: number }[],
  ) => void;
  const page = Object.assign(new EventTarget(), {
    hidden: false,
    hasFocus: () => focused,
  });
  const win = new EventTarget(),
    root = { dataset: {} as Record<string, string> },
    output = { textContent: "" };
  const globals = {
    document: page,
    window: win,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++next, callback);
      return next;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    },
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const cleanup = revealWindowText(
    root as unknown as HTMLElement,
    output as unknown as HTMLElement,
    text,
    () => {
      done++;
    },
  );
  t.after(() => {
    cleanup();
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    root,
    output,
    frames,
    cleanup,
    done: () => done,
    view(ratio: number) {
      notify([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    },
    focus(value: boolean) {
      focused = value;
      win.dispatchEvent(new Event(value ? "focus" : "blur"));
    },
    hide(value: boolean) {
      page.hidden = value;
      page.dispatchEvent(new Event("visibilitychange"));
    },
    step(count = 1, ms = 20) {
      for (let i = 0; i < count; i++) {
        now += ms;
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(now));
      }
    },
  };
}

test("window text waits for readable visibility, types at the reference cadence and finishes once", (t) => {
  const scene = fixture(t, "HELLO\n\nWORLD");
  scene.view(0.1);
  scene.step(10);
  assert.equal(scene.output.textContent, "");
  assert.equal(scene.frames.size, 0);
  scene.view(0.5);
  scene.step(5);
  assert.equal(scene.output.textContent, "HELLO\n\n");
  scene.step(10);
  assert.equal(
    scene.output.textContent,
    "HELLO\n\n",
    "paragraphs retain their 250ms pause",
  );
  scene.step(30);
  assert.equal(scene.output.textContent, "HELLO\n\nWORLD");
  assert.equal(scene.root.dataset.typeState, "complete");
  assert.equal(scene.done(), 1);
  assert.equal(scene.frames.size, 0);
  scene.view(0);
  scene.view(1);
  scene.step(10);
  assert.equal(scene.done(), 1, "scrolling back never rewinds completed copy");
});

test("hidden and unfocused windows resume without a character catch-up jump", (t) => {
  const scene = fixture(
    t,
    "The retro gaming convention for people who never stopped playing.",
  );
  scene.view(1);
  scene.step(5);
  const initial = scene.output.textContent;
  scene.hide(true);
  scene.step(100, 1000);
  assert.equal(scene.output.textContent, initial);
  scene.hide(false);
  scene.step();
  assert.equal(scene.output.textContent, initial);
  scene.step();
  assert.ok(scene.output.textContent.length - initial.length <= 2);
  scene.focus(false);
  const before = scene.output.textContent;
  scene.step(100, 1000);
  scene.focus(true);
  scene.step();
  assert.equal(scene.output.textContent, before);
});

test("cleanup rejects queued visibility callbacks and releases all frame work", (t) => {
  const scene = fixture(t, "Opening keynote");
  scene.view(1);
  scene.step(3);
  scene.cleanup();
  const before = scene.output.textContent;
  scene.view(1);
  scene.focus(true);
  scene.step(100);
  assert.equal(scene.output.textContent, before);
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.done(), 0);
});
