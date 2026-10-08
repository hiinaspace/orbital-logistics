// Offline set authoring: analytic Hohmann windows produce explicit paid burns.
// The viewer consumes the saved programs; it does not plan or insert maneuvers.
import {readFileSync, writeFileSync} from 'node:fs';
import {bodyState} from '../src/sim/dynamics';
import {compareOperations, MODEL, validateBundle, type Bundle, type Port, type Program, type Scenario} from '../src/sim/schema';
import {prepareSet, type ModelSet} from '../src/model-set/model';

const tau = 2 * Math.PI;
const mod = (x: number) => (x % tau + tau) % tau;
const ports: Port[] = [
  ['Kiln', 0.8, 0], ['Anchor', 1.15, 0], ['Crown', 1.6, 0], ['Farpoint', 2.05, 0],
].map(([id, radius]) => ({id: id as string, rail: {kind: 'circular', center: [0, 0, 0],u:[1,0,0],v:[0,1,0], radius: radius as number,
  rate: Math.sqrt(1 / (radius as number) ** 3), phase: 0}, cargo: 4, cargoCapacity: 12,
  propellant: 4, tankCapacity: 4, serviceDuration: 0.25}));
const anchor = ports[1];
const duration = (a: Port, b: Port) => Math.PI * ((a.rail.radius + b.rail.radius) / 2) ** 1.5;
for (const [i, departure] of [[0, 0.8], [2, 1.8], [3, 3.2]]) {
  const p = ports[i];
  p.rail.phase = mod((anchor.rail.rate - p.rail.rate) * departure + Math.PI - p.rail.rate * duration(anchor, p));
}
function window(a: Port, b: Port, earliest: number): number {
  const dn = a.rail.rate - b.rail.rate;
  const delta = b.rail.phase + b.rail.rate * duration(a, b) - a.rail.phase - Math.PI;
  return earliest + mod((delta - dn * earliest) * Math.sign(dn)) / Math.abs(dn);
}
function vessel(name: string, color: string, homeIndex: number, awayIndex: number, earliest: number) {
  const home = ports[homeIndex], away = ports[awayIndex], cargo = 0.16;
  const state = bodyState({id: home.id, mu: 0, radius: 0, rail: home.rail}, 0);
  const scenario: Scenario = {schemaVersion: 2, modelVersion: MODEL, id: 'orison-freight-v1',
    units: {length: 'reference orbital radius', time: 'inverse circular angular rate', mass: 'reference dry mass'},
    epoch: 0, duration: 64, policy: {step: 1 / 512, maxNodes: 65536, maxSubdivision: 16},
    bodies: [{id: 'Orison', mu: 1, radius: 0.28, rail: {kind: 'fixed', position: [0, 0, 0]}}],
    ship: {id: name, state, dryMass: 1, cargoMass: 0, propellant: 0.65, tankCapacity: 1, exhaustVelocity: 3},
    logistics: {modelVersion: 'kinematic-ports-v1', ports, cargoCapacity: 0.2,
      capture: {position: 1e-5, velocity: 1e-5},
      objective: {destinationId: away.id, quota: cargo, returnPortId: home.id, minPropellant: 0, hardwareCost: 1}}};
  const program: Program = {schemaVersion: 2, id: `${name}-service-v1`, burns: [],
    operations: [{id: 'initial-dock', t: 0, kind: 'dock', portId: home.id}]};
  let ready = earliest, trip = 0;
  function leg(a: Port, b: Port, t: number, prefix: string) {
    const ra = a.rail.radius, rb = b.rail.radius, axis = (ra + rb) / 2, arrival = t + duration(a, b);
    program.burns.push({id: `${prefix}-depart`, t, referenceBodyId: 'Orison', basis: 'radial-transverse-normal-v2',orientationAxis:[0,0,1],normal:0,
      radial: 0, transverse: Math.sqrt(2 / ra - 1 / axis) - Math.sqrt(1 / ra)},
    {id: `${prefix}-capture`, t: arrival, referenceBodyId: 'Orison', basis: 'radial-transverse-normal-v2',orientationAxis:[0,0,1],normal:0,
      radial: 0, transverse: Math.sqrt(1 / rb) - Math.sqrt(2 / rb - 1 / axis)});
    program.operations!.push({id: `${prefix}-undock`, kind: 'undock', t, portId: a.id},
      {id: `${prefix}-dock`, kind: 'dock', t: arrival, portId: b.id});
    return arrival;
  }
  while (true) {
    const departure = window(home, away, ready);
    const arrival = departure + duration(home, away);
    const back = window(away, home, arrival + 0.6), returned = back + duration(home, away);
    if (returned > 63) break; // Only admit complete round trips within the scene.
    const prefix = `voyage-${++trip}`;
    program.operations!.push({id: `${prefix}-load`, kind: 'transfer', t: departure - 0.3, portId: home.id, cargo, propellant: 0});
    leg(home, away, departure, `${prefix}-out`);
    program.operations!.push({id: `${prefix}-unload`, kind: 'transfer', t: arrival, portId: away.id, cargo: -cargo, propellant: 0.1});
    leg(away, home, back, `${prefix}-back`);
    ready = returned + 0.6;
  }
  program.operations!.sort(compareOperations);
  program.burns.sort((a, b) => a.t - b.t);
  if (!trip) throw new Error(`No round trip for ${name}`);
  return {name, color, cargo: 'Freight', bundle: validateBundle({scenario, program})};
}
const freight: ModelSet = {schemaVersion: 1, id: 'orison-freight', name: 'Orison · orbital freight', extent: 2.6,
  description: 'Four orbital stations. Four reusable freighters. Prepared Hohmann services with finite freight and fuel stocks.',
  provenance: 'Fictional normalized system; fixed primary and circular test ports. Spacecraft follow integrated impulsive trajectories. No mutual gravity, manufacturing, or ground launches. Shared inventories and multi-berth occupancy checked before viewing.',
  rotating: {name: 'Anchor rotating', rate: anchor.rail.rate, phase: anchor.rail.phase},
  stations: [{id: 'Kiln', role: 'Fabrication ring', berths: 4}, {id: 'Anchor', role: 'Freight hub', berths: 4},
    {id: 'Crown', role: 'Habitat', berths: 4}, {id: 'Farpoint', role: 'Survey station', berths: 4}],
  vessels: [vessel('Kestrel', '#efb878', 1, 0, 0.6), vessel('Tern', '#78c9c0', 1, 2, 1.6),
    vessel('Petrel', '#a6a4e8', 1, 3, 3), vessel('Swift', '#dc91b3', 2, 1, 0.6)]};
