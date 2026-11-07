import { loadImage } from "../character";

const backdrops = new Map<boolean | "street-far", Promise<HTMLImageElement>>();
export function duskBackdrop(near: boolean | "street-far" = false) {
  const saved = backdrops.get(near);
  if (saved) return saved;
  const backdrop = (async () => {
    const source = await loadImage(
      `/assets/vega/city-${near ? "mid" : "far"}.png`,
    );
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const c = canvas.getContext("2d")!;
    c.drawImage(source, 0, 0);
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    const p = pixels.data;
    // Match the hall's opaque sunset-distance color matrix, without touching alpha.
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i],
        g = p[i + 1],
        b = p[i + 2];
      p[i] =
        near === true ? 0.9 * r + 0.3 * b : 0.68 * r + 0.3 * b + 0.13 * 255;
      p[i + 1] =
        near === true ? 0.15 * r + 0.7 * g : 0.12 * r + 0.64 * g + 0.06 * 255;
      p[i + 2] =
        near === true ? 0.15 * r + 0.8 * b : 0.12 * r + 0.73 * b + 0.05 * 255;
    }
    c.putImageData(pixels, 0, 0);
    return loadImage(canvas.toDataURL("image/png"));
  })();
  backdrops.set(near, backdrop);
  backdrop.catch(() => {
    if (backdrops.get(near) === backdrop) backdrops.delete(near);
  });
  return backdrop;
}
