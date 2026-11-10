"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { retainDialogFocus } from "@/lib/dialog-focus";
import { audio } from "@/lib/audio";
import Icon from "./Icon";
import SessionTickets from "./SessionTickets";

export default function ScheduleDialog({
  interests,
  onSession,
  onClose,
  soundControl,
  reduced = false,
  motionPaused = false,
}: {
  interests: number[];
  onSession: (index: number) => void;
  onClose: () => void;
  soundControl: ReactNode;
  reduced?: boolean;
  motionPaused?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!,
      previous = document.activeElement as HTMLElement | null;
    element.showModal();
    element.focus({ preventScroll: true });
    const unlock = retainDialogFocus(element);
    audio.duck(0.35);
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    element.addEventListener("cancel", cancel);
    return () => {
      element.removeEventListener("cancel", cancel);
      unlock();
      element.close();
      audio.duck(1);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <dialog
      ref={dialog}
      className="lineup-dialog"
      tabIndex={-1}
      aria-labelledby="lineup-title"
      onKeyDown={(event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          ![
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        event.preventDefault();
        const items = [
          ...dialog.current!.querySelectorAll<HTMLButtonElement>(
            ".ticket-action",
          ),
        ];
        const current = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : current < 0
                ? 0
                : (current +
                    (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1) +
                    items.length) %
                  items.length;
        items[next]?.focus({ preventScroll: true });
        items[next]?.scrollIntoView({ block: "nearest" });
      }}
    >
      <header className="window-title">
        <h2 id="lineup-title">The lineup.</h2>
        <div className="window-actions">
          {soundControl}
          <button
            type="button"
            className="icon-button"
            aria-label="Close schedule"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="lineup-content">
        <p>Featured sessions from October 3–5, 2026.</p>
        <SessionTickets
          interests={interests}
          onSession={onSession}
          paused={motionPaused}
          reduced={reduced}
        />
        <p className="lineup-note">
          New York time · A selection of event highlights.
        </p>
      </div>
    </dialog>
  );
}
