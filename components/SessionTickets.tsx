import { SESSIONS } from "@/lib/types";
import { SCENE } from "@/lib/scene";

export default function SessionTickets({
  interests,
  onSession,
  inWorld = false,
}: {
  interests: number[];
  onSession: (index: number) => void;
  inWorld?: boolean;
}) {
  return (
    <div className="event-tickets">
      {SESSIONS.map((session, index) => {
        const selected = interests.includes(index);
        return (
          <article className="event-ticket" key={session.time}>
            <div className="ticket-top">
              <time>{session.time}</time>
            </div>
            <h3>{session.title}</h3>
            <p>{session.kind}</p>
            <button
              className="ticket-action"
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
              aria-label={`${selected ? "Remove" : "Add"} ${session.title} ${selected ? "from" : "to"} my list`}
            >
              {selected ? "On my list ✓" : "Add to my list"}
            </button>
            <div className="ticket-perforation" aria-hidden="true" />
          </article>
        );
      })}
    </div>
  );
}
