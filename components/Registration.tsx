"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_APPEARANCE,
  SESSIONS,
  type Appearance,
  type OutfitPart,
  type Player,
} from "@/lib/types";
import { characterSheets, loadImage } from "@/lib/character";
import PlayerCard from "./PlayerCard";
import Icon from "./Icon";
import { audio } from "@/lib/audio";
const labels: Record<OutfitPart, string[]> = {
  hat: ["Original", "Cap", "Bucket", "Headphones"],
  glasses: ["Original", "Sunshine", "Cream", "Ink"],
  shirt: ["Original", "Leaf", "Yellow", "Varsity"],
};
export default function Registration({
  player,
  interest,
  onClose,
  onSubmit,
  sessionOnly = false,
  soundControl,
}: {
  player: Player | null;
  interest: number | null;
  onClose: () => void;
  onSubmit: (p: Player, card: HTMLElement) => Promise<void>;
  sessionOnly?: boolean;
  soundControl: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    alive = useRef(true);
  const [name, setName] = useState(player?.name || ""),
    [email, setEmail] = useState(""),
    [appearance, setAppearance] = useState<Appearance>(
      player?.appearance || DEFAULT_APPEARANCE,
    ),
    [sprite, setSprite] = useState("/assets/vega/sam-idle.png");
  const [submitting, setSubmitting] = useState(false),
    [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    void characterSheets(appearance)
      .then(async (sheets) => {
        await loadImage(sheets.idle);
        if (active) {
          setSprite(sheets.idle);
          setPending(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("This look could not load. Try again or choose Original.");
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appearance, retry]);
  useEffect(() => {
    const d = ref.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    alive.current = true;
    d.showModal();
    document.body.style.overflow = "hidden";
    audio.duck(0.35);
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      alive.current = false;
      d.removeEventListener("cancel", cancel);
      d.close();
      document.body.style.overflow = overflow;
      audio.duck(1);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="registration-dialog"
      aria-labelledby="registration-title"
    >
      <header className="window-title">
        <span>Player pass</span>
        <div className="window-actions">
          {soundControl}
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close registration"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const clean = name.trim();
          if (!clean || submitting) return;
          setSubmitting(true);
          setError("");
          const look = { ...appearance },
            interests = [
              ...new Set([
                ...(player?.interests || []),
                ...(interest !== null ? [interest] : []),
              ]),
            ];
          try {
            const sheets = await characterSheets(look);
            await Promise.all(Object.values(sheets).map(loadImage));
            if (!alive.current) return;
            setSprite(sheets.idle);
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            if (!alive.current) return;
            audio.effect("collect");
            await onSubmit(
              { name: clean.slice(0, 24), appearance: look, interests },
              ref.current!.querySelector<HTMLElement>("[data-player-pass]")!,
            );
          } catch {
            if (alive.current) {
              setError("Your player could not be prepared. Try again.");
              setSubmitting(false);
            }
          }
        }}
      >
        <div className="registration-copy">
          <h2 id="registration-title">
            {player ? "Make it your own." : "Make yourself at home."}
          </h2>
          <p>Choose a name and outfit for Sam.</p>
        </div>
        <div className="registration-grid">
          <div className="registration-preview">
            <PlayerCard name={name} sprite={sprite} />
            <p className="look-status" role="status">
              {pending ? "Preparing your look…" : error || " "}
            </p>
            {error && (
              <button
                type="button"
                className="text-link"
                onClick={() => setRetry((n) => n + 1)}
              >
                Try preview again
              </button>
            )}
          </div>
          <div className="registration-fields">
            <label>
              Your name
              <input
                autoFocus
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={24}
                disabled={submitting}
                placeholder="What should we call you?"
              />
            </label>
            {!player && (
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="you@example.com"
                />
              </label>
            )}
            <div className="outfit-options">
              {(["hat", "glasses", "shirt"] as OutfitPart[]).map((part) => (
                <fieldset key={part} disabled={submitting}>
                  <legend>{part[0].toUpperCase() + part.slice(1)}</legend>
                  <div className="outfit-all">
                    {labels[part].map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        className="outfit-option"
                        aria-pressed={appearance[part] === i}
                        onClick={() => {
                          audio.effect("click");
                          setAppearance((old) => ({ ...old, [part]: i }));
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="outfit-cycle">
                    <button
                      type="button"
                      aria-label={`Previous ${part}`}
                      onClick={() => {
                        audio.effect("click");
                        setAppearance((old) => ({
                          ...old,
                          [part]: (old[part] + 3) % 4,
                        }));
                      }}
                    >
                      ←
                    </button>
                    <span aria-live="polite">
                      {labels[part][appearance[part]]}
                    </span>
                    <button
                      type="button"
                      aria-label={`Next ${part}`}
                      onClick={() => {
                        audio.effect("click");
                        setAppearance((old) => ({
                          ...old,
                          [part]: (old[part] + 1) % 4,
                        }));
                      }}
                    >
                      →
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            {interest !== null && (
              <p className="registration-interest">
                Add to your list: {SESSIONS[interest].title}
              </p>
            )}
            <button
              className="pixel-button primary register-submit"
              disabled={submitting || pending || !!error || !name.trim()}
            >
              {submitting
                ? "Preparing your player…"
                : player
                  ? "Update my player"
                  : "Create my player"}
            </button>
            <p className="form-note">
              {player
                ? "Your name and outfit are part of this local demo."
                : "Demo RSVP. Your email is never sent or saved."}{" "}
              {sessionOnly
                ? "Your player is available for this visit only."
                : "Your player and scores save in this browser."}
            </p>
          </div>
        </div>
      </form>
    </dialog>
  );
}
