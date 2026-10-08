// Consultant witness (2026-10-07): a two-tug Home<->Depot shuttle service as an
// OVERLAY of independent single-ship runs through the app's unchanged Runner.
// Tug 2 flies the accepted "patient" program shifted by one synodic period S.
// Each tug is simulated alone (the Runner is single-ship), so this script then
// checks, offline and in time order, whether the two ledgers would over-draw any
// shared port stock. That check is exactly what an honest "overlay" viewer would
// need before claiming the ships share one world.
// Run from the repo root: npx tsx docs/design/orbital-model-set/consultant/experiments/shuttle/fleet-overlay.ts
import {readFileSync, writeFileSync} from 'node:fs';
import {Runner} from '../../../../../../src/sim/runner';
import {validateBundle, type Bundle} from '../../../../../../src/sim/schema';

const seed = validateBundle(JSON.parse(readFileSync('fixtures/m4-patient-solution.json', 'utf8')));
const spec = seed.scenario.logistics!;
const rate = spec.ports[1].rail.rate;
const synodic = 2 * Math.PI / (1 - rate); // same relative geometry recurs every S

function shifted(shift: number, id: string): Bundle {
  const b = structuredClone(seed);
  b.scenario.duration = 64; b.scenario.policy.maxNodes = 65536;
  b.program.id = id;
  b.program.burns = seed.program.burns.map(burn => ({...burn, t: burn.t + shift,
    ...(burn.assist ? {assist: {...burn.assist, targetEpoch: burn.assist.targetEpoch + shift}} : {})}));
  // Stay docked at Home from t=0; everything else moves by the shift.
  b.program.operations = seed.program.operations!.map(op => op.id === 'dock-home' ? op : {...op, t: op.t + shift});
  return validateBundle(b);
}
const tugs = [shifted(0, 'tug-1'), shifted(synodic, 'tug-2')];
const runs = tugs.map(bundle => { const r = new Runner(bundle); const end = r.advanceTo(64); return {bundle, end, ledger: r.ledger}; });

// Offline contention check: merge both ledgers' port transfers in time order
// against ONE shared stock per port. The single-ship runs each assumed the full stock.
const stock = Object.fromEntries(spec.ports.map(p => [p.id, {cargo: p.cargo, propellant: p.propellant}]));
const draws = runs.flatMap((run, i) => run.ledger.filter(e => e.kind === 'transfer').map(e => ({...e, tug: i + 1})))
  .sort((a, b) => a.t - b.t);
const contention: string[] = [];
for (const e of draws) {
  const s = stock[e.portId!];
  s.cargo -= (e.cargoAfter! - e.cargoBefore!); s.propellant -= (e.propellantAfter - e.propellantBefore);
  if (s.cargo < -1e-12 || s.propellant < -1e-12) contention.push(`t ${e.t.toFixed(3)} tug ${e.tug} ${e.id} at ${e.portId}: shared stock would be cargo ${s.cargo.toFixed(3)}, fuel ${s.propellant.toFixed(3)}`);
}
const summary = {
  synodic, horizon: 64,
  tugs: runs.map((r, i) => ({tug: i + 1, departure: tugs[i].program.burns[0].t, homeArrival: tugs[i].program.burns.at(-1)!.t,
    status: r.end.status, cargoDelivered: -(r.ledger.find(e => e.kind === 'transfer' && e.portId === 'Depot')?.cargoAfter ?? 0) + (r.ledger.find(e => e.kind === 'transfer' && e.portId === 'Depot')?.cargoBefore ?? 0),
    fuelUsed: r.end.logistics!.fuelUsed, finalPropellant: r.end.propellant, dockedAtEnd: r.end.logistics!.dockedPortId ?? null})),
  sharedStockAfterBoth: stock, contention,
  thirdTripWouldOverdrawDepotFuel: spec.ports[1].propellant - 3 * 0.1 < 0,
  interpretation: 'Independent single-ship runs of a staggered service are physically valid individually. Shared-stock honesty is a separate offline check; here two tugs fit, a third refuel would not (Depot fuel 0.25, 0.1 per visit).',
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync('docs/design/orbital-model-set/consultant/experiments/shuttle/results.json', JSON.stringify(summary, null, 2) + '\n');
