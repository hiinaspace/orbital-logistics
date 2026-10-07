import type { Program } from '../sim/schema';

// Grey only the physically identical prefix. Editing an already flown event
// must not make the new hypothetical past look as if it actually happened.
export function followedUntil(accepted: Program, draft: Program, live: number): number {
  const events = (p: Program) => [...p.burns, ...(p.operations ?? [])];
  const a = events(accepted), b = events(draft);
  let until = live;
  for (const event of [...a, ...b]) {
    const before = a.find(e => e.id === event.id), after = b.find(e => e.id === event.id);
    if (JSON.stringify(before) !== JSON.stringify(after)) until = Math.min(until, event.t - Number.EPSILON * Math.max(1, Math.abs(event.t)));
  }
  return until;
}

export function trailAlpha(age: number, duration: number): number {
  return 0.08 + 0.82 * Math.exp(-Math.max(0, age) / (duration / 5));
}
