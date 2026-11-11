import { loadImage } from "../image";
import { CITY_COLORS } from "./types";

const backdrops = new Map<boolean | "street-far", Promise<HTMLImageElement>>();
export function daylightBackdrop(near: boolean | "street-far" = false) {
  const saved = backdrops.get(near);
  if (saved) return saved;
  const backdrop = (async () => {
    const source = await loadImage(
      `/assets/vega/city-${near ? "mid" : "far"}.png`,
    );
    if (near !== "street-far") return source;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const c = canvas.getContext("2d")!;
    c.drawImage(source, 0, 0);
    // Distant street facades retain the same crops and alpha, with a little sky haze.
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = 0.18;
    c.fillStyle = CITY_COLORS.sky;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return loadImage(canvas.toDataURL("image/png"));
  })();
  backdrops.set(near, backdrop);
  backdrop.catch(() => {
    if (backdrops.get(near) === backdrop) backdrops.delete(near);
  });
  return backdrop;
}
