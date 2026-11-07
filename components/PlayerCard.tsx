import Sprite from "./Sprite";
export default function PlayerCard({
  name,
  sprite,
  ready = false,
}: {
  name: string;
  sprite: string;
  ready?: boolean;
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
            <Sprite name="sam-idle" src={sprite} />
          </div>
          <strong>{name || "Your player"}</strong>
          <p>
            16-Bit Con
            <br />
            October 3–5, 2026
          </p>
          <div className="pass-code">JAVITS CENTER / 630</div>
        </div>
        <div className="pass-face pass-back" aria-hidden="true">
          <div className="pass-heading">
            {ready ? "PLAYER READY" : "SEE YOU ON THE FLOOR"}
          </div>
          <div className="pass-character">
            <Sprite name="sam-idle" src={sprite} />
          </div>
          <strong>{name || "Your player"}</strong>
          <p>Meet us in the middle.</p>
          <div className="pass-code">VEGA / BOOTH 630</div>
        </div>
      </div>
    </div>
  );
}
