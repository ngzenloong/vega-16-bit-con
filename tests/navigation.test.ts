import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type View = { type: unknown; props: Record<string, unknown> };
type Cleanup = () => void;
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: Cleanup };
const jsx = (type: unknown, props: View["props"]): View => ({ type, props });
const source = (name: string) =>
  readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
function compile(code: string, imports: Record<string, unknown>, globals = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const output = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(`(function(require,module,exports){${output}\n})`, globals)(
    (name: string) => {
      assert.ok(name in imports, `unhandled test import: ${name}`);
      return imports[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}
function views(value: unknown): View[] {
  if (Array.isArray(value)) return value.flatMap(views);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as View;
  return [node, ...views(node.props.children)];
}
function event(values: Record<string, unknown> = {}) {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    ...values,
  };
}
function invoke(node: View, handler: string, value: unknown) {
  (node.props[handler] as ((value: unknown) => void) | undefined)?.(value);
}
class Surface extends EventTarget {
  // Normalize Node 22's boolean-capture removal to the browser contract.
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    super.removeEventListener(
      type,
      listener,
      typeof options === "boolean" ? { capture: options } : options,
    );
  }
}

/** Execute the real component and its handlers; browser event order is supplied explicitly. */
function header(t: TestContext) {
  const page = Object.assign(new Surface(), { activeElement: null as unknown });
  const windowMock = new Surface();
  const media = new Map<string, Surface & { matches: boolean }>();
  const slots: Slot[] = [];
  let index = 0,
    dirty = false;
  let effects: Cleanup[] = [];
  const equal = (a?: readonly unknown[], b?: readonly unknown[]) =>
    a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((v, i) => Object.is(v, b[i]));
  const effect = (
    callback: () => void | Cleanup,
    deps?: readonly unknown[],
  ) => {
    const slot = (slots[index++] ||= {});
    if (!equal(slot.deps, deps)) {
      slot.deps = deps;
      effects.push(() => {
        slot.cleanup?.();
        slot.cleanup = callback() || undefined;
      });
    }
  };
  const react = {
    useState(initial: unknown) {
      const slot = (slots[index++] ||= { value: initial });
      return [
        slot.value,
        (next: unknown) => {
          const value = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(value, slot.value)) {
            slot.value = value;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial: unknown) {
      return (slots[index++] ||= { value: { current: initial } }).value;
    },
    useCallback(callback: unknown, deps: readonly unknown[]) {
      const slot = (slots[index++] ||= {});
      if (!equal(slot.deps, deps)) {
        slot.deps = deps;
        slot.value = callback;
      }
      return slot.value;
    },
    useEffect: effect,
    useLayoutEffect: effect,
  };
  const headerControls = new Set<unknown>();
  const makeControl = (name: string) => {
    const control = {
      name,
      rendered: true,
      focus() {
        page.activeElement = this;
      },
      getClientRects() {
        return this.rendered ? [{}] : [];
      },
      scrollIntoView() {},
      closest: () => ({
        contains: (node: unknown) => headerControls.has(node),
      }),
    };
    headerControls.add(control);
    return control;
  };
  const trigger = makeControl("Menu"),
    desktop = makeControl("Explore"),
    inlineAction = makeControl("Register now");
  const items = ["Explore the hall", "See the schedule", "Register now"].map(
    makeControl,
  );
  const panel = {
    contains: (node: unknown) =>
      node === panel || items.includes(node as (typeof items)[number]),
    querySelectorAll: () => items,
  };
  const calls: { name: string; focus: unknown }[] = [];
  const props = {
    registered: false,
    inactive: false,
    onExplore: () => calls.push({ name: "explore", focus: page.activeElement }),
    onSchedule: () =>
      calls.push({ name: "schedule", focus: page.activeElement }),
    onRegister: () =>
      calls.push({ name: "register", focus: page.activeElement }),
  };
  const Component = compile(
    source("SiteHeader"),
    {
      react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "./Icon": () => null,
    },
    {
      document: page,
      window: windowMock,
      matchMedia: (query: string) => {
        if (!media.has(query))
          media.set(query, Object.assign(new Surface(), { matches: false }));
        return media.get(query)!;
      },
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
      cancelAnimationFrame: () => {},
    },
  ).default as (value: typeof props) => View;
  let tree: View;
  let attached: { current: unknown }[] = [];
  const find = (className: string) => {
    const node = views(tree).find((item) =>
      String(item.props.className || "")
        .split(" ")
        .includes(className),
    );
    assert.ok(node, `missing ${className}`);
    return node;
  };
  const render = () => {
    for (let pass = 0; pass < 5; pass++) {
      index = 0;
      dirty = false;
      effects = [];
      tree = Component(props);
      attached.forEach((ref) => {
        ref.current = null;
      });
      attached = [];
      for (const node of views(tree)) {
        const ref = node.props.ref as { current: unknown } | undefined;
        if (ref) {
          ref.current =
            node.props.id === "convention-menu"
              ? panel
              : node.props["aria-controls"]
                ? trigger
                : desktop;
          attached.push(ref);
        }
      }
      effects.forEach((run) => run());
      if (!dirty) return;
    }
    assert.fail("header did not settle");
  };
  render();
  t.after(() => slots.forEach((slot) => slot.cleanup?.()));
  return {
    page,
    window: windowMock,
    trigger,
    desktop,
    inlineAction,
    items,
    calls,
    open: () => find("nav-toggle").props["aria-expanded"],
    clickTrigger(detail = 1) {
      invoke(find("nav-toggle"), "onClick", event({ detail }));
      render();
    },
    blur(next: unknown, fromPanel = true) {
      if (fromPanel)
        invoke(
          find("nav-dropdown"),
          "onBlur",
          event({ relatedTarget: next, currentTarget: panel }),
        );
      invoke(tree, "onBlur", event({ relatedTarget: next }));
      render();
    },
    clickItem(position: number) {
      const buttons = views(find("nav-dropdown")).filter(
        (node) => node.type === "button",
      );
      invoke(buttons[position], "onClick", event({ detail: 1 }));
      render();
    },
    key(key: string) {
      invoke(find("nav-toggle"), "onKeyDown", event({ key }));
      render();
    },
    menuKey(key: string) {
      invoke(
        find("nav-dropdown"),
        "onKeyDown",
        event({ key, currentTarget: panel }),
      );
      render();
    },
    headerKey(
      key: string,
      repeat: boolean,
      modifiers: Record<string, boolean> = {},
    ) {
      const down = event({ key, repeat, ...modifiers });
      invoke(tree, "onKeyDown", down);
      render();
      return down.defaultPrevented;
    },
    mediaChange(query: string, matches: boolean) {
      const target = media.get(query);
      assert.ok(target, `missing media subscription: ${query}`);
      target.matches = matches;
      target.dispatchEvent(new Event("change"));
      render();
    },
    outside() {
      const down = event();
      invoke(find("nav-dismiss"), "onPointerDown", down);
      assert.equal(down.defaultPrevented, true);
      invoke(find("nav-dismiss"), "onClick", event({ detail: 1 }));
      render();
    },
    escape() {
      const key = new Event("keydown", { cancelable: true });
      Object.defineProperty(key, "key", { value: "Escape" });
      page.dispatchEvent(key);
      render();
      return key.defaultPrevented;
    },
    scroll() {
      windowMock.dispatchEvent(new Event("scroll"));
      render();
    },
  };
}

test("pointer Menu toggles stay reversible when null blur precedes the next click", (t) => {
  const menu = header(t);
  for (let i = 0; i < 3; i++) {
    menu.clickTrigger();
    assert.equal(menu.open(), true);
    assert.equal(menu.page.activeElement, menu.trigger);
    menu.blur(null);
    assert.equal(menu.open(), true);
    menu.clickTrigger();
    assert.equal(menu.open(), false);
  }
});

test("null blur does not remove a menu action before its click", (t) => {
  const menu = header(t);
  for (const [index, action] of ["explore", "schedule", "register"].entries()) {
    menu.clickTrigger();
    menu.blur(null);
    menu.clickItem(index);
    assert.equal(menu.open(), false);
    assert.equal(menu.calls[index].name, action);
    assert.equal(menu.calls[index].focus, menu.trigger);
  }
  assert.equal(menu.calls.length, 3);
});

test("keyboard activation and an already-open pointer menu focus the intended item", (t) => {
  const menu = header(t);
  menu.clickTrigger(0);
  assert.equal(menu.page.activeElement, menu.items[0]);
  menu.clickTrigger(0);
  assert.equal(menu.open(), false);
  assert.equal(menu.page.activeElement, menu.trigger);
  menu.clickTrigger(0);
  assert.equal(menu.escape(), true);
  assert.equal(menu.page.activeElement, menu.trigger);
  menu.clickTrigger();
  menu.key("ArrowDown");
  assert.equal(menu.page.activeElement, menu.items[0]);
  menu.trigger.focus();
  menu.key("ArrowUp");
  assert.equal(menu.page.activeElement, menu.items.at(-1));
});

test("real focus leaving, outside click and scrolling dismiss without leaking Escape ownership", (t) => {
  const menu = header(t);
  menu.clickTrigger();
  menu.blur(menu.items[0]);
  assert.equal(menu.open(), true);
  menu.blur(menu.trigger);
  assert.equal(menu.open(), true);
  menu.blur({}, false);
  assert.equal(menu.open(), false);
  menu.clickTrigger();
  menu.outside();
  assert.equal(menu.open(), false);
  assert.equal(menu.page.activeElement, menu.trigger);
  menu.clickTrigger();
  menu.scroll();
  assert.equal(menu.open(), false);
  assert.equal(
    menu.escape(),
    false,
    "closed navigation no longer owns document Escape",
  );
});

test("layout breakpoints close a popup and restore a visible header control", (t) => {
  const menu = header(t);
  menu.clickTrigger(0);
  menu.menuKey("End");
  assert.equal(menu.page.activeElement, menu.items[2]);
  menu.items[2].rendered = false;
  menu.trigger.rendered = false;
  menu.page.activeElement = null; // The browser drops focus as the mobile menu hides.
  menu.mediaChange("(min-width: 48rem)", true);
  assert.equal(menu.open(), false);
  assert.equal(menu.page.activeElement, menu.desktop);

  menu.desktop.rendered = false;
  menu.trigger.rendered = true;
  menu.inlineAction.focus();
  menu.inlineAction.rendered = false;
  menu.mediaChange("(min-width: 48rem)", false);
  assert.equal(menu.page.activeElement, menu.trigger);

  const outside = {};
  menu.page.activeElement = outside;
  menu.mediaChange("(min-width: 48rem)", true);
  assert.equal(
    menu.page.activeElement,
    outside,
    "an inactive header must not steal outside focus",
  );
});

test("held Enter and Space suppress repeated native activation without claiming modifier shortcuts", (t) => {
  const menu = header(t);
  menu.clickTrigger(0);
  for (const key of ["Enter", " "]) {
    assert.equal(menu.headerKey(key, false), false);
    assert.equal(menu.headerKey(key, true), true);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      assert.equal(menu.headerKey(key, true, { [modifier]: true }), false);
  }
  assert.equal(menu.open(), true);
  assert.equal(menu.calls.length, 0);
});

test("conversation sound keeps native Enter/Space activation without advancing dialogue", () => {
  const file = ts.createSourceFile(
    "Dialogue.tsx",
    source("Dialogue"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let keyboard: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "keyboard")
      keyboard = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(keyboard);
  class Button {
    dataset = {};
    closest(selector: string) {
      return selector === ".cinematic-top" || selector.includes("button")
        ? this
        : null;
    }
  }
  let advances = 0,
    toggles = 0;
  const globals = {
    Element: Button,
    HTMLButtonElement: Button,
    last: true,
    complete: true,
    advance: () => advances++,
  };
  const handler = compile(
    `${keyboard.getText(file)}\nexports.keyboard = keyboard;`,
    {},
    globals,
  ).keyboard as (value: ReturnType<typeof event>) => void;
  const SoundControl = compile(source("SoundControl"), {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "./Icon": () => null,
  }).default as (props: Record<string, unknown>) => View;
  const sound = views(
    SoundControl({
      enabled: false,
      loading: false,
      error: "",
      onToggle: async () => {
        toggles++;
      },
    }),
  ).find((node) => node.type === "button")!;
  for (const finalLine of [false, true]) {
    globals.last = globals.complete = finalLine;
    for (const key of ["Enter", " "]) {
      const down = event({ key, repeat: false, target: new Button() });
      handler(down);
      assert.equal(down.defaultPrevented, false);
      invoke(sound, "onClick", event({ detail: 0 }));
      const repeat = event({ key, repeat: true, target: new Button() });
      handler(repeat);
      assert.equal(repeat.defaultPrevented, true);
    }
  }
  assert.equal(toggles, 4);
  assert.equal(advances, 0);
});
