import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

let instance = 0;
function fixture(t: TestContext, values: Record<string, unknown>) {
  let id = 0;
  const timers = new Map<number, () => void>();
  const globals = {
    ...values,
    setTimeout: (fn: () => void) => {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout: (key: number) => timers.delete(key),
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  t.after(() => {
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    expire: () => {
      const fn = timers.values().next().value;
      assert.ok(fn);
      fn();
    },
    timers,
  };
}
async function fresh(file: string) {
  const url = new URL(file, import.meta.url);
  url.searchParams.set("case", String(instance++));
  return import(url.href);
}
test("image loads share successes, evict timeouts, and ignore a late obsolete callback", async (t) => {
  const images: FakeImage[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = "";
    constructor() {
      images.push(this);
    }
  }
  const clock = fixture(t, { Image: FakeImage });
  const { loadImage } = await fresh("../lib/image.ts");
  const first = loadImage("/stalled.png");
  assert.equal(loadImage("/stalled.png"), first);
  const late = images[0].onload!;
  const rejected = assert.rejects(first, /timed out/);
  clock.expire();
  await rejected;
  assert.equal(images[0].src, "");
  assert.equal(images[0].onload, null);
  const second = loadImage("/stalled.png");
  assert.equal(images.length, 2, "retry creates a replacement image request");
  late();
  assert.equal(loadImage("/stalled.png"), second);
  images[1].onload!();
  assert.equal(await second, images[1]);
  assert.equal(loadImage("/stalled.png"), second);
  assert.equal(clock.timers.size, 0);
});
test("a stalled canvas font reaches an error and retry uses an abortable replacement request", async (t) => {
  let resolveNative: (faces: unknown[]) => void = () => {};
  let resolveFetch: (response: unknown) => void = () => {};
  let fetchCount = 0;
  const added: unknown[] = [];
  class Face {
    async load() {
      return this;
    }
  }
  const clock = fixture(t, {
    document: {
      fonts: {
        load: () =>
          new Promise((resolve) => {
            resolveNative = resolve;
          }),
        add: (face: unknown) => added.push(face),
      },
    },
    FontFace: Face,
    fetch: () => {
      fetchCount++;
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    },
  });
  const { prepareGameFont } = await fresh("../lib/game-font.ts");
  const first = prepareGameFont();
  assert.equal(prepareGameFont(), first);
  const rejected = assert.rejects(first, /timed out/);
  clock.expire();
  await rejected;
  const second = prepareGameFont();
  assert.equal(fetchCount, 1);
  resolveNative([new Face()]);
  await Promise.resolve();
  assert.equal(
    prepareGameFont(),
    second,
    "an obsolete font must not replace the new cached request",
  );
  resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  assert.equal((await second).length, 1);
  assert.equal(added.length, 1);
  assert.equal(clock.timers.size, 0);
});
