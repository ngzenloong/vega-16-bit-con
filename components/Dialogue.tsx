"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CHARACTERS, dialoguePages, type LoreCharacter } from "@/lib/lore";
import { characterPortrait } from "@/lib/character";
import { NPC_APPEARANCES } from "@/lib/characters";
import Icon from "./Icon";
import { SCENE } from "@/lib/scene";
import { retainDialogFocus } from "@/lib/dialog-focus";
import { audio } from "@/lib/audio";

type Action = NonNullable<LoreCharacter["choices"]>[number]["action"];
export default function Dialogue({
  id,
  reduced,
  touch = false,
  onClose,
  onAction,
  soundControl,
}: {
  id: string;
  reduced: boolean;
  touch?: boolean;
  onClose: () => void;
  onAction: (action: Action) => void;
  soundControl: ReactNode;
}) {
  const character = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  const ref = useRef<HTMLDialogElement>(null),
    typing = useRef(0),
    typingStopped = useRef(false),
    leaving = useRef(false),
    exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [line, setLine] = useState(0),
    [page, setPage] = useState(0),
    [length, setLength] = useState(0),
    [selected, setSelected] = useState(0),
    [closing, setClosing] = useState(false);
  const [portrait, setPortrait] = useState("/assets/vega/sam-portrait.png");
  const pagesByLine = useMemo(
    () =>
      character.lines.map((text) => (touch ? dialoguePages(text, 64) : [text])),
    [character, touch],
  );
  const pageIndex = Math.min(page, pagesByLine[line].length - 1);
  const text = pagesByLine[line][pageIndex],
    complete = length >= text.length,
    last =
      line === character.lines.length - 1 &&
      pageIndex === pagesByLine[line].length - 1;
  const choices = character.choices || [
    { label: "Back to the floor", action: "close" as const },
  ];
  const closeCallback = useRef(onClose);
  const motion = useRef(reduced);
  motion.current = reduced;
  closeCallback.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (d?.open && !d.contains(document.activeElement))
      d.focus({ preventScroll: true });
  }, [complete, last]);

  function leave(action: Action = "close") {
    if (leaving.current) return;
    if (action === "about") {
      audio.effect("click");
      onAction(action);
      return;
    }
    leaving.current = true;
    setClosing(true);
    cancelAnimationFrame(typing.current);
    audio.effect("click");
    exitTimer.current = setTimeout(
      () => {
        if (action === "close") closeCallback.current();
        else onAction(action);
      },
      motion.current ? 0 : 200,
    );
  }
  useEffect(() => {
    let active = true;
    void characterPortrait(
      NPC_APPEARANCES[id] || { hat: 0, glasses: 0, shirt: 0 },
      id,
    )
      .then((src) => {
        if (active) setPortrait(src);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const d = ref.current!,
      previous = document.activeElement as HTMLElement | null,
      oldOverflow = document.body.style.overflow,
      oldScroll = scrollY;
    const actor = document.querySelector<HTMLElement>(`[data-target="${id}"]`),
      floor = actor?.closest<HTMLElement>("[data-floor]"),
      world = actor?.closest<HTMLElement>(".world-stage");
    const oldHeight = world?.style.height || "";
    d.showModal();
    const releaseFocus = retainDialogFocus(d);
    d.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    audio.duck(0.25);
    const frameScene = () => {
      if (!actor || !floor || !world) return;
      const speakerX =
          Number(actor.dataset.x) + Number(actor.dataset.headX || 0),
        camera = Math.max(
          0,
          Math.min(SCENE.width - innerWidth, speakerX - innerWidth / 2),
        );
      const bottom = d
        .querySelector(".conversation-frame")!
        .getBoundingClientRect().height;
      world.style.setProperty("--conversation-camera", `${camera}px`);
      world.style.setProperty("--conversation-anchor", `${speakerX}px`);
      world.style.setProperty("--dialogue-bottom", `${bottom}px`);
    };
    if (floor && world) {
      world.style.height = `${world.offsetHeight}px`;
      world.dataset.conversation = "true";
      frameScene();
      floor.classList.add("is-conversation");
    }
    window.addEventListener("resize", frameScene);
    const cancel = (event: Event) => {
      event.preventDefault();
      leave();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      cancelAnimationFrame(typing.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
      d.removeEventListener("cancel", cancel);
      releaseFocus();
      window.removeEventListener("resize", frameScene);
      d.close();
      document.body.style.overflow = oldOverflow;
      audio.duck(1);
      floor?.classList.remove("is-conversation");
      if (world) {
        delete world.dataset.conversation;
        world.style.height = oldHeight;
        world.style.removeProperty("--conversation-camera");
        world.style.removeProperty("--conversation-anchor");
        world.style.removeProperty("--dialogue-bottom");
      }
      previous?.focus({ preventScroll: true });
      const html = document.documentElement,
        oldBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo({ top: oldScroll, behavior: "auto" });
      requestAnimationFrame(() => {
        window.scrollTo({ top: oldScroll, behavior: "auto" });
        html.style.scrollBehavior = oldBehavior;
      });
    };
    // The scene is captured once; changing a dialogue line must not reframe it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    setLength(reduced ? text.length : 0);
    setSelected(0);
    typingStopped.current = reduced;
    if (reduced) return;
    let elapsed = 0,
      lastTick = 0,
      previousCount = -1,
      previousVoice = 0;
    const reveal = (now: number) => {
      if (typingStopped.current || leaving.current) return;
      if (lastTick) elapsed += Math.min(100, now - lastTick);
      lastTick = now;
      const next = Math.min(text.length, Math.floor(elapsed * 0.045));
      if (next !== previousCount) {
        setLength(next);
        previousCount = next;
      }
      if (next - previousVoice >= 5) {
        audio.effect("talk");
        previousVoice = next;
      }
      if (next < text.length) typing.current = requestAnimationFrame(reveal);
      else typingStopped.current = true;
    };
    const suspend = () => {
      cancelAnimationFrame(typing.current);
      lastTick = 0;
    };
    const resume = () => {
      suspend();
      if (
        !document.hidden &&
        document.hasFocus() &&
        !typingStopped.current &&
        !leaving.current
      )
        typing.current = requestAnimationFrame(reveal);
    };
    resume();
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      suspend();
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [text, reduced]);

  function advance() {
    if (leaving.current) return;
    audio.effect("click");
    if (!complete) {
      typingStopped.current = true;
      cancelAnimationFrame(typing.current);
      setLength(text.length);
    } else if (!last) {
      setLength(0);
      if (pageIndex < pagesByLine[line].length - 1) setPage(pageIndex + 1);
      else {
        setPage(0);
        setLine((n) => n + 1);
      }
    } else leave(choices[selected].action);
  }
  function keyboard(event: KeyboardEvent<HTMLDialogElement>) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key === "Escape" ||
      event.key === "Tab"
    )
      return;
    if (event.repeat) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key))
        event.preventDefault();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    // Toolbar controls keep their native actions; focused dialogue buttons click normally.
    if (target?.closest(".cinematic-top")) return;
    if (
      ["Enter", " "].includes(event.key) &&
      target?.closest("button,a,summary,input,select,textarea")
    )
      return;
    if (
      last &&
      complete &&
      ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)
    ) {
      event.preventDefault();
      const delta = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      const next = (selected + delta + choices.length) % choices.length;
      setSelected(next);
      ref.current
        ?.querySelectorAll<HTMLButtonElement>(
          ".dialogue-choice-slot [data-native-action]",
        )
        [next]?.focus({ preventScroll: true });
      audio.effect("click");
      return;
    }
    if (["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      advance();
    }
  }
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className="conversation-dialog"
      data-closing={closing}
      aria-labelledby="speaker-name"
      onKeyDown={keyboard}
      onClick={(event) => {
        if (last && complete) return;
        if ((event.target as Element).closest("button,a,input,select,textarea"))
          return;
        advance();
      }}
    >
      <div className="cinematic-top">
        {soundControl}
        <button
          className="cinematic-close"
          data-native-action="true"
          onClick={() => leave()}
          aria-label="End conversation"
        >
          Back to the hall {!touch && <kbd>Esc</kbd>}
          <Icon name="close" />
        </button>
      </div>
      <div className="conversation-frame">
        <div className="dialogue-identity">
          <img
            src={portrait}
            width={120}
            height={120}
            alt=""
            className="dialogue-portrait"
          />
          <div>
            <h2 id="speaker-name">{character.name}</h2>
            <p>{character.role}</p>
          </div>
        </div>
        <button
          className="dialogue-copy"
          onClick={advance}
          disabled={last && complete}
          aria-label={
            !complete
              ? "Reveal full dialogue"
              : !last
                ? "Continue dialogue"
                : "Choose a response below"
          }
        >
          <span className="dialogue-text-stack" aria-hidden="true">
            {pagesByLine.flat().map((full, i) => (
              <span className="dialogue-text-measure" key={i}>
                {full}
              </span>
            ))}
            <span className="dialogue-text-visible">
              <span>{text.slice(0, length)}</span>
              <span className="dialogue-unrevealed">{text.slice(length)}</span>
            </span>
          </span>
          <span className="sr-only">{text}</span>
        </button>
        <div className="dialogue-interaction">
          <div
            className="dialogue-choice-slot"
            role="group"
            aria-label="Choose a response"
          >
            {last && complete ? (
              choices.map((choice, i) => (
                <button
                  key={choice.label}
                  data-native-action="true"
                  data-selected={selected === i}
                  onFocus={() => setSelected(i)}
                  onClick={() => leave(choice.action)}
                >
                  <span aria-hidden="true">{selected === i ? "▸" : " "}</span>
                  {choice.label}
                </button>
              ))
            ) : (
              <button className="dialogue-continue" onClick={advance}>
                {!touch && <kbd>↵</kbd>}
                {complete ? "Continue" : "Reveal line"}
                <span aria-hidden="true">{complete ? "▾" : ""}</span>
              </button>
            )}
          </div>
          <p>
            {touch
              ? last && complete
                ? "Tap a response."
                : complete
                  ? "Tap anywhere to continue."
                  : "Tap anywhere to reveal."
              : last && complete
                ? "↑ ↓ Choose · Enter Select"
                : "Enter / Space Continue"}
            <br />
            {!touch && "Esc Back to hall"}
          </p>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
    </dialog>
  );
}
