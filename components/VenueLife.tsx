import Sprite from "./Sprite";
import NpcSprite from "./NpcSprite";

function Stall({
  kind,
  left,
  onRegister,
  onPizza,
}: {
  kind: "pizza" | "merch";
  left: number;
  onRegister?: () => void;
  onPizza?: (el: HTMLButtonElement) => void;
}) {
  return (
    <div className={`venue-prop venue-stall stall-${kind}`} style={{ left }}>
      {kind === "merch" && (
        <button
          type="button"
          className="stall-hotspot"
          data-target="merch"
          data-kind="register"
          data-label="Vega merch"
          data-action-label="CHANGE OUTFIT"
          data-x={left + 100}
          onClick={onRegister}
          aria-label="Browse Vega merch and change your outfit"
        />
      )}
      {kind === "pizza" && (
        <button
          type="button"
          className="stall-hotspot"
          data-target="pizza"
          data-kind="food"
          data-label="Pizza break"
          data-x={left + 100}
          onClick={(e) => onPizza?.(e.currentTarget)}
          aria-label="Grab a slice of pizza"
        />
      )}
      <div aria-hidden="true">
        <div className="stall-sign">
          {kind === "pizza" ? "PIZZA" : "VEGA MERCH"}
        </div>
        {kind === "pizza" ? (
          <Sprite name="mole-pizza" className="stall-vendor" />
        ) : (
          <div className="stall-vendor">
            <NpcSprite id="merch" />
          </div>
        )}
        <svg
          width="200"
          height="100"
          viewBox="0 0 100 50"
          shapeRendering="crispEdges"
          className="stall-counter"
        >
          <path
            d="M2 10H83L98 18H17Z"
            fill="#FFFAEB"
            stroke="#0F3301"
            strokeWidth="2"
          />
          <path
            d="M2 10L17 18V47L2 39Z"
            fill="#49832C"
            stroke="#0F3301"
            strokeWidth="2"
          />
          <path
            d="M17 18H98V47H17Z"
            fill={kind === "pizza" ? "#FF9823" : "#FFD11B"}
            stroke="#0F3301"
            strokeWidth="2"
          />
          {kind === "pizza" ? (
            <>
              <path
                d="M30 5H65L72 11H37Z"
                fill="#FFD11B"
                stroke="#B87421"
                strokeWidth="2"
              />
              <path d="M40 7h3v2h-3zm10-1h3v2h-3zm9 3h3v2h-3z" fill="#B87421" />
            </>
          ) : (
            <>
              <path d="M26 3h8l5 4-3 4-2-2v8h-8V9l-2 2-3-4Z" fill="#0D5500" />
              <path d="M58 4h8l5 4-3 4-2-2v7h-8v-7l-2 2-3-4Z" fill="#FF9823" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
function CodeBench({ left, variant }: { left: number; variant: number }) {
  return (
    <div className="venue-prop code-bench" style={{ left }} aria-hidden="true">
      <Sprite name="computers-desk" />
      <Sprite
        name="mole-typing"
        className="bench-coder"
        style={{ left: variant ? 150 : 240 }}
      />
    </div>
  );
}
export default function VenueLife({
  floor,
  onRegister,
  onPizza,
}: {
  floor: 0 | 1;
  onRegister?: () => void;
  onPizza?: (el: HTMLButtonElement) => void;
}) {
  return floor === 0 ? (
    <>
      <Stall kind="pizza" left={170} onPizza={onPizza} />
      <Stall kind="merch" left={3240} onRegister={onRegister} />
      <div
        className="venue-prop spectator"
        style={{ left: 2630 }}
        aria-hidden="true"
      >
        <Sprite name="mole-phone" />
      </div>
    </>
  ) : (
    <>
      <CodeBench left={1230} variant={0} />
      <CodeBench left={2180} variant={1} />
      <div
        className="venue-prop"
        style={{ left: 1680, bottom: 110 }}
        aria-hidden="true"
      >
        <Sprite name="moles-sofa" />
      </div>
      <div className="developer-wall" aria-hidden="true">
        <span>QUERY NIGHT</span>
        <pre>
          {
            "source → detect → investigate\nNYC ↔ TLV\nPOST-SIEM / OPEN SESSION"
          }
        </pre>
      </div>
    </>
  );
}
