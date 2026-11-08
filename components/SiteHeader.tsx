"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  const initialItem = useRef<number | null>(null);
  const cta = registered ? "My player" : "Register now";
  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  }, []);
  const choose = (action: () => void, restore = true) => {
    close(restore);
    action();
  };
  const focusItem = useCallback((position: number) => {
    const items = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>("button") || []),
    ].filter((item) => item.getClientRects().length);
    items[position < 0 ? items.length - 1 : 0]?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    if (open && initialItem.current !== null) focusItem(initialItem.current);
  }, [open, focusItem]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    const scroll = () => close();
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", scroll);
    };
  }, [open, close]);
  useEffect(() => {
    if (inactive) setOpen(false);
  }, [inactive]);
  useEffect(() => {
    const wide = matchMedia("(min-width: 35rem)");
    const inlineAction = matchMedia("(min-width: 22rem)");
    const adapt = () => {
      const active = document.activeElement;
      const restore =
        Boolean(panel.current) ||
        active === trigger.current ||
        Boolean(
          active &&
            trigger.current?.closest("header")?.contains(active) &&
            !active.getClientRects().length,
        );
      setOpen(false);
      if (restore)
        (wide.matches ? firstLink.current : trigger.current)?.focus({
          preventScroll: true,
        });
    };
    const breakpoints = [wide, inlineAction];
    breakpoints.forEach((media) => media.addEventListener("change", adapt));
    return () =>
      breakpoints.forEach((media) =>
        media.removeEventListener("change", adapt),
      );
  }, []);
  return (
    <header
      className="site-header"
      inert={inactive}
      data-nav-open={open}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.repeat && ["Enter", " "].includes(event.key))
          event.preventDefault();
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        // A null target can be a pointer or window handoff, not a dismissal.
        if (
          open &&
          next &&
          next !== trigger.current &&
          !panel.current?.contains(next)
        )
          close();
      }}
    >
      <a
        className="header-brand"
        href="https://vega.io/"
        target="_blank"
        rel="noreferrer"
        aria-label="Visit Vega"
        onClick={() => close()}
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
          onClick={(event) => {
            initialItem.current = event.detail === 0 ? 0 : null;
            if (event.detail !== 0)
              trigger.current?.focus({ preventScroll: true });
            setOpen((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              initialItem.current = event.key === "ArrowUp" ? -1 : 0;
              if (open) focusItem(initialItem.current);
              else setOpen(true);
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
        <button
          className="header-cta"
          onClick={() => choose(onRegister, false)}
        >
          <span>{cta}</span>
        </button>
      </nav>
      {open && (
        <>
          <button
            className="nav-dismiss"
            aria-label="Close navigation"
            tabIndex={-1}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => close(true)}
          />
          <div
            ref={panel}
            id="convention-menu"
            className="nav-dropdown"
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
