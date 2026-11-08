import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as math from "../lib/math.ts";
import * as input from "../lib/input.ts";
import { SCENE } from "../lib/scene.ts";
import { SpriteClock } from "../lib/sprite-clock.ts";
import { SnackSequence } from "../lib/snack.ts";
import { advanceWalk } from "../lib/walk.ts";
import { PointerIntent } from "../lib/pointer-intent.ts";
import type { WorldController } from "../lib/world.ts";

const source = ts.transpileModule(
  readFileSync(new URL("../lib/world.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;

/** Run the real engine against fixed scene geometry and a controllable frame clock. */
function fixture(t: TestContext, reduced = false) {
  let now = 0,
    frameId = 0,
    active: Surface | null = null;
  const frames = new Map<number, FrameRequestCallback>();
  const scrolls: number[] = [];
  const sounds: string[] = [];
  const viewedFloors: number[] = [];
  const media = { matches: reduced };
  const windowMock = new EventTarget();
  const page = Object.assign(new EventTarget(), {
    hidden: false,
    querySelector: () => null,
  });
  Object.defineProperty(page, "activeElement", { get: () => active });
  const globals: Record<string, unknown> = {
    document: page,
    window: windowMock,
    innerWidth: 760,
    innerHeight: 700,
    scrollY: 0,
    performance: { now: () => now },
    AbortController,
    matchMedia: () => media,
    getComputedStyle: () => ({ getPropertyValue: () => "600" }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  class Surface extends EventTarget {
    dataset: Record<string, string> = {};
    hidden = false;
    disabled = false;
    children = new Map<string, Surface[]>();
    parentElement: Surface | null = null;
    classes = new Set<string>();
    classList = {
      contains: (name: string) => this.classes.has(name),
      toggle: (name: string, value: boolean) =>
        value ? this.classes.add(name) : this.classes.delete(name),
    };
    properties = new Map<string, string>();
    style = {
      scrollBehavior: "",
      getPropertyValue: (key: string) => this.properties.get(key) || "",
      setProperty: (key: string, value: string) =>
        this.properties.set(key, value),
      removeProperty: (key: string) => this.properties.delete(key),
    };
    clientWidth = 760;
    offsetWidth = 3600;
    offsetHeight = 1000;
    scrollHeight = 2000;
    top = 0;
    textContent = "";
    querySelectorAll(selector: string) {
      return this.children.get(selector) || [];
    }
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] || null;
    }
    setAttribute(name: string, value: string) {
      this.properties.set(name, value);
    }
    getAttribute(name: string) {
      return this.properties.get(name) || null;
    }
    hasAttribute(name: string) {
      return this.properties.has(name);
    }
    closest(_selector: string): Surface | null {
      return null;
    }
    contains(node: unknown) {
      return node === this;
    }
    matches() {
      return false;
    }
    focus() {
      active = this;
    }
    blur() {
      if (active === this) active = null;
    }
    scrollIntoView() {}
    getBoundingClientRect() {
      const top = this.top - Number(globals.scrollY);
      return {
        top,
        bottom: top + this.offsetHeight,
        left: 0,
        right: this.clientWidth,
        width: this.offsetWidth,
        height: this.offsetHeight,
      };
    }
  }
  const root = new Surface();
  root.parentElement = new Surface();
  const floors = [new Surface(), new Surface()];
  floors[1].top = 1000;
  const actors = floors.map(() => new Surface());
  const lifts = floors.map(() => new Surface());
  const inners = floors.map(() => new Surface());
  floors.forEach((floor, i) => {
    floor.dataset.floor = String(i);
    floor.dataset.visible = "true";
    let height = floor.offsetHeight;
    Object.defineProperty(floor, "offsetHeight", {
      get: () =>
        root.classList.contains("is-handheld") &&
        floor.dataset.current === "false"
          ? 0
          : height,
      set: (value: number) => {
        height = value;
      },
    });
    floor.getBoundingClientRect = () => {
      const top = root.classList.contains("is-handheld")
        ? 0
        : floor.top - Number(globals.scrollY);
      return {
        top,
        bottom: top + floor.offsetHeight,
        left: 0,
        right: floor.clientWidth,
        width: floor.clientWidth,
        height: floor.offsetHeight,
      };
    };
    inners[i].getBoundingClientRect = () => ({
      ...floor.getBoundingClientRect(),
      width: 3600,
    });
    actors[i].getBoundingClientRect = () => {
      const [, x, y] =
        actors[i].style
          .getPropertyValue("transform")
          .match(/translate3d\(([-\d]+)px,([-\d]+)px/) || [];
      const left =
        Number(x || 0) -
        parseFloat(floor.style.getPropertyValue("--camera-x") || "0");
      const top = floor.top + Number(y || 0) - Number(globals.scrollY);
      return {
        left,
        right: left + 120,
        top,
        bottom: top + 120,
        width: 120,
        height: 120,
      };
    };
    const prompt = new Surface();
    prompt.children.set("[data-prompt-title]", [new Surface()]);
    prompt.children.set("[data-prompt-action]", [new Surface()]);
    floor.children.set("[data-world-inner]", [inners[i]]);
    floor.children.set("[data-player]", [actors[i]]);
    floor.children.set("[data-world-prompt]", [prompt]);
    floor.children.set("[data-companion]", [new Surface()]);
    floor.children.set(".world-lift", [lifts[i]]);
    lifts[i].dataset = {
      kind: "lift",
      target: `lift-${i}`,
      x: "520",
      label: "Use lift",
    };
    lifts[i].closest = (selector) =>
      selector === "[data-world-inner]"
        ? inners[i]
        : selector.startsWith("input,")
          ? lifts[i]
          : null;
    lifts[i].getBoundingClientRect = () => {
      const left = 520 - parseFloat(floor.style.getPropertyValue("--camera-x"));
      const top = floor.top + 650 - Number(globals.scrollY);
      return {
        left,
        right: left + 120,
        top,
        bottom: top + 220,
        width: 120,
        height: 220,
      };
    };
    inners[i].children.set("[data-target]", [lifts[i]]);
    inners[i].children.set("[data-dust-layer]", [new Surface()]);
  });
  root.children.set("[data-floor]", floors);
  const html = new Surface();
  Object.assign(page, { documentElement: html });
  Object.assign(windowMock, {
    scrollTo: ({ top }: { top: number }) => {
      globals.scrollY = top;
      scrolls.push(top);
    },
  });
  Object.assign(globals, {
    Element: Surface,
    HTMLElement: Surface,
    HTMLButtonElement: Surface,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const imports: Record<string, unknown> = {
    "./math": math,
    "./input": input,
    "./scene": { SCENE },
    "./audio": {
      audio: {
        effect(name: string) {
          sounds.push(name);
        },
      },
    },
    "./assets": { SPRITES: {} },
    "./sprite-clock": { SpriteClock },
    "./snack": { SnackSequence },
    "./walk": { advanceWalk },
    "./pointer-intent": { PointerIntent },
    "./dust": {
      createFootDust: () => ({
        active: false,
        clear() {},
        burst() {},
        update() {},
        destroy() {},
      }),
    },
  };
  const module = {
    exports: {} as { createWorld: (...args: unknown[]) => WorldController },
  };
  runInNewContext(`(function(require,module,exports){${source}\n})`, globals)(
    (name: string) => {
      assert.ok(name in imports, name);
      return imports[name];
    },
    module,
    module.exports,
  );
  const engine = module.exports.createWorld(
    root,
    () => {},
    () => {},
    () => {},
    (floor: number) => viewedFloors.push(floor),
  );
  engine.setAmbient(true);
  t.after(() => engine.destroy());
  return {
    engine,
    root,
    floors,
    actors,
    lifts,
    page,
    media,
    scrolls,
    sounds,
    viewedFloors,
    position(i: number) {
      const [, x, y] = actors[i].style
        .getPropertyValue("transform")
        .match(/translate3d\(([-\d]+)px,([-\d]+)px/)!;
      return {
        x: Number(x) + 60,
        y: Number(y) + 120,
        camera: parseFloat(floors[i].style.getPropertyValue("--camera-x")),
      };
    },
    scroll(y: number) {
      globals.scrollY = y;
      windowMock.dispatchEvent(new Event("scroll"));
    },
    currentScroll: () => Number(globals.scrollY),
    viewportHeight(value: number) {
      globals.innerHeight = value;
      windowMock.dispatchEvent(new Event("resize"));
    },
    restorePage() {
      const before = Number(globals.scrollY);
      engine.restorePage();
      if (Number(globals.scrollY) !== before) {
        windowMock.dispatchEvent(new Event("scroll"));
        windowMock.dispatchEvent(new Event("scrollend"));
      }
    },
    event(name: string) {
      windowMock.dispatchEvent(new Event(name));
    },
    hidden(value: boolean) {
      page.hidden = value;
      page.dispatchEvent(new Event("visibilitychange"));
    },
    handheld(value: boolean) {
      root.classList.toggle("is-handheld", value);
    },
    focusLift(index: number) {
      active = lifts[index];
      const event = new Event("focusin");
      Object.defineProperty(event, "target", { value: active });
      page.dispatchEvent(event);
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(now));
      }
    },
    assertHome() {
      const current = engine.position().floor;
      assert.equal(this.position(current).x, 1800);
      assert.equal(
        this.position(current).y,
        floors[current].offsetHeight - SCENE.walkline,
      );
      for (let i = 0; i < 2; i++) {
        assert.equal(
          this.position(i).camera,
          Math.round(1800 - floors[i].clientWidth / 2),
        );
        assert.equal(
          actors[i].style.getPropertyValue("visibility"),
          i === current ? "visible" : "hidden",
        );
      }
    },
  };
}

test("page release walks only the current Sam home and restores both cameras", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 3100, false);
  scene.engine.goTo(0, 520, false);
  scene.engine.control(0);
  const scrolls = scene.scrolls.length;
  scene.event("wheel");
  assert.equal(scene.position(0).x, 520);
  scene.step(30);
  const first = scene.position(0).x;
  assert.ok(first > 520 && first < 660);
  const camera = scene.position(0).camera;
  assert.ok(camera > 340 && camera < 1420);
  scene.event("wheel");
  scene.step(30);
  assert.ok(
    scene.position(0).x - first > 90,
    "repeated wheel does not reset acceleration",
  );
  scene.step(420);
  scene.assertHome();
  assert.equal(
    scene.position(1).x,
    3100,
    "inactive render surface does not walk a second Sam",
  );
  assert.equal(scene.scrolls.length, scrolls);
});

test("handheld exit stays on the destination floor even when the page is still at its entry floor", (t) => {
  const scene = fixture(t);
  scene.handheld(true);
  scene.engine.goTo(0, 520, false);
  scene.engine.goTo(1, 3100, false);
  scene.engine.control(1);
  scene.engine.cancelTravel();
  scene.engine.release();
  scene.handheld(false);
  const scrolls = scene.scrolls.length;
  scene.engine.restorePage();
  assert.equal(scene.engine.position().floor, 1);
  assert.equal(Reflect.get(scene.page, "activeElement"), scene.floors[1]);
  assert.equal(
    scene.currentScroll(),
    1276,
    "page follows the destination floor baseline",
  );
  scene.step(480);
  scene.assertHome();
  assert.equal(scene.scrolls.length, scrolls + 1);
});

test("exit cancels an unfinished lift flight and its stale animation frame", (t) => {
  const scene = fixture(t);
  scene.handheld(true);
  scene.engine.control(0);
  scene.engine.travel(1);
  scene.step(12);
  assert.equal(scene.root.dataset.travelling, "true");
  scene.engine.cancelTravel();
  scene.engine.release();
  scene.handheld(false);
  scene.engine.restorePage();
  scene.step(480);
  scene.assertHome();
  assert.equal(scene.root.dataset.travelling, "false");
  assert.ok(scene.lifts.every((lift) => !lift.disabled));
});

test("new movement interrupts the return at Sam's current position", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  const before = scene.position(0).x;
  scene.engine.control(0);
  assert.equal(scene.position(0).x, before);
  scene.engine.virtual("left", true);
  scene.step(30);
  assert.ok(scene.position(0).x < before);
  assert.equal(scene.root.dataset.control, "manual");
  scene.engine.virtual("left", false);
  scene.step(400);
  assert.ok(
    scene.position(0).x < before,
    "old return never resumes behind the user",
  );
});

test("blur, hidden tabs and overlays suspend a return without elapsed-time jumps", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(30);
  for (const reason of ["blur", "hidden", "overlay"]) {
    if (reason === "blur") scene.event("blur");
    else if (reason === "hidden") scene.hidden(true);
    else scene.engine.pause("overlay", true);
    const before = scene.position(0);
    scene.step(600);
    assert.deepEqual(scene.position(0), before);
    if (reason === "blur") scene.event("focus");
    else if (reason === "hidden") scene.hidden(false);
    else scene.engine.pause("overlay", false);
    scene.step();
    assert.ok(Math.abs(scene.position(0).x - before.x) < 5);
    scene.step(30);
  }
  scene.step(480);
  scene.assertHome();
});

test("reduced motion restores the centered, grounded page immediately", (t) => {
  const scene = fixture(t, true);
  scene.engine.goTo(0, 520, false);
  scene.engine.goTo(1, 3100, false);
  const scrolls = scene.scrolls.length;
  scene.engine.restorePage();
  scene.assertHome();
  assert.equal(scene.scrolls.length, scrolls + 1);
});

test("ordinary page scroll repairs a focus-owned camera pan without manual control", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.event("wheel");
  scene.step(480);
  scene.assertHome();
});

