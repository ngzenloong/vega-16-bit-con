import { clamp, landingSurface, floorFrameScroll } from "./math";
import { HeldInput, isSceneTap, type ScenePress } from "./input";
import { audio } from "./audio";
import { SCENE } from "./scene";
import { SPRITES } from "./assets";
import { SpriteClock } from "./sprite-clock";
import { SnackSequence } from "./snack";
import { advanceWalk } from "./walk";
import { createFootDust } from "./dust";
import { PointerIntent } from "./pointer-intent";
import type { GameButton } from "./games/types";

export const WORLD_WIDTH = SCENE.width;
export type WorldTarget = {
  kind: "game" | "npc" | "lift" | "register" | "session" | "food" | "schedule";
  id: string;
  label: string;
  element: HTMLElement;
};
export type WorldController = {
  pause: (reason: string, value: boolean) => void;
  virtual: (key: GameButton, down: boolean, source?: string) => void;
  goTo: (floor: number, x?: number, scroll?: boolean) => HTMLElement;
  interact: (target: WorldTarget) => void;
  eat: () => void;
  reveal: (floor: number, x?: number) => void;
  reframe: (floor: number, x?: number) => HTMLElement;
  control: (floor: number) => void;
  travel: (floor: number) => void;
  cancelTravel: () => void;
  release: () => void;
  restorePage: () => void;
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
  recentering: boolean;
  width: number;
  tracking: number;
  petX: number;
  petY: number;
  held: number;
  lookahead: number;
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
  frameActor: boolean;
  fromX: number;
  toX: number;
  walk: boolean;
  onArrive?: () => void;
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
  onSceneTap: (floor: number) => void = () => {},
  onViewFloorChange: (floor: number) => void = () => {},
): WorldController {
  const floors = [...root.querySelectorAll<HTMLElement>("[data-floor]")];
  const inners = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-world-inner]")!,
  );
  const players = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-player]")!,
  );
  const lifts = floors.map((f) => f.querySelector<HTMLElement>(".world-lift")!);
  const dust = inners.map((inner) =>
    createFootDust(inner.querySelector<HTMLElement>("[data-dust-layer]")!),
  );
  const prompts = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-world-prompt]")!,
  );
  const companions = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-companion]")!,
  );
  const targets = inners.map((i) => [
    ...i.querySelectorAll<HTMLElement>("[data-target]"),
  ]);
  const heads = new Map<HTMLElement, { x: number; y: number }>();
  const pointer = new PointerIntent();
  const syncPointer = () => {
    const value = String(pointer.active);
    if (root.dataset.pointerActive !== value)
      root.dataset.pointerActive = value;
  };
  const suppressHover = () => {
    pointer.suppress();
    syncPointer();
  };
  syncPointer();
  const platforms = inners.map((i) => [
    ...i.querySelectorAll<HTMLElement>("[data-platform]"),
  ]);
  const collectSprites = () =>
    inners.map((inner) =>
      [...inner.querySelectorAll<HTMLElement>(".sprite-animated")]
        .filter((el) => !el.closest(".world-lift"))
        .map((el) => {
          const name = el.dataset.sprite!;
          const asset = SPRITES[name];
          const owner = el.closest<HTMLElement>(
            "[data-player],[data-companion],.npc,.venue-prop",
          );
          return {
            el,
            owner,
            player:
              !!owner?.hasAttribute("data-player") ||
              !!owner?.hasAttribute("data-companion"),
            companion: !!owner?.hasAttribute("data-companion"),
            name,
            pose:
              el.dataset.spritePose ||
              (name === "sam-idle"
                ? "idle"
                : name === "sam-run"
                  ? "run"
                  : null),
            width: parseFloat(el.style.getPropertyValue("--sprite-width")),
            clock: new SpriteClock(asset.frames, asset.fps),
          };
        }),
    );
  let spriteFrames = collectSprites();
  const refreshSprites = () => {
    const previous = new Map(
      spriteFrames.flat().map((sprite) => [sprite.el, sprite]),
    );
    spriteFrames = collectSprites().map((group) =>
      group.map((sprite) => {
        const saved = previous.get(sprite.el);
        return saved &&
          saved.name === sprite.name &&
          saved.width === sprite.width
          ? saved
          : sprite;
      }),
    );
  };
  let spriteTime = performance.now();
  const input = new HeldInput(),
    snack = new SnackSequence(),
    paused = new Set<string>(),
    abort = new AbortController();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    signal = abort.signal;
  const geometry = floors.map(() => ({
    ground: 700,
    ceiling: 132,
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
    recentering: false,
    width: f.clientWidth,
    tracking: f.clientWidth / 2,
    petX: SCENE.booth - 82,
    petY: 700,
    held: 0,
    lookahead: 0,
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
    viewedFloor = 0,
    manual = false,
    returningToPage = false,
    raf = 0,
    last = 0,
    accumulator = 0,
    dropUntil = 0,
    coyote = 0,
    jumpBuffer = 0;
  let frameScrollTarget: number | null = null,
    near: string | null = null;
  let ambientPaused = reduced.matches,
    destroyed = false,
    pointerFocusUntil = 0,
    navFrame = 0,
    navigationPausedAt = 0,
    navId = 0,
    flight: Flight | null = null,
    oldScrollBehavior = "";
  let navigationStep: ((now: number) => void) | null = null;
  const current = () => views[floor];
  function reportViewedFloor(index: number) {
    if (index < 0 || index === viewedFloor) return;
    viewedFloor = index;
    onViewFloorChange(index);
  }
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
    if (paused.has("overlay") || document.querySelector("dialog[open]")) return;
    const v = current(),
      width = floors[floor].clientWidth;
    const screenX = v.x - v.camera;
    if (manual && !flight && (screenX < 60 || screenX > width - 60)) {
      const desired = clamp(
        v.x - width / 2,
        0,
        Math.max(0, WORLD_WIDTH - width),
      );
      if (Math.abs(desired - v.camera) > 1) {
        v.tracking = width / 2;
        v.lookahead = 0;
        v.recentering = true;
        schedule();
      }
      framePlayer();
    }
    floors[floor].focus({ preventScroll: true });
  }
  function framePlayer(force = false) {
    if (root.classList.contains("is-handheld")) return;
    const actor = players[floor].getBoundingClientRect();
    if (force || actor.top < 8 || actor.bottom > innerHeight - 64) {
      const floorBottom =
        scrollY + floors[floor].getBoundingClientRect().bottom;
      const top = floorFrameScroll(
        floorBottom,
        innerHeight,
        document.documentElement.scrollHeight - innerHeight,
      );
      if (Math.abs(top - scrollY) < 1) return;
      scrollFrame(top, reduced.matches ? "instant" : "smooth");
    }
  }
  function scrollFrame(top: number, behavior: ScrollBehavior) {
    const before = scrollY;
    if (behavior === "smooth") frameScrollTarget = top;
    window.scrollTo({ top, behavior });
    // Instant navigation can end with subpixel updates, each emitting scroll.
    if (behavior !== "smooth" && scrollY !== before)
      frameScrollTarget = scrollY;
  }
  function clearHeld() {
    input.clear();
    const v = current();
    v.vx = 0;
    v.held = 0;
    v.lookahead = 0;
    v.tracking = v.x - v.camera;
    jumpBuffer = 0;
  }
  function release() {
    frameScrollTarget = null;
    const returnHome = !root.classList.contains("is-handheld");
    finishSnack(false);
    if (returnHome) cancelTravel();
    // Repeated wheel events must not restart a walk that is already returning.
    if (returningToPage) input.clear();
    else clearHeld();
    coyote = 0;
    jumpBuffer = 0;
    dropUntil = 0;
    manual = false;
    root.dataset.control = "ambient";
    if (returnHome) startPageReturn();
    schedule();
  }
  function stopPageReturn() {
    if (!returningToPage) return;
    returningToPage = false;
    for (const v of views) {
      v.vx = 0;
      v.held = 0;
      v.tracking = v.x - v.camera;
    }
  }
  function startPageReturn() {
    if (returningToPage) return;
    suppressHover();
    accumulator = 0;
    last = 0;
    returningToPage = true;
    for (const v of views) {
      v.vx = 0;
      v.held = 0;
      v.lookahead = 0;
    }
    if (reduced.matches) settlePageReturn();
    render(0);
    schedule();
  }
  function settlePageReturn() {
    const v = current();
    v.x = SCENE.booth;
    v.y = geometry[floor].ground;
    v.vx = 0;
    v.vy = 0;
    v.grounded = true;
    v.support = null;
    views.forEach((view, i) => {
      view.camera = pageCamera(i);
    });
    stopPageReturn();
  }
  function pageCamera(index: number) {
    return clamp(
      SCENE.booth - views[index].width / 2,
      0,
      Math.max(0, WORLD_WIDTH - views[index].width),
    );
  }
  function restorePage() {
    release();
    measure();
    // The player owns the exit floor; the page must follow it, not the entry scroll.
    scrollFrame(destinationScroll(floor, true), "instant");
    reportViewedFloor(floor);
    // An old lift/machine trigger would pan back to that off-center target.
    floors[floor].focus({ preventScroll: true });
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
    frameScrollTarget = null;
    flight = null;
    navId++;
    cancelAnimationFrame(navFrame);
    navigationPausedAt = 0;
    navigationStep = null;
    paused.delete("navigation");
    document.documentElement.style.scrollBehavior = oldScrollBehavior;
    travelState(false);
    if (!destroyed) reportViewedFloor(floor);
    current().tracking = current().x - current().camera;
    last = 0;
    schedule();
  }
  function suspendTravel() {
    if (!flight || navigationPausedAt) return;
    navigationPausedAt = performance.now();
    cancelAnimationFrame(navFrame);
  }
  function resumeTravel() {
    if (
      !flight ||
      !navigationStep ||
      !navigationPausedAt ||
      document.hidden ||
      paused.has("window") ||
      paused.has("hidden")
    )
      return;
    flight.started += performance.now() - navigationPausedAt;
    navigationPausedAt = 0;
    navFrame = requestAnimationFrame(navigationStep);
  }
  let measuredViewportHeight = innerHeight;
  function measure() {
    if (root.classList.contains("is-handheld")) stopPageReturn();
    const viewportHeightChanged = measuredViewportHeight !== innerHeight;
    measuredViewportHeight = innerHeight;
    // Keep the stacked agenda clear of the ground-level furnishings as its text reflows.
    const agenda = root.querySelector<HTMLElement>(".schedule-board");
    if (
      !root.classList.contains("is-handheld") &&
      root.dataset.conversation !== "true" &&
      agenda?.offsetHeight
    ) {
      const required =
        Math.ceil((agenda.offsetTop + agenda.offsetHeight + 360) / 8) * 8;
      setStyle(floors[1], "--content-floor-height", `${required}px`);
    }
    refreshSprites();
    // Cinematic scaling is presentation-only; it must not alter collision geometry.
    if (root.dataset.conversation === "true") {
      render(0);
      return;
    }
    for (let i = 0; i < floors.length; i++) {
      const el = floors[i],
        v = views[i];
      if (!el.offsetHeight) continue;
      const previousGround = geometry[i].ground;
      geometry[i].ground = el.offsetHeight - SCENE.walkline;
      const groundDelta = geometry[i].ground - previousGround;
      v.y += groundDelta;
      v.petY += groundDelta;
      if (groundDelta) dust[i].clear();
      const base = inners[i].getBoundingClientRect(),
        sx = base.width / inners[i].offsetWidth || 1,
        sy = base.height / inners[i].offsetHeight || 1;
      geometry[i].ceiling = Math.max(
        0,
        132 - (base.top - el.getBoundingClientRect().top),
      );
      for (const target of targets[i])
        if (target.dataset.kind === "session") {
          const rect = target.getBoundingClientRect();
          target.dataset.x = String(
            (rect.left - base.left + rect.width / 2) / sx,
          );
        }
      const floorTop = el.getBoundingClientRect().top;
      for (const target of targets[i])
        if (target.dataset.kind === "npc") {
          heads.set(target, {
            x: Number(target.dataset.headX || 0),
            y:
              target.getBoundingClientRect().top -
              floorTop +
              Number(target.dataset.headY || 0),
          });
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
        v.petY = v.y;
      }
      if (v.y < geometry[i].ceiling) {
        v.y = geometry[i].ceiling;
        v.vy = Math.max(0, v.vy);
        v.grounded = false;
        v.support = null;
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
      flight.toScroll = destinationScroll(flight.floor, flight.frameActor);
      flight.started = performance.now();
      if (navigationPausedAt) navigationPausedAt = flight.started;
    }
    render(0);
    if (
      viewportHeightChanged &&
      manual &&
      !flight &&
      !paused.size &&
      root.dataset.conversation !== "true"
    )
      framePlayer(true);
    if (!root.classList.contains("is-handheld") && !flight)
      reportViewedFloor(visibleFloor());
    schedule();
  }
  function activate(index: number, px?: number, notify = true) {
    const previous = current(),
      previousFloor = floor;
    if (returningToPage) input.clear();
    else clearHeld();
    floor = clamp(index, 0, floors.length - 1);
    if (notify) reportViewedFloor(floor);
    const v = current();
    const placePlayer = px !== undefined || floor !== previousFloor;
    floors.forEach((el, i) => (el.dataset.current = String(i === floor)));
    if (placePlayer) {
      // Each floor has a render surface, but there is only one travelling Sam.
      v.x = clamp(px ?? previous.x, 40, WORLD_WIDTH - 40);
      v.facing = previous.facing;
      v.support = null;
      v.grounded = true;
      v.vx = 0;
      v.vy = 0;
    }
    measure();
    if (placePlayer) v.y = geometry[floor].ground;
    if (placePlayer) {
      v.petX = v.x - v.facing * 82;
      v.petY = v.y;
    }
    v.tracking = v.x - v.camera;
    near = null;
    render(0);
  }
  function destinationScroll(index: number, lift = false) {
    const el = floors[index],
      top = scrollY + el.getBoundingClientRect().top;
    return clamp(
      lift && el.offsetHeight > innerHeight
        ? floorFrameScroll(
            top + el.offsetHeight,
            innerHeight,
            document.documentElement.scrollHeight - innerHeight,
          )
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
    movePlayer = true,
    onArrive?: () => void,
  ) {
    finishSnack(false);
    stopPageReturn();
    frameScrollTarget = null;
    suppressHover();
    if (lift && flight) return players[floor];
    const previousFloor = floor;
    const fromX = current().x;
    const canWalk =
      movePlayer &&
      index === floor &&
      current().grounded &&
      current().support === null &&
      !lift;
    cancelTravel();
    activate(index, movePlayer ? px : undefined, false);
    if (lift) lifts[floor].dataset.arrived = "true";
    const v = current(),
      toCamera = clamp(
        px - floors[floor].clientWidth / 2,
        0,
        Math.max(0, WORLD_WIDTH - floors[floor].clientWidth),
      );
    const scrollPage = scroll && !root.classList.contains("is-handheld");
    const frameActor = lift || manual || !!onArrive;
    if (!scroll || reduced.matches) {
      v.camera = toCamera;
      v.tracking = v.x - v.camera;
      if (scrollPage) {
        const before = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        scrollFrame(destinationScroll(floor, frameActor), "auto");
        document.documentElement.style.scrollBehavior = before;
      }
      render(0);
      focus();
      reportViewedFloor(floor);
      onArrive?.();
      return players[floor];
    }
    const baseDuration =
      parseFloat(
        getComputedStyle(root).getPropertyValue("--duration-camera"),
      ) || 600;
    const duration = canWalk
      ? Math.max(baseDuration, (Math.abs(px - fromX) / SCENE.walkSpeed) * 1000)
      : baseDuration;
    if (canWalk) v.x = fromX;
    flight = {
      id: ++navId,
      floor,
      fromCamera: v.camera,
      toCamera,
      fromScroll: scrollY,
      toScroll: scrollPage ? destinationScroll(floor, frameActor) : scrollY,
      started: performance.now(),
      duration,
      scroll: scrollPage,
      lift,
      frameActor,
      fromX,
      toX: px,
      walk: canWalk,
      onArrive,
    };
    oldScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    paused.add("navigation");
    travelState(
      true,
      movePlayer && (lift || previousFloor !== floor || !canWalk),
    );
    render(0);
    let previousFrame = performance.now();
    const advance = (now: number) => {
      const active = flight;
      if (!active || active.id !== navId || destroyed) return;
      if (document.hidden || paused.has("window") || paused.has("hidden")) {
        suspendTravel();
        return;
      }
      const progress = clamp((now - active.started) / active.duration, 0, 1),
        amount = active.walk ? progress : ease(progress),
        view = views[active.floor];
      view.camera =
        active.fromCamera + (active.toCamera - active.fromCamera) * amount;
      if (active.walk) {
        view.x = active.fromX + (active.toX - active.fromX) * progress;
        view.facing = active.toX >= active.fromX ? 1 : -1;
      }
      if (active.scroll) {
        scrollFrame(
          active.fromScroll + (active.toScroll - active.fromScroll) * amount,
          "auto",
        );
      }
      render(Math.min(0.05, (now - previousFrame) / 1000));
      previousFrame = now;
      if (progress < 1) navFrame = requestAnimationFrame(advance);
      else {
        flight = null;
        navigationStep = null;
        paused.delete("navigation");
        document.documentElement.style.scrollBehavior = oldScrollBehavior;
        travelState(false);
        view.tracking = view.x - view.camera;
        last = 0;
        focus();
        schedule();
        reportViewedFloor(active.floor);
        active.onArrive?.();
      }
    };
    navigationStep = advance;
    navFrame = requestAnimationFrame(advance);
    return players[floor];
  }
  const targetX = (element: HTMLElement) =>
    Number(element.dataset.x) + Number(element.dataset.headX || 0);
  function nearest(): WorldTarget | null {
    const v = current();
    if (!v.grounded || Math.abs(v.y - geometry[floor].ground) > 115 || flight)
      return null;
    let closest: HTMLElement | null = null,
      distance = Infinity;
    const mode = root.classList.contains("is-handheld") ? "handheld" : "page";
    for (const element of targets[floor]) {
      if (element.dataset.activeMode && element.dataset.activeMode !== mode)
        continue;
      const gap = Math.abs(targetX(element) - v.x),
        radius =
          element.dataset.kind === "npc"
            ? 96
            : element.dataset.kind === "food"
              ? 144
              : 80;
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
  function interact(target: WorldTarget) {
    if (paused.size || flight) return;
    stopPageReturn();
    if (snack.active) {
      if (target.kind === "food") return;
      finishSnack(false);
    }
    const index = Number(
      target.element.closest<HTMLElement>("[data-floor]")?.dataset.floor || 0,
    );
    const x = targetX(target.element);
    if (target.kind !== "npc" && target.kind !== "food") {
      if (index !== floor) activate(index, x);
      onTarget(target);
      return;
    }
    const distance = target.kind === "food" ? 100 : 72;
    const side = target.kind === "food" ? 1 : current().x < x ? -1 : 1;
    if (index === floor && Math.abs(current().x - x) <= distance + 20) {
      clearHeld();
      onTarget(target);
    } else {
      announce(`Walking over to ${target.label}. Press Escape to cancel.`);
      navigate(index, x + side * distance, true, false, true, () =>
        onTarget(target),
      );
    }
  }
  function finishSnack(completed: boolean) {
    const wasActive = snack.active || root.dataset.snacking === "true";
    snack.cancel();
    if (!wasActive) return;
    delete root.dataset.snacking;
    players.forEach((player) => delete player.dataset.snackStep);
    if (completed) {
      audio.effect("collect");
      announce("Good slice. Ready to play again.");
    }
    clearHeld();
    last = 0;
    schedule();
  }
  function eat() {
    if (
      !players[floor].querySelector<HTMLElement>(".snack-pose")?.style
        .backgroundImage
    ) {
      announce("Your slice is getting ready. Try again in a moment.");
      return;
    }
    if (paused.size || flight || floor !== 0 || !snack.start()) return;
    clearHeld();
    begin();
    current().facing = -1;
    root.dataset.snacking = "true";
    players[floor].dataset.snackStep = "0";
    audio.effect("click");
    announce("Pizza break. Press Escape or move to stop eating.");
    focus();
    render(0);
    schedule();
  }
  function travel(index: number) {
    if (flight || paused.size) return;
    if (index === floor) {
      navigate(index, current().x, true, false, false);
      return;
    }
    audio.effect("start");
    navigate(index, SCENE.lift, true, true);
  }
  function engage() {
    const target = nearest();
    if (!target) return;
    if (target.kind === "lift") travel(floor ? 0 : 1);
    else {
      clearHeld();
      onTarget(target);
    }
  }
  function begin() {
    stopPageReturn();
    if (!manual) {
      manual = true;
      const screenX = current().x - current().camera;
      current().recentering =
        screenX < 0 || screenX > floors[floor].clientWidth;
      current().tracking = clamp(
        current().recentering ? floors[floor].clientWidth / 2 : screenX,
        floors[floor].clientWidth * 0.25,
        floors[floor].clientWidth * 0.75,
      );
      root.dataset.control = "manual";
      framePlayer(true);
    }
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
    if (paused.size || document.hidden) return;
    suppressHover();
    if (snack.active) {
      if (button === "action") return;
      finishSnack(false);
    }
    if (!input.down(source, button)) return;
    if (button === "left" || button === "right") audio.effect("step");
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
      if (
        e.key === "Tab" ||
        e.key === "Escape" ||
        codes[e.code] ||
        fallback[e.key.toLowerCase()]
      )
        suppressHover();
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        if (e.repeat) return;
        if (snack.active) {
          e.preventDefault();
          finishSnack(false);
          return;
        }
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
      if (["PageUp", "PageDown", "Home", "End"].includes(e.key)) {
        if (root.classList.contains("is-handheld")) e.preventDefault();
        else release();
        return;
      }
      if (paused.size) return;
      const button = codes[e.code] || fallback[e.key.toLowerCase()];
      if (!button) return;
      if (nativeControl(e.target)) {
        const target = e.target as Element;
        const gameArrow =
          ["left", "right"].includes(button) ||
          (manual &&
            ["up", "down"].includes(button) &&
            !!target.closest(".scene-tools,.handheld-top,.handheld-controls"));
        if (
          !gameArrow ||
          !target.closest("button,a,summary") ||
          target.closest(
            'input,textarea,select,[contenteditable],[role="slider"],[role="tab"],[role="combobox"],dialog,.nav-dropdown,.nav-toggle',
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
      if (e.target !== floors[floor]) focus();
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
    (event) => {
      pointerFocusUntil = performance.now() + 300;
      pointer.press(
        event.clientX,
        event.clientY,
        event.pointerType !== "touch",
      );
      if (!root.contains(event.target as Node) || paused.size || flight)
        pointer.suppress();
      syncPointer();
    },
    { signal, capture: true },
  );
  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      pointer.move(
        event.clientX,
        event.clientY,
        event.movementX,
        event.movementY,
      );
      if (!root.contains(event.target as Node) || paused.size || flight)
        pointer.suppress();
      syncPointer();
    },
    { signal, passive: true },
  );
  let scenePress: (ScenePress & { pointer: number; floor: number }) | null =
    null;
  root.addEventListener(
    "pointerdown",
    (e) => {
      scenePress = null;
      if (
        e.button !== 0 ||
        !e.isPrimary ||
        nativeControl(e.target) ||
        paused.size
      )
        return;
      const target = e.target as Element;
      if (target.closest(".event-board,.schedule-board,.hall-controls")) return;
      const section = target.closest<HTMLElement>("[data-floor]");
      if (section) {
        scenePress = {
          pointer: e.pointerId,
          floor: Number(section.dataset.floor),
          x: e.clientX,
          y: e.clientY,
          scroll: scrollY,
          time: performance.now(),
        };
      }
    },
    { signal },
  );
  root.addEventListener(
    "pointerup",
    (e) => {
      const start = scenePress;
      scenePress = null;
      if (!start || start.pointer !== e.pointerId || paused.size) return;
      if (
        isSceneTap(start, {
          x: e.clientX,
          y: e.clientY,
          scroll: scrollY,
          time: performance.now(),
        })
      )
        onSceneTap(start.floor);
    },
    { signal },
  );
  root.addEventListener(
    "pointercancel",
    () => {
      scenePress = null;
    },
    { signal },
  );
  document.addEventListener(
    "focusin",
    (e) => {
      if (!nativeControl(e.target)) return;
      if (paused.has("overlay") || (e.target as Element).closest("dialog")) {
        clearHeld();
        return;
      }
      if (root.contains(e.target as Node)) clearHeld();
      else release();
      if (performance.now() < pointerFocusUntil || paused.size) return;
      const el = e.target as HTMLElement,
        inner = el.closest<HTMLElement>("[data-world-inner]");
      if (!inner) return;
      const index = inners.indexOf(inner),
        r = el.getBoundingClientRect();
      stopPageReturn();
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
        // Inspecting a control changes the view, not Sam's physical floor.
        reportViewedFloor(index);
        const v = views[index];
        v.camera = clamp(
          px - floors[index].clientWidth / 2,
          0,
          WORLD_WIDTH - floors[index].clientWidth,
        );
        v.tracking = v.x - v.camera;
        render(0);
        const beforeScroll = scrollY;
        el.scrollIntoView({ behavior: "instant", block: "nearest" });
        if (scrollY !== beforeScroll) frameScrollTarget = scrollY;
      }
    },
    { signal },
  );
  window.addEventListener(
    "blur",
    () => {
      clearHeld();
      suspendTravel();
      paused.add("window");
      last = 0;
    },
    { signal },
  );
  window.addEventListener(
    "focus",
    () => {
      paused.delete("window");
      resumeTravel();
      last = 0;
      if (manual) focus();
      schedule();
    },
    { signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      clearHeld();
      last = 0;
      if (document.hidden) {
        paused.add("hidden");
        suspendTravel();
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        paused.delete("hidden");
        resumeTravel();
        if (manual) focus();
        schedule();
      }
    },
    { signal },
  );
  window.addEventListener(
    "wheel",
    () => {
      if (root.classList.contains("is-handheld")) return;
      if (!paused.size || paused.has("navigation")) release();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    "scroll",
    () => {
      if (!paused.size && !flight && !root.classList.contains("is-handheld")) {
        const framing = frameScrollTarget !== null;
        if (framing && Math.abs(scrollY - frameScrollTarget!) < 1)
          frameScrollTarget = null;
        if (!framing) release();
        const visible = visibleFloor();
        reportViewedFloor(visible);
      }
      schedule();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    "scrollend",
    () => {
      if (frameScrollTarget === null) return;
      const interrupted = Math.abs(scrollY - frameScrollTarget) >= 1;
      frameScrollTarget = null;
      if (
        interrupted &&
        !paused.size &&
        !root.classList.contains("is-handheld")
      )
        release();
    },
    { signal },
  );
  window.addEventListener(
    "touchmove",
    () => {
      if (
        !root.classList.contains("is-handheld") &&
        (!paused.size || paused.has("navigation"))
      )
        release();
    },
    { signal, passive: true },
  );
  const resize = new ResizeObserver(measure);
  window.addEventListener(
    "resize",
    () => {
      if (measuredViewportHeight !== innerHeight) measure();
    },
    { signal },
  );
  floors.forEach((f) => resize.observe(f));
  const agenda = root.querySelector<HTMLElement>(".schedule-board");
  if (agenda) resize.observe(agenda);
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
    const controlled = manual && !returningToPage;
    const direction = returningToPage
        ? Math.sign(SCENE.booth - v.x)
        : controlled
          ? input.horizontal()
          : 0,
      speed = SCENE.walkSpeed * (returningToPage ? 0.7 : 1);
    const motion = advanceWalk(v.vx, v.held, direction, dt, speed);
    v.vx = motion.velocity;
    v.held = motion.held;
    if (direction) v.facing = direction;
    const step = v.vx * dt;
    if (returningToPage && Math.abs(step) >= Math.abs(SCENE.booth - v.x)) {
      v.x = SCENE.booth;
      v.vx = 0;
      v.held = 0;
    } else v.x = clamp(v.x + step, 35, WORLD_WIDTH - 35);
    if (controlled) {
      coyote = v.grounded ? 0.1 : Math.max(0, coyote - dt);
      jumpBuffer = Math.max(0, jumpBuffer - dt);
    }
    if (controlled && jumpBuffer > 0 && coyote > 0) {
      const headroom = Math.max(
        24,
        Math.min(200, v.y - geometry[floor].ceiling),
      );
      v.vy = -Math.sqrt(2 * 3000 * headroom);
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
      returningToPage || (controlled && now < dropUntil)
        ? geometry[floor].surfaces.filter((s) => s.node === null)
        : geometry[floor].surfaces;
    const surface =
      v.vy >= 0
        ? (landingSurface(previous, v.y, v.x, 16, surfaces) as Surface | null)
        : null;
    if (surface) {
      if (!v.grounded && surface.node === null && !reduced.matches)
        dust[floor].burst(v.x, surface.y, v.facing, 5);
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
        (pointer.active && walker.el.matches(":hover"))
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
  function renderSpriteFrames() {
    const now = performance.now();
    const elapsed = (now - spriteTime) / 1000;
    spriteTime = now;
    for (let i = 0; i < floors.length; i++) {
      const visible = !document.hidden && floors[i].dataset.visible !== "false";
      const ambient = floors[i].dataset.live === "true";
      for (const sprite of spriteFrames[i]) {
        const activePose =
          !sprite.pose ||
          (sprite.owner?.dataset.pose || "idle") === sprite.pose;
        const deliberate =
          sprite.player &&
          (sprite.pose === "run" ||
            (sprite.companion && sprite.owner?.dataset.pose === "run")) &&
          (((manual || returningToPage) && !paused.size && i === floor) ||
            (flight?.walk && flight.floor === i));
        if (reduced.matches) sprite.clock.reset();
        const frame = sprite.clock.advance(
          elapsed *
            (sprite.name === "sam-run" && sprite.player && !sprite.companion
              ? clamp(
                  flight?.walk
                    ? ((Math.abs(flight.toX - flight.fromX) / flight.duration) *
                        1000) /
                        SCENE.walkSpeed
                    : Math.abs(views[i].vx) / SCENE.walkSpeed,
                  0.35,
                  1.2,
                )
              : 1),
          visible &&
            (!sprite.player || i === floor) &&
            sprite.owner?.dataset.inView !== "false" &&
            !reduced.matches &&
            activePose &&
            !!(ambient || deliberate),
        );
        setStyle(
          sprite.el,
          "background-position",
          `${-frame * sprite.width}px 0px`,
        );
        const value = String(frame);
        if (sprite.el.dataset.spriteFrame !== value) {
          if (
            sprite.player &&
            sprite.name === "sam-run" &&
            activePose &&
            (frame === 1 || frame === 3) &&
            deliberate
          )
            audio.effect("step");
          sprite.el.dataset.spriteFrame = value;
        }
      }
    }
  }
  function render(dt: number) {
    const v = current(),
      width = floors[floor].clientWidth || innerWidth;
    if (returningToPage && !root.classList.contains("is-handheld")) {
      for (let i = 0; i < views.length; i++) {
        const view = views[i],
          target = pageCamera(i);
        const next =
          view.camera + (target - view.camera) * (1 - Math.exp(-5 * dt));
        const margin = Math.min(96, view.width / 4);
        // Return the information into view without leaving the walking actor behind.
        view.camera =
          i !== floor
            ? next
            : target > view.camera
              ? Math.min(next, Math.max(view.camera, view.x - margin))
              : Math.max(
                  next,
                  Math.min(view.camera, view.x - view.width + margin),
                );
        if (Math.abs(target - view.camera) < 0.5) view.camera = target;
      }
    } else if (manual && !flight) {
      const ahead =
        Math.abs(v.vx) > 60 ? Math.sign(v.vx) * Math.min(80, width * 0.12) : 0;
      v.lookahead += (ahead - v.lookahead) * (1 - Math.exp(-5 * dt));
      const target = clamp(
        v.x + v.lookahead - v.tracking,
        0,
        Math.max(0, WORLD_WIDTH - width),
      );
      v.camera = reduced.matches
        ? target
        : v.camera +
          (target - v.camera) *
            (1 -
              Math.exp(
                -(v.recentering
                  ? 5
                  : root.classList.contains("is-handheld")
                    ? 6
                    : 8) * dt,
              ));
      if (Math.abs(target - v.camera) < 2) v.recentering = false;
    }
    if (root.parentElement)
      setStyle(
        root.parentElement,
        "--footer-floor-phase",
        `${Math.round(views[1].camera) % 512}px`,
      );
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
      dust[i].update(
        dt,
        view.x,
        view.y,
        walking && flight
          ? ((flight.toX - flight.fromX) / flight.duration) * 1000
          : view.vx,
        i === floor &&
          !reduced.matches &&
          !document.hidden &&
          !cinematic &&
          view.grounded &&
          (!paused.size || !!flight?.walk),
      );
      players[i].dataset.pose = walking
        ? "run"
        : !view.grounded
          ? "jump"
          : Math.abs(view.vx) > 8
            ? "run"
            : "idle";
      players[i].dataset.facing = view.facing < 0 ? "left" : "right";
      if (snack.active && i === floor)
        setStyle(
          players[i],
          "--snack-frame",
          `${-(reduced.matches ? (snack.step < 4 ? 0 : 9) : snack.frame) * 120}px`,
        );
      const pet = companions[i],
        targetX = view.x - view.facing * 82;
      const follow = (!paused.size || !!flight?.walk) && i === floor;
      if (!Number(pet.dataset.companion) || reduced.matches) {
        view.petX = targetX;
        view.petY = view.y;
      } else if (follow) {
        const amount = 1 - Math.exp(-7 * dt);
        view.petX += (targetX - view.petX) * amount;
        view.petY += (view.y - view.petY) * amount;
      }
      const petMoving =
        Math.abs(targetX - view.petX) > 4 || Math.abs(view.vx) > 10;
      pet.dataset.pose = petMoving ? "run" : "idle";
      pet.dataset.facing = view.facing < 0 ? "left" : "right";
      pet.dataset.inView = String(
        view.petX - view.camera > -30 &&
          view.petX - view.camera < view.width + 30,
      );
      setStyle(
        pet,
        "visibility",
        i === floor &&
          !paused.has("arrival") &&
          root.dataset.travelling !== "true"
          ? "visible"
          : "hidden",
      );
      setStyle(
        pet,
        "transform",
        `translate3d(${Math.round(view.petX - 30)}px,${Math.round(view.petY - 60 + offset)}px,0)`,
      );
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
    renderSpriteFrames();
    lifts.forEach((lift, i) => {
      if (
        lift.dataset.arrived &&
        (i !== floor || Math.abs(v.x - SCENE.lift) > 190)
      )
        delete lift.dataset.arrived;
    });
    const target = nearest(),
      prompt = prompts[floor],
      id = target?.id || "";
    prompt.hidden =
      returningToPage ||
      (!manual && target?.kind !== "lift") ||
      !target ||
      !!flight;
    prompt.dataset.kind = target?.kind || "";
    if (target) {
      const head =
        target.kind === "npc" ? heads.get(target.element) : undefined;
      if (head)
        setStyle(prompt, "top", `${Math.max(44, Math.round(head.y - 12))}px`);
      else prompt.style.removeProperty("top");
      const edge = Math.min(110, width / 2);
      const anchor = targetX(target.element) - v.camera;
      const labelX = clamp(anchor, edge, width - edge);
      setStyle(prompt, "left", `${labelX}px`);
      setStyle(prompt, "--prompt-tip", `${clamp(anchor - labelX, -60, 60)}px`);
    }
    if (id !== near) {
      near = id;
      root.dataset.near = id;
      root.dataset.nearKind = target?.kind || "";
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
            : target.kind === "food"
              ? "EAT PIZZA"
              : target.kind === "npc"
                ? "TALK"
                : target.kind === "register"
                  ? target.element.dataset.actionLabel || "REGISTER"
                  : target.kind === "schedule"
                    ? "VIEW"
                    : target.kind === "session"
                      ? target.element.getAttribute("aria-pressed") === "true"
                        ? "REMOVE INTEREST"
                        : "SAVE INTEREST"
                      : "PLAY",
        hint = prompt.querySelector("[data-prompt-action]")!,
        text = snack.active ? "ENJOY YOUR SLICE" : `${key} · ${verb}`;
      if (hint.textContent !== text) hint.textContent = text;
    }
  }
  function tick(now: number) {
    raf = 0;
    if (root.classList.contains("is-handheld")) stopPageReturn();
    if (returningToPage && reduced.matches) settlePageReturn();
    const elapsed = last ? Math.min((now - last) / 1000, 0.15) : 0;
    last = now;
    const visible = visibleFloor(),
      v = current();
    if (!paused.size && visible >= 0 && !document.hidden) {
      if (snack.active) {
        const previousStep = snack.step;
        const completed = snack.advance(elapsed);
        players[floor].dataset.snackStep = String(snack.step);
        if (
          snack.step !== previousStep &&
          (snack.step === 1 || snack.step === 3)
        )
          audio.effect("bite");
        if (completed) finishSnack(true);
      }
      const pageReturn =
        returningToPage && !root.classList.contains("is-handheld");
      if (visible === floor || pageReturn) {
        accumulator = Math.min(accumulator + elapsed, 0.15);
        while (accumulator >= 1 / 60) {
          physics(1 / 60, now);
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      updateWalkers(elapsed);
      render(elapsed);
      if (
        returningToPage &&
        v.x === SCENE.booth &&
        v.grounded &&
        v.support === null &&
        views.every((view, i) => view.camera === pageCamera(i))
      )
        stopPageReturn();
    } else {
      accumulator = 0;
      last = 0;
      floors.forEach((el) => (el.dataset.live = "false"));
      renderSpriteFrames();
    }
    if (
      !document.hidden &&
      !paused.size &&
      visible >= 0 &&
      (returningToPage ||
        jumpBuffer > 0 ||
        snack.active ||
        dust[floor].active ||
        (manual &&
          !reduced.matches &&
          (Math.abs(v.lookahead) > 1 ||
            Math.abs(
              clamp(
                v.x - v.tracking,
                0,
                Math.max(0, WORLD_WIDTH - floors[floor].clientWidth),
              ) - v.camera,
            ) > 1)) ||
        (manual && !!input.horizontal()) ||
        (Number(companions[floor].dataset.companion) > 0 &&
          Math.abs(v.petX - (v.x - v.facing * 82)) > 1) ||
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
        suppressHover();
        finishSnack(false);
        cancelTravel();
        paused.add(reason);
        clearHeld();
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
    interact,
    eat,
    reveal: (index, px) => navigate(index, px ?? current().x, true),
    reframe: (index, px) =>
      navigate(index, px ?? current().x, true, false, false),
    control: (index) => {
      if (paused.size) return;
      if (floor !== index) activate(index);
      begin();
      framePlayer();
      focus();
      render(0);
      schedule();
    },
    travel,
    cancelTravel,
    release,
    restorePage,
    focus,
    refresh: measure,
    position: () => ({ floor, x: current().x }),
    setAmbient(value) {
      ambientPaused = value;
      if (value) clearHeld();
      render(0);
      schedule();
    },
    destroy() {
      destroyed = true;
      finishSnack(false);
      cancelTravel();
      abort.abort();
      resize.disconnect();
      intersection.disconnect();
      dust.forEach((trail) => trail.destroy());
      cancelAnimationFrame(raf);
      input.clear();
    },
  };
}
