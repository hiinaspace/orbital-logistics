import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EditorSession } from '../../src/editor/session';
import { predict } from '../../src/planning/predict';
import { inspectEvents } from '../../src/planning/events';
import { Runner } from '../../src/sim/runner';
import { bodyState } from '../../src/sim/dynamics';
import { validateBundle, type Bundle } from '../../src/sim/schema';
import { frameState, hitPath, project, unproject } from '../../src/view/coordinates';
import { analytic, error, fixture } from './helpers';

const orbit = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m1-orbit.json', import.meta.url), 'utf8')));
const binary = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m0-binary.json', import.meta.url), 'utf8')));
function shaped(): { editor: EditorSession; first: string; second: string } {
  const editor = new EditorSession(orbit), first = editor.addBurn(0, 'primary');
  editor.updateBurn(first, { transverse: 0.1 });
  const second = editor.addBurn(6, 'primary'); return { editor, first, second };
}
test('draft edits, gesture cancel/commit, undo and redo preserve the executed program', () => {
  const editor = new EditorSession(orbit), id = editor.addBurn(1.137, 'primary');
  const before = editor.execution.serialize();
  editor.beginGesture(); editor.updateBurn(id, { transverse: 0.1 }); editor.updateBurn(id, { transverse: 0.15 });
  editor.endGesture(false); assert.equal(editor.draft.burns[0].transverse, 0);
  editor.beginGesture(); editor.updateBurn(id, { transverse: 0.08 }); editor.updateBurn(id, { transverse: 0.1 });
  editor.endGesture(true); editor.undo(); assert.equal(editor.draft.burns[0].transverse, 0);
  editor.beginGesture(); editor.updateBurn(id, { transverse: 0.2 }); editor.endGesture(false);
  editor.redo(); assert.equal(editor.draft.burns[0].transverse, 0.1);
  assert.equal(editor.execution.serialize(), before); assert.deepEqual(editor.accepted.burns, []);
  assert.deepEqual(editor.baseline.burns, []);
});

test('editing and duplicate-epoch validation are atomic', () => {
  const { editor, first, second } = shaped(), before = editor.draft;
  assert.throws(() => editor.updateBurn(second, { t: 0 })); assert.deepEqual(editor.draft, before);
  editor.removeBurn(second); assert.equal(editor.draft.burns.length, 1); editor.undo();
  assert.deepEqual(editor.draft, before); assert.equal(editor.draft.burns[0].id, first);
});

test('canonical event brackets exclude burn velocity jumps and circular sign noise', () => {
  const bundle = structuredClone(orbit);
  bundle.program.burns.push({ id: 'burn', t: 1.137, referenceBodyId: 'primary', basis: 'radial-transverse-normal-v2', orientationAxis: [0,0,1], normal:0, radial: 0, transverse: 0.1 });
  const run = new Runner(bundle), result = inspectEvents(bundle, run, 'primary', 8);
  assert.equal(result.apsides.length, 1); assert.equal(result.apsides[0].kind, 'apoapsis');
  assert.ok(result.apsides[0].t > 1.137);
  const circular = inspectEvents(orbit, new Runner(orbit), 'primary', 8);
  assert.deepEqual(circular.apsides, []); assert.equal(circular.apsidesUnique, false);
  const segment = run.coastSegments(8).find(s => s.t1 === 1.137)!;
  assert.ok(Math.abs(Math.hypot(segment.y1[3], segment.y1[4]) - 1) < 1e-10);
  assert.ok(Math.abs(Math.hypot(run.sample(1.137).y[3], run.sample(1.137).y[4]) - 1.1) < 1e-10);
});

test('apsis time, radius and speed converge against independent analytic orbit', () => {
  const rows = [];
  for (const step of [1 / 128, 1 / 256, 1 / 512]) {
    const bundle = fixture(analytic(0, 0.6), step), result = inspectEvents(bundle, new Runner(bundle), 'primary', 6);
    const apo = result.apsides.find(e => e.kind === 'apoapsis')!;
    assert.ok(apo); rows.push(Math.abs(apo.t - Math.PI));
    if (step === 1 / 512) {
      assert.ok(Math.abs(apo.t - Math.PI) < 1e-8);
      assert.ok(Math.abs(apo.distance - 1.6) < 1e-8);
      assert.ok(Math.abs(apo.relativeSpeed - 0.5) < 1e-8);
    }
  }
  assert.ok(rows[0] > rows[1] * 10 && rows[1] > rows[2] * 10, String(rows));
});

test('snap keeps an explicit epoch and reports upstream changes, missing and ambiguous windows', () => {
  const { editor, first, second } = shaped();
  const apo = editor.snapCandidates(second).find(e => e.kind === 'apoapsis')!;
  editor.snap(second, apo, [apo.t - 0.5, apo.t + 0.5]);
  assert.equal(editor.snapState(second), 'current');
  const epoch = editor.draft.burns.find(b => b.id === second)!.t;
  editor.updateBurn(first, { transverse: 0.101 });
  assert.equal(editor.snapState(second), 'stale');
  assert.equal(editor.draft.burns.find(b => b.id === second)!.t, epoch);
  assert.throws(() => editor.execute(), /Re-snap/);
  editor.updateBurn(first, { transverse: 0 }); assert.equal(editor.snapState(second), 'missing');
  const b = fixture(); b.program.burns = [{ id: 'a', t: 0, referenceBodyId: 'primary', basis: 'radial-transverse-normal-v2', orientationAxis: [0,0,1], normal:0, radial: 0, transverse: 0.1 },
    { id: 'b', t: 15, referenceBodyId: 'primary', basis: 'radial-transverse-normal-v2', orientationAxis: [0,0,1], normal:0, radial: 0, transverse: 0 }];
  const multiple = new EditorSession(b), firstApo = multiple.snapCandidates('b').find(e => e.kind === 'apoapsis')!;
  multiple.snap('b', firstApo, [0, 16]);
  // The selected burn is excluded from its own prefix; two reference apsides qualify.
  assert.equal(multiple.snapState('b'), 'ambiguous');
});

