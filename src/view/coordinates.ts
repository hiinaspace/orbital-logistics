import { bodyState } from '../sim/dynamics';
import type { Scenario, State } from '../sim/schema';
export type Frame = 'inertial' | string;
export interface Camera { center: [number, number]; scale: number }
export function frameState(scenario: Scenario, y: State, t: number, frame: Frame, referenceShip: State): State {
  const origin: State = frame === 'inertial' ? [0, 0, 0, 0] : frame === 'ship' ? referenceShip :
    bodyState(scenario.bodies.find(b => b.id === frame)!, t);
  return y.map((value, i) => value - origin[i]) as State;
}
export function project(point: number[], camera: Camera): [number, number] {
  return [500 + (point[0] - camera.center[0]) * camera.scale, 325 - (point[1] - camera.center[1]) * camera.scale];
}
export function unproject(point: number[], camera: Camera): [number, number] {
  return [(point[0] - 500) / camera.scale + camera.center[0], (325 - point[1]) / camera.scale + camera.center[1]];
}
export function hitPath(points: { t: number; p: number[] }[], pointer: number[], preferredTime: number): { t: number; distance: number } | undefined {
  const candidates = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1];
    const length = dx * dx + dy * dy;
    if (length < 1e-10) continue;
    const u = Math.max(0, Math.min(1, ((pointer[0] - a.p[0]) * dx + (pointer[1] - a.p[1]) * dy) / length));
    const distance = Math.hypot(pointer[0] - a.p[0] - u * dx, pointer[1] - a.p[1] - u * dy);
    if (distance < 12) candidates.push({ t: a.t + u * (b.t - a.t), distance });
  }
  if (!candidates.length) return undefined;
  const nearest = Math.min(...candidates.map(c => c.distance));
  // Resolve only genuinely overlapping hits by time. A pairwise "within a few
  // pixels" comparator is non-transitive and can drift far down a dense path.
  return candidates.filter(c => c.distance <= nearest + 0.25)
    .sort((a, b) => Math.abs(a.t - preferredTime) - Math.abs(b.t - preferredTime))[0];
}
