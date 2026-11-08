import Sprite from "./Sprite";
import Companion from "./Companion";
export default function PlayerCard({
  name,
  sprite,
  ready = false,
  companion = 0,
}: {
  name: string;
  sprite: string;
  ready?: boolean;
  companion?: number;
}) {
  return (
    <div className="player-pass" data-player-pass>
      <div className="pass-inner">
        <div className="pass-face pass-front">
          <div className="pass-heading">
            <img src="/assets/vega/logo.svg" alt="Vega" />
            <span>PLAYER PASS</span>
          </div>
          <div className="pass-character">
            <div className="pass-character-scene">
              <Sprite name="sam-idle" src={sprite} />
              <Companion kind={companion} className="pass-companion" />
            </div>
          </div>
          <strong>{name || "Your player"}</strong>
          <p className="pass-event">
            <span>16-Bit Con</span>
            <time dateTime="2026-10-03">October 3–5, 2026</time>
          </p>
          <div className="pass-code">JAVITS CENTER / 630</div>
        </div>
        <div className="pass-face pass-back" aria-hidden="true">
          <div className="pass-heading">
            {ready ? "PLAYER READY" : "SEE YOU ON THE FLOOR"}
          </div>
          <div className="pass-character">
            <div className="pass-character-scene">
              <Sprite name="sam-idle" src={sprite} />
              <Companion kind={companion} className="pass-companion" />
            </div>
          </div>
          <strong>{name || "Your player"}</strong>
          <p>Meet us in the middle.</p>
          <div className="pass-code">VEGA / BOOTH 630</div>
        </div>
      </div>
    </div>
  );
}
