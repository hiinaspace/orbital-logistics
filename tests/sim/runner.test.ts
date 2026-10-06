import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Runner } from '../../src/sim/runner';
import { bodyState, certifiedCoast } from '../../src/sim/dynamics';
import { parseBundle, validateBundle, type State } from '../../src/sim/schema';
import { analytic, circular, error, fixture, impulse } from './helpers';

for (const e of [0, 0.6, 1.5]) test(`analytic state and step halving: e=${e}`, () => {
  const horizon = e < 1 ? 2 * Math.PI : 4;
  const errors: number[] = [];
  for (const step of [1 / 128, 1 / 256, 1 / 512]) {
    const runner = new Runner(fixture(analytic(0, e), step));
    let worst = 0;
    for (let i = 1; i <= 100; i++) {
      const t = horizon * i / 100, sample = runner.advanceTo(t);
      assert.equal(sample.status, 'running'); worst = Math.max(worst, error(sample.y, analytic(t, e)));
    }
    errors.push(worst);
  }
  assert.ok(errors[2] < 1e-8, String(errors));
  assert.ok(errors[0] > errors[1] * 10 && errors[1] > errors[2] * 10, String(errors));
});

test('eccentric apsides and period agree with independent Kepler solution', () => {
  const runner = new Runner(fixture(analytic(0, 0.6)));
  const apo = runner.sample(Math.PI), peri = runner.sample(2 * Math.PI);
  assert.ok(Math.abs(Math.hypot(apo.y[0], apo.y[1]) - 1.6) < 1e-8);
  assert.ok(error(peri.y, analytic(0, 0.6)) < 1e-8);
});

test('off-grid impulse has analytic axes, exact accounting, and no early leakage', () => {
  const b = fixture(); b.program = impulse;
  const coast = new Runner(fixture()), run = new Runner(b), burn = impulse.burns[0];
  assert.equal(run.sample(burn.t - 1e-8).propellant, 0.6);
  const after = run.advanceTo(burn.t), expected = analytic(burn.t, 0);
  expected[2] += -Math.sin(burn.t) * burn.transverse; expected[3] += Math.cos(burn.t) * burn.transverse;
  assert.ok(error(after.y, expected) < 1e-10);
  assert.ok(error(after.y.slice(0, 2), coast.sample(burn.t).y.slice(0, 2)) < 1e-10);
  const used = 1.8 * -Math.expm1(-0.12 / 3);
  assert.equal(after.propellant, 0.6 - used);
  assert.equal(after.burnCursor, 1); assert.equal(run.ledger.length, 1);
  assert.ok(Math.abs(run.ledger[0].fuelUsed - used) < 1e-15);
});

test('two burns use current mass, including cargo; zero burn costs zero', () => {
  const b = fixture(); b.program = structuredClone(impulse);
  b.program.burns.push({ ...b.program.burns[0], id: 'second', t: 2.219, radial: 0.05, transverse: -0.1 });
  b.program.burns.push({ ...b.program.burns[0], id: 'zero', t: 2.5, radial: 0, transverse: 0 });
  const run = new Runner(b); run.advanceTo(3);
  const entries = run.ledger, first = 1.8 * -Math.expm1(-0.12 / 3);
  assert.equal(entries[1].fuelUsed, (1.8 - first) * -Math.expm1(-Math.hypot(0.05, 0.1) / 3));
  assert.equal(entries[2].fuelUsed, 0);
});

test('prepared burn follows an independent post-impulse Kepler ellipse over the browser horizon', () => {
  const b = fixture(); b.program = impulse;
  const run = new Runner(b), t0 = impulse.burns[0].t, speed = 1.12;
  const a = 1 / (2 - speed ** 2), e = 1 - 1 / a, rate = a ** -1.5;
  for (let i = 0; i <= 100; i++) {
    const t = t0 + (16 - t0) * i / 100, local = analytic((t - t0) * rate, e);
    local[0] *= a; local[1] *= a; local[2] /= Math.sqrt(a); local[3] /= Math.sqrt(a);
    const c = Math.cos(t0), s = Math.sin(t0);
    const expected: State = [c * local[0] - s * local[1], s * local[0] + c * local[1],
      c * local[2] - s * local[3], s * local[2] + c * local[3]];
    assert.ok(error(run.advanceTo(t).y, expected) < 1e-9);
  }
});