test("handheld reentry stops the pending page return before measuring its new frame", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  const before = scene.position(0).x;
  scene.handheld(true);
  scene.engine.refresh();
  scene.engine.control(0);
  scene.step(400);
  assert.equal(scene.position(0).x, before);
});

test("reading scroll transfers the same Sam and the return continues on the newly visible floor", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.restorePage();
  scene.step(50);
  const first = scene.engine.position().x;
  scene.scroll(1000);
  assert.equal(scene.engine.position().floor, 1);
  assert.equal(scene.engine.position().x, first);
  assert.equal(scene.viewedFloors.at(-1), 1);
  assert.ok(
    scene.position(1).x - scene.position(1).camera >= 60,
    "Sam remains visible after the floor switch",
  );
  scene.step(50);
  assert.equal(scene.position(0).x, Math.round(first));
  assert.ok(scene.position(1).x > first);
  const beforeSwitches = scene.engine.position().x;
  for (const next of [0, 1, 0, 1, 0]) {
    scene.scroll(next * 1000);
    assert.equal(scene.engine.position().floor, next);
    assert.equal(scene.engine.position().x, beforeSwitches);
  }
  scene.step(480);
  scene.assertHome();
});

test("keyboard focus can inspect an off-center target and the next scroll restores the page", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  scene.focusLift(0);
  const focused = scene.position(0);
  assert.equal(focused.camera, 140);
  scene.step(180);
  assert.deepEqual(
    scene.position(0),
    focused,
    "return must not fight deliberate focus",
  );
  scene.event("wheel");
  scene.step(480);
  scene.assertHome();
});

