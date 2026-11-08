"use client";
import { useEffect, useRef, useState } from "react";
import type { Appearance, OutfitPart } from "@/lib/types";
import { OUTFIT_LABELS, OUTFIT_OPTIONS } from "@/lib/appearance";
import { outfitThumbnail } from "@/lib/outfit-thumbnail";
import { audio } from "@/lib/audio";
import { updateHorizontalOverflow as updateOverflow } from "@/lib/overflow";

const rows: OutfitPart[] = [
  "shirt",
  "hat",
  "glasses",
  "neck",
  "bag",
  "shoes",
  "item",
  "companion",
];
export default function OutfitPicker({
  value,
  onChange,
  onInspect,
  disabled,
}: {
  value: Required<Appearance>;
  onChange: (value: Required<Appearance>) => void;
  onInspect?: (part: OutfitPart) => void;
  disabled: boolean;
}) {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strips = [
      ...root.current!.querySelectorAll<HTMLDivElement>(".accessory-strip"),
    ];
    const observer = new ResizeObserver(() => strips.forEach(updateOverflow));
    strips.forEach((strip) => {
      updateOverflow(strip);
      observer.observe(strip);
    });
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{
    element: HTMLDivElement;
    pointer: number;
    x: number;
    scroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const finishDrag = (suppress = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    delete current.element.dataset.dragging;
    if (current.element.hasPointerCapture(current.pointer))
      current.element.releasePointerCapture(current.pointer);
    suppressClick.current = suppress && current.moved;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };
  useEffect(() => {
    const blur = () => finishDrag();
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      finishDrag();
    };
  }, []);
  const [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const entries = rows.flatMap((part) =>
      OUTFIT_OPTIONS[part].map((_, i) => ({ part, i })),
    );
    void Promise.allSettled(
      entries.map(({ part, i }) => outfitThumbnail(part, i)),
    ).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled")
          next[`${entries[index].part}:${entries[index].i}`] = result.value;
      });
      setIcons(next);
      setFailed(results.some((result) => result.status === "rejected"));
    });
    return () => {
      active = false;
    };
  }, [retry]);
  const choose = (part: OutfitPart, i: number) => {
    onInspect?.(part);
    audio.effect("click");
    if (value[part] === i) return;
    onChange({ ...value, [part]: i });
  };
  return (
    <div
      ref={root}
      className="wardrobe-rows"
      aria-label="Choose clothes and accessories"
    >
      {failed && (
        <p className="outfit-error" role="status">
          Some previews could not load.{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {rows.map((part, rowIndex) => (
        <div
          className="accessory-strip"
          role="radiogroup"
          aria-label={OUTFIT_LABELS[part]}
          key={part}
          onScroll={(event) => updateOverflow(event.currentTarget)}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse" || event.button !== 0) return;
            drag.current = {
              element: event.currentTarget,
              pointer: event.pointerId,
              x: event.clientX,
              scroll: event.currentTarget.scrollLeft,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current || current.element !== event.currentTarget) return;
            if (!event.buttons) {
              finishDrag();
              return;
            }
            const delta = event.clientX - current.x;
            if (!current.moved && Math.abs(delta) < 6) return;
            event.preventDefault();
            current.moved = true;
            current.element.dataset.dragging = "true";
            current.element.setPointerCapture(current.pointer);
            current.element.scrollLeft = current.scroll - delta;
          }}
          onPointerUp={() => finishDrag(true)}
          onPointerCancel={() => finishDrag()}
          onLostPointerCapture={() => {
            if (drag.current) finishDrag();
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {OUTFIT_OPTIONS[part].map((label, i) => (
            <button
              key={label}
              type="button"
              className="accessory-option"
              role="radio"
              aria-label={label}
              aria-checked={value[part] === i}
              tabIndex={value[part] === i ? 0 : -1}
              disabled={disabled}
              onFocus={() => onInspect?.(part)}
              onClick={() => choose(part, i)}
              onKeyDown={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const nextRow =
                    rowIndex + (event.key === "ArrowDown" ? 1 : -1);
                  const strips =
                    root.current!.querySelectorAll(".accessory-strip");
                  const next =
                    nextRow === rows.length
                      ? root
                          .current!.closest("form")
                          ?.querySelector<HTMLButtonElement>(
                            ".register-submit:not(:disabled)",
                          )
                      : strips[nextRow]?.querySelector<HTMLButtonElement>(
                          '[aria-checked="true"]',
                        );
                  if (next) {
                    audio.effect("click");
                    next.focus({ preventScroll: true });
                    next.scrollIntoView({
                      block: "nearest",
                      inline: "center",
                      behavior: "instant",
                    });
                  }
                  return;
                }
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const length = OUTFIT_OPTIONS[part].length;
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? length - 1
                      : (i + (event.key === "ArrowRight" ? 1 : -1) + length) %
                        length;
                choose(part, next);
                const button = event.currentTarget.parentElement!.children[
                  next
                ] as HTMLElement;
                button.focus({ preventScroll: true });
                button.scrollIntoView({
                  block: "nearest",
                  inline: "center",
                  behavior: "instant",
                });
              }}
            >
              {icons[`${part}:${i}`] ? (
                <img
                  src={icons[`${part}:${i}`]}
                  alt=""
                  draggable={false}
                  width={44}
                  height={44}
                />
              ) : (
                <span className="accessory-placeholder" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