test('basis is CCW transverse, not velocity aligned, even on clockwise eccentric paths', () => {
  const b = fixture([1, 0, 0.3, -0.8]); b.program = structuredClone(impulse);
  b.program.burns[0].t = 0; b.program.burns[0].radial = 0.04;
  const sample = new Runner(b).current;
  assert.deepEqual(sample.y, [1, 0, 0.3 + 0.04, -0.8 + 0.12]);
});

test('unaffordable burn is atomic and blocks all later events', () => {
  const b = fixture(); b.program = structuredClone(impulse);
  b.program.burns[0].t = 0; b.program.burns[0].transverse = 100;
  b.program.burns.push({ ...b.program.burns[0], id: 'later', t: 2 });
  const run = new Runner(b), sample = run.advanceTo(16);
  assert.equal(sample.status, 'burn-rejected'); assert.equal(sample.t, 0);
  assert.deepEqual(sample.y, b.scenario.ship.state); assert.equal(sample.propellant, 0.6);
  assert.equal(sample.burnCursor, 0); assert.equal(run.ledger.length, 1);
  assert.equal(run.ledger[0].fuelUsed, 0);
});

test('display queries, playback partitions, seek, and horizon extension preserve committed states', () => {
  const b = fixture(analytic(0, 0.6), 1 / 32); b.program = impulse;
  const direct = new Runner(b), partitioned = new Runner(b);
  const expected = direct.advanceTo(6);
  for (const t of [0.137, 0.234, 0.789, 1.137, 2.002, 2.999, 3.14159, 4.567, 5.912]) {
    partitioned.advanceTo(t); partitioned.sample(0.11); partitioned.sample(t + 0.00013);
  }
  assert.deepEqual(partitioned.advanceTo(6), expected);
  assert.deepEqual(partitioned.snapshot(), direct.snapshot());
  for (const warp of [0.5, 1, 4, 16]) {
    const run = new Runner(b);
    for (let i = 1; i * warp / 60 < 6; i++) run.advanceTo(i * warp / 60);
    assert.deepEqual(run.advanceTo(6), expected);
  }
  partitioned.seek(1.137); assert.equal(partitioned.ledger.length, 1);
  partitioned.seek(0.137); assert.equal(partitioned.ledger.length, 0);
  assert.deepEqual(partitioned.advanceTo(6), expected);
  partitioned.reset(); assert.deepEqual(partitioned.current.y, validateBundle(b).scenario.ship.state);
});

for (const t of [0, 0.6, 1.137, 1.138, 6, 16]) test(`snapshot reload at t=${t} preserves grid/event cursor`, () => {
  const b = fixture(analytic(0, 0.6), 1 / 32); b.program = impulse;
  const run = new Runner(b); run.advanceTo(t);
  const restored = Runner.deserialize(run.serialize());
  assert.deepEqual(restored.current, run.current);
  assert.deepEqual(restored.snapshot(), run.snapshot());
  assert.deepEqual(restored.advanceTo(16), run.advanceTo(16));
});

test('tampered snapshots are rejected', () => {
  const run = new Runner(circular); run.advanceTo(1.137);
  const snapshot = run.snapshot(); snapshot.anchor.propellant += 1;
  assert.throws(() => Runner.restore(circular, snapshot), /does not match/);
});

test('snapshot object key order is immaterial in JSON', () => {
  const run = new Runner(circular); run.advanceTo(1.137);
  const snapshot = run.snapshot();
  const reordered = Object.fromEntries(Object.entries(snapshot).reverse());
  assert.deepEqual(Runner.restore(circular, reordered).current, run.current);
});

