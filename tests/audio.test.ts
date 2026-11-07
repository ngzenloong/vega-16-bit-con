import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
let instance = 0;

async function audioFixture(t: TestContext) {
  const requests: {
    url: string;
    resolve: (response: unknown) => void;
    reject: (error: Error) => void;
  }[] = [];
  const sources: { started: boolean; stopped: boolean }[] = [];
  const parameter = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  class AudioContextMock {
    currentTime = 1;
    state = "running";
    destination = {};
    outputLatency = 0;
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
    createBiquadFilter() {
      return {
        frequency: parameter(),
        Q: parameter(),
        connect() {},
        disconnect() {},
      };
    }
    createBufferSource() {
      const source = {
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      sources.push(source);
      return source;
    }
    async decodeAudioData() { return { duration: 90 }; }
    async resume() { this.state = "running"; }
  }
  const globals = {
    AudioContext: AudioContextMock,
    document: { hidden: false },
    fetch: (url: unknown) => new Promise((resolve, reject) => {
      requests.push({ url: String(url), resolve, reject });
    }),
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  // Separate module instances avoid leaking the singleton/cache between cases.
  const url = new URL("../lib/audio.ts", import.meta.url);
  url.searchParams.set("test", String(instance++));
  const { audio } = await import(url.href);
  const success = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  t.after(async () => {
    await audio.setEnabled(false);
    // Settle cached loads so their timeout handles cannot outlive this fixture.
    for (const request of requests) request.resolve(success());
    await flush();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  await audio.setEnabled(true);
  return { audio, requests, sources, success };
}

test("muting releases a stalled music start before its network request completes", async (t) => {
  const { audio, requests, sources } = await audioFixture(t);
  let settled = false;
  const play = audio.play("breaker", 0).then((value: boolean) => {
    settled = true;
    return value;
  });
  await flush();
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/breaker\.ogg/);
  await audio.setEnabled(false);
  await flush();
  assert.equal(settled, true, "GameHost must be able to leave its starting state after mute");
  assert.equal(await play, false);
  assert.equal(sources.length, 0);
  assert.equal(audio.lastError, null);
});

test("a failed obsolete room load cannot replace the current track or publish its error", async (t) => {
  const { audio, requests, sources, success } = await audioFixture(t);
  const previous = audio.play("hall", 0);
  await flush();
  const current = audio.play("kart", 0);
  await flush();
  requests.find((request) => request.url.includes("/kart.ogg"))!.resolve(success());
  assert.equal(await current, true);
  assert.equal(await previous, false);

  requests.find((request) => request.url.includes("/hall.ogg"))!.reject(Error("Previous room failed"));
  await flush();
  requests.find((request) => request.url.includes("/hall.wav"))!.reject(Error("Previous room fallback failed"));
  await flush();

  assert.equal(audio.lastError, null);
  assert.notEqual(audio.position("kart"), null);
  assert.equal(audio.position("hall"), null);
  assert.equal(sources.filter((source) => source.started && !source.stopped).length, 1);
});
