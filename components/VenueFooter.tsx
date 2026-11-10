"use client";

type Props = {
  registered: boolean;
  inactive: boolean;
  onRegister: () => void;
  onExplore: () => void;
  onSchedule: () => void;
};

export default function VenueFooter({
  registered,
  inactive,
  onRegister,
  onExplore,
  onSchedule,
}: Props) {
  return (
    <footer className="venue-footer event-footer" inert={inactive}>
      <div className="event-footer-frame">
        <div className="event-footer-grid">
          <a
            className="event-footer-brand"
            href="https://vega.io/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Vega (opens in a new tab)"
          >
            <img
              src="/assets/vega/footer-flower.svg"
              alt="Vega"
              width={53}
              height={48}
            />
          </a>

          <section
            className="event-footer-column"
            aria-labelledby="footer-event"
          >
            <h2 id="footer-event">Event</h2>
            <ul>
              <li>16-Bit Con</li>
              <li>
                <time dateTime="2026-10-03">October 3–5, 2026</time>
              </li>
              <li>
                Javits Center
                <br />
                New York
              </li>
              <li>Booth 630</li>
            </ul>
          </section>

          <section
            className="event-footer-column"
            aria-labelledby="footer-explore"
          >
            <h2 id="footer-explore">Explore</h2>
            <ul>
              <li>
                <button type="button" onClick={onExplore}>
                  Main hall
                </button>
              </li>
              <li>
                <button type="button" onClick={onSchedule}>
                  Schedule
                </button>
              </li>
            </ul>
          </section>

          <section
            className="event-footer-column"
            aria-labelledby="footer-player"
          >
            <h2 id="footer-player">Your player</h2>
            <button
              type="button"
              className="pixel-button event-footer-signup"
              onClick={onRegister}
            >
              {registered ? "My player" : "Sign up"}
            </button>
          </section>

          <section
            className="event-footer-column"
            aria-labelledby="footer-vega"
          >
            <h2 id="footer-vega">Vega</h2>
            <ul>
              <li>
                <a
                  href="https://vega.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vega home
                </a>
              </li>
              <li>
                <a
                  href="https://vega.io/about"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  About Vega
                </a>
              </li>
              <li>
                <a
                  href="https://vega.io/careers"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Careers
                </a>
              </li>
            </ul>
          </section>
        </div>

        <p className="event-footer-note">
          16-Bit Con is a fictional event and interactive demo.
        </p>
      </div>
    </footer>
  );
}
