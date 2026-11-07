import test from "node:test";
import assert from "node:assert/strict";
import { retainDialogFocus, lockPageScroll } from "../lib/dialog-focus.ts";

test("returning from another app restores the modal and routes lost-focus arrows away from the page", (t) => {
  const documentMock = new EventTarget() as EventTarget & {
    hidden: boolean;
    activeElement: unknown;
    hasFocus: () => boolean;
    documentElement: { style: { overflowY: string } };
    querySelectorAll: () => unknown[];
  };
  const windowMock = new EventTarget();
  let owner: FakeDialog;
  class FakeDialog extends EventTarget {
    open = true;
    isConnected = true;
    contains(target: unknown) {
      return target === this;
    }
    hasAttribute() {
      return false;
    }
    matches() {
      return false;
    }
    focus() {
      documentMock.activeElement = this;
    }
    querySelectorAll() {
      return [];
    }
  }
  owner = new FakeDialog();
  Object.assign(documentMock, {
    hidden: false,
    activeElement: null,
    hasFocus: () => true,
    documentElement: { style: { overflowY: "auto" } },
    querySelectorAll: () => [owner],
  });
  class Key extends Event {
    code: string;
    key: string;
    repeat = false;
    shiftKey = false;
    ctrlKey = false;
    metaKey = false;
    altKey = false;
    constructor(
      type: string,
      options: { code: string; key: string; cancelable?: boolean },
    ) {
      super(type, { cancelable: true });
      this.code = options.code;
      this.key = options.key;
    }
  }
  const globals = {
    document: documentMock,
    window: windowMock,
    KeyboardEvent: Key,
    requestAnimationFrame: (fn: () => void) => {
      fn();
      return 1;
    },
    cancelAnimationFrame: () => {},
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const releaseHandheld = lockPageScroll();
  const release = retainDialogFocus(owner as unknown as HTMLDialogElement);
  t.after(() => {
    release();
    assert.equal(
      documentMock.documentElement.style.overflowY,
      "hidden",
      "closing an overlay must retain the handheld scroll lock",
    );
    releaseHandheld();
    releaseHandheld();
    assert.equal(documentMock.documentElement.style.overflowY, "auto");
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  assert.equal(documentMock.documentElement.style.overflowY, "hidden");
  windowMock.dispatchEvent(new Event("focus"));
  assert.equal(documentMock.activeElement, owner);
  documentMock.activeElement = null;
  let routed = 0,
    cancelled = 0;
  owner.addEventListener("keydown", () => routed++);
  owner.addEventListener("cancel", () => cancelled++);
  const key = new Key("keydown", { code: "ArrowDown", key: "ArrowDown" });
  documentMock.dispatchEvent(key);
  assert.equal(key.defaultPrevented, true);
  assert.equal(routed, 1);
  documentMock.activeElement = null;
  documentMock.dispatchEvent(
    new Key("keydown", { code: "Escape", key: "Escape" }),
  );
  assert.equal(cancelled, 1);
});
