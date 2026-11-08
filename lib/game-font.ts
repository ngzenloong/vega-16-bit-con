let fontReady: Promise<FontFace[]> | null = null;
let retry = false;

async function loadGameFont() {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Error("Game font load timed out"));
    }, 8000);
  });
  const load = retry
    ? (async () => {
        const response = await fetch("/fonts/mondwest.woff2", {
          signal: controller.signal,
          cache: "reload",
        });
        if (!response.ok) throw Error("Game font unavailable");
        const face = await new FontFace(
          "PP Mondwest",
          await response.arrayBuffer(),
        ).load();
        if (controller.signal.aborted) throw Error("Game font load expired");
        document.fonts.add(face);
        return [face];
      })()
    : document.fonts.load('16px "PP Mondwest"').then((faces) => {
        if (!faces.length) throw Error("Game font unavailable");
        return faces;
      });
  try {
    return await Promise.race([load, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
export function prepareGameFont() {
  if (!fontReady) {
    const request = loadGameFont();
    fontReady = request;
    request.catch(() => {
      if (fontReady === request) {
        fontReady = null;
        retry = true;
      }
    });
  }
  return fontReady;
}
