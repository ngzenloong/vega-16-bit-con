"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_APPEARANCE,
  SESSIONS,
  type Appearance,
  type Player,
} from "@/lib/types";
import { characterSheets, loadImage } from "@/lib/character";
import { completeAppearance } from "@/lib/appearance";
import { retainDialogFocus } from "@/lib/dialog-focus";
import { audio } from "@/lib/audio";
import PlayerCard from "./PlayerCard";
import OutfitPicker from "./OutfitPicker";
import Icon from "./Icon";

export default function Registration({
  player,
  interest,
  onClose,
  onSave,
  onSubmit,
  sessionOnly = false,
  soundControl,
}: {
  player: Player | null;
  interest: number | null;
  onClose: () => void;
  onSave: (player: Player) => void;
  onSubmit: (
    player: Player,
    card: HTMLElement,
    updating: boolean,
  ) => Promise<void>;
  sessionOnly?: boolean;
  soundControl: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registered = useRef(!!player).current;
  const [compact, setCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      matchMedia("(max-width: 700px), (max-height: 600px)").matches,
  );
  const entering = useRef(false);
  const confirmed = useRef<Player | null>(null);
  const enterCallback = useRef<() => void>(() => {});
  const [step, setStep] = useState<"look" | "details" | "confirmed">("look");
  const [name, setName] = useState(player?.name || "");
  const [email, setEmail] = useState(player?.email || "");
  const [appearance, setAppearance] = useState<Required<Appearance>>(
    completeAppearance(player?.appearance || DEFAULT_APPEARANCE),
  );
  const [sprite, setSprite] = useState("/assets/vega/sam-idle.png");
  const [pending, setPending] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const d = dialog.current;
      const target =
        step === "look"
          ? d?.querySelector<HTMLElement>(
              '.accessory-option[aria-checked="true"]',
            )
          : step === "details"
            ? d?.querySelector<HTMLElement>("input")
            : d;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
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
          setError("Your look could not load. Try again.");
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appearance, retry]);
  useEffect(() => {
    const d = dialog.current!,
      previous = document.activeElement as HTMLElement | null;
    alive.current = true;
    d.showModal();
    d.focus({ preventScroll: true });
    const unlock = retainDialogFocus(d);
    audio.duck(0.35);
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      d.removeEventListener("cancel", cancel);
      unlock();
      d.close();
      audio.duck(1);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0,
      fieldFrame = 0;
    const measure = () => {
      setCompact(matchMedia("(max-width: 700px), (max-height: 600px)").matches);
      dialog.current?.style.setProperty(
        "--registration-vh",
        `${viewport?.height || innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--registration-top",
        `${viewport?.offsetTop || 0}px`,
      );
      cancelAnimationFrame(fieldFrame);
      fieldFrame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          !document.hidden &&
          document.hasFocus() &&
          active instanceof HTMLInputElement &&
          dialog.current?.contains(active)
        )
          active.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
          });
      });
    };
    const update = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(fieldFrame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(fieldFrame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const changeStep = (next: "look" | "details") => {
    (document.activeElement as HTMLElement | null)?.blur();
    audio.effect("click");
    setStep(next);
  };
  const enter = async (next = confirmed.current) => {
    if (!next || entering.current || !alive.current) return;
    entering.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await onSubmit(
        next,
        dialog.current!.querySelector<HTMLElement>("[data-player-pass]")!,
        registered,
      );
    } catch {
      if (alive.current) {
        entering.current = false;
        setSaving(false);
        setError("Your pass is saved. Try entering again.");
      }
    }
  };
  enterCallback.current = () => {
    void enter();
  };
  useEffect(() => {
    if (step !== "confirmed") return;
    let remaining = 2000,
      started = 0;
    const suspend = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (started)
        remaining = Math.max(0, remaining - (performance.now() - started));
      started = 0;
    };
    const resume = () => {
      suspend();
      if (document.hidden || !document.hasFocus()) return;
      started = performance.now();
      timer.current = setTimeout(() => enterCallback.current(), remaining);
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
  }, [step]);
  const confirm = async () => {
    if (saving || pending || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const sheets = await characterSheets(appearance);
      await Promise.all(Object.values(sheets).map(loadImage));
      if (!alive.current) return;
      const next: Player = {
        name: name.trim().slice(0, 24),
        ...(email.trim() ? { email: email.trim().slice(0, 254) } : {}),
        appearance: { ...appearance },
        interests: [
          ...new Set([
            ...(player?.interests || []),
            ...(interest === null ? [] : [interest]),
          ]),
        ],
      };
      confirmed.current = next;
      onSave(next);
      setSprite(sheets.idle);
      setStep("confirmed");
      audio.effect("collect");
    } catch {
      if (alive.current) {
        setSaving(false);
        setError("Your player could not be prepared. Try again.");
      }
    }
  };
  const title =
    step === "confirmed"
      ? registered
        ? "Pass updated."
        : "Pass confirmed."
      : step === "details"
        ? registered
          ? "Your details."
          : "Make it official."
        : registered
          ? "Welcome back."
          : "Make your player.";
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className={`registration-dialog ${compact ? "registration-mobile" : ""}`}
      data-step={step}
      data-error={Boolean(error)}
      aria-labelledby="registration-title"
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.nativeEvent.isComposing
        )
          return;
        const target = event.target as HTMLElement;
        const fields = [
          ...dialog.current!.querySelectorAll<HTMLInputElement>(
            ".registration-details input:not(:disabled)",
          ),
        ];
        const focus = (element?: HTMLElement | null) => {
          element?.focus({ preventScroll: true });
          element?.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
          });
        };
        if (
          step === "details" &&
          target === fields[0] &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          focus(fields[1]);
          return;
        }
        if (
          step === "details" &&
          target instanceof HTMLInputElement &&
          ["ArrowUp", "ArrowDown"].includes(event.key)
        ) {
          event.preventDefault();
          const index = fields.indexOf(target);
          if (event.key === "ArrowUp") focus(fields[Math.max(0, index - 1)]);
          else
            focus(
              fields[index + 1] ||
                dialog.current!.querySelector<HTMLButtonElement>(
                  ".register-submit:not(:disabled)",
                ),
            );
          return;
        }
        if (!target.closest(".registration-actions") || step === "confirmed")
          return;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (step === "details") focus(fields.at(-1));
          else {
            const items = dialog.current!.querySelectorAll<HTMLElement>(
              '.accessory-option[aria-checked="true"]',
            );
            focus(items[items.length - 1]);
          }
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          focus(
            step === "details"
              ? fields[0]
              : dialog.current!.querySelector<HTMLElement>(
                  '.accessory-option[aria-checked="true"]',
                ),
          );
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const buttons = [
            ...dialog.current!.querySelectorAll<HTMLButtonElement>(
              ".registration-actions button:not(:disabled)",
            ),
          ];
          const index = buttons.indexOf(target as HTMLButtonElement);
          focus(
            buttons[
              (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length
            ],
          );
        }
      }}
    >
      <header className="window-title">
        <div className="window-actions">
          {soundControl}
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close registration"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <form
        className="pass-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "look" && !registered) changeStep("details");
          else if (step === "confirmed") {
            if (!saving) void enter();
          } else void confirm();
        }}
      >
        <div
          className={`registration-copy ${step === "look" ? "sr-only" : ""}`}
          aria-live="polite"
        >
          <h2 id="registration-title">{title}</h2>
          <p>
            {step === "confirmed"
              ? `See you at 16-Bit Con, ${name}.`
              : step === "details"
                ? registered
                  ? "Update the details on your saved pass."
                  : "Add your details to finish your demo pass."
                : registered
                  ? `See you at the con, ${name}. Your pass is ready.`
                  : "Pick a look, then add your details."}
          </p>
        </div>
        <div className="registration-content">
          <div className="registration-preview">
            <div className="registration-card-window">
              <PlayerCard
                name={name}
                sprite={sprite}
                companion={appearance.companion}
                ready={step === "confirmed"}
              />
            </div>
            <p className="look-status" role="status">
              {pending
                ? "Preparing your look…"
                : error ||
                  (step === "confirmed" ? "Saved. Entering the hall…" : "")}
            </p>
            {error && (
              <button
                className="text-link"
                type="button"
                onClick={() => setRetry((n) => n + 1)}
              >
                Try preview again
              </button>
            )}
          </div>
          {step === "look" && (
            <OutfitPicker
              value={appearance}
              onChange={setAppearance}
              disabled={saving}
            />
          )}
          {step === "details" && (
            <div className="registration-details">
              <label>
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={24}
                  autoComplete="given-name"
                  enterKeyHint="next"
                  placeholder="What should we call you?"
                  disabled={saving}
                />
              </label>
              <label>
                Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required={!registered}
                  maxLength={254}
                  autoComplete="email"
                  enterKeyHint="done"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  disabled={saving}
                />
              </label>
              {interest !== null && (
                <p className="registration-interest">
                  Your list: {SESSIONS[interest].title}
                </p>
              )}
              <p className="form-note">
                Demo RSVP. Your details stay on this site in this browser. No
                email is sent.
              </p>
            </div>
          )}
          {step === "confirmed" && (
            <div className="registration-confirmation">
              <Icon name="check" />
              <h3>
                {registered
                  ? "Ready for another round?"
                  : "You're ready for the con."}
              </h3>
              <p>
                {sessionOnly
                  ? "Your pass is available for this visit."
                  : "Your name, details and look are saved for this site in this browser."}
              </p>
            </div>
          )}
        </div>
        <footer className="registration-actions">
          {step === "details" ? (
            <button
              type="button"
              className="pixel-button"
              disabled={saving}
              onClick={() => changeStep("look")}
            >
              Back
            </button>
          ) : step === "look" && registered ? (
            <button
              type="button"
              className="text-link"
              onClick={() => changeStep("details")}
            >
              Edit details
            </button>
          ) : (
            <span className="pass-step">
              {step === "confirmed"
                ? "See you on the floor."
                : "1 / 2 · Your look"}
            </span>
          )}
          <button
            className="pixel-button primary register-submit"
            disabled={pending || saving}
            aria-busy={step === "confirmed" && saving}
            type="submit"
          >
            {step === "confirmed"
              ? error
                ? "Try entering"
                : "Entering…"
              : saving
                ? "Saving…"
                : step === "look"
                  ? registered
                    ? "Save look"
                    : "Continue"
                  : registered
                    ? "Save player"
                    : "Confirm my pass"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
