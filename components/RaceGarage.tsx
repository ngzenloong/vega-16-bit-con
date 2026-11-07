import { RIVAL_CARS, DRIVER_PROFILES, PLAYER_PROFILE } from "@/lib/games/cars";

const cars = [
  { id: "fiat-player", model: "Your Fiat 500", asset: "fiat-player-side.svg" },
  ...RIVAL_CARS.map((car) => ({
    ...car,
    asset: car.asset.replace(".svg", "-side.svg"),
  })),
];

export default function RaceGarage() {
  return (
    <details className="race-garage">
      <summary>Meet the {RIVAL_CARS.length + 1}-car grid</summary>
      <ul aria-label="Every car races in every round" tabIndex={0}>
        {cars.map((car) => {
          const profile = DRIVER_PROFILES[car.id] || PLAYER_PROFILE;
          return (
            <li key={car.id}>
              <span
                className="garage-profile"
                style={{ backgroundImage: `url(/assets/vega/${car.asset})` }}
                aria-hidden="true"
              />
              <span>
                {car.model}
                {car.id === "scargo" ? " · Boss" : ""}
              </span>
              <dl className="garage-stats">
                <div>
                  <dt>KM/H</dt>
                  <dd>{profile.topSpeed}</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>
                    {Math.max(
                      1,
                      Math.min(
                        5,
                        Math.round((profile.acceleration - 600) / 100),
                      ),
                    )}
                    /5
                  </dd>
                </div>
                <div>
                  <dt>Grip</dt>
                  <dd>{Math.round(profile.handling * 5)}/5</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <small className="garage-note">
        Arcade tuning. Yellow boosts lift the Fiat above its usual top speed.
      </small>
    </details>
  );
}
