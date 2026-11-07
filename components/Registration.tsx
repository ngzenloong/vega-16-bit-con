"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_APPEARANCE,
  SESSIONS,
  type Appearance,
  type Player,
} from "@/lib/types";
import { characterSheets, loadImage } from "@/lib/character";
import PlayerCard from "./PlayerCard";
import Icon from "./Icon";
import { audio } from "@/lib/audio";
import {
  OUTFIT_OPTIONS as labels,
  OUTFIT_LABELS,
  OUTFIT_PARTS,
  LOOK_PRESETS,
  completeAppearance,
} from "@/lib/appearance";
export default function Registration({
  player,
  interest,
  onClose,
  onSubmit,
  sessionOnly = false,
  soundControl,
  mobile = false,
}: {
  player: Player | null;
  interest: number | null;
  onClose: () => void;
  onSubmit: (p: Player, card: HTMLElement) => Promise<void>;
  sessionOnly?: boolean;
  soundControl: ReactNode;
  mobile?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    form = useRef<HTMLFormElement>(null),
    title = useRef<HTMLHeadingElement>(null),
    alive = useRef(true);
  const [step, setStep] = useState<"look" | "details">("look");
  const settings = useRef({ mobile, step });
  settings.current = { mobile, step };
  const [name, setName] = useState(player?.name || ""),
    [email, setEmail] = useState(""),
    [appearance, setAppearance] = useState<Required<Appearance>>(
      completeAppearance(player?.appearance || DEFAULT_APPEARANCE),
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
    if (settings.current.mobile) d.focus({ preventScroll: true });
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
  useEffect(() => {
    const d = ref.current!;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const height = viewport?.height || innerHeight;
      d.style.setProperty("--registration-vh", `${height}px`);
      d.style.setProperty(
        "--registration-top",
        `${viewport?.offsetTop || 0}px`,
      );
      d.style.setProperty(
        "--pass-scale",
        String(Math.min(1, Math.max(0.7, (height - 360) / 320))),
      );
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    if (!mobile) return;
    form.current?.scrollTo({ top: 0, behavior: "instant" });
    title.current?.focus({ preventScroll: true });
  }, [mobile, step]);
  const changeStep = (next: "look" | "details") => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    audio.effect("click");
    setStep(next);
  };
  return (
    <dialog
      ref={ref}
      className={`registration-dialog ${mobile ? "registration-mobile" : ""}`}
      data-step={step}
      tabIndex={-1}
      aria-labelledby="registration-title"
    >
      <header className="window-title">
        <span>
          Player pass
          {mobile && (
            <span
              className="registration-step"
              aria-label={`Step ${step === "look" ? 1 : 2} of 2`}
            >
              {" "}
              · {step === "look" ? "1" : "2"}/2
            </span>
          )}
        </span>
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
        ref={form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (mobile && step === "look") {
            changeStep("details");
            return;
          }
          const clean = name.trim();
          if (!clean || submitting) return;
          if (mobile && document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
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
          <h2 id="registration-title" ref={title} tabIndex={-1}>
            {mobile
              ? step === "look"
                ? "Choose your look."
                : "Add your details."
              : player
                ? "Make it your own."
                : "Make yourself at home."}
          </h2>
          <p>
            {mobile
              ? step === "look"
                ? "Try a style or build your own look."
                : "Name your player and finish your pass."
              : "Choose a name and outfit for Sam."}
          </p>
        </div>
        <div className="registration-grid">
          <div className="registration-preview">
            <div className="registration-card-window">
              <PlayerCard
                name={name}
                sprite={sprite}
                companion={appearance.companion}
              />
            </div>
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
            <div
              className="registration-details"
              hidden={mobile && step === "look"}
            >
              <label>
                Your name
                <input
                  autoFocus={!mobile}
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={24}
                  disabled={submitting || (mobile && step === "look")}
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
                    disabled={submitting || (mobile && step === "look")}
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                  />
                </label>
              )}
            </div>
            <div
              className="outfit-options"
              hidden={mobile && step === "details"}
              tabIndex={mobile && step === "look" ? 0 : undefined}
              aria-label="Choose your outfit"
            >
              <fieldset disabled={submitting} className="look-presets">
                <legend>Start with a style</legend>
                <div>
                  {LOOK_PRESETS.map((preset) => (
                    <button
                      type="button"
                      className="outfit-option"
                      key={preset.name}
                      aria-pressed={OUTFIT_PARTS.every(
                        (part) => appearance[part] === preset.look[part],
                      )}
                      onClick={() => {
                        audio.effect("click");
                        setAppearance({ ...preset.look });
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              {OUTFIT_PARTS.map((part) => (
                <fieldset key={part} disabled={submitting}>
                  <legend>{OUTFIT_LABELS[part]}</legend>
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
                      aria-label={`Previous ${OUTFIT_LABELS[part].toLowerCase()}`}
                      onClick={() => {
                        audio.effect("click");
                        setAppearance((old) => ({
                          ...old,
                          [part]:
                            (old[part] + labels[part].length - 1) %
                            labels[part].length,
                        }));
                      }}
                    >
                      ←
                    </button>
                    <select
                      aria-label={`Choose ${OUTFIT_LABELS[part].toLowerCase()}`}
                      value={appearance[part]}
                      onChange={(event) => {
                        audio.effect("click");
                        setAppearance((old) => ({
                          ...old,
                          [part]: Number(event.target.value),
                        }));
                      }}
                    >
                      {labels[part].map((label, value) => (
                        <option key={label} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Next ${OUTFIT_LABELS[part].toLowerCase()}`}
                      onClick={() => {
                        audio.effect("click");
                        setAppearance((old) => ({
                          ...old,
                          [part]: (old[part] + 1) % labels[part].length,
                        }));
                      }}
                    >
                      →
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            {interest !== null && (!mobile || step === "details") && (
              <p className="registration-interest">
                Add to your list: {SESSIONS[interest].title}
              </p>
            )}
            <div className="registration-actions">
              {mobile && step === "look" ? (
                <button
                  type="button"
                  className="pixel-button primary register-submit"
                  disabled={pending || !!error}
                  onClick={() => changeStep("details")}
                >
                  Continue
                </button>
              ) : (
                <>
                  {mobile && (
                    <button
                      type="button"
                      className="pixel-button registration-back"
                      disabled={submitting}
                      onClick={() => changeStep("look")}
                    >
                      Back
                    </button>
                  )}
                  <button
                    className="pixel-button primary register-submit"
                    disabled={submitting || pending || !!error || !name.trim()}
                  >
                    {submitting
                      ? "Preparing your player…"
                      : mobile
                        ? player
                          ? "Save player"
                          : "Create player"
                        : player
                          ? "Update my player"
                          : "Create my player"}
                  </button>
                </>
              )}
            </div>
            <p className="form-note" hidden={mobile && step === "look"}>
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
