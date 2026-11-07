import { clamp, landingSurface } from "./math";
import { HeldInput } from "./input";
import { audio } from "./audio";
import { SCENE } from "./scene";
import type { GameButton } from "./games/types";

export const WORLD_WIDTH = SCENE.width;
export type WorldTarget = {
  kind: "game" | "npc" | "lift" | "register" | "session";
  id: string;
  label: string;
  element: HTMLElement;
};
export type WorldController = {
  pause: (reason: string, value: boolean) => void;
  virtual: (key: GameButton, down: boolean, source?: string) => void;
  goTo: (floor: number, x?: number, scroll?: boolean) => HTMLElement;
  travel: (floor: number) => void;
  cancelTravel: () => void;
  release: () => void;
  focus: () => void;
  refresh: () => void;
  destroy: () => void;
  position: () => { floor: number; x: number };
  setAmbient: (paused: boolean) => void;
};
type Surface = { x: number; y: number; w: number; node: HTMLElement | null };
type View = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
  support: HTMLElement | null;
  camera: number;
  width: number;
  tracking: number;
  idleOrigin: number;
  idleTarget: number;
  idleAfter: number;
};
type Flight = {
  id: number;
  floor: number;
  fromCamera: number;
  toCamera: number;
  fromScroll: number;
  toScroll: number;
  started: number;
  duration: number;
  scroll: boolean;
  lift: boolean;
  fromX: number;
  toX: number;
  walk: boolean;
};
const codes: Record<string, GameButton> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "secondary",
  Enter: "action",
};
const fallback: Record<string, GameButton> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  " ": "secondary",
  enter: "action",
};
const nativeControl = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest(
    'input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="combobox"],[role="tab"],[role="checkbox"],[role="radio"]',
  );
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function createWorld(
  root: HTMLElement,
  onTarget: (target: WorldTarget) => void,
  announce: (text: string) => void,
): WorldController {
  const floors = [...root.querySelectorAll<HTMLElement>("[data-floor]")];
  const inners = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-world-inner]")!,
  );
  const players = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-player]")!,
  );
  const prompts = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-world-prompt]")!,
  );
  const targets = inners.map((i) => [
    ...i.querySelectorAll<HTMLElement>("[data-target]"),
  ]);
  const platforms = inners.map((i) => [
    ...i.querySelectorAll<HTMLElement>("[data-platform]"),
  ]);
  const input = new HeldInput(),
    paused = new Set<string>(),
    abort = new AbortController();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    signal = abort.signal;
  const geometry = floors.map(() => ({
    ground: 700,
    surfaces: [] as Surface[],
  }));
  const views: View[] = floors.map((f) => ({
    x: SCENE.booth,
    y: 700,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    support: null,
    camera: clamp(
      SCENE.booth - f.clientWidth / 2,
      0,
      WORLD_WIDTH - f.clientWidth,
    ),
    width: f.clientWidth,
    tracking: f.clientWidth / 2,
    idleOrigin: SCENE.booth,
    idleTarget: SCENE.booth + 45,
    idleAfter: performance.now() + 6500,
  }));
  const walkers = [...root.querySelectorAll<HTMLElement>("[data-roam]")].map(
    (el) => {
      const range = Number(el.dataset.roam),
        duration = range / 38;
      return {
        el,
        home: Number(el.dataset.homeX),
        range,
        duration,
        time:
          el.dataset.facing === "left" ? duration * 1.5 + 2 : duration * 0.5,
        floor: Number(el.closest<HTMLElement>("[data-floor]")!.dataset.floor),
      };
    },
  );
  let floor = 0,
    manual = false,
    raf = 0,
    last = 0,
    accumulator = 0,
    lastInput = 0,
    near = "",
    dropUntil = 0,
    coyote = 0,
    jumpBuffer = 0;
  let ambientPaused = reduced.matches,
    destroyed = false,
    pointerFocusUntil = 0,
    navFrame = 0,
    navId = 0,
    flight: Flight | null = null,
    oldScrollBehavior = "";
  const current = () => views[floor];
  const setStyle = (el: HTMLElement, key: string, value: string) => {
    if (el.style.getPropertyValue(key) !== value)
      el.style.setProperty(key, value);
  };
  function visibleFloor() {
    let best = -1,
      area = 0;
    for (let i = 0; i < floors.length; i++) {
      const r = floors[i].getBoundingClientRect(),
        height = Math.max(
          0,
          Math.min(innerHeight, r.bottom) - Math.max(0, r.top),
        );
      if (height > area && height > Math.min(r.height, innerHeight) * 0.35) {
        area = height;
        best = i;
      }
    }
    return best;
  }
  function schedule() {
    if (!raf && !destroyed && !document.hidden)
      raf = requestAnimationFrame(tick);
  }
  function focus() {
    if (!paused.has("overlay")) floors[floor].focus({ preventScroll: true });
  }
  function release() {
    input.clear();
    manual = false;
    const v = current();
    v.vx = 0;
    jumpBuffer = 0;
    v.idleOrigin = v.x;
    v.idleTarget = v.x + 45;
    v.idleAfter = performance.now() + 10000;
    root.dataset.control = "ambient";
    schedule();
  }
  function travelState(active: boolean, lift = false) {
    root.dataset.travelling = String(active && lift);
    root.dataset.navigating = String(active);
    root.setAttribute("aria-busy", String(active));
    for (const group of targets)
      for (const target of group)
        if (target instanceof HTMLButtonElement) target.disabled = active;
  }
  function cancelTravel() {
    if (!flight) return;
    flight = null;
    navId++;
    cancelAnimationFrame(navFrame);
    paused.delete("navigation");
    document.documentElement.style.scrollBehavior = oldScrollBehavior;
    travelState(false);
    current().tracking = current().x - current().camera;
    last = 0;
    schedule();
  }
  function measure() {
    // Cinematic scaling is presentation-only; it must not alter collision geometry.
    if (root.dataset.conversation === "true") {
      render(0);
      return;
    }
    for (let i = 0; i < floors.length; i++) {
      const el = floors[i],
        v = views[i];
      if (!el.offsetHeight) continue;
      geometry[i].ground = el.offsetHeight - SCENE.walkline;
      const base = inners[i].getBoundingClientRect(),
        sx = base.width / inners[i].offsetWidth || 1,
        sy = base.height / inners[i].offsetHeight || 1;
      for (const target of targets[i])
        if (target.dataset.kind === "session") {
          const rect = target.getBoundingClientRect();
          target.dataset.x = String(
            (rect.left - base.left + rect.width / 2) / sx,
          );
        }
      geometry[i].surfaces = [
        { x: 0, y: geometry[i].ground, w: WORLD_WIDTH, node: null },
        ...platforms[i]
          .map((node) => {
            const r = node.getBoundingClientRect();
            return {
              x: (r.left - base.left) / sx,
              y:
                (r.top - base.top) / sy +
                Number(node.dataset.surfaceOffset || 0),
              w: r.width / sx,
              node,
            };
          })
          .filter((s) => s.w > 0),
      ];
      if (v.grounded) {
        const support = geometry[i].surfaces.find((s) => s.node === v.support);
        if (support) v.y = support.y;
        else v.grounded = false;
      }
      const width = el.clientWidth;
      if (v.width && v.width !== width) v.camera += v.width / 2 - width / 2;
      setStyle(el, "--viewport-width", `${width}px`);
      v.width = width;
      v.camera = clamp(v.camera, 0, Math.max(0, WORLD_WIDTH - width));
      v.tracking = v.x - v.camera;
    }
    if (flight) {
      flight.fromCamera = views[flight.floor].camera;
      flight.fromX = views[flight.floor].x;
      flight.toCamera = clamp(
        flight.toX - floors[flight.floor].clientWidth / 2,
        0,
        WORLD_WIDTH - floors[flight.floor].clientWidth,
      );
      flight.fromScroll = scrollY;
      flight.toScroll = destinationScroll(flight.floor, flight.lift);
      flight.started = performance.now();
    }
    render(0);
    schedule();
  }
  function activate(index: number, px?: number) {
    release();
    floor = clamp(index, 0, floors.length - 1);
    const v = current();
    floors.forEach((el, i) => (el.dataset.current = String(i === floor)));
    if (px !== undefined) {
      v.x = clamp(px, 40, WORLD_WIDTH - 40);
      v.support = null;
      v.grounded = true;
      v.vx = 0;
      v.vy = 0;
    }
    measure();
    if (px !== undefined) v.y = geometry[floor].ground;
    v.tracking = v.x - v.camera;
    v.idleOrigin = v.x;
    v.idleTarget = v.x + 45;
    v.idleAfter = performance.now() + 6500;
    near = "";
    render(0);
  }
  function destinationScroll(index: number, lift = false) {
    const el = floors[index],
      top = scrollY + el.getBoundingClientRect().top;
    return clamp(
      lift && el.offsetHeight > innerHeight
        ? top + el.offsetHeight - innerHeight
        : top - Math.max(0, (innerHeight - el.offsetHeight) / 2),
      0,
      Math.max(0, document.documentElement.scrollHeight - innerHeight),
    );
  }
  function navigate(
    index: number,
    px: number = SCENE.booth,
    scroll = true,
    lift = false,
  ) {
    if (lift && flight) return players[floor];
    const previousFloor = floor;
    const fromX = current().x;
    const canWalk =
      index === floor &&
      current().grounded &&
      current().support === null &&
      !lift;
    cancelTravel();
    activate(index, px);
    const v = current(),
      toCamera = clamp(
        px - floors[floor].clientWidth / 2,
        0,
        Math.max(0, WORLD_WIDTH - floors[floor].clientWidth),
      );
    const scrollPage = scroll && !root.classList.contains("is-handheld");
    if (!scroll || reduced.matches) {
      v.camera = toCamera;
      v.tracking = v.x - v.camera;
      if (scrollPage) {
        const before = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({
          top: destinationScroll(floor, lift),
          behavior: "auto",
        });
        document.documentElement.style.scrollBehavior = before;
      }
      render(0);
      focus();
      return players[floor];
    }
    const baseDuration =
      parseFloat(
        getComputedStyle(root).getPropertyValue("--duration-camera"),
      ) || 600;
    const duration = canWalk
      ? Math.max(baseDuration, (Math.abs(px - fromX) / 640) * 1000)
      : baseDuration;
    if (canWalk) v.x = fromX;
    flight = {
      id: ++navId,
      floor,
      fromCamera: v.camera,
      toCamera,
      fromScroll: scrollY,
      toScroll: scrollPage ? destinationScroll(floor, lift) : scrollY,
      started: performance.now(),
      duration,
      scroll: scrollPage,
      lift,
      fromX,
      toX: px,
      walk: canWalk,
    };
    oldScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    paused.add("navigation");
    travelState(true, lift || previousFloor !== floor || !canWalk);
    render(0);
    const advance = (now: number) => {
      const active = flight;
      if (!active || active.id !== navId || destroyed) return;
      const progress = clamp((now - active.started) / active.duration, 0, 1),
        amount = ease(progress),
        view = views[active.floor];
      view.camera =
        active.fromCamera + (active.toCamera - active.fromCamera) * amount;
      if (active.walk) {
        view.x = active.fromX + (active.toX - active.fromX) * progress;
        view.facing = active.toX >= active.fromX ? 1 : -1;
      }
      if (active.scroll)
        window.scrollTo({
          top:
            active.fromScroll + (active.toScroll - active.fromScroll) * amount,
          behavior: "auto",
        });
      render(0);
      if (progress < 1) navFrame = requestAnimationFrame(advance);
      else {
        flight = null;
        paused.delete("navigation");
        document.documentElement.style.scrollBehavior = oldScrollBehavior;
        travelState(false);
        view.tracking = view.x - view.camera;
        view.idleOrigin = view.x;
        view.idleTarget = view.x + 45;
        view.idleAfter = performance.now() + 6500;
        last = 0;
        focus();
        schedule();
      }
    };
    navFrame = requestAnimationFrame(advance);
    return players[floor];
  }
  function nearest(): WorldTarget | null {
    const v = current();
    if (!v.grounded || Math.abs(v.y - geometry[floor].ground) > 115 || flight)
      return null;
    let closest: HTMLElement | null = null,
      distance = Infinity;
    for (const element of targets[floor]) {
      const gap = Math.abs(Number(element.dataset.x) - v.x),
        radius = element.dataset.kind === "npc" ? 58 : 80;
      if (gap < radius && gap < distance) {
        distance = gap;
        closest = element;
      }
    }
    return closest
      ? {
          kind: closest.dataset.kind as WorldTarget["kind"],
          id: closest.dataset.target!,
          label: closest.dataset.label!,
          element: closest,
        }
      : null;
  }
  function travel(index: number) {
    if (flight || paused.size) return;
    audio.effect("start");
    navigate(index, SCENE.lift, true, true);
  }
  function engage() {
    const target = nearest();
    if (!target) return;
    if (target.kind === "lift") travel(floor ? 0 : 1);
    else {
      release();
      onTarget(target);
    }
  }
  function begin() {
    if (!manual) {
      manual = true;
      current().tracking = clamp(
        current().x - current().camera,
        floors[floor].clientWidth * 0.25,
        floors[floor].clientWidth * 0.75,
      );
      root.dataset.control = "manual";
    }
    lastInput = performance.now();
  }
  function press(source: string, button: GameButton, down: boolean) {
    const v = current();
    if (!down) {
      const released = input.up(source);
      if (
        (released === "up" || released === "secondary") &&
        !input.has("up") &&
        !input.has("secondary") &&
        v.vy < -480
      )
        v.vy = -480;
      return;
    }
    if (paused.size || document.hidden || !input.down(source, button)) return;
    if (button === "left" || button === "right") audio.effect("steer");
    begin();
    if (button === "action") {
      engage();
      return;
    }
    if (button === "secondary" || button === "up") {
      if (button === "up" && nearest()?.kind === "lift" && floor === 1) {
        travel(0);
        return;
      }
      if (input.has("down")) {
        dropUntil = performance.now() + 250;
        v.grounded = false;
        v.support = null;
        v.y += 5;
      } else jumpBuffer = 0.12;
    }
    if (button === "down") {
      if (v.support !== null) {
        schedule();
        return;
      }
      if (nearest()?.kind === "lift") {
        if (floor === 0) travel(1);
      } else engage();
    }
    schedule();
  }
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        if (paused.has("overlay") || paused.has("arrival")) return;
        cancelTravel();
        release();
        floors[floor].blur();
        announce("Controls released. You can browse the page.");
        return;
      }
      if (e.key === "Tab") {
        release();
        return;
      }
      if (paused.size) return;
      const button = codes[e.code] || fallback[e.key.toLowerCase()];
      if (!button) return;
      if (nativeControl(e.target)) {
        const target = e.target as Element;
        if (
          !["left", "right"].includes(button) ||
          !target.closest("button,a,summary") ||
          target.closest(
            'input,textarea,select,[contenteditable],[role="slider"],[role="tab"],[role="combobox"],dialog',
          )
        )
          return;
      }
      if (!manual) {
        if (
          (!["left", "right"].includes(button) && e.target !== floors[floor]) ||
          e.repeat
        )
          return;
        const visible = visibleFloor();
        if (visible < 0) return;
        if (visible !== floor) activate(visible);
        focus();
      }
      e.preventDefault();
      if (!e.repeat) press(e.code || e.key.toLowerCase(), button, true);
    },
    { signal },
  );
  document.addEventListener(
    "keyup",
    (e) => {
      const button = codes[e.code] || fallback[e.key.toLowerCase()];
      if (button) press(e.code || e.key.toLowerCase(), button, false);
    },
    { signal },
  );
  document.addEventListener(
    "pointerdown",
    () => {
      pointerFocusUntil = performance.now() + 300;
    },
    { signal, capture: true },
  );
  root.addEventListener(
    "pointerdown",
    (e) => {
      if (!nativeControl(e.target) && !paused.size) {
        const visible = visibleFloor();
        if (visible >= 0 && visible !== floor) activate(visible);
        focus();
      }
    },
    { signal },
  );
  document.addEventListener(
    "focusin",
    (e) => {
      if (!nativeControl(e.target)) return;
      release();
      if (performance.now() < pointerFocusUntil || paused.size) return;
      const el = e.target as HTMLElement,
        inner = el.closest<HTMLElement>("[data-world-inner]");
      if (!inner) return;
      const index = inners.indexOf(inner),
        r = el.getBoundingClientRect();
      if (
        index >= 0 &&
        (index !== floor ||
          r.left < 0 ||
          r.right > innerWidth ||
          r.top < 0 ||
          r.bottom > innerHeight)
      ) {
        const base = inner.getBoundingClientRect(),
          px = el.dataset.x
            ? Number(el.dataset.x)
            : r.left - base.left + r.width / 2;
        // Keyboard focus is a deliberate target, unlike ordinary reading scroll.
        activate(index);
        const v = current();
        v.camera = clamp(
          px - floors[index].clientWidth / 2,
          0,
          WORLD_WIDTH - floors[index].clientWidth,
        );
        v.tracking = v.x - v.camera;
        render(0);
        el.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    },
    { signal },
  );
  window.addEventListener("blur", release, { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      release();
      last = 0;
      if (document.hidden) {
        cancelTravel();
        cancelAnimationFrame(raf);
        raf = 0;
      } else schedule();
    },
    { signal },
  );
  window.addEventListener(
    "wheel",
    () => {
      cancelTravel();
      if (!paused.size) release();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    "scroll",
    () => {
      if (!paused.size) release();
      schedule();
    },
    { signal, passive: true },
  );
  const resize = new ResizeObserver(measure);
  floors.forEach((f) => resize.observe(f));
  platforms.flat().forEach((el) => resize.observe(el));
  const intersection = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        (entry.target as HTMLElement).dataset.visible = String(
          entry.isIntersecting,
        );
      schedule();
    },
    { threshold: [0, 0.35] },
  );
  floors.forEach((f) => intersection.observe(f));
  function physics(dt: number, now: number) {
    const v = current();
    let direction = manual ? input.horizontal() : 0,
      speed = 640;
    if (
      !manual &&
      !ambientPaused &&
      !reduced.matches &&
      !nativeControl(document.activeElement) &&
      now > v.idleAfter
    ) {
      direction =
        Math.abs(v.idleTarget - v.x) > 3 ? Math.sign(v.idleTarget - v.x) : 0;
      speed = 38;
      if (!direction) {
        v.idleTarget =
          v.x > v.idleOrigin ? v.idleOrigin - 45 : v.idleOrigin + 45;
        v.idleAfter = now + 3200;
      }
    }
    if (manual && direction) lastInput = now;
    if (direction) {
      v.facing = direction;
      if (Math.sign(v.vx) !== direction) v.vx = 0;
      v.vx += (direction * speed - v.vx) * (1 - Math.exp(-16 * dt));
    } else v.vx *= Math.exp(-24 * dt);
    if (Math.abs(v.vx) < 0.5) v.vx = 0;
    v.x = clamp(v.x + v.vx * dt, 35, WORLD_WIDTH - 35);
    coyote = v.grounded ? 0.1 : Math.max(0, coyote - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && coyote > 0) {
      v.vy = -1100;
      v.grounded = false;
      v.support = null;
      coyote = 0;
      jumpBuffer = 0;
      audio.effect("jump");
    }
    const previous = v.y;
    v.vy += 3000 * dt;
    v.y += v.vy * dt;
    const surfaces =
      now < dropUntil
        ? geometry[floor].surfaces.filter((s) => s.node === null)
        : geometry[floor].surfaces;
    const surface =
      v.vy >= 0
        ? (landingSurface(previous, v.y, v.x, 16, surfaces) as Surface | null)
        : null;
    if (surface) {
      v.y = surface.y;
      v.vy = 0;
      v.grounded = true;
      v.support = surface.node;
    } else {
      v.grounded = false;
      v.support = null;
    }
    if (v.y > geometry[floor].ground + 100) {
      v.y = geometry[floor].ground;
      v.vy = 0;
      v.grounded = true;
      v.support = null;
    }
  }
  function updateWalkers(dt: number) {
    if (ambientPaused || reduced.matches) return;
    for (const walker of walkers) {
      if (
        floors[walker.floor].dataset.visible === "false" ||
        document.activeElement === walker.el ||
        walker.el.matches(":hover")
      ) {
        walker.el.dataset.pose = "idle";
        continue;
      }
      walker.time += dt;
      const t = walker.time % (walker.duration * 2 + 4);
      let progress = 0,
        walking = false,
        dir = 1;
      if (t < walker.duration) {
        progress = t / walker.duration;
        walking = true;
      } else if (t < walker.duration + 2) progress = 1;
      else if (t < walker.duration * 2 + 2) {
        progress = 1 - (t - walker.duration - 2) / walker.duration;
        walking = true;
        dir = -1;
      } else dir = -1;
      const offset = Math.round((progress - 0.5) * walker.range);
      setStyle(walker.el, "--npc-shift", `${offset}px`);
      walker.el.dataset.x = String(walker.home + offset);
      walker.el.dataset.pose = walking ? "run" : "idle";
      walker.el.dataset.facing = dir < 0 ? "left" : "right";
    }
  }
  function render(dt: number) {
    const v = current(),
      width = floors[floor].clientWidth || innerWidth;
    if (manual && !flight) {
      const target = clamp(
        v.x - v.tracking,
        0,
        Math.max(0, WORLD_WIDTH - width),
      );
      v.camera = reduced.matches
        ? target
        : v.camera + (target - v.camera) * (1 - Math.exp(-14 * dt));
    }
    for (let i = 0; i < floors.length; i++) {
      const view = views[i],
        cinematic = floors[i].classList.contains("is-conversation"),
        offset = cinematic
          ? floors[i].offsetHeight - SCENE.walkline - geometry[i].ground
          : 0;
      setStyle(floors[i], "--camera-x", `${Math.round(view.camera)}px`);
      setStyle(players[i], "visibility", i === floor ? "visible" : "hidden");
      setStyle(
        players[i],
        "transform",
        `translate3d(${Math.round(view.x - 60)}px,${Math.round(view.y - 120 + offset)}px,0)`,
      );
      const walking =
        !!flight?.walk &&
        flight.floor === i &&
        Math.abs(flight.toX - flight.fromX) > 1;
      players[i].dataset.autoWalk = String(walking);
      players[i].dataset.pose = walking
        ? "run"
        : !view.grounded
          ? "jump"
          : Math.abs(view.vx) > 8
            ? "run"
            : "idle";
      players[i].dataset.facing = view.facing < 0 ? "left" : "right";
      const live = String(
        !paused.size &&
          !document.hidden &&
          !reduced.matches &&
          !ambientPaused &&
          floors[i].dataset.visible !== "false",
      );
      if (floors[i].dataset.live !== live) floors[i].dataset.live = live;
      for (const node of targets[i]) {
        if (node.dataset.kind !== "npc") continue;
        const screenX = Number(node.dataset.x) - view.camera;
        const inView = String(screenX >= 35 && screenX <= view.width - 35);
        if (node.dataset.inView !== inView) node.dataset.inView = inView;
      }
      if (i !== floor) prompts[i].hidden = true;
    }
    const target = nearest(),
      prompt = prompts[floor],
      id = target?.id || "";
    prompt.hidden = (!manual && target?.kind !== "lift") || !target || !!flight;
    if (target)
      setStyle(
        prompt,
        "left",
        `${clamp(Number(target.element.dataset.x) - v.camera, 110, width - 110)}px`,
      );
    if (id !== near) {
      near = id;
      root.dataset.near = id;
      for (const group of targets)
        for (const node of group)
          node.classList.toggle("is-near", node === target?.element);
      if (target) {
        prompt.querySelector("[data-prompt-title]")!.textContent = target.label;
        if (manual) {
          audio.effect("near");
          announce(
            `${target.label}. ${root.classList.contains("is-handheld") ? "Use the Interact button." : "Press Enter to interact."}`,
          );
        }
      }
    }
    if (target) {
      const key = root.classList.contains("is-handheld")
          ? "A"
          : manual
            ? "ENTER"
            : "CLICK",
        verb =
          target.kind === "lift"
            ? "USE LIFT"
            : target.kind === "npc"
              ? "TALK"
              : target.kind === "register"
                ? "REGISTER"
                : target.kind === "session"
                  ? target.element.getAttribute("aria-pressed") === "true"
                    ? "REMOVE INTEREST"
                    : "SAVE INTEREST"
                  : "PLAY",
        hint = prompt.querySelector("[data-prompt-action]")!,
        text = `${key} · ${verb}`;
      if (hint.textContent !== text) hint.textContent = text;
    }
  }
  function tick(now: number) {
    raf = 0;
    const elapsed = last ? Math.min((now - last) / 1000, 0.15) : 0;
    last = now;
    const visible = visibleFloor(),
      v = current();
    if (!paused.size && visible >= 0 && !document.hidden) {
      if (manual && now - lastInput > 12000 && !input.horizontal()) release();
      if (visible === floor) {
        accumulator = Math.min(accumulator + elapsed, 0.15);
        while (accumulator >= 1 / 60) {
          physics(1 / 60, now);
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      updateWalkers(elapsed);
      render(elapsed);
    } else {
      accumulator = 0;
      floors.forEach((el) => (el.dataset.live = "false"));
    }
    if (
      !document.hidden &&
      !paused.size &&
      visible >= 0 &&
      (manual ||
        !v.grounded ||
        Math.abs(v.vx) > 1 ||
        (!ambientPaused && !reduced.matches))
    )
      schedule();
  }
  floors.forEach((el, i) => (el.dataset.current = String(i === 0)));
  measure();
  render(0);
  schedule();
  return {
    pause(reason, value) {
      if (value) {
        cancelTravel();
        paused.add(reason);
        release();
        render(0);
      } else {
        paused.delete(reason);
        last = 0;
        schedule();
      }
    },
    virtual: (button, down, source) =>
      press(source || `virtual:${button}`, button, down),
    goTo: (index, px, scroll) => navigate(index, px, scroll),
    travel,
    cancelTravel,
    release,
    focus,
    refresh: measure,
    position: () => ({ floor, x: current().x }),
    setAmbient(value) {
      ambientPaused = value;
      if (value) release();
      render(0);
      schedule();
    },
    destroy() {
      destroyed = true;
      cancelTravel();
      abort.abort();
      resize.disconnect();
      intersection.disconnect();
      cancelAnimationFrame(raf);
      input.clear();
    },
  };
}
