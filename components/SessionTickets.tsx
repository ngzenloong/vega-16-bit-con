import { SESSIONS } from "@/lib/types";
import { SCENE } from "@/lib/scene";
import InfoWindow from "./InfoWindow";
import TypewriterText, { TypewriterSequence } from "./TypewriterText";

export default function SessionTickets({
  interests,
  onSession,
  inWorld = false,
  paused = false,
  reduced = false,
}: {
  interests: number[];
  onSession: (index: number) => void;
  inWorld?: boolean;
  paused?: boolean;
  reduced?: boolean;
}) {
  return (
    <TypewriterSequence>
      <div className="event-tickets">
        {SESSIONS.map((session, index) => {
          const selected = interests.includes(index);
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
                  className="ticket-action pixel-button"
                  {...(inWorld
                    ? {
                        "data-target": String(index),
                        "data-kind": "session",
                        "data-label": session.title,
                        "data-x": SCENE.booth,
                        "data-active-mode": "page",
                      }
                    : {})}
                  onClick={() => onSession(index)}
                  aria-pressed={selected}
                  aria-label={`${selected ? "On my list" : "Add to my list"}: ${session.title}${selected ? ". Remove session" : ""}`}
                >
                  {selected ? "On my list" : "Add to my list"}
                </button>
              </div>
            </InfoWindow>
          );
        })}
      </div>
    </TypewriterSequence>
  );
}
