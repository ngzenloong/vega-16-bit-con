import { SESSIONS } from "@/lib/types";
import { SCENE } from "@/lib/scene";
import InfoWindow from "./InfoWindow";
import TypewriterText, { TypewriterSequence } from "./TypewriterText";

export default function SessionTickets({
  interests,
  registered,
  onSession,
  inWorld = false,
  paused = false,
  reduced = false,
}: {
  interests: number[];
  registered: boolean;
  onSession: (index: number) => void;
  inWorld?: boolean;
  paused?: boolean;
  reduced?: boolean;
}) {
  return (
    <TypewriterSequence>
      <div className="event-tickets">
        {SESSIONS.map((session, index) => {
          const selected = registered && interests.includes(index);
          const label = !registered
            ? "Sign up"
            : selected
              ? "On my list"
              : "Add to my list";
          return (
            <InfoWindow
              className="event-ticket"
              key={session.time}
              title={
                <>
                  <time className="sr-only">{session.time}</time>
                  <TypewriterText
                    text={session.time}
                    step={index * 2}
                    cursor={false}
                    paused={paused}
                    reduced={reduced}
                  />
                </>
              }
              labelledBy={`session-${inWorld ? "scene" : "dialog"}-${index}`}
            >
              <div className="session-copy">
                <div className="sr-only">
                  <p>{session.kind}</p>
                  <h3 id={`session-${inWorld ? "scene" : "dialog"}-${index}`}>
                    {session.title}
                  </h3>
                </div>
                <TypewriterText
                  text={`${session.kind}\n\n${session.title}`}
                  step={index * 2 + 1}
                  paused={paused}
                  reduced={reduced}
                />
              </div>
              <div className="session-actions">
                <button
                  className="ticket-action pixel-button primary"
                  {...(inWorld
                    ? {
                        "data-target": String(index),
                        "data-kind": "session",
                        "data-label": session.title,
                        "data-x": SCENE.booth,
                        "data-active-mode": "page",
                        "data-action-label": !registered
                          ? "SIGN UP"
                          : selected
                            ? "REMOVE FROM LIST"
                            : "ADD TO MY LIST",
                      }
                    : {})}
                  onClick={() => onSession(index)}
                  aria-pressed={registered ? selected : undefined}
                  aria-label={`${label}: ${session.title}${selected ? ". Remove session" : ""}`}
                >
                  {label}
                </button>
              </div>
            </InfoWindow>
          );
        })}
      </div>
    </TypewriterSequence>
  );
}
