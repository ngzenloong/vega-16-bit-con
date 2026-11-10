import { SESSIONS } from "@/lib/types";
import { SCENE } from "@/lib/scene";
import InfoWindow from "./InfoWindow";
import TypewriterText from "./TypewriterText";

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
    <div className="event-tickets">
      {SESSIONS.map((session, index) => {
        const selected = interests.includes(index);
        return (
          <InfoWindow
            className="event-ticket"
            key={session.time}
            title={<time>{session.time}</time>}
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
  );
}