test("an airborne release settles naturally and cannot replay the buffered jump", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.control(0);
  scene.engine.virtual("secondary", true);
  scene.step(8);
  const airborne = scene.position(0).y;
  assert.ok(airborne < 912);
  scene.event("wheel");
  assert.equal(scene.position(0).y, airborne);
  scene.step(480);
  scene.assertHome();
  scene.engine.control(1);
  scene.step(60);
  assert.equal(scene.position(1).y, 912);
  assert.equal(scene.sounds.filter((sound) => sound === "jump").length, 1);
});

test("page resize changes the centering target without changing Sam's position", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  const before = scene.position(0).x;
  scene.floors.forEach((floor) => {
    floor.clientWidth = 320;
  });
  scene.engine.refresh();
  assert.equal(scene.position(0).x, before);
  scene.step(480);
  for (let i = 0; i < 2; i++) {
    assert.equal(scene.position(i).x, 1800);
    assert.equal(scene.position(i).camera, 1640);
  }
});

test("enabling reduced motion while returning settles the remaining movement", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  scene.media.matches = true;
  scene.step();
  scene.assertHome();
});

test("scrolling away from both floors suspends the return without a catch-up frame", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.restorePage();
  scene.step(40);
  scene.scroll(2500);
  scene.step();
  const before = scene.position(0);
  scene.step(600);
  scene.scroll(0);
  scene.step();
  assert.deepEqual(scene.position(0), before);
  scene.step(480);
  scene.assertHome();
});

