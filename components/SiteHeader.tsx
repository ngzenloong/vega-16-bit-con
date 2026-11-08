"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export default function SiteHeader({
  registered,
  inactive,
  onExplore,
  onSchedule,
  onRegister,
}: {
  registered: boolean;
  inactive: boolean;
  onExplore: () => void;
  onSchedule: () => void;
  onRegister: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstLink = useRef<HTMLButtonElement>(null);
  const initialItem = useRef(0);
  const cta = registered ? "My player" : "Register now";
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const choose = (action: () => void) => {
    close();
    action();
  };
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const items = [
        ...panel.current!.querySelectorAll<HTMLButtonElement>("button"),
      ].filter((item) => item.getClientRects().length);
      items[initialItem.current < 0 ? items.length - 1 : 0]?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (inactive) setOpen(false);
  }, [inactive]);
  useEffect(() => {
    const media = matchMedia("(min-width: 35rem)");
    const adapt = () => {
      if (!media.matches) return;
      const restore =
        panel.current?.contains(document.activeElement) ||
        document.activeElement === trigger.current;
      setOpen(false);
      if (restore) firstLink.current?.focus({ preventScroll: true });
    };
    media.addEventListener("change", adapt);
    return () => media.removeEventListener("change", adapt);
  }, []);
  return (
    <header className="site-header" inert={inactive} data-nav-open={open}>
      <a
        className="header-brand"
        href="https://vega.io/"
        target="_blank"
        rel="noreferrer"
        aria-label="Visit Vega"
      >
        <img src="/assets/vega/logo.svg" alt="Vega" width={111} height={36} />
      </a>
      <nav className="header-nav" aria-label="Convention navigation">
        <div className="header-links">
          <button ref={firstLink} className="nav-link" onClick={onExplore}>
            <span>Explore</span>
          </button>
          <button className="nav-link" onClick={onSchedule}>
            <span>Schedule</span>
          </button>
        </div>
        <button
          ref={trigger}
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="convention-menu"
          onClick={() => {
            initialItem.current = 0;
            setOpen((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              initialItem.current = event.key === "ArrowUp" ? -1 : 0;
              setOpen(true);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
          }}
        >
          <span>Menu</span>
          <Icon name="chevron" size={14} />
        </button>
        <button className="header-cta" onClick={() => choose(onRegister)}>
          <span>{cta}</span>
        </button>
      </nav>
      {open && (
        <>
          <button
            className="nav-dismiss"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => close(true)}
          />
          <div
            ref={panel}
            id="convention-menu"
            className="nav-dropdown"
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null;
              if (
                !event.currentTarget.contains(next) &&
                next !== trigger.current
              )
                close();
            }}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close(true);
                return;
              }
              if (
                ![
                  "ArrowDown",
                  "ArrowUp",
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button",
                ),
              ].filter((item) => item.getClientRects().length);
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const index =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (current +
                        (["ArrowUp", "ArrowLeft"].includes(event.key)
                          ? -1
                          : 1) +
                        items.length) %
                      items.length;
              items[index]?.focus({ preventScroll: true });
            }}
          >
            <button className="nav-link" onClick={() => choose(onExplore)}>
              <span>Explore the hall</span>
            </button>
            <button className="nav-link" onClick={() => choose(onSchedule)}>
              <span>See the schedule</span>
            </button>
            <button
              className="header-cta menu-register"
              onClick={() => choose(onRegister)}
            >
              <span>{cta}</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
