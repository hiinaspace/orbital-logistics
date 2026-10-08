// Prepared finite services generated from independently witnessed binary shooting.
import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {compareOperations,validateBundle,type Bundle,type Port,type BallisticRail} from '../src/sim/schema';
import {prepareSet,type ModelSet} from '../src/model-set/model';
const input=JSON.parse(readFileSync('docs/design/lunar-freight/input.json','utf8'));
const trips=JSON.parse(readFileSync('docs/design/lunar-freight/return-report.json','utf8')).trips;
if(trips.length!==3)throw new Error('Three complete return witnesses required');
const target=validateBundle(input.target),policy={...target.scenario.policy,step:1/4096};
const port=(id:string,state:BallisticRail['state'],cargo:number,provenance:string):Port=>({id,
  rail:{kind:'ballistic',epoch:0,validUntil:12,state,policy,minClearance:.03,provenance},cargo,cargoCapacity:6,propellant:4,tankCapacity:6,serviceDuration:.25});
const meridian=trips.find((t:any)=>t.outbound.summary.phase===0).outbound.bundle.scenario.ship.state;
const nightfall=trips.find((t:any)=>t.outbound.summary.phase===Math.PI).outbound.bundle.scenario.ship.state;
const ports=[port('Meridian',meridian,2,'Ballistic planet-orbit depot, osculating radius0.5 at epoch0'),
  port('Nightfall',nightfall,2,'Opposite-phase ballistic planet-orbit depot, epoch0'),
  port('Selene Hub',target.scenario.ship.state,0,'Independently witnessed burn-free distant retrograde orbit')];
const names=['Wren','Ibis','Plover'],colors=['#efb878','#78c9c0','#a6a4e8'];
const vessels=trips.map((trip:any,i:number)=>{
  const b:Bundle=validateBundle(trip.outbound.bundle),home=trip.outbound.summary.phase===0?'Meridian':'Nightfall',away='Selene Hub';
  b.scenario.policy={...policy};b.scenario.id='selene-freight-v2';b.scenario.ship.id=names[i];b.scenario.ship.cargoMass=0;
  b.scenario.logistics={modelVersion:'ballistic-ports-v2',ports,cargoCapacity:.2,capture:{position:1e-5,velocity:1e-5},
    objective:{destinationId:away,quota:.16,returnPortId:home,minPropellant:.05,hardwareCost:1}};
  const departure=b.program.burns[0].t,arrival=b.program.burns[1].t;
  b.program.operations=[{id:'initial-dock',kind:'dock',portId:home,t:0},
    {id:'load',kind:'transfer',portId:home,t:0,cargo:.16,propellant:0},
    {id:'leave-home',kind:'undock',portId:home,t:departure},
    {id:'dock-selene',kind:'dock',portId:away,t:arrival},
    {id:'unload-refuel',kind:'transfer',portId:away,t:arrival,cargo:-.16,propellant:0}];
  const prefix=new Runner(b).advanceTo(arrival),fuelToLoad=.85-prefix.propellant;
  if(prefix.status!=='running' || fuelToLoad<=0)throw new Error('Outbound logistics prefix failed');
  (b.program.operations[4] as any).propellant=fuelToLoad;
  const back=trip.return;
  b.program.burns.push({id:'return-departure',t:back.departure,referenceBodyId:'moon',basis:'inertial-cartesian-v2',deltaVelocity:back.departureDv},
    {id:'return-capture',t:back.arrival,referenceBodyId:'primary',basis:'inertial-cartesian-v2',deltaVelocity:back.arrivalDv});
  b.program.operations.push({id:'leave-selene',kind:'undock',portId:away,t:back.departure},{id:'return-home',kind:'dock',portId:home,t:back.arrival});
  b.program.operations.sort(compareOperations);b.program.id=`${names[i]}-lunar-service-v2`;
  return {name:names[i],color:colors[i],cargo:'Supplies',bundle:validateBundle(b)};
});
const set:ModelSet={schemaVersion:1,id:'selene-freight',name:'Selene · lunar freight',extent:1.75,
  description:'Three freighters connect two planet-orbit depots with a distant retrograde lunar depot.',
  provenance:'Fictional circular binary, moon mass fraction0.02. Burn-free ballistic depots; independently solved paid round trips, finite supplies and refueling stocks. Finite12-unit scene; no ground launches or maintained station orbits.',
  rotating:{name:'Planet–moon rotating',rate:1,phase:0},stations:[{id:'Meridian',role:'Planet-orbit supply depot',berths:3},
    {id:'Nightfall',role:'Planet-orbit supply depot',berths:3},{id:'Selene Hub',role:'Distant retrograde freight depot',berths:3}],vessels};
const run=prepareSet(set);
writeFileSync('fixtures/model-sets/selene-freight.json',JSON.stringify(set,null,2)+'\n');
console.log(run.vessels.map(v=>({name:v.name,delivered:v.ledger.filter(e=>e.kind==='transfer' && e.cargoAfter!<e.cargoBefore!).length,
  return:v.ledger.find(e=>e.id==='return-home')!.t,fuel:v.samples.at(-1)!.propellant})));
