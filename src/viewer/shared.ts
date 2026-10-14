import { sampleVessel as query, type VesselView } from "../model-set/model";
export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// Immutable publications share physical samples across panes. This cache never
// enters a physical target, worker request or canonical integration.
const samples = new WeakMap<
  VesselView,
  Map<number, ReturnType<typeof query>>
>();
export function sampleVessel(v: VesselView, epoch: number) {
  let cache = samples.get(v);
  if (!cache) {
    cache = new Map();
    samples.set(v, cache);
  }
  const known = cache.get(epoch);
  if (known) return known;
  const result = query(v, epoch);
  if (cache.size >= 256) cache.clear();
  cache.set(epoch, result);
  return result;
}
