import { RIVAL_CARS } from "@/lib/games/cars";

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
      <summary>Meet the 13-car grid</summary>
      <ul aria-label="Every car races in every round" tabIndex={0}>
        {cars.map((car) => (
          <li key={car.id}>
            <span
              className="garage-profile"
              style={{ backgroundImage: `url(/assets/vega/${car.asset})` }}
              aria-hidden="true"
            />
            <span>{car.model}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
