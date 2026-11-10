import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { hallAudioShouldPlay } from "../lib/ambience.ts";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

// Execute the real callback bodies with controlled browser/audio dependencies.
// This follows the component-handler fixture used by navigation.test.ts.
function callbacks<const Name extends string>(
  file: string,
  names: readonly Name[],
  globals: Record<string, unknown>,
) {
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const definitions = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (names as readonly string[]).includes(node.name.text)
    ) {
      assert.ok(node.initializer && ts.isCallExpression(node.initializer));
      definitions.set(
        node.name.text,
        node.initializer.arguments[0].getText(source),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const code = names
    .map((name) => {
      assert.ok(definitions.has(name), `Missing callback ${name}`);
      return `const ${name} = ${definitions.get(name)}; exports.${name} = ${name};`;
    })
    .join("\n");
  const output = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const exports = {} as Record<Name, (...args: any[]) => any>;
  runInNewContext(output, { ...globals, exports });
  return exports;
}

function convention() {
  const calls: string[] = [];
  const state = { sound: false, status: "off", error: "" };
  const page = { hidden: false, focused: true, hasFocus: () => page.focused };
  const desiredSound = { current: false },
    explicitlyMuted = { current: false },
    soundIntent = { current: 0 };
  const panelRef = { current: null as unknown },
    arrivalRef = { current: false },
    handheldEntry = { current: null as unknown };
  const ambienceRef = { current: false },
    viewedFloorRef = { current: 0 };
  const pendingEnable = deferred<boolean>(),
    pendingPlay = deferred<boolean>();
  let holdEnable = false,
    holdPlay = false,
    failEnable = false;
  const audio = {
    enabled: false,
    setEnabled(next: boolean) {
      calls.push(`enabled:${next}`);
      this.enabled = next;
      if (!next) pendingPlay.resolve(false);
      if (next && failEnable) return Promise.reject(Error("Unavailable"));
      return next && holdEnable ? pendingEnable.promise : Promise.resolve(next);
    },
    play(track: string) {
      calls.push(`play:${track}`);
      return holdPlay ? pendingPlay.promise : Promise.resolve(true);
    },
    prepare() {
      assert.fail("Convention must not duplicate track preparation");
    },
    effect(name: string) {
      calls.push(`effect:${name}`);
    },
  };
  const handlers = callbacks(
    "Convention.tsx",
    ["requestSound", "toggleSound", "enableSoundForGesture", "movementIntent"],
    {
      audio,
      document: page,
      desiredSound,
      explicitlyMuted,
      soundIntent,
      panelRef,
      arrivalRef,
      handheldEntry,
      ambienceRef,
      viewedFloorRef,
      hallAudioShouldPlay,
      setSound: (value: boolean) => {
        state.sound = value;
      },
      setSoundStatus: (value: string) => {
        state.status = value;
      },
      setSoundError: (value: string) => {
        state.error = value;
      },
    },
  );
  return {
    ...handlers,
    audio,
    calls,
    state,
    page,
    panelRef,
    arrivalRef,
    handheldEntry,
    ambienceRef,
    viewedFloorRef,
    desiredSound,
    explicitlyMuted,
    pendingEnable,
    pendingPlay,
    holdEnable: () => {
      holdEnable = true;
    },
    holdPlay: () => {
      holdPlay = true;
    },
    failEnable: (value: boolean) => {
      failEnable = value;
    },
  };
}

test("accepted movement enables synchronously and repeated intent cannot toggle it off", async () => {
  const scene = convention();
  scene.viewedFloorRef.current = 1;
  scene.movementIntent();
  assert.deepEqual(
    scene.calls,
    ["enabled:true"],
    "unlock starts in the gesture call stack",
  );
  scene.movementIntent();
  scene.enableSoundForGesture();
  await flush();
  assert.equal(scene.calls.filter((call) => call === "enabled:true").length, 1);
  assert.ok(scene.calls.includes("play:office"));
  assert.equal(scene.state.status, "ready");
});

test("explicit mute blocks movement and game-start auto-enable until manually enabled", async () => {
  const scene = convention();
  scene.movementIntent();
  await flush();
  await scene.toggleSound();
  const calls = scene.calls.length;
  scene.movementIntent();
  scene.enableSoundForGesture();
  await flush();
  assert.equal(scene.calls.length, calls);
  assert.equal(scene.state.sound, false);
  assert.equal(scene.explicitlyMuted.current, true);
  await scene.toggleSound();
  assert.equal(scene.state.sound, true);
  assert.equal(scene.explicitlyMuted.current, false);
});

test("mute wins over both pending context unlock and pending venue playback", async () => {
  for (const phase of ["unlock", "play"] as const) {
    const scene = convention();
    if (phase === "unlock") scene.holdEnable();
    else scene.holdPlay();
    scene.movementIntent();
    await flush();
    await scene.toggleSound();
    scene.pendingEnable.resolve(true);
    scene.pendingPlay.resolve(true);
    await flush();
    scene.movementIntent();
    assert.equal(scene.audio.enabled, false, phase);
    assert.equal(scene.state.sound, false, phase);
    assert.equal(scene.state.status, "off", phase);
    assert.equal(scene.state.error, "", phase);
    assert.equal(
      scene.calls.filter((call) => call === "enabled:true").length,
      1,
      phase,
    );
  }
});

test("modal, entry, hidden and unfocused world intent stays silent; game intent does not prepare a venue", async () => {
  const scene = convention();
  for (const kind of ["register", "schedule", "npc", "game"]) {
    scene.panelRef.current = { kind };
    scene.movementIntent();
  }
  scene.panelRef.current = null;
  scene.arrivalRef.current = true;
  scene.movementIntent();
  scene.arrivalRef.current = false;
  scene.handheldEntry.current = {};
  scene.movementIntent();
  scene.handheldEntry.current = null;
  scene.page.hidden = true;
  scene.movementIntent();
  scene.page.hidden = false;
  scene.page.focused = false;
  scene.movementIntent();
  scene.page.focused = true;
  assert.equal(scene.calls.length, 0);
  scene.panelRef.current = { kind: "game", id: "beat" };
  scene.enableSoundForGesture();
  await flush();
  assert.deepEqual(scene.calls, ["enabled:true", "effect:click"]);
});

test("an unavailable context is not a user mute and a new deliberate gesture can retry", async () => {
  const scene = convention();
  scene.failEnable(true);
  scene.movementIntent();
  await flush();
  assert.equal(scene.state.status, "error");
  assert.equal(scene.explicitlyMuted.current, false);
  scene.failEnable(false);
  scene.movementIntent();
  await flush();
  assert.equal(scene.state.status, "ready");
  scene.ambienceRef.current = true;
  await scene.toggleSound();
  const count = scene.calls.filter((call) => call.startsWith("play:")).length;
  await scene.toggleSound();
  assert.equal(
    scene.calls.filter((call) => call.startsWith("play:")).length,
    count,
    "venue pause is not overridden",
  );
});

function game(id = "beat", owner = convention()) {
  owner.panelRef.current = { kind: "game", id };
  const modeRef = { current: "intro" },
    launch = { current: 0 },
    dialog = { current: { open: true } };
  const song = { current: { offset: 0, started: 0 } },
    elapsed = { current: 0 },
    lastFrame = { current: 0 };
  const ready = deferred<boolean>();
  const events: string[] = [];
  let rounds = 0;
  const audio = {
    duck() {},
    effect() {},
    pause() {
      events.push("pause");
    },
    play() {
      events.push(`play:${owner.audio.enabled}`);
      return owner.audio.enabled ? ready.promise : Promise.resolve(false);
    },
  };
  const handlers = callbacks(
    "GameHost.tsx",
    ["start", "restart", "selectCar"],
    {
      id,
      audio,
      document: owner.page,
      modeRef,
      launch,
      dialog,
      song,
      elapsed,
      lastFrame,
      onPlayIntent: () => {
        events.push("gesture");
        owner.enableSoundForGesture();
      },
      changeMode: (value: string) => {
        modeRef.current = value;
      },
      clearInput() {},
      setAudioError() {},
      performance: { now: () => 500 },
      soundRequest: { current: 0 },
      replay: { current: false },
      setResult() {},
      setNewBest() {},
      setRound: (update: (value: number) => number) => {
        rounds = update(rounds);
      },
      progressRef: { current: { selected: "fiat" } },
      normalizeProgress: (value: unknown) => value,
      setProgress() {},
      saveRaceProgress: () => true,
      setSessionOnly() {},
      setCarId() {},
      setUnlocks() {},
    },
  );
  return {
    ...handlers,
    modeRef,
    launch,
    dialog,
    song,
    ready,
    events,
    owner,
    rounds: () => rounds,
  };
}

test("direct rhythm Start enables in the gesture and waits for track readiness before its clock starts", async () => {
  const round = game();
  const starting = round.start();
  assert.deepEqual(round.events, ["gesture", "play:true"]);
  assert.equal(round.modeRef.current, "starting");
  assert.equal(round.song.current.started, 0);
  round.ready.resolve(true);
  await starting;
  assert.equal(round.modeRef.current, "playing");
  assert.equal(round.song.current.started, 500);
});

test("muted and programmatic starts do not regain sound; stale ready results cannot enter playing", async () => {
  const owner = convention();
  owner.movementIntent();
  await flush();
  await owner.toggleSound();
  const muted = game("beat", owner);
  await muted.start();
  assert.deepEqual(muted.events, ["gesture", "play:false"]);
  assert.equal(owner.audio.enabled, false);
  const replay = game();
  await replay.start(true, false);
  assert.deepEqual(replay.events, ["play:false"]);
  const closed = game();
  const start = closed.start();
  closed.launch.current++;
  closed.dialog.current.open = false;
  closed.ready.resolve(true);
  await start;
  assert.notEqual(closed.modeRef.current, "playing");
});

test("garage, confirmed race and replay actions issue intent before asynchronous controller loading", async () => {
  const race = game("kart");
  await race.start();
  assert.equal(race.modeRef.current, "garage");
  assert.deepEqual(race.events, ["gesture"]);
  race.selectCar("fiat");
  assert.equal(race.events.at(-1), "gesture");
  assert.equal(race.rounds(), 1);
  const round = game("runner");
  round.restart();
  assert.deepEqual(round.events, ["gesture", "pause"]);
  assert.equal(round.rounds(), 1);
});

function unmuteFixture(id = "beat", initiallyEnabled = false) {
  let now = 10000,
    prepared = initiallyEnabled,
    focusCount = 0;
  let running: { offset: number; started: number } | null = null;
  const bufferReady = deferred<void>();
  const preparations: string[] = [];
  const plays: { track: string; offset: number | undefined }[] = [];
  const starts: { offset: number; started: number }[] = [];
  const errors: string[] = [];
  const modeRef = { current: "playing" },
    launch = { current: 1 },
    soundRequest = { current: 0 },
    song = { current: { offset: 4, started: now } },
    elapsed = { current: 4 };
  const page = {
    hidden: false,
    focused: true,
    hasFocus: () => page.focused,
  };
  const dialog = { current: { open: true, focus() {} } };
  const audio = {
    enabled: initiallyEnabled,
    position(_track: string, stamp: number) {
      return this.enabled && running
        ? running.offset + (stamp - running.started) / 1000
        : null;
    },
    async prepare(track: string) {
      preparations.push(track);
      if (!prepared) await bufferReady.promise;
      prepared = true;
    },
    async play(track: string, offset?: number) {
      plays.push({ track, offset });
      if (!this.enabled) return false;
      // Model the uncached decode that previously happened after offset sampling.
      if (!prepared) await bufferReady.promise;
      if (!this.enabled) return false;
      prepared = true;
      running = { offset: offset ?? 0, started: now };
      starts.push(running);
      return true;
    },
    pause() {
      running = null;
    },
  };
  const handlers = callbacks("GameHost.tsx", ["readTime", "toggleSound"], {
    id,
    audio,
    document: page,
    performance: { now: () => now },
    modeRef,
    launch,
    soundRequest,
    dialog,
    song,
    elapsed,
    canvas: { current: { focus: () => focusCount++ } },
    onSound: async () => {
      audio.enabled = !audio.enabled;
      if (!audio.enabled) audio.pause();
    },
    setAudioError: (message: string) => errors.push(message),
  });
  return {
    ...handlers,
    audio,
    page,
    modeRef,
    launch,
    soundRequest,
    dialog,
    song,
    bufferReady,
    preparations,
    plays,
    starts,
    errors,
    advance: (milliseconds: number) => { now += milliseconds; },
    focuses: () => focusCount,
  };
}

test("cold rhythm unmute samples the current offset after decode without moving its clock backward", async () => {
  const round = unmuteFixture();
  const pending = round.toggleSound();
  await flush();
  assert.deepEqual(round.preparations, ["beat"]);
  assert.equal(round.plays.length, 0, "do not capture a seek before the buffer is ready");
  round.advance(6000);
  const whileLoading = round.readTime();
  assert.equal(whileLoading, 10, "the muted fallback clock keeps advancing");
  round.bufferReady.resolve();
  await pending;
  assert.equal(round.starts.length, 1);
  assert.equal(round.starts[0].offset, whileLoading);
  assert.equal(round.readTime(), whileLoading);
  round.advance(500);
  assert.equal(round.readTime(), whileLoading + 0.5);
});

test("obsolete rhythm preparations cannot play, publish errors or focus after a lifecycle change", async () => {
  const cases = ["mute", "restart", "exit", "pause-resume", "result", "hidden", "blur", "disabled"] as const;
  for (const change of cases) {
    const round = unmuteFixture();
    const pending = round.toggleSound();
    await flush();
    round.advance(3000);
    if (change === "mute") await round.toggleSound();
    if (change === "restart") {
      round.soundRequest.current++;
      round.launch.current++;
      round.modeRef.current = "intro";
    }
    if (change === "exit") {
      round.soundRequest.current++;
      round.launch.current++;
      round.dialog.current.open = false;
    }
    if (change === "pause-resume") {
      round.launch.current += 2;
      // The value is playing again, but this is a different phase.
      round.modeRef.current = "playing";
    }
    if (change === "result") round.modeRef.current = "result";
    if (change === "hidden") round.page.hidden = true;
    if (change === "blur") round.page.focused = false;
    if (change === "disabled") round.audio.enabled = false;
    const focuses = round.focuses(), errors = round.errors.length;
    round.bufferReady.resolve();
    await pending;
    assert.equal(round.starts.length, 0, change);
    assert.equal(round.focuses(), focuses, change);
    assert.equal(round.errors.length, errors, change);
  }
});

test("a superseded failing preparation stays quiet and a newer unmute owns the fresh offset", async () => {
  const failed = unmuteFixture();
  const obsolete = failed.toggleSound();
  await flush();
  await failed.toggleSound();
  const errors = failed.errors.length, focuses = failed.focuses();
  failed.bufferReady.reject(Error("Old request failed"));
  await obsolete;
  assert.equal(failed.errors.length, errors);
  assert.equal(failed.focuses(), focuses);

  const round = unmuteFixture();
  const first = round.toggleSound();
  await flush();
  round.advance(1000);
  await round.toggleSound();
  round.advance(1000);
  const latest = round.toggleSound();
  await flush();
  round.advance(4000);
  const expected = round.readTime();
  round.bufferReady.resolve();
  await Promise.all([first, latest]);
  assert.equal(round.starts.length, 1);
  assert.equal(round.starts[0].offset, expected);
  assert.equal(round.readTime(), expected);
});

test("muting and non-rhythm audio do not acquire the rhythm preparation barrier", async () => {
  const muted = unmuteFixture("beat", true);
  await muted.toggleSound();
  assert.equal(muted.audio.enabled, false);
  assert.deepEqual(muted.preparations, []);
  assert.equal(muted.starts.length, 0);

  const runner = unmuteFixture("runner");
  const pending = runner.toggleSound();
  await flush();
  assert.deepEqual(runner.preparations, []);
  assert.equal(runner.plays[0].offset, undefined);
  runner.bufferReady.resolve();
  await pending;
  assert.equal(runner.starts.length, 1);
});
