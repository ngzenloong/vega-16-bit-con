import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { revealWindowText } from "../lib/typewriter.ts";

function fixture(
  t: TestContext,
  text: string,
  options: Parameters<typeof revealWindowText>[4] = {},
  layout = { rendered: true, bottom: 100, scrollTop: null as number | null },
) {
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
    root = {
      dataset: {} as Record<string, string>,
      getClientRects: () => (layout.rendered ? [{}] : []),
      getBoundingClientRect: () => ({ bottom: layout.bottom }),
      parentElement:
        layout.scrollTop === null
          ? null
          : {
              parentElement: null,
              getBoundingClientRect: () => ({ top: layout.scrollTop }),
            },
    },
    output = { textContent: "" };
  const globals = {
    getComputedStyle: () => ({ overflowY: "auto" }),
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
    options,
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
    layout,
    scroll: () => page.dispatchEvent(new Event("scroll")),
    resize: () => win.dispatchEvent(new Event("resize")),
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

test("sequence handoff holds before typing the next block", (t) => {
  const scene = fixture(t, "NEXT", { delay: 0.1 });
  scene.view(1);
  scene.step(5);
  assert.equal(scene.output.textContent, "");
  scene.step(12);
  assert.equal(scene.output.textContent, "NEXT");
  assert.equal(scene.done(), 1);
});

test("a fast scroll past a waiting block advances without an intersection notification", (t) => {
  const scene = fixture(t, "FIRST", { skipPast: true });
  scene.layout.bottom = 2000;
  scene.view(0);
  scene.layout.bottom = -20;
  scene.scroll();
  assert.equal(scene.output.textContent, "FIRST");
  assert.equal(scene.done(), 1);
  scene.scroll();
  scene.view(1);
  assert.equal(scene.done(), 1);
});

test("past-block detection uses the inner scrollport top", (t) => {
  const scene = fixture(
    t,
    "FIRST",
    { skipPast: true },
    { rendered: true, bottom: 200, scrollTop: 90 },
  );
  scene.view(0);
  scene.layout.bottom = 90;
  scene.scroll();
  assert.equal(scene.done(), 1);
});

test("a responsive hidden label does not block the next visible field", (t) => {
  const scene = fixture(t, "Date", { skipHidden: true });
  scene.view(0);
  scene.layout.rendered = false;
  scene.resize();
  assert.equal(scene.done(), 1);
  assert.equal(scene.output.textContent, "Date");
});

test("scroll and resize callbacks cannot advance a destroyed sequence step", (t) => {
  const scene = fixture(t, "Date", { skipHidden: true, skipPast: true });
  scene.cleanup();
  scene.layout.rendered = false;
  scene.layout.bottom = -20;
  scene.scroll();
  scene.resize();
  assert.equal(scene.done(), 0);
});
