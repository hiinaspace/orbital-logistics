import type { SceneView } from "../model-set/model";
import { bodyState } from "../sim/dynamics";
import type { State, Vec3 } from "../sim/schema";
import type { FieldSource } from "./potential-field";
/** A time-independent planar source pattern in a rotating, normalized display
 * basis. No propagated samples or vessel state define the physical sources. */
export interface FieldModel {
  sources: FieldSource[];
  origin: Vec3;
  length: number;
  potentialScale: number;
  rate: number;
}
export function sceneField(
  run: Pick<SceneView, "world" | "extent" | "solar">,
): FieldModel | undefined {
  const bodies = run.world.bodies;
  if (run.solar || bodies.length < 1 || bodies.length > 2) return;
  const circular = bodies.filter((b) => b.rail.kind === "circular");
  const rail = circular[0]?.rail;
  const origin: Vec3 =
    rail?.kind === "circular"
      ? [...rail.center]
      : ([
          ...(bodies[0].rail.kind === "fixed"
            ? bodies[0].rail.position
            : [0, 0, 0]),
        ] as Vec3);
  const rate =
    rail?.kind === "circular"
      ? rail.rate * (rail.u[0] * rail.v[1] - rail.u[1] * rail.v[0])
      : 0;
  if (origin[2] !== 0) return;
  for (const b of bodies) {
    const r = b.rail;
    if (r.kind === "fixed") {
      // A noncentral fixed source cannot be stationary in a rotating basis.
      if (
        r.position[2] !== 0 ||
        (rate !== 0 && r.position.some((x, i) => x !== origin[i]))
      )
        return;
    } else if (
      Math.abs(r.rate * (r.u[0] * r.v[1] - r.u[1] * r.v[0]) - rate) > 1e-12 ||
      r.center.some((x, i) => x !== origin[i]) ||
      r.u[2] !== 0 ||
      r.v[2] !== 0
    )
      return;
  }
  const poses = bodies.map((b) => bodyState(b, 0));
  const separation =
    bodies.length === 2
      ? Math.hypot(poses[1][0] - poses[0][0], poses[1][1] - poses[0][1])
      : 0;
  const length =
    separation > 0
      ? separation / 5
      : Math.max(bodies[0].radius, run.extent / 8);
  if (!(length > 0) || !Number.isFinite(length)) return;
  if (bodies.some((b) => !(b.mu > 0) || !(b.radius > 0))) return;
  const potentialScale = bodies[0].mu / length;
  const sources = bodies.map((b, i) => ({
    x: (poses[i][0] - origin[0]) / length,
    y: (poses[i][1] - origin[1]) / length,
    mu: b.mu / bodies[0].mu,
    radius: b.radius / length,
  }));
  return { sources, origin, length, potentialScale, rate };
}
export function fieldPoint(
  model: FieldModel,
  point: readonly number[],
  t: number,
): State {
  const c = Math.cos(model.rate * t),
    s = Math.sin(model.rate * t),
    [x, y, z] = point;
  return [
    model.origin[0] + model.length * (c * x - s * y),
    model.origin[1] + model.length * (s * x + c * y),
    model.length * z,
    0,
    0,
    0,
  ];
}
export function fieldCoordinates(
  model: FieldModel,
  point: readonly number[],
  t: number,
): Vec3 {
  const c = Math.cos(model.rate * t),
    s = Math.sin(model.rate * t),
    x = point[0] - model.origin[0],
    y = point[1] - model.origin[1];
  return [
    (c * x + s * y) / model.length,
    (-s * x + c * y) / model.length,
    point[2] / model.length,
  ];
}
