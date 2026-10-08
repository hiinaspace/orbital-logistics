import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSet, sampleVessel, setEvents, stockAt, validateSet, type ModelSet} from '../../src/model-set/model';
import {transform} from '../../src/model-set/frames';
import {portState} from '../../src/sim/logistics';
import {bodyState} from '../../src/sim/dynamics';
import {Runner} from '../../src/sim/runner';
import {error} from './helpers';
const freight: ModelSet = JSON.parse(readFileSync('fixtures/model-sets/orison-freight.json', 'utf8'));
const lunar: ModelSet = JSON.parse(readFileSync('fixtures/model-sets/lunar-loop.json', 'utf8'));
const run = prepareSet(freight);

test('prepared freight conserves shared cargo and accounts for every unit of propellant', () => {
  const events = setEvents(run), ports = freight.vessels[0].bundle.scenario.logistics!.ports;
  const initialCargo = ports.reduce((s, p) => s + p.cargo, 0);
  const initialFuel = ports.reduce((s, p) => s + p.propellant, 0) + freight.vessels.reduce((s, v) => s + v.bundle.scenario.ship.propellant, 0);
  for (const t of new Set([0, 64, ...events.map(e => e.t)])) {
    const stock = stockAt(run, t), samples = run.vessels.map(v => sampleVessel(v, t));
    const cargo = stock.reduce((s, p) => s + p.cargo, 0) + samples.reduce((s, p) => s + p.logistics!.cargoMass, 0);
    const fuel = stock.reduce((s, p) => s + p.propellant, 0) + samples.reduce((s, p) => s + p.propellant, 0);
    const spent = events.filter(e => e.t <= t).reduce((s, e) => s + e.fuelUsed, 0);
    assert.ok(Math.abs(cargo - initialCargo) < 1e-12);
    assert.ok(Math.abs(fuel + spent - initialFuel) < 1e-12);
  }
  assert.equal(events.filter(e => e.kind === 'transfer' && e.cargoAfter! < e.cargoBefore!).length, 7);
  run.vessels.forEach(v => assert.equal(v.samples.at(-1)!.logistics!.dockedPortId, v.bundle.scenario.logistics!.objective.returnPortId));
});

test('admission rejects incompatible worlds, aggregate overdrafts and berth contention', () => {
  const bad = structuredClone(freight); bad.vessels[1].bundle.scenario.bodies[0].radius = 0.29;
  assert.throws(() => validateSet(bad), /Incompatible worlds/);
  const crowded = structuredClone(freight); crowded.stations.find(s => s.id === 'Anchor')!.berths = 1;
  assert.throws(() => prepareSet(crowded), /Shared stock or berths exceeded/);
  const depleted = structuredClone(freight);
  // Each ship alone can load its allotted cargo, but the overlay cannot.
  depleted.vessels.forEach(v => v.bundle.scenario.logistics!.ports.find(p => p.id === 'Anchor')!.cargo = 0.5);
  assert.throws(() => prepareSet(depleted), /Shared stock or berths exceeded/);
});

test('display interpolation does not anticipate cargo operations or impulses and remains disposable', () => {
  const v = run.vessels[0], transfer = v.ledger.find(e => e.kind === 'transfer')!, burn = v.bundle.program.burns[0];
  assert.equal(sampleVessel(v, transfer.t - 1e-8).logistics!.cargoMass, 0);
  assert.equal(sampleVessel(v, transfer.t).logistics!.cargoMass, 0.16);
  const runner = new Runner(v.bundle), before = sampleVessel(v, burn.t - 1e-9);
  assert.ok(error(before.y.slice(3), runner.sample(burn.t - 1e-9).y.slice(3)) < 1e-7);
  const sample = sampleVessel(v, 4); sample.y[0] = 999; sample.logistics!.ports[0].cargo = -99;
  assert.notEqual(sampleVessel(v, 4).y[0], 999);
  assert.ok(sampleVessel(v, 4).logistics!.ports[0].cargo >= 0);
  assert.throws(() => sampleVessel(v, -1), /Display epoch outside/);
  let positionError = 0;
  for (let t = 0.017; t < 64; t += 0.137) positionError = Math.max(positionError, error(sampleVessel(v, t).y.slice(0, 3), runner.sample(t).y.slice(0, 3)));
  assert.ok(positionError < 0.0003); // <0.15 px at 500 px/unit, excluding zoom magnification.
});

test('rotating frame includes omega cross r and transforms every epoch independently', () => {
  const anchor = run.vessels[0].bundle.scenario.logistics!.ports.find(p => p.id === 'Anchor')!;
  for (const t of [0, 1.7, 17, 63.2]) {
    assert.ok(error(transform(run, portState(anchor, t), t, 'rotating'), [anchor.rail.radius, 0, 0, 0, 0, 0]) < 1e-14);
    const y = sampleVessel(run.vessels[0], t).y;
    assert.ok(error(transform(run, y, t, run.vessels[0].name), [0, 0, 0, 0, 0, 0]) < 1e-14);
    assert.equal(error(transform(run, y, t, 'inertial'), y), 0);
  }
});

test('lunar rotating-frame loop closes in the current runner; view changes cannot mutate its program', () => {
  const r = prepareSet(lunar), v = r.vessels[0], original = JSON.stringify(v.bundle);
  const runner = new Runner(v.bundle), p = 2.7903664817016236;
  assert.ok(error(transform(r, runner.sample(p).y, p, 'rotating'), transform(r, runner.sample(0).y, 0, 'rotating')) < 1e-9);
  for (const frame of ['inertial', 'rotating', 'primary', 'moon', 'Lark']) transform(r, sampleVessel(v, 8).y, 8, frame);
  assert.equal(JSON.stringify(v.bundle), original);
  const moon = v.bundle.scenario.bodies.find(b => b.id === 'moon')!;
  assert.ok(error(transform(r, bodyState(moon, 4), 4, 'rotating'), [0.98, 0, 0, 0, 0, 0]) < 1e-14);
});