const droBundle: Bundle = validateBundle(JSON.parse(readFileSync('fixtures/m0-binary.json', 'utf8')));
droBundle.scenario.duration = 24; droBundle.scenario.policy.maxNodes = 65536;
droBundle.scenario.ship.id = 'Lark';
droBundle.scenario.ship.state = [1.18, 0, 0, 0, 0.6158221495873256, 0];
droBundle.program = {schemaVersion: 2, id: 'lark-dro-v1', burns: []};
const lunar: ModelSet = {schemaVersion: 1, id: 'lunar-loop', name: 'Selene · lunar loop', extent: 1.65,
  description: 'A distant retrograde orbit in a circular planet–moon system.',
  provenance: 'Synthetic planar restricted three-body system, moon mass fraction 0.02. Prepared DRO from independent SciPy shooting, checked in the canonical Runner. Not an exact Earth–Moon mission; no insertion or stationkeeping modeled.',
  rotating: {name: 'Planet–moon rotating', rate: 1, phase: 0}, stations: [],
  vessels: [{name: 'Lark', color: '#efb878', cargo: 'Instruments', bundle: validateBundle(droBundle)}]};
for (const set of [freight, lunar]) {
  const run = prepareSet(set);
  if(!process.argv.includes('--check'))writeFileSync(`fixtures/model-sets/${set.id}.json`, JSON.stringify(set, null, 2) + '\n');
  console.log(set.id, run.vessels.map(v => ({name: v.name, burns: v.ledger.filter(e => e.kind === 'burn').length,
    deliveries: v.ledger.filter(e => e.kind === 'transfer' && e.cargoAfter! < e.cargoBefore!).length})));
}
