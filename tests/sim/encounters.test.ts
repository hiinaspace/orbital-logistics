import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { discoverEncounters, proposeEncounter } from '../../src/planning/encounters';
import { targetBundle } from '../../src/planning/target';
import { Runner } from '../../src/sim/runner';
import { validateBundle } from '../../src/sim/schema';
import { EditorSession } from '../../src/editor/session';

function manual(transverse = Math.sqrt(7 / 6) - 1) {
  const b = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m2-rendezvous.json', import.meta.url), 'utf8')));
  Object.assign(b.program.burns[0], { radial: 0, transverse }); return b;
}
test('manual tangent transfer exposes both orbit matching and simultaneous intercept', () => {
  const b = manual(), events = discoverEncounters(b);
  assert.deepEqual(events.map(e => e.kind).sort(), ['intercept', 'match-orbit']);
  for (const e of events) assert.ok(Math.abs(e.t - b.scenario.rendezvous!.arrivalEpoch) < 1e-8);
  const before = structuredClone(b), result = proposeEncounter(b, events.find(e => e.kind === 'intercept')!.id);
  assert.equal(result.status, 'proposed'); assert.deepEqual(b, before);
  if (result.status !== 'proposed') return;
  const p = result.proposal, runner = new Runner({scenario: b.scenario, program: p.program});
  assert.deepEqual(p.program.burns[0], b.program.burns[0]); assert.equal(p.program.burns.length, 2);
  assert.ok(p.addedDv > 0.07 && p.propellantUsed > 0);
  const target = new Runner(targetBundle(b)).sample(p.arrival.t), actual = runner.sample(p.arrival.t);
  assert.ok(Math.hypot(actual.y[0] - target.y[0], actual.y[1] - target.y[1]) < 1e-8);
  assert.ok(Math.hypot(actual.y[3] - target.y[3], actual.y[4] - target.y[4]) < 1e-12);
  runner.advanceTo(6); assert.equal(runner.ledger.length, 2);
  const editor = new EditorSession(b); editor.change(p.program); editor.undo(); assert.deepEqual(editor.draft, b.program); editor.redo();
  const restored = EditorSession.deserialize(editor.serialize(4)).session;
  assert.deepEqual(restored.draft, p.program);
  restored.updateBurn(p.arrival.id, { transverse: p.arrival.transverse + 0.001 });
  assert.equal(restored.draft.burns[1].assist, undefined);
});
test('phase-offset crossing offers only orbit matching, pays for it and does not imply rendezvous', () => {
  const b = manual(0.1), events = discoverEncounters(b);
  assert.deepEqual(events.map(e => e.kind), ['match-orbit']);
  const e = events[0]; assert.ok(Math.abs(e.t - e.targetEpoch) > 0.04);
  const result = proposeEncounter(b, e.id); assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed') return;
  const runner = new Runner({scenario: b.scenario, program: result.proposal.program}), target = new Runner(targetBundle(b));
  const a = runner.sample(e.t), sameTime = target.sample(e.t), atPoint = target.sample(e.targetEpoch);
  assert.ok(Math.hypot(a.y[0] - sameTime.y[0], a.y[1] - sameTime.y[1]) > b.scenario.rendezvous!.tolerance.position);
  assert.ok(Math.hypot(a.y[3] - atPoint.y[3], a.y[4] - atPoint.y[4]) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...runner.sample(6).y.slice(0, 3)) - 1.4) < 1e-8);
  assert.ok(result.proposal.addedDv > 0.15);
});
test('stale, unaffordable and inaccurate correction requests do not change their input', () => {
  const b = manual(), id = discoverEncounters(b)[0].id;
  const stale = manual(0.065), low = manual(), coarse = manual();
  low.scenario.ship.propellant = 0.05; coarse.scenario.policy.step = 0.125;
  for (const input of [stale, low, coarse]) {
    const before = structuredClone(input), result = proposeEncounter(input, id);
    assert.equal(result.status, 'failed'); assert.deepEqual(input, before);
  }
});
test('canonical event roots and matching corrections converge under step refinement', () => {
  const cases = [manual(), manual(0.1)];
  for (const b of cases) {
    const events = [1, 2, 4].map(divisor => { const fine = structuredClone(b); fine.scenario.policy.step /= divisor; fine.scenario.policy.maxNodes = 20000; return discoverEncounters(fine); });
    assert.deepEqual(events[0].map(e => e.kind), events[1].map(e => e.kind));
    assert.deepEqual(events[1].map(e => e.kind), events[2].map(e => e.kind));
    for (let i = 0; i < events[0].length; i++) {
      assert.ok(Math.abs(events[0][i].t - events[2][i].t) < 1e-8);
      assert.ok(Math.abs(events[0][i].targetEpoch - events[2][i].targetEpoch) < 1e-8);
    }
  }
});
