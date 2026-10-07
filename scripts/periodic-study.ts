// Retained design experiment: explicit schedules only, no runtime route language.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle, type Bundle} from '../src/sim/schema';
import {logisticsResult} from '../src/sim/logistics';

const seed = validateBundle(JSON.parse(readFileSync('fixtures/m4-patient-solution.json', 'utf8')));
const rate = seed.scenario.logistics!.ports[1].rail.rate;
const synodic = 2 * Math.PI / (1 - rate);
const returnAt = seed.program.operations!.at(-1)!.t;
function repeated(period: number): Bundle {
  const b = structuredClone(seed);
  b.scenario.duration = 56;
  b.scenario.logistics!.objective.quota = 0.4;
  b.program.id = 'periodic-study-explicit-two-voyages';
  b.program.burns.push(...seed.program.burns.map(burn => ({
    ...burn, id: 'second-' + burn.id, t: burn.t + period,
    ...(burn.assist ? {assist: {...burn.assist, targetEpoch: burn.assist.targetEpoch + period}} : {}),
  })));
  b.program.operations!.push(...seed.program.operations!.filter(op => op.id !== 'dock-home').map(op => ({
    // Home load starts on the preceding return, not at a copied absolute offset.
    ...op, id: 'second-' + op.id, t: op.id === 'load' ? returnAt : op.t + period,
  })));
  return validateBundle(b);
}
function run(bundle: Bundle) {
  const runner = new Runner(bundle), end = runner.advanceTo(bundle.scenario.duration), state = end.logistics!;
  const initialFuel = bundle.scenario.ship.propellant + bundle.scenario.logistics!.ports.reduce((s,p) => s+p.propellant, 0);
  const remainingFuel = end.propellant + state.ports.reduce((s,p) => s+p.propellant, 0);
  assert.ok(Math.abs(initialFuel - remainingFuel - state.fuelUsed) < 1e-12);
  assert.ok(Math.abs(state.cargoMass + state.ports.reduce((s,p) => s+p.cargo, 0) - 1) < 1e-12);
  return {end, result: logisticsResult(bundle.scenario.logistics!, state, end.propellant, end.t), ledger: runner.ledger};
}
const naive = run(repeated(returnAt)), alignedBundle = repeated(2*synodic), aligned = run(alignedBundle);
assert.equal(naive.end.status, 'operation-rejected');
assert.match(naive.end.detail, /Capture Depot: miss/);
assert.equal(aligned.end.status, 'horizon');
assert.equal(aligned.result.complete, true);
// Refinement and display-query/warp partitions; this is not a new independent oracle.
const tightBundle = structuredClone(alignedBundle); tightBundle.scenario.policy.step /= 2;
const tight = run(tightBundle); assert.equal(tight.result.complete, true);
const partitioned = new Runner(alignedBundle);
for (let t=0; t<56; t+=0.347) {partitioned.sample(Math.min(56,t+0.19)); partitioned.advanceTo(t);}
assert.deepEqual(partitioned.advanceTo(56), aligned.end);
assert.deepEqual(partitioned.ledger, aligned.ledger);
const summarize = (r: ReturnType<typeof run>) => ({
  terminal: r.end, result: r.result,
  events: r.ledger.filter(e => ['dock','transfer','burn','operation-rejected'].includes(e.kind)),
});
const output = {
  model: seed.scenario.modelVersion, node: process.version,
  synodic, earliestSameGeometryReuse: 2*synodic,
  firstHomeArrival: returnAt, missedOutboundOpportunity: 0.5+synodic,
  secondDeparture: 0.5+2*synodic, secondHomeArrival: returnAt+2*synodic,
  naive: summarize(naive), aligned: summarize(aligned),
  refinement: {step: tightBundle.scenario.policy.step, terminal: tight.end,
    fuelDifference: Math.abs(tight.end.propellant - aligned.end.propellant)},
  partitionedIdentical: true,
  interpretation: 'Two explicitly compiled voyages in the unchanged runner. No runtime resolver, infinite sustainability proof, or finite-thrust validation.',
};
writeFileSync('docs/design/periodic-transfer/schedule-study.json', JSON.stringify(output, null, 2)+'\n');
console.log(JSON.stringify({synodic, naive: naive.end.detail, aligned: aligned.result,
  secondDeparture: output.secondDeparture, secondHomeArrival: output.secondHomeArrival,
  fuelDifference: output.refinement.fuelDifference}, null, 2));