test('execution, save/load and baseline preserve a queue and snap provenance', () => {
  const { editor, second } = shaped(), apo = editor.snapCandidates(second).find(e => e.kind === 'apoapsis')!;
  editor.snap(second, apo, [apo.t - 0.5, apo.t + 0.5]); editor.updateBurn(second, { radial: 0.01 });
  const prediction = predict(editor.bundle, editor.revision); editor.execute();
  for (const sample of prediction.samples) assert.deepEqual(editor.execution.advanceTo(sample.t).y, sample.y);
  const saved = EditorSession.deserialize(editor.serialize(3.4));
  assert.deepEqual(saved.session.draft, editor.draft); assert.deepEqual(saved.session.accepted, editor.accepted);
  assert.deepEqual(saved.session.baseline.burns, []); assert.equal(saved.previewEpoch, 3.4);
  assert.deepEqual(saved.session.execution.current, editor.execution.current);
  assert.equal(saved.session.snapState(second), 'current');
});

test('failed or unfinished plans never replace accepted execution', () => {
  const editor = new EditorSession(orbit), id = editor.addBurn(1.137, 'primary');
  editor.updateBurn(id, { transverse: 100 }); const before = editor.execution.serialize();
  assert.throws(() => editor.execute(), /burn-rejected/); assert.equal(editor.execution.serialize(), before);
  editor.updateBurn(id, { transverse: 0.1 }); editor.beginGesture();
  assert.throws(() => editor.execute(), /Finish/); assert.equal(editor.execution.serialize(), before);
});

test('per-draft step refinement blocks an unconverged plan before acceptance', () => {
  const good = predict(orbit, 0, 8, true);
  assert.equal(good.accuracy!.status, 'converged');
  const coarse = fixture(analytic(0, 0.6), 1 / 16), editor = new EditorSession(coarse);
  const check = predict(coarse, 0, 8, true);
  assert.equal(check.accuracy!.status, 'unresolved');
  const before = editor.execution.serialize(); assert.throws(() => editor.execute(), /accuracy unresolved/);
  assert.equal(editor.execution.serialize(), before);
});

test('a zero impulse does not erase a continuous apsis and a radial jump does not invent one', () => {
  const { editor, second } = shaped(), event = editor.snapCandidates(second).find(e => e.kind === 'apoapsis')!;
  editor.snap(second, event, [event.t - 0.5, event.t + 0.5]);
  const result = predict(editor.bundle, 0);
  assert.ok(result.diagnostics.primary.apsides.some(e => e.kind === 'apoapsis' && Math.abs(e.t - event.t) < 1e-7));
  const bundle = fixture(analytic(0, 0.6));
  bundle.program.burns = [{ id: 'radial-jump', t: 2, referenceBodyId: 'primary', basis: 'radial-transverse-normal-v2', orientationAxis: [0,0,1], normal:0, radial: -1, transverse: 0 }];
  const diagnostics = inspectEvents(bundle, new Runner(bundle), 'primary', 6);
  assert.ok(diagnostics.apsides.every(e => Math.abs(e.t - 2) > 1e-5));
});

test('sample-time frame transformations are independent of view epoch and burn axes', () => {
  const run = new Runner(binary), before = run.serialize(), t = 2.5, y = run.sample(t).y;
  const moon = bodyState(binary.scenario.bodies[1], t);
  const relative = frameState(binary.scenario, y, t, 'moon', y);
  assert.deepEqual(relative, y.map((v, i) => v - moon[i]));
  assert.deepEqual(frameState(binary.scenario, moon, t, 'moon', y), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(frameState(binary.scenario, y, t, 'ship', y), [0, 0, 0, 0, 0, 0]);
  assert.equal(run.serialize(), before);
  const camera = { center: [0.2, 0.3] as [number, number], scale: 500 };
  assert.ok(error(unproject(project([1, 2], camera), camera), [1, 2]) < 1e-14);
});

test('path hit testing preserves the explicitly previewed occurrence on overlapping revolutions', () => {
  const points = [{ t: 0, p: [0, 0] }, { t: 1, p: [100, 0] }, { t: 2, p: [0, 0] }];
  assert.equal(hitPath(points, [50, 1], 0)?.t, 0.5);
  assert.equal(hitPath(points, [50, 1], 2)?.t, 1.5);
  assert.equal(hitPath(points, [50, 100], 2), undefined);
  const dense = Array.from({ length: 1000 }, (_, i) => ({ t: i / 100, p: [i, 0] }));
  assert.ok(Math.abs(hitPath(dense, [567.4, 0], 0)!.t - 5.674) < 1e-12);
});

test('JSON rejects invalid snap provenance and editor snapshot without altering an existing session', () => {
  const { editor } = shaped(), before = editor.serialize(0);
  const value = JSON.parse(before); value.program.burns[0].snap = { kind: 'apoapsis', bodyId: 'primary', window: [3, 2], resolvedEpoch: 0 };
  assert.throws(() => EditorSession.deserialize(JSON.stringify(value)));
  assert.equal(editor.serialize(0), before);
  const tampered = JSON.parse(before); tampered.editor.snapshot.anchor.y[0] += 1;
  assert.throws(() => EditorSession.deserialize(JSON.stringify(tampered)), /does not match/);
});