test("handheld exit rebases both floors from hidden/compact geometry before returning", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.goTo(1, 3100, false);
  scene.handheld(true);
  scene.floors[0].offsetHeight = 0;
  scene.floors[1].offsetHeight = 360;
  scene.floors[1].clientWidth = 350;
  scene.floors[1].top = 0;
  scene.engine.refresh();
  scene.engine.control(1);
  assert.equal(scene.position(1).y, 272);
  scene.engine.cancelTravel();
  scene.engine.release();
  scene.handheld(false);
  scene.floors[0].offsetHeight = 1000;
  scene.floors[1].offsetHeight = 1200;
  scene.floors[1].clientWidth = 760;
  scene.floors[1].top = 1000;
  scene.engine.restorePage();
  scene.step(480);
  assert.deepEqual(scene.position(0), { x: 520, y: 912, camera: 1420 });
  assert.deepEqual(scene.position(1), { x: 1800, y: 1112, camera: 1420 });
  assert.equal(scene.engine.position().floor, 1);
});

test("the camera keeps the single Sam visible on either floor and approach", (t) => {
  for (const width of [240, 393, 760, 1280]) {
    for (const floor of [0, 1]) {
      for (const start of [520, 3100]) {
        const scene = fixture(t);
        scene.floors.forEach((room) => {
          room.clientWidth = width;
        });
        scene.engine.goTo(floor, start, false);
        scene.restorePage();
        for (let frame = 0; frame < 480; frame++) {
          scene.step();
          const { x, camera } = scene.position(floor);
          assert.ok(
            x - camera >= 60 && x - camera <= width - 60,
            `Sam leaves floor ${floor} at frame ${frame}, width ${width}`,
          );
          assert.equal(
            scene.actors[1 - floor].style.getPropertyValue("visibility"),
            "hidden",
          );
        }
        scene.assertHome();
      }
    }
  }
});

