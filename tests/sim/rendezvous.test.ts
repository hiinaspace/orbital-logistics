import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { solveRendezvous, type RendezvousProposal } from '../../src/planning/rendezvous';
import { targetBundle } from '../../src/planning/target';
import { Runner } from '../../src/sim/runner';
import { validateBundle } from '../../src/sim/schema';
import { EditorSession } from '../../src/editor/session';

const fixture = () => validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m2-rendezvous.json', import.meta.url), 'utf8')));
function proposed(bundle = fixture()): RendezvousProposal {
  const result = solveRendezvous(bundle, 'departure');
  assert.equal(result.status, 'proposed', JSON.stringify(result));
  if (result.status !== 'proposed') throw new Error('No proposal');
  for (const row of result.trials) if (row.status === 'valid') {
    assert.ok(row.sweep! > 0 && row.sweep! < 2 * Math.PI);
    assert.ok(row.clearance! >= bundle.scenario.rendezvous!.branch.minClearance);
    assert.ok(row.radial >= bundle.scenario.rendezvous!.bounds.radial[0] && row.radial <= bundle.scenario.rendezvous!.bounds.radial[1]);
    assert.ok(row.transverse >= bundle.scenario.rendezvous!.bounds.transverse[0] && row.transverse <= bundle.scenario.rendezvous!.bounds.transverse[1]);
  }
  return result.proposal;
}
test('bounded shooting recovers an independently analytic Hohmann rendezvous and charges both impulses', () => {
  const bundle = fixture(), before = structuredClone(bundle), spec = bundle.scenario.rendezvous!, p = proposed(bundle);
  assert.deepEqual(bundle, before);
  assert.ok(Math.abs(p.departure.radial) < 1e-8);
  assert.ok(Math.abs(p.departure.transverse - (Math.sqrt(7 / 6) - 1)) < 1e-8);
  const targetSpeed = Math.sqrt(1 / 1.4), transferSpeed = Math.sqrt(2 / 1.4 - 1 / 1.2);
  assert.ok(Math.abs(p.arrival.transverse - (targetSpeed - transferSpeed)) < 1e-8);
  const runner = new Runner({ scenario: bundle.scenario, program: p.program }), target = new Runner(targetBundle(bundle));
  const a = runner.sample(spec.arrivalEpoch), b = target.sample(spec.arrivalEpoch);
  assert.ok(Math.hypot(a.y[0] - b.y[0], a.y[1] - b.y[1]) < 1e-7);
  assert.ok(Math.hypot(a.y[2] - b.y[2], a.y[3] - b.y[3]) < 1e-12);
  runner.advanceTo(bundle.scenario.duration); assert.equal(runner.ledger.length, 2);
  const ship = bundle.scenario.ship, analyticFuel = (ship.dryMass + ship.cargoMass + ship.propellant) * -Math.expm1(-p.totalDv / ship.exhaustVelocity);
  assert.ok(Math.abs(p.propellantUsed - analyticFuel) < 1e-14);
  assert.ok(p.refinement.position < spec.tolerance.position / 100 && p.refinement.velocity < spec.tolerance.velocity / 100);
});
test('manually closer and worse seeds converge locally with different correction cost and work', () => {
  const better = fixture(), worse = fixture();
  Object.assign(better.program.burns[0], { radial: 0, transverse: 0.078 });
  Object.assign(worse.program.burns[0], { radial: 0.05, transverse: 0.02 });
  const a = proposed(better), b = proposed(worse);
  assert.ok(a.iterations < b.iterations); assert.ok(a.addedDv < b.addedDv);
  assert.ok(Math.abs(a.totalDv - b.totalDv) < 1e-7);
});
test('fuel, work, component bounds and unsupported queue failures leave the input unchanged', () => {
  const cases = [fixture(), fixture(), fixture(), fixture()];
  cases[0].scenario.ship.propellant = 0.05; // departure is affordable, arrival is not
  cases[1].program.burns[0].transverse = 0.3;
  cases[2].program.burns.push({ ...cases[2].program.burns[0], id: 'extra', t: 3 });
  cases[3].program.burns[0].t = 0.6;
  for (const bundle of cases) { const before = structuredClone(bundle); assert.equal(solveRendezvous(bundle, 'departure').status, 'failed'); assert.deepEqual(bundle, before); }
  const result = solveRendezvous(fixture(), 'departure', 1);
  assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.match(result.reason, /Work limit/);
});
test('clockwise, full-revolution and inadequate-clearance seeds are rejected before route correction', () => {
  const clockwise = fixture(), revolution = fixture(), clearance = fixture();
  clockwise.scenario.rendezvous!.bounds.transverse = [-2, 2]; clockwise.program.burns[0].transverse = -1.5;
  revolution.scenario.duration = 8; revolution.scenario.rendezvous!.arrivalEpoch = 7.5;
  Object.assign(revolution.program.burns[0], { radial: 0, transverse: 0 });
  clearance.scenario.rendezvous!.branch.minClearance = 1;
  for (const b of [clockwise, revolution, clearance]) {
    const r = solveRendezvous(b, 'departure'); assert.equal(r.status, 'failed');
    if (r.status === 'failed') assert.match(r.reason, /branch/);
    assert.equal(r.trials.length, 1);
  }
});
test('proposal acceptance is one undoable draft change; execution and saved target remain reproducible', () => {
  const bundle = fixture(), editor = new EditorSession(bundle), p = proposed(bundle), accepted = editor.accepted;
  editor.change(p.program); assert.deepEqual(editor.accepted, accepted);
  editor.undo(); assert.deepEqual(editor.draft, bundle.program); editor.redo();
  editor.execute(); editor.execution.advanceTo(5);
  const saved = editor.serialize(4), restored = EditorSession.deserialize(saved).session;
  assert.deepEqual(restored.scenario.rendezvous, bundle.scenario.rendezvous);
  assert.deepEqual(restored.execution.current, editor.execution.current);
  assert.deepEqual(restored.accepted, p.program);
});
test('unsupported rendezvous metadata is rejected and coarse accuracy cannot become a proposal', () => {
  const bad: any = fixture(); bad.scenario.rendezvous.branch.direction = 'cw'; assert.throws(() => validateBundle(bad));
  const coarse = fixture(); coarse.scenario.policy.step = 0.125;
  const result = solveRendezvous(coarse, 'departure'); assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.match(result.reason, /accuracy/);
});
