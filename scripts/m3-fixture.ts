// Offline fixture authoring from analytic circular/Hohmann geometry. The app
// always replays these authored burns through its integrated simulation.
import { readFileSync, writeFileSync } from 'node:fs';
import { validateBundle, type Bundle, type Burn, type Operation } from '../src/sim/schema';
import { Runner } from '../src/sim/runner';
import { logisticsResult } from '../src/sim/logistics';
const b: Bundle = validateBundle(JSON.parse(readFileSync('fixtures/m1-orbit.json', 'utf8')));
const h = Math.PI * 1.2 ** 1.5, rate = Math.sqrt(1 / 1.4 ** 3), departure = 0.5, arrival = departure + h;
const wait = (4 * Math.PI - 2 * h) / (1 - rate), back = arrival + wait, home = back + h;
const phase = departure + Math.PI - rate * arrival;
b.scenario.id = 'm3-delivery-v1'; b.scenario.duration = 24; b.scenario.policy.maxNodes = 65536;
b.scenario.ship.cargoMass = 0; b.scenario.ship.propellant = 0.2; b.scenario.ship.tankCapacity = 0.6;
b.scenario.logistics = {modelVersion: 'kinematic-ports-v1', cargoCapacity: 0.2, capture: {position: 1e-5, velocity: 1e-5},
  ports: [{id: 'Home', rail: {kind: 'circular', center: [0,0], radius: 1, rate: 1, phase: 0}, cargo: 1, cargoCapacity: 1, propellant: 0.4, tankCapacity: 0.4, serviceDuration: 0.25},
    {id: 'Depot', rail: {kind: 'circular', center: [0,0], radius: 1.4, rate, phase}, cargo: 0, cargoCapacity: 1, propellant: 0.25, tankCapacity: 0.25, serviceDuration: 0.25}],
  objective: {destinationId: 'Depot', quota: 0.2, returnPortId: 'Home', minPropellant: 0.15, hardwareCost: 1}};
const dv1 = Math.sqrt(7/6)-1, dv2 = Math.sqrt(1/1.4)-Math.sqrt(2/1.4-1/1.2);
const burn = (id: string, t: number, transverse: number): Burn => ({id, t, transverse, radial: 0, referenceBodyId: 'primary', basis: 'radial-transverse-ccw-v1'});
const dock = (id: string, t: number, portId: string, kind: 'dock'|'undock' = 'dock'): Operation => ({id, t, portId, kind});
b.program = {schemaVersion: 1, id: 'm3-round-trip-v1', burns: [burn('outbound', departure, dv1), burn('arrival', arrival, dv2), burn('return', back, -dv2), burn('home-arrival', home, -dv1)],
  operations: [dock('dock-home',0,'Home'), {id:'load',t:0,portId:'Home',kind:'transfer',cargo:0.2,propellant:0}, dock('leave-home',departure,'Home','undock'),
    dock('dock-depot',arrival,'Depot'), {id:'unload-refuel',t:arrival,portId:'Depot',kind:'transfer',cargo:-0.2,propellant:0.1}, dock('leave-depot',back,'Depot','undock'), dock('return-home',home,'Home')]};
const valid = validateBundle(b), runner = new Runner(valid), end = runner.advanceTo(24);
console.log({arrival, back, home, terminal: end.status, detail: end.detail, result: logisticsResult(valid.scenario.logistics!, end.logistics!, end.propellant)});
if (end.status !== 'horizon') throw new Error(end.detail);
writeFileSync('fixtures/m3-round-trip.json', JSON.stringify(valid, null, 2)+'\n');
valid.program.burns = valid.program.burns.slice(0,2); valid.program.operations = valid.program.operations!.slice(0,5);
valid.program.id = 'm3-outbound-v1';
writeFileSync('fixtures/m3-delivery.json', JSON.stringify(valid, null, 2)+'\n');