test('nonzero scenario epoch anchors grid and future queries do not execute live burns', () => {
  const b = fixture(); b.scenario.epoch = 10; b.program = structuredClone(impulse); b.program.burns[0].t = 11.137;
  const run = new Runner(b); run.sample(26);
  assert.equal(run.current.t, 10); assert.equal(run.current.propellant, 0.6); assert.deepEqual(run.ledger, []);
  const restored = Runner.deserialize(run.serialize());
  assert.deepEqual(restored.advanceTo(13.234), run.advanceTo(13.234));
});

test('initial surface collision takes precedence over coincident burn', () => {
  const b = fixture([0.08, 0, 0, 1]); b.program = structuredClone(impulse); b.program.burns[0].t = 0;
  const run = new Runner(b);
  assert.equal(run.advanceTo(16).status, 'collision');
  assert.equal(run.current.burnCursor, 0); assert.equal(run.ledger[0].kind, 'collision');
});

for (const step of [1 / 32, 1 / 64, 1 / 128]) test(`high-speed surface approach cannot tunnel, h=${step}`, () => {
  const b = fixture([1, 0, -200, 0], step), run = new Runner(b);
  assert.equal(certifiedCoast(b.scenario, 0, b.scenario.ship.state, step), false);
  const end = run.advanceTo(1);
  assert.equal(end.status, 'unsupported-approach');
  assert.ok(end.t < 0.005 && end.t > 0);
  assert.ok(Math.hypot(end.y[0], end.y[1]) > 0.08);
  assert.ok(end.y.every(Number.isFinite)); assert.equal(run.ledger.length, 1);
  const restored = Runner.deserialize(run.serialize()); assert.deepEqual(restored.current, end);
});

test('moving surfaces enter the clearance bound', () => {
  const b = fixture([1, 0, 0, 0], 1 / 32);
  b.scenario.bodies = [{ id: 'primary', mu: 0.001, radius: 0.1,
    rail: { kind: 'circular', center: [0, 0], radius: 1, rate: 100, phase: Math.PI } }];
  const run = new Runner(b), end = run.advanceTo(1);
  assert.equal(end.status, 'unsupported-approach');
  const body = bodyState(b.scenario.bodies[0], end.t);
  assert.ok(Math.hypot(end.y[0] - body[0], end.y[1] - body[1]) > 0.1);
});

test('retained-node budget is enforced during deterministic subdivisions', () => {
  const b = fixture([1, 0, -10, 0], 1 / 16); b.scenario.duration = 1; b.scenario.policy.maxNodes = 18;
  const run = new Runner(b), end = run.advanceTo(1);
  assert.equal(end.status, 'work-limit'); assert.ok(run.retainedNodes <= 18);
});

test('owned data cannot be modified by view or caller', () => {
  const b = fixture(), run = new Runner(b); b.scenario.ship.state[0] = 9;
  const current = run.current; current.y[0] = 42;
  const copy = run.bundle; copy.scenario.ship.state[0] = 99;
  assert.deepEqual(run.current.y, circular.scenario.ship.state);
});

test('untrusted JSON validates versions, IDs, times, work, mass and finite state', () => {
  const edits = [
    (b: any) => { b.scenario.modelVersion = 'unknown'; },
    (b: any) => { b.scenario.ship.state[0] = NaN; },
    (b: any) => { b.scenario.ship.propellant = -1; },
    (b: any) => { b.scenario.ship.propellant = 9; },
    (b: any) => { b.scenario.policy.step = 1e-100; },
    (b: any) => { b.scenario.duration = 1.234; },
    (b: any) => { b.program.burns[0].referenceBodyId = 'missing'; },
    (b: any) => { b.program.burns[0].t = 20; },
    (b: any) => { b.program.burns.push(b.program.burns[0]); },
    (b: any) => { b.scenario.bodies.push(b.scenario.bodies[0]); },
  ];
  for (const edit of edits) { const b = fixture(); b.program = structuredClone(impulse); edit(b); assert.throws(() => validateBundle(b)); }
  assert.throws(() => parseBundle(' '.repeat(256001)), /limit/);
  const run = new Runner(circular); assert.throws(() => run.sample(NaN)); assert.throws(() => run.advance(-1));
});
