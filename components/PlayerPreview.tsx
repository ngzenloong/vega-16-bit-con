import Sprite from "./Sprite";
import Companion from "./Companion";
import Icon from "./Icon";

/** The same composed character is shown in selection, confirmation and the hall. */
export default function PlayerPreview({
  name,
  sprite,
  companion,
  ready = false,
  detail,
}: {
  name: string;
  sprite: string;
  companion: number;
  ready?: boolean;
  detail?: string;
}) {
  return (
    <figure className="player-preview" data-ready={ready}>
      <div className="player-preview-stage">
        {ready && (
          <span className="player-ready-check">
            <Icon name="check" size={32} />
          </span>
        )}
        <div className="player-preview-actors">
          <Sprite name="sam-idle" src={sprite} />
          <Companion kind={companion} className="player-preview-companion" />
        </div>
        <div className="player-preview-plinth" aria-hidden="true" />
      </div>
      <figcaption>
        <strong>{name || "Your player"}</strong>
        {detail && <span className="player-preview-detail">{detail}</span>}
      </figcaption>
    </figure>
  );
}
