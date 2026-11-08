const images = new Map<string, Promise<HTMLImageElement>>();
const IMAGE_TIMEOUT = 8000;

/** Concurrent consumers share a load; a failed or expired request can be retried. */
export function loadImage(src: string) {
  const cached = images.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) {
        image.src = "";
        reject(error);
      } else resolve(image);
    };
    const timer = setTimeout(
      () => finish(Error("Image load timed out")),
      IMAGE_TIMEOUT,
    );
    image.onload = () => finish();
    image.onerror = () => finish(Error("Image could not load"));
    image.src = src;
  });
  images.set(src, pending);
  if (images.size > 128) {
    const oldest = [...images.keys()].find((key) => key.startsWith("data:"));
    if (oldest && oldest !== src) images.delete(oldest);
  }
  pending.catch(() => {
    if (images.get(src) === pending) images.delete(src);
  });
  return pending;
}
