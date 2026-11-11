"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { revealWindowText } from "@/lib/typewriter";

const Sequence = createContext<{
  active: number;
  advance: (step: number) => void;
} | null>(null);

/** One reading order; each block hands off only after its last character. */
export function TypewriterSequence({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  const advance = useCallback(
    (step: number) => setActive((value) => Math.max(value, step + 1)),
    [],
  );
  const value = useMemo(() => ({ active, advance }), [active, advance]);
  return <Sequence.Provider value={value}>{children}</Sequence.Provider>;
}

/** Full text reserves the final size; the animated copy never drives layout or speech. */
export default function TypewriterText({
  text,
  paused = false,
  reduced = false,
  className = "",
  cursor = true,
  step,
  skipHidden = false,
}: {
  text: string;
  paused?: boolean;
  reduced?: boolean;
  className?: string;
  cursor?: boolean;
  step?: number;
  skipHidden?: boolean;
}) {
  const sequence = useContext(Sequence);
  const enabled = step === undefined || !sequence || step <= sequence.active;
  const advance = sequence?.advance;
  const root = useRef<HTMLSpanElement>(null),
    output = useRef<HTMLSpanElement>(null),
    completed = useRef(false),
    previous = useRef(text);
  useLayoutEffect(() => {
    if (previous.current !== text) {
      previous.current = text;
      completed.current = false;
    }
    const finish = () => {
      completed.current = true;
      if (step !== undefined) advance?.(step);
    };
    if (paused || reduced || completed.current) {
      output.current!.textContent = text;
      root.current!.dataset.typeState = "complete";
      finish();
      return;
    }
    if (!enabled) {
      output.current!.textContent = "";
      root.current!.dataset.typeState = "waiting";
      return;
    }
    return revealWindowText(root.current!, output.current!, text, finish, {
      delay: step !== undefined && step > 0 ? 0.1 : 0,
      skipHidden,
      skipPast: step !== undefined,
    });
  }, [text, paused, reduced, enabled, step, skipHidden, advance]);
  return (
    <span
      className={`typed-copy ${className}`}
      ref={root}
      data-type-state="waiting"
      data-static={paused || reduced}
      data-type-step={step}
      aria-hidden="true"
    >
      <span className="typed-reserve">
        {text}
        {cursor && <span className="terminal-cursor" />}
      </span>
      <span className="typed-live">
        <span ref={output} />
        {cursor && <span className="terminal-cursor" />}
      </span>
    </span>
  );
}
