import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { dropIntoHall } from "../lib/arrival.ts";

class Key extends Event {
  key = "Escape";
  constructor() {
    super("keydown", { cancelable: true });
  }
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// Node 22's EventTarget does not remove a capture listener with a boolean flag.
// Normalize that overload so the fixture follows the browser EventTarget contract.
class BrowserEvents extends EventTarget {
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    super.removeEventListener(
      type,
      callback,
      typeof options === "boolean" ? { capture: options } : options,
    );
  }
}

function fixture(t: TestContext, handheld = false) {
  const page = Object.assign(new BrowserEvents(), {
    hidden: false,
    documentElement: { dataset: {} as Record<string, string> },
  });
  const scrolls: ScrollToOptions[] = [];
  const windowMock = Object.assign(new BrowserEvents(), {
    scrollTo: (options: ScrollToOptions) => scrolls.push(options),
  });
  let now = 0;
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const animations: FakeAnimation[] = [];
  class FakeAnimation {
    cancelled = false;
    finished: Promise<void>;
    readonly keyframes: Keyframe[];
    private resolve = () => {};
    private reject = (_error: Error) => {};
    constructor(keyframes: Keyframe[]) {
      this.keyframes = keyframes;
      this.finished = new Promise<void>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
    finish() {
      this.resolve();
    }
    cancel() {
      this.cancelled = true;
      this.reject(new DOMException("Animation cancelled", "AbortError"));
    }
  }
  const look = {
    animate: (keyframes: Keyframe[]) => {
      const animation = new FakeAnimation(keyframes);
      animations.push(animation);
      return animation;
    },
  };
  const actor = {
    style: { opacity: "" },
    dataset: {} as Record<string, string>,
    querySelector: () => look,
    getBoundingClientRect: () => ({ top: 200, height: 120 }),
  };
  const room = {
    closest: () => (handheld ? {} : null),
    getBoundingClientRect: () => ({ top: 0, bottom: 800 }),
  };
  const destination = {
    player: actor as unknown as HTMLElement,
    world: room as unknown as HTMLElement,
  };
  const globals = {
    document: page,
    window: windowMock,
    scrollY: 0,
    innerHeight: 600,
    performance: { now: () => now },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    page,
    window: windowMock,
    actor,
    animations,
    scrolls,
    destination,
    async frame() {
      await settle();
      now += 40;
      const current = [...frames.values()];
      frames.clear();
      current.forEach((callback) => callback(now));
      await settle();
    },
    async reachDrop() {
      for (let i = 0; i < 10 && !animations.length; i++) await this.frame();
      assert.equal(animations.length, 1, "the settled room starts one drop");
    },
    assertReleased(done: number) {
      assert.equal(done, 1);
      assert.equal(actor.style.opacity, "");
      assert.equal(actor.dataset.arriving, undefined);
      assert.equal(page.documentElement.dataset.arrival, "complete");
      const escape = new Key();
      page.dispatchEvent(escape);
      assert.equal(
        escape.defaultPrevented,
        false,
        "arrival no longer owns Escape",
      );
    },
  };
}

test("direct arrival drops and lands once, then releases visual and keyboard ownership", async (t) => {
  const scene = fixture(t);
  let done = 0;
  const pending = dropIntoHall({
    prepare: async () => scene.destination,
    reduced: false,
    onDone: () => done++,
  });
  await scene.reachDrop();
  assert.equal(scene.actor.style.opacity, "1");
  assert.equal(scene.actor.dataset.arriving, "true");
  assert.match(
    String(scene.animations[0].keyframes[0].translate),
    /^0 -\d+px$/,
  );
  scene.animations[0].finish();
  await settle();
  assert.equal(scene.animations.length, 2);
  scene.animations[1].finish();
  await pending;
  scene.assertReleased(done);
  assert.ok(scene.animations.every((animation) => animation.cancelled));
});

test("reduced-motion arrival still prepares the player but performs no drop", async (t) => {
  const scene = fixture(t);
  let prepared = 0;
  let done = 0;
  await dropIntoHall({
    prepare: async () => {
      prepared++;
      return scene.destination;
    },
    reduced: true,
    onDone: () => done++,
  });
  assert.equal(prepared, 1);
  assert.equal(scene.animations.length, 0);
  assert.deepEqual(scene.scrolls, [{ top: 224, behavior: "instant" }]);
  scene.assertReleased(done);
});

test("handheld arrival does not scroll the surrounding page", async (t) => {
  const scene = fixture(t, true);
  let done = 0;
  await dropIntoHall({
    prepare: async () => scene.destination,
    reduced: true,
    onDone: () => done++,
  });
  assert.deepEqual(scene.scrolls, []);
  scene.assertReleased(done);
});

for (const reason of ["escape", "blur", "hidden", "owner"] as const) {
  test(`${reason} during the drop reveals the saved actor and clears arrival ownership`, async (t) => {
    const scene = fixture(t);
    const owner = new AbortController();
    let done = 0;
    const pending = dropIntoHall({
      prepare: async () => scene.destination,
      reduced: false,
      signal: owner.signal,
      onDone: () => done++,
    });
    await scene.reachDrop();
    if (reason === "escape") {
      const escape = new Key();
      scene.page.dispatchEvent(escape);
      assert.equal(escape.defaultPrevented, true);
    } else if (reason === "blur") scene.window.dispatchEvent(new Event("blur"));
    else if (reason === "hidden") {
      scene.page.hidden = true;
      scene.page.dispatchEvent(new Event("visibilitychange"));
    } else owner.abort();
    await pending;
    assert.equal(
      scene.animations.length,
      1,
      "a cancelled drop cannot start a landing bounce",
    );
    assert.equal(scene.animations[0].cancelled, true);
    scene.assertReleased(done);
  });
}

test("an already-aborted owner does not prepare or animate an obsolete arrival", async (t) => {
  const scene = fixture(t);
  const owner = new AbortController();
  owner.abort();
  let prepared = 0;
  let done = 0;
  await dropIntoHall({
    prepare: async () => {
      prepared++;
      return scene.destination;
    },
    reduced: false,
    signal: owner.signal,
    onDone: () => done++,
  });
  assert.equal(prepared, 0);
  assert.equal(scene.animations.length, 0);
  assert.deepEqual(scene.scrolls, []);
  scene.assertReleased(done);
});
