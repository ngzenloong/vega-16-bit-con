"use client";

import { useEffect, useRef } from "react";
import { revealWindowText } from "@/lib/typewriter";

/** Full text reserves the final size; the animated copy never drives layout or speech. */
export default function TypewriterText({
  text,
  paused = false,
  reduced = false,
  className = "",
  cursor = true,
}: {
  text: string;
  paused?: boolean;
  reduced?: boolean;
  className?: string;
  cursor?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    output = useRef<HTMLSpanElement>(null),
    completed = useRef(false),
    previous = useRef(text);
  useEffect(() => {
    if (previous.current !== text) {
      previous.current = text;
      completed.current = false;
    }
    if (paused || reduced || completed.current) {
      output.current!.textContent = text;
      root.current!.dataset.typeState = "complete";
      completed.current = true;
      return;
    }
    return revealWindowText(root.current!, output.current!, text, () => {
      completed.current = true;
    });
  }, [text, paused, reduced]);
  return (
    <div className={`typed-copy ${className}`} ref={root} aria-hidden="true">
      <div className="typed-reserve">
        {text}
        {cursor && <span className="terminal-cursor" />}
      </div>
      <div className="typed-live">
        <span ref={output} />
        {cursor && <span className="terminal-cursor" />}
      </div>
    </div>
  );
}
