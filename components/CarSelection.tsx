"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ALL_CARS, driverProfile } from "@/lib/games/cars";
import { UNLOCK_WINS, type RaceProgress } from "@/lib/games/progression";
import type { GameButton } from "@/lib/games/types";
import { audio } from "@/lib/audio";
import Icon from "./Icon";
import { PointerIntent } from "@/lib/pointer-intent";

export type CarSelectionController = { press: (button: GameButton) => void };
const CarSelection = forwardRef<
  CarSelectionController,
  {
    progress: RaceProgress;
    sessionOnly: boolean;
    onRace: (id: string) => void;
  }
>(function CarSelection({ progress, sessionOnly, onRace }, ref) {
  const [cursor, setCursor] = useState(() =>
    Math.max(
      0,
      ALL_CARS.findIndex((car) => car.id === progress.selected),
    ),
  );
  const [preview, setPreview] = useState<number | null>(null);
  const pointer = useRef(new PointerIntent());
  const grid = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const selected = ALL_CARS[cursor];
  const car = ALL_CARS[preview ?? cursor];
  const profile = driverProfile(car.id);
  const unlocked = progress.wins >= UNLOCK_WINS[selected.id];
  const pick = (index: number, focus = false) => {
    setCursor(index);
    setPreview(null);
    audio.effect("click");
    if (focus) {
      const button = grid.current!.children[index] as HTMLButtonElement;
      button.focus({ preventScroll: true });
      button.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
    }
  };
  const race = () => {
    if (unlocked) onRace(selected.id);
    else audio.effect("hurt");
  };
  const move = (direction: GameButton) => {
    const columns = getComputedStyle(grid.current!).gridTemplateColumns.split(
      " ",
    ).length;
    if (document.activeElement === start.current) {
      if (direction === "up") pick(cursor, true);
      return;
    }
    const offset =
      direction === "left"
        ? -1
        : direction === "right"
          ? 1
          : direction === "up"
            ? -columns
            : columns;
    const next = cursor + offset;
    if (next >= ALL_CARS.length && direction === "down" && unlocked)
      start.current?.focus();
    else pick(Math.max(0, Math.min(ALL_CARS.length - 1, next)), true);
  };
  useImperativeHandle(ref, () => ({
    press(button) {
      if (button === "action") race();
      else if (["left", "right", "up", "down"].includes(button)) move(button);
    },
  }));
  return (
    <div
      className="car-selection"
      aria-labelledby="car-selection-title"
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        const direction = {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
        }[event.key] as GameButton | undefined;
        if (direction && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          move(direction);
        }
      }}
    >
      <header className="car-selection-heading">
        <h3 id="car-selection-title">SELECT CAR</h3>
        <p>
          {progress.wins} {progress.wins === 1 ? "WIN" : "WINS"}
        </p>
      </header>
      <section className="car-preview" aria-live="polite" aria-atomic="true">
        <figure className="car-display">
          <figcaption>
            <h4>
              {car.model
                .replace("Classic ", "")
                .replace("Nissan ", "")
                .replace("Subaru ", "")
                .replace(" kei ", " ")}
            </h4>
          </figcaption>
          <span
            className="car-side"
            style={{
              backgroundImage: `url(/assets/vega/${car.asset.replace(".svg", "-side.svg")})`,
            }}
            aria-hidden="true"
          />
        </figure>
        <div className="car-preview-copy">
          <p className="car-unlock">
            {progress.wins >= UNLOCK_WINS[car.id]
              ? "READY TO RACE"
              : `${UNLOCK_WINS[car.id] - progress.wins} MORE ${UNLOCK_WINS[car.id] - progress.wins === 1 ? "WIN" : "WINS"} TO UNLOCK`}
          </p>
          <dl className="car-stats" aria-label="Arcade performance ratings">
            {[
              {
                label: "Speed",
                rating: profile.topSpeed / 180,
                value: `${profile.topSpeed}`,
                unit: "km/h",
              },
              { label: "Accel", rating: profile.acceleration / 1200 },
              { label: "Grip", rating: profile.handling },
              { label: "Brake", rating: profile.braking / 2500 },
            ].map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>
                  <span className="car-meter" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <i
                        key={i}
                        data-filled={i < Math.round(stat.rating * 10)}
                      />
                    ))}
                  </span>
                  <span
                    className="car-stat-value"
                    data-unit={stat.unit || "rating"}
                  >
                    {stat.value ? (
                      <>
                        {stat.value}
                        <small>{stat.unit}</small>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">
                          {Math.round(stat.rating * 10)}/10
                        </span>
                        <span className="sr-only">
                          {Math.round(stat.rating * 10)} out of 10
                        </span>
                      </>
                    )}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div
        ref={grid}
        className="car-grid"
        role="radiogroup"
        aria-label="Cars"
        onPointerLeave={() => setPreview(null)}
      >
        {ALL_CARS.map((entry, index) => {
          const locked = progress.wins < UNLOCK_WINS[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-label={`${entry.model}${locked ? `. Unlock at ${UNLOCK_WINS[entry.id]} ${UNLOCK_WINS[entry.id] === 1 ? "win" : "wins"}` : ""}`}
              aria-checked={index === cursor && !locked}
              aria-disabled={locked}
              tabIndex={index === cursor ? 0 : -1}
              data-locked={locked}
              data-current={index === cursor}
              onPointerMove={(event) => {
                if (
                  event.pointerType === "mouse" &&
                  pointer.current.move(
                    event.clientX,
                    event.clientY,
                    event.movementX,
                    event.movementY,
                  )
                )
                  setPreview(index);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.repeat) {
                  event.preventDefault();
                  if (!locked) onRace(entry.id);
                  else audio.effect("hurt");
                }
              }}
              onClick={() => pick(index)}
              onFocus={() => {
                setCursor(index);
                setPreview(null);
              }}
            >
              <span
                className="car-side"
                style={{
                  backgroundImage: `url(/assets/vega/${entry.asset.replace(".svg", "-side.svg")})`,
                }}
                aria-hidden="true"
              />
              {locked && (
                <span className="car-lock">
                  <Icon name="lock" size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <footer className="car-selection-actions">
        <p>
          <span>← → ↑ ↓ SELECT</span>
          {sessionOnly && <small>Saved for this visit</small>}
        </p>
        <button
          ref={start}
          className="car-race-button"
          type="button"
          disabled={!unlocked}
          onClick={race}
        >
          <span aria-hidden="true">▶</span> START RACE <kbd>↵</kbd>
        </button>
      </footer>
    </div>
  );
});
export default CarSelection;