test("same-floor scrollbar scrolling releases controls after engine framing completes", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.control(0);
  scene.event("scroll");
  scene.event("scrollend");
  assert.equal(
    scene.root.dataset.control,
    "manual",
    "engine framing is not a user exit",
  );
  scene.scroll(scene.currentScroll() + 20);
  assert.equal(scene.root.dataset.control, "ambient");
  scene.step(480);
  scene.assertHome();
});

test("a scrollbar interrupting automatic framing releases after the gesture ends", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(0, 520, false);
  scene.engine.control(0);
  scene.scroll(1000);
  scene.event("scrollend");
  assert.equal(scene.root.dataset.control, "ambient");
  assert.equal(
    scene.engine.position().floor,
    1,
    "reading scroll can take over from interrupted framing",
  );
  scene.step(480);
  scene.assertHome();
});

test("the final navigation scroll event does not undo a deliberate destination", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 3100, true);
  for (let i = 0; i < 60; i++) {
    const before = scene.currentScroll();
    scene.step();
    if (scene.currentScroll() !== before) {
      scene.event("scroll");
      scene.event("scrollend");
    }
  }
  scene.step(120);
  assert.equal(scene.engine.position().floor, 1);
  assert.equal(scene.position(1).x, 3100);
  assert.equal(scene.position(1).camera, 2720);
  scene.scroll(scene.currentScroll() - 20);
  scene.step(480);
  scene.assertHome();
});

test("exit remains on either arrival floor and frames that floor exactly once", (t) => {
  for (const destination of [0, 1]) {
    const scene = fixture(t);
    scene.engine.goTo(1 - destination, 520, false);
    scene.handheld(true);
    scene.engine.control(1 - destination);
    scene.engine.travel(destination);
    scene.step(60);
    assert.equal(scene.engine.position().floor, destination);
    scene.engine.cancelTravel();
    scene.engine.release();
    scene.handheld(false);
    const before = scene.scrolls.length;
    scene.restorePage();
    assert.equal(scene.engine.position().floor, destination);
    assert.equal(scene.currentScroll(), destination ? 1276 : 276);
    assert.equal(
      Reflect.get(scene.page, "activeElement"),
      scene.floors[destination],
    );
    scene.step(480);
    assert.equal(scene.engine.position().floor, destination);
    assert.equal(scene.scrolls.length, before + 1);
    scene.assertHome();
  }
});

