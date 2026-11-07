import { clamp, landingSurface } from "./math";
import { HeldInput, isSceneTap, type ScenePress } from "./input";
import { audio } from "./audio";
import { SCENE } from "./scene";
import { SPRITES } from "./assets";
import { SpriteClock } from "./sprite-clock";
import { SnackSequence } from "./snack";
import { advanceWalk } from "./walk";
import { createFootDust } from "./dust";
import type { GameButton } from "./games/types";

export const WORLD_WIDTH = SCENE.width;
export type WorldTarget = {
  kind: "game" | "npc" | "lift" | "register" | "session" | "food";
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
): WorldController {
  const floors = [...root.querySelectorAll<HTMLElement>("[data-floor]")];
  const inners = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-world-inner]")!,
  );
  const players = floors.map(
    (f) => f.querySelector<HTMLElement>("[data-player]")!,
  );
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
    manual = false,
    raf = 0,
    last = 0,
    accumulator = 0,
    near = "",
    dropUntil = 0,
    coyote = 0,
    jumpBuffer = 0;
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
  function framePlayer() {
    if (root.classList.contains("is-handheld")) return;
    const rect = players[floor].getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight - 76)
      window.scrollTo({
        top: Math.max(
          0,
          scrollY + rect.top - (innerHeight - rect.height) * 0.62,
        ),
        behavior: reduced.matches ? "instant" : "smooth",
      });
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
    finishSnack(false);
    clearHeld();
    manual = false;
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
    navigationPausedAt = 0;
    navigationStep = null;
    paused.delete("navigation");
    document.documentElement.style.scrollBehavior = oldScrollBehavior;
    travelState(false);
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
  function measure() {
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
    schedule();
  }
  function activate(index: number, px?: number) {
    clearHeld();
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
    if (px !== undefined) {
      v.petX = v.x - v.facing * 82;
      v.petY = v.y;
    }
    v.tracking = v.x - v.camera;
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
    movePlayer = true,
    onArrive?: () => void,
  ) {
    finishSnack(false);
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
    activate(index, movePlayer ? px : undefined);
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
        window.scrollTo({
          top: destinationScroll(floor, frameActor),
          behavior: "auto",
        });
        document.documentElement.style.scrollBehavior = before;
      }
      render(0);
      focus();
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
      if (active.scroll)
        window.scrollTo({
          top:
            active.fromScroll + (active.toScroll - active.fromScroll) * amount,
          behavior: "auto",
        });
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
        active.onArrive?.();
      }
    };
    navigationStep = advance;
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
        radius =
          element.dataset.kind === "npc"
            ? Math.max(96, element.offsetWidth / 2 + 32)
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
    if (snack.active) {
      if (target.kind === "food") return;
      finishSnack(false);
    }
    if (target.kind !== "npc" && target.kind !== "food") {
      onTarget(target);
      return;
    }
    const index = Number(
      target.element.closest<HTMLElement>("[data-floor]")?.dataset.floor || 0,
    );
    const x = Number(target.element.dataset.x);
    const distance =
      target.kind === "food"
        ? 100
        : Math.max(72, target.element.offsetWidth / 2 + 24);
    const side = target.kind === "food" ? 1 : views[index].x < x ? -1 : 1;
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
      framePlayer();
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
      cancelTravel();
      if (!paused.size) release();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    "scroll",
    () => {
      if (!paused.size && !flight && !root.classList.contains("is-handheld")) {
        const visible = visibleFloor();
        if (visible >= 0 && visible !== floor) {
          release();
          activate(visible);
        }
      }
      schedule();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    "touchmove",
    () => {
      if (!paused.size && !root.classList.contains("is-handheld")) release();
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
    const direction = manual ? input.horizontal() : 0,
      speed = SCENE.walkSpeed;
    const motion = advanceWalk(v.vx, v.held, direction, dt, speed);
    v.vx = motion.velocity;
    v.held = motion.held;
    if (direction) v.facing = direction;
    v.x = clamp(v.x + v.vx * dt, 35, WORLD_WIDTH - 35);
    coyote = v.grounded ? 0.1 : Math.max(0, coyote - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && coyote > 0) {
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
      now < dropUntil
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
          ((manual && !paused.size && i === floor) ||
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
    if (manual && !flight) {
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
            : target.kind === "food"
              ? "EAT PIZZA"
              : target.kind === "npc"
                ? "TALK"
                : target.kind === "register"
                  ? target.element.dataset.actionLabel || "REGISTER"
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
      renderSpriteFrames();
    }
    if (
      !document.hidden &&
      !paused.size &&
      visible >= 0 &&
      (snack.active ||
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
    reveal: (index, px) => navigate(index, px ?? views[index].x, true),
    reframe: (index, px) =>
      navigate(index, px ?? views[index].x, true, false, false),
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
