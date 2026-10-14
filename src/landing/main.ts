// This entry has no imports from the viewer, numerical engines or exhibit registry.
const motion = document.querySelector<HTMLButtonElement>("#hero-motion")!;
const poster = document.querySelector<HTMLImageElement>("#hero-poster")!;
const canvas = document.querySelector<HTMLCanvasElement>("#hero-canvas")!;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let preview:
  Awaited<ReturnType<(typeof import("./preview"))["mountPreview"]>> | undefined;
let disposed = false,
  requested = false,
  userPaused = reduce.matches;
function label() {
  motion.hidden = false;
  motion.textContent = userPaused ? "Play preview" : "Pause preview";
  motion.setAttribute(
    "aria-label",
    (userPaused ? "Play" : "Pause") + " orbital preview",
  );
}
async function start() {
  if (preview || requested || disposed) return;
  requested = true;
  try {
    const { mountPreview } = await import("./preview");
    if (disposed) return;
    preview = mountPreview(canvas, poster);
    preview.pause(userPaused);
  } catch {
    // A failed optional enhancement leaves the readable page and poster intact.
    motion.hidden = true;
  }
}
motion.onclick = () => {
  userPaused = !userPaused;
  label();
  void start();
  preview?.pause(userPaused);
};
const changed = () => {
  userPaused = reduce.matches;
  label();
  if (!userPaused) void start();
  preview?.pause(userPaused);
};
reduce.addEventListener("change", changed);
label();
if (!userPaused) void start();
function dispose() {
  disposed = true;
  preview?.dispose();
  reduce.removeEventListener("change", changed);
}
window.addEventListener("pagehide", dispose, { once: true });
// The page remains readable when restored from the browser's back/forward cache.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