test("focus on another floor changes only the view until the user explicitly takes control", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 2100, false);
  scene.focusLift(0);
  assert.equal(scene.engine.position().floor, 1);
  assert.equal(scene.engine.position().x, 2100);
  assert.equal(scene.viewedFloors.at(-1), 0);
  assert.equal(scene.actors[0].style.getPropertyValue("visibility"), "hidden");
  scene.engine.control(0);
  assert.equal(scene.engine.position().floor, 0);
  assert.equal(
    scene.engine.position().x,
    2100,
    "the same Sam transfers, not an old floor snapshot",
  );
  assert.equal(scene.actors[1].style.getPropertyValue("visibility"), "hidden");
});

test("arrival keeps the lift open until Sam walks away and then clears its hold", (t) => {
  const scene = fixture(t);
  scene.handheld(true);
  scene.engine.control(0);
  scene.engine.travel(1);
  scene.step(60);
  assert.equal(scene.lifts[1].dataset.arrived, "true");
  scene.step(600);
  assert.equal(
    scene.lifts[1].dataset.arrived,
    "true",
    "idle time does not close the arrival door",
  );
  scene.engine.virtual("right", true);
  scene.step(120);
  scene.engine.virtual("right", false);
  assert.ok(scene.engine.position().x > 710);
  assert.equal(scene.lifts[1].dataset.arrived, undefined);
  assert.equal(scene.lifts[1].classList.contains("is-near"), false);
});

test("travelling straight back closes the previous floor's empty lift", (t) => {
  const scene = fixture(t);
  scene.handheld(true);
  scene.engine.control(0);
  scene.engine.travel(1);
  scene.step(60);
  assert.equal(scene.lifts[1].dataset.arrived, "true");
  scene.engine.travel(0);
  scene.step(60);
  assert.equal(scene.lifts[1].dataset.arrived, undefined);
  assert.equal(scene.lifts[1].classList.contains("is-near"), false);
  assert.equal(scene.lifts[0].dataset.arrived, "true");
  assert.equal(scene.actors[0].style.getPropertyValue("visibility"), "visible");
  assert.equal(scene.actors[1].style.getPropertyValue("visibility"), "hidden");
});

test("exiting at the lift holds its door while Sam starts the same-floor walk home", (t) => {
  const scene = fixture(t);
  scene.handheld(true);
  scene.engine.control(0);
  scene.engine.travel(1);
  scene.step(60);
  scene.engine.release();
  scene.handheld(false);
  scene.restorePage();
  assert.equal(scene.lifts[1].dataset.arrived, "true");
  scene.step(30);
  assert.equal(scene.lifts[1].dataset.arrived, "true");
  scene.step(90);
  assert.equal(scene.lifts[1].dataset.arrived, undefined);
  assert.equal(scene.engine.position().floor, 1);
  scene.step(360);
  scene.assertHome();
});

test("a page lift link to Sam's existing floor only brings that floor into view", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 2100, false);
  scene.engine.travel(1);
  assert.equal(scene.root.dataset.travelling, "false");
  scene.step(60);
  assert.equal(scene.engine.position().floor, 1);
  assert.equal(scene.engine.position().x, 2100);
  assert.equal(scene.lifts[1].dataset.arrived, undefined);
});

test("a viewport-only resize updates the viewed floor without moving Sam or page scroll", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 2100, false);
  scene.scroll(800);
  assert.equal(scene.viewedFloors.at(-1), 1);
  const before = scene.engine.position();
  scene.viewportHeight(320);
  assert.equal(scene.viewedFloors.at(-1), 0);
  assert.deepEqual(scene.engine.position(), before);
  assert.equal(scene.currentScroll(), 800);
});

test("engine-owned framing does not switch Sam floors, but subsequent reading scroll does", (t) => {
  const scene = fixture(t);
  scene.engine.goTo(1, 520, false);
  scene.engine.control(1);
  scene.scroll(300);
  assert.equal(
    scene.engine.position().floor,
    1,
    "intermediate framing remains owned by Sam's destination",
  );
  scene.scroll(1276);
  scene.event("scrollend");
  assert.equal(scene.engine.position().floor, 1);
  scene.scroll(0);
  assert.equal(
    scene.engine.position().floor,
    0,
    "new user scroll resumes automatic floor following",
  );
  assert.equal(scene.engine.position().x, 520);
  scene.step(480);
  scene.assertHome();
});
