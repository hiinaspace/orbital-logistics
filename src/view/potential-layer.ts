import type { State } from "../sim/schema";
import { ReliefRenderer } from "./relief";
import { viewerProfile } from "./profile";
import {
  FIELD_LIMIT,
  SOURCES,
  reliefFootprint,
  type Bounds,
  type FieldGrid,
  type FieldRequest,
  type FieldSource,
} from "./potential-field";
type Project = (point: State) => readonly number[];
interface Patch {
  grid: FieldGrid;
  image: HTMLCanvasElement;
  path: Path2D;
  bytes: number;
}
const OVERVIEW: Bounds = { x: -12, y: -12, span: 24 };
const same = (a: Bounds, b: Bounds) =>
  a.x === b.x && a.y === b.y && a.span === b.span;
// One lazy display worker, one request and one replaceable desired region.
// Points use the normalized source basis; the caller owns its world/frame projection.
export class PotentialLayer {
  private worker?: Worker;
  private overview?: Patch;
  private detail?: Patch;
  private plateKey = "";
  private plateHits = 0;
  private relief?: ReliefRenderer;
  constructor(
    private plate: HTMLCanvasElement,
    private reliefCanvas: HTMLCanvasElement,
    private sources: FieldSource[] = SOURCES,
  ) {}
  private desired?: Bounds;
  private pending?: FieldRequest;
  private serial = 0;
  error = "";
  visible = false;
  requests = 0;
  outlineOnly = false;
  private reliefBounds?: Bounds;
  get stats() {
    return {
      visible: this.visible,
      outlineOnly: this.outlineOnly,
      ready:
        !!this.overview || (!this.reliefCanvas.hidden && !this.relief?.error),
      pending: !!this.pending,
      requests: this.requests,
      plateHits: this.plateHits,
      reliefError: this.relief?.error ?? "",
      mode: this.reliefCanvas.hidden ? "flat" : "relief",
      bounds: this.reliefBounds,
      bytes:
        (this.relief?.bytes ?? 0) +
        this.plate.width * this.plate.height * 4 +
        (this.overview?.bytes ?? 0) +
        (this.detail?.bytes ?? 0) +
        (this.pending ? this.pending.size ** 2 * 16 + 20000 * 80 : 0),
      segments:
        (this.overview?.grid.segments.length ?? 0) / 4 +
        (this.detail?.grid.segments.length ?? 0) / 4,
      error: this.error,
    };
  }
  suspend() {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
    this.pending = undefined;
    this.relief?.hide();
    this.plate.hidden = true;
    this.visible = false;
  }
  dispose() {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
    this.pending = undefined;
    this.desired = undefined;
    for (const patch of [this.overview, this.detail])
      if (patch) patch.image.width = patch.image.height = 1;
    this.overview = this.detail = undefined;
    this.relief?.dispose();
    this.relief = undefined;
    this.plate.width =
      this.plate.height =
      this.reliefCanvas.width =
      this.reliefCanvas.height =
        1;
    this.plate.hidden = this.reliefCanvas.hidden = true;
    this.visible = false;
    this.plateKey = "";
  }
  private request(bounds: Bounds, size: number) {
    if (this.pending || this.error) return;
    const reserve = size ** 2 * 16 + 20000 * 80;
    if (this.stats.bytes + reserve > FIELD_LIMIT) {
      if (this.detail) {
        this.detail.image.width = this.detail.image.height = 1;
        this.detail = undefined;
      }
      if (this.stats.bytes + reserve > FIELD_LIMIT) return;
    }
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./potential-worker.ts", import.meta.url),
        { type: "module" },
      );
      const owner = this.worker;
      this.worker.onerror = () => {
        if (owner !== this.worker) return;
        this.error = "Field unavailable";
        this.pending = undefined;
        this.worker?.terminate();
      };
      this.worker.onmessage = (
        e: MessageEvent<{ grid?: FieldGrid; error?: string; id?: number }>,
      ) => {
        if (owner !== this.worker || !this.pending) return;
        const expected = this.pending;
        this.pending = undefined;
        if (e.data.error) {
          this.error = e.data.error;
          return;
        }
        const g = e.data.grid!;
        if (g.id !== expected.id) {
          this.error = "Field reply mismatch";
          return;
        }
        const uploadStart = performance.now();
        const image = document.createElement("canvas");
        image.width = image.height = g.size;
        image
          .getContext("2d")!
          .putImageData(
            new ImageData(new Uint8ClampedArray(g.pixels), g.size, g.size),
            0,
            0,
          );
        const path = new Path2D();
        for (let i = 0; i < g.segments.length; i += 4) {
          path.moveTo(g.segments[i], g.segments[i + 1]);
          path.lineTo(g.segments[i + 2], g.segments[i + 3]);
        }
        const patch = {
          grid: g,
          image,
          path,
          bytes:
            g.pixels.byteLength + g.segments.byteLength * 3 + g.size ** 2 * 4,
        };
        viewerProfile.record("fieldUpload", performance.now() - uploadStart);
        if (same(g.bounds, OVERVIEW)) this.overview = patch;
        else this.detail = patch;
        if (this.stats.bytes > FIELD_LIMIT) {
          this.error = "Field storage budget";
          this.detail = undefined;
        }
      };
    }
    this.pending = { id: ++this.serial, bounds, size, sources: this.sources };
    this.requests++;
    this.worker.postMessage(this.pending);
  }
  private planeOutline(width: number, height: number, project: Project) {
    const points = Array.from({ length: 97 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 96;
      return project([10 * Math.cos(angle), 10 * Math.sin(angle), 0, 0, 0, 0]);
    });
    if (points.some((p) => !p.every(Number.isFinite))) return;
    this.visible = true;
    this.outlineOnly = true;
    this.plate.hidden = false;
    const key = "outline:" + points.flat().join(",") + width + "," + height;
    if (key === this.plateKey) return;
    this.plateKey = key;
    const ratio = Math.min(1, 1280 / Math.max(width, height));
    this.plate.width = Math.ceil(width * ratio);
    this.plate.height = Math.ceil(height * ratio);
    const ctx = this.plate.getContext("2d")!;
    ctx.fillStyle = "#0c141d";
    ctx.fillRect(0, 0, this.plate.width, this.plate.height);
    ctx.scale(ratio, ratio);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const p of [...points.slice(1), points[0]]) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = "rgba(145,175,182,.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  draw(
    width: number,
    height: number,
    project: Project,
    enabled: boolean,
    relief = false,
    gain = 1,
    originHeight = 0,
    colored = true,
    grid = true,
    gridPhase = 0,
    gridOffset: readonly number[] = [0, 0],
    gridSpacing = 1,
    gridStrength = 0.55,
  ) {
    this.visible = false;
    this.outlineOnly = false;
    if (relief && enabled) {
      if (this.pending) {
        this.worker?.terminate();
        this.worker = undefined;
        this.pending = undefined;
      }
      if (this.detail) {
        this.detail.image.width = this.detail.image.height = 1;
        this.detail = undefined;
      }
    }
    if (!enabled || !relief) this.relief?.hide();
    this.plate.hidden = !enabled;
    this.reliefCanvas.hidden = true;
    if (!enabled) return;
    const o = project([0, 0, 0, 0, 0, 0]),
      x = project([1, 0, 0, 0, 0, 0]),
      y = project([0, 1, 0, 0, 0, 0]);
    const a = x[0] - o[0],
      b = x[1] - o[1],
      c = y[0] - o[0],
      d = y[1] - o[1],
      det = a * d - b * c,
      scale = Math.max(Math.hypot(a, b), Math.hypot(c, d));
    if (Math.abs(det) < 0.12 * scale ** 2) {
      this.plate.hidden = true;
      if (!relief) {
        this.planeOutline(width, height, project);
        return;
      }
      if (relief) {
        this.plate.width = this.plate.height = 1;
        this.plateKey = "";
      }
      if (relief) {
        this.relief ??= new ReliefRenderer(this.reliefCanvas, this.sources);
        this.reliefBounds = OVERVIEW;
        this.visible = this.relief.draw(
          width,
          height,
          project,
          OVERVIEW,
          gain,
          originHeight,
          colored,
          grid ? gridSpacing : 0,
          gridPhase,
          gridOffset,
          gridStrength,
        );
      }
      return;
    }
    this.visible = true;
    // Invert only a well-conditioned physical plane. No source/cursor sampling.
    const z = project([0, 0, 1, 0, 0, 0]).map((v, i) => v - o[i]);
    const corners = relief
      ? reliefFootprint(width, height, o, a, b, c, d, z, gain, originHeight)
      : [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height],
        ].map(([u, v]) => [
          (d * (u - o[0]) - c * (v - o[1])) / det,
          (-b * (u - o[0]) + a * (v - o[1])) / det,
        ]);
    const xs = corners.map((p) => p[0]),
      ys = corners.map((p) => p[1]),
      left = Math.min(...xs),
      right = Math.max(...xs),
      bottom = Math.min(...ys),
      top = Math.max(...ys);
    const span =
      2 ** Math.ceil(Math.log2(Math.max(right - left, top - bottom) * 1.6));
    this.desired =
      span < 16
        ? {
            x:
              (Math.round((left + right) / 2 / (span / 8)) * span) / 8 -
              span / 2,
            y:
              (Math.round((bottom + top) / 2 / (span / 8)) * span) / 8 -
              span / 2,
            span,
          }
        : undefined;
    if (!this.overview && !relief) this.request(OVERVIEW, 256);
    else if (this.desired && !relief) {
      const q = this.detail?.grid.bounds;
      const covered =
        q &&
        q.span <= span * 2 &&
        q.span >= span / 2 &&
        left >= q.x &&
        right <= q.x + q.span &&
        bottom >= q.y &&
        top <= q.y + q.span;
      if (!covered && (!q || !same(q, this.desired)))
        this.request(this.desired, 512);
    }
    const detail = this.desired ? this.detail : undefined;
    if (relief) {
      this.plate.hidden = true;
      this.plate.width = this.plate.height = 1;
      this.plateKey = "";
      this.relief ??= new ReliefRenderer(this.reliefCanvas, this.sources);
      const bounds = this.desired ?? OVERVIEW;
      this.reliefBounds = bounds;
      this.visible = this.relief.draw(
        width,
        height,
        project,
        bounds,
        gain,
        originHeight,
        colored,
        grid ? gridSpacing : 0,
        gridPhase,
        gridOffset,
        gridStrength,
      );
      return;
    }
    const paint = (
      ctx: CanvasRenderingContext2D,
      patch: Patch,
      exclude?: Bounds,
    ) => {
      const q = patch.grid.bounds;
      ctx.save();
      ctx.transform(a, b, c, d, o[0], o[1]);
      ctx.beginPath();
      ctx.rect(q.x, q.y, q.span, q.span);
      for (const s of this.sources) {
        ctx.moveTo(s.x + s.radius, s.y);
        ctx.arc(s.x, s.y, s.radius, 0, 2 * Math.PI);
      }
      ctx.clip("evenodd");
      if (exclude) {
        ctx.beginPath();
        ctx.rect(q.x, q.y, q.span, q.span);
        ctx.rect(exclude.x, exclude.y, exclude.span, exclude.span);
        ctx.clip("evenodd");
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(patch.image, q.x, q.y, q.span, q.span);
      ctx.strokeStyle = "rgba(170,191,172,.30)";
      ctx.lineWidth = 0.8 / Math.sqrt(Math.abs(det));
      ctx.stroke(patch.path);
      ctx.restore();
    };
    const affine = [a, b, c, d, o[0], o[1], width, height]
      .map((v) => Math.round(v * 1e8) / 1e8)
      .join(",");
    // The field is an independent bounded canvas behind the moving freight.
    // An unchanged projection does not repaint it; a changed projection redraws
    // at the exact cursor rather than temporally decimating the physical field.
    const key = affine + ":" + this.overview?.grid.id + ":" + detail?.grid.id;
    if (key !== this.plateKey) {
      const ratio = Math.min(1, 1280 / Math.max(width, height));
      const w = Math.ceil(width * ratio),
        h = Math.ceil(height * ratio);
      if (this.plate.width !== w || this.plate.height !== h) {
        this.plate.width = w;
        this.plate.height = h;
      }
      const target = this.plate.getContext("2d")!;
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.clearRect(0, 0, w, h);
      target.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.overview) paint(target, this.overview, detail?.grid.bounds);
      if (detail) paint(target, detail);
      target.save();
      target.transform(a, b, c, d, o[0], o[1]);
      target.globalCompositeOperation = "destination-in";
      const fade = target.createRadialGradient(0, 0, 8, 0, 0, 11);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      target.fillStyle = fade;
      target.fillRect(-40, -40, 80, 80);
      target.restore();
      this.plateKey = key;
    } else this.plateHits++;
  }
}
