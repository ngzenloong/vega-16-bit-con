import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Execute the real scene effect while exposing React's before/after-paint boundary. */
function fixture(initialHeight = "") {
  const source = ts.createSourceFile(
    "Dialogue.tsx",
    readFileSync(new URL("../components/Dialogue.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let lifecycle: ts.CallExpression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ["useEffect", "useLayoutEffect"].includes(node.expression.getText(source)) &&
      node.arguments[0]?.getText(source).includes("d.showModal()")
    )
      lifecycle = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(lifecycle, "missing dialogue scene lifecycle");

  const properties = new Map<string, string>();
  const world = {
    offsetHeight: 2300,
    dataset: {} as Record<string, string>,
    style: {
      height: initialHeight,
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
    },
  };
  const classes = new Set<string>();
  const floor = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
  };
  const actor = {
    dataset: { x: "1800", headX: "0" },
    closest: (selector: string) => selector === "[data-floor]" ? floor : world,
  };
  const scene = () => ({
    cinematic: world.dataset.conversation === "true",
    fixed: classes.has("is-conversation"),
    height: world.style.height,
  });
  const releaseScenes: ReturnType<typeof scene>[] = [];
  const closeScenes: ReturnType<typeof scene>[] = [];
  const focusScenes: ReturnType<typeof scene>[] = [];
  const dialog = Object.assign(new EventTarget(), {
    open: false,
    showModal() { this.open = true; },
    close() { closeScenes.push(scene()); this.open = false; },
    focus() {},
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 240 }) }),
  });
  const document = {
    activeElement: { focus: () => focusScenes.push(scene()) },
    body: { style: { overflow: "auto" } },
    documentElement: { style: { scrollBehavior: "smooth" } },
    querySelector: () => actor,
  };
  const frames = new Map<number, FrameRequestCallback>();
  const scrolls: number[] = [];
  let nextFrame = 0;
  let phase = "";
  let effect: (() => () => void) | undefined;
  let cleanup: (() => void) | undefined;
  const register = (kind: string) => (callback: () => () => void) => {
    phase = kind;
    effect = callback;
  };
  const globals = {
    ref: { current: dialog }, id: "host", typing: { current: 0 },
    exitTimer: { current: null }, leave() {},
    SCENE: { width: 3600 }, innerWidth: 900, scrollY: 1200,
    document,
    window: Object.assign(new EventTarget(), {
      scrollTo: ({ top }: { top: number }) => {
        globals.scrollY = top;
        scrolls.push(top);
      },
    }),
    audio: { duck() {} },
    retainDialogFocus: () => () => releaseScenes.push(scene()),
    useEffect: register("passive"),
    useLayoutEffect: register("layout"),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    clearTimeout() {},
  };
  const output = ts.transpileModule(lifecycle.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, globals);
  return {
    dialog, document, globals, scrolls, properties, releaseScenes, closeScenes,
    focusScenes, scene,
    mountBeforePaint() { if (phase === "layout") cleanup = effect!(); },
    mount() { cleanup = effect!(); },
    unmountBeforePaint() { if (phase === "layout") cleanup?.(); },
    cleanup() { cleanup?.(); },
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    },
  };
}

test("dialogue establishes its scene and modal together before the first paint", () => {
  const view = fixture();
  view.mountBeforePaint();
  assert.equal(view.dialog.open, true);
  assert.deepEqual(view.scene(), { cinematic: true, fixed: true, height: "2300px" });
  assert.equal(view.document.body.style.overflow, "hidden");
  view.cleanup();
});

test("dialogue restores page or handheld geometry before unlocking and painting its exit", () => {
  for (const height of ["", "640px"]) {
    const view = fixture(height);
    view.mount();
    view.unmountBeforePaint();
    const restored = { cinematic: false, fixed: false, height };
    assert.deepEqual(view.scene(), restored);
    assert.deepEqual(view.closeScenes, [restored]);
    assert.deepEqual(view.releaseScenes, [restored]);
    assert.deepEqual(view.focusScenes, [restored]);
    assert.equal(view.document.body.style.overflow, "auto");
    assert.equal(view.properties.size, 0);
    assert.equal(view.globals.scrollY, 1200);
  }
});

test("a disposed dialogue leaves no delayed scroll that overwrites subsequent navigation", () => {
  const view = fixture();
  view.mount();
  view.cleanup();
  assert.equal(view.globals.scrollY, 1200);
  view.globals.scrollY = 1700;
  view.flushFrames();
  assert.equal(view.globals.scrollY, 1700);
  assert.deepEqual(view.scrolls, [1200]);
  assert.equal(view.document.documentElement.style.scrollBehavior, "smooth");
});
