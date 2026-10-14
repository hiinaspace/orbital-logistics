import clip from "./preview.json";
/** Bounded, decorative playback only. Positions come from the offline generator;
 * this module deliberately imports no simulation, viewer or worker code. */
export function mountPreview(
  canvas: HTMLCanvasElement,
  poster: HTMLImageElement,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { pause: (_value: boolean) => {}, dispose: () => {} };
  const context = ctx;
  const paths = clip.ships.map((ship) => {
    const path = new Path2D();
    ship.points.forEach(([x, y], i) => {
      const q = [450 + x * 34, 300 - y * 34];
      if (i) path.lineTo(...(q as [number, number]));
      else path.moveTo(...(q as [number, number]));
    });
    return path;
  });
  let animation = 0,
    paused = false,
    visible = false,
    disposed = false,
    elapsed = 0,
    last = 0,
    lastPaint = 0,
    frames = 0;
  function draw() {
    if (disposed) return;
    const scale = canvas.width / 900;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = "#0c141d";
    context.fillRect(0, 0, 900, 600);
    context.fillStyle = "#738b95";
    context.globalAlpha = 0.2;
    for (let i = 0; i < 32; i++)
      context.fillRect((i * 317.1) % 900, (i * 173.7) % 600, 1, 1);
    context.globalAlpha = 1;
    for (const [i, ship] of clip.ships.entries()) {
      context.lineWidth = 1.2;
      context.strokeStyle = ship.color;
      context.globalAlpha = 0.27;
      context.stroke(paths[i]);
      context.globalAlpha = 1;
      const n = ship.points.length - 1,
        q = (elapsed / 50000) * n,
        index = Math.floor(q) % n,
        u = q - Math.floor(q),
        a = ship.points[index],
        b = ship.points[index + 1];
      const x = 450 + (a[0] + (b[0] - a[0]) * u) * 34,
        y = 300 - (a[1] + (b[1] - a[1]) * u) * 34;
      context.fillStyle = ship.color;
      context.beginPath();
      context.arc(x, y, 4, 0, 2 * Math.PI);
      context.fill();
      context.strokeStyle = ship.color;
      context.globalAlpha = 0.2;
      context.beginPath();
      context.arc(x, y, 9, 0, 2 * Math.PI);
      context.stroke();
      context.globalAlpha = 1;
    }
    for (const [x, r, name] of [
      [450, 34, "Aster"],
      [620, 9, "Selene"],
    ] as const) {
      context.fillStyle = "#192a37";
      context.strokeStyle = "#61747b";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, 300, r, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      context.fillStyle = "#a5b4b4";
      context.font = "12px Space Grotesk, sans-serif";
      context.fillText(name, x - (name === "Aster" ? 16 : 18), 300 + r + 21);
    }
    canvas.hidden = false;
    poster.hidden = true;
    canvas.dataset.frames = String(++frames);
  }
  function tick(now: number) {
    if (disposed || paused || !visible || document.hidden) {
      animation = 0;
      return;
    }
    if (last) elapsed = (elapsed + Math.min(200, now - last)) % 50000;
    last = now;
    if (now - lastPaint >= 50) {
      draw();
      lastPaint = now;
    }
    animation = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(animation);
    animation = 0;
    last = 0;
    const running = !disposed && !paused && visible && !document.hidden;
    canvas.dataset.running = String(running);
    if (running) animation = requestAnimationFrame(tick);
  }
  const visibility = () => sync();
  document.addEventListener("visibilitychange", visibility);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  });
  observer.observe(canvas.parentElement!);
  const resize = new ResizeObserver(() => {
    const box = canvas.parentElement!.getBoundingClientRect(),
      ratio = Math.min(
        devicePixelRatio || 1,
        1.5,
        1100 / Math.max(1, box.width),
      );
    const width = Math.round(box.width * ratio),
      height = Math.round((width * 2) / 3);
    if (width > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
      draw();
    }
  });
  resize.observe(canvas.parentElement!);
  return {
    pause(value: boolean) {
      paused = value;
      sync();
    },
    dispose() {
      disposed = true;
      sync();
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.width = canvas.height = 1;
      canvas.hidden = true;
      poster.hidden = false;
    },
  };
}
