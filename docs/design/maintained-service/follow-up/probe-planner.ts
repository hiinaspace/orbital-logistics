import {Runner} from '../../../../src/sim/runner';
import type {Bundle,Scenario,State,ThrustArc} from '../../../../src/sim/schema';
import {MaintainedWorld,type MaintainedDefinition} from '../../../../src/maintained/world';
import {shootForcesJob,PlanningFailure} from '../../../../src/maintained/shoot';
import {transferSeed} from '../../../../src/maintained/seed';
export interface Pair {
 id:string;departure:number;arrival:number;knownAt:number;bundle:Bundle;runner:Runner;evaluations:number;
 leaseChunks:number[];capturePosition:number;captureVelocity:number;
}
export function* planPairJob(d:MaintainedDefinition,world:MaintainedWorld,departure:number,knownAt:number,fuel:number,ordinal:number,budget=96):Generator<void,Pair> {
 const ship=d.world.scenario.ship,arcs:ThrustArc[]=[];let remaining=fuel,evaluations=0;
 for(const [start,from,to] of [[departure,d.origin.id,d.relay.id],[departure+16,d.relay.id,d.origin.id]] as const) {
  const duration=from===d.origin.id?14:38; const y=world.sample(from,start).y,target=world.sample(to,start+duration).y;
  const s:Scenario={...structuredClone(d.world.scenario),epoch:start,duration,ship:{...structuredClone(ship),state:y,propellant:remaining}};
  const mass=ship.dryMass+ship.cargoMass+remaining, r0=Math.hypot(y[0],y[1]),r1=Math.hypot(target[0],target[1]),a=(r0+r1)/2,v0=Math.sqrt(2/r0-1/a),v1=Math.sqrt(2/r1-1/a);const seed=from===d.origin.id?transferSeed(y,target,duration,mass):[(-y[1]/r0*v0-y[3])*mass/1.6,(y[0]/r0*v0-y[4])*mass/1.6,0,(target[3]+target[1]/r1*v1)*mass/1.8,(target[4]-target[0]/r1*v1)*mass/1.8,0],shot=yield* shootForcesJob(s,[{start,end:start+1.6},{start:start+duration-1.8,end:start+duration}],target,seed,budget);
  remaining=shot.runner.sample(start+duration).propellant;evaluations+=shot.evaluations;
  arcs.push(...shot.arcs.map((a,i)=>({...a,id:`trip-${ordinal}-${start}-${i}`})));
  if(from===d.origin.id) {
   yield;
   const prefix=new Runner({scenario:{...s,duration:16,logistics:{modelVersion:'powered-ports-v4',ports:world.ports(start,start+16),cargoCapacity:.1,capture:{position:1e-7,velocity:1e-7},objective:{destinationId:d.relay.id,quota:.05,returnPortId:d.origin.id,minPropellant:.05,hardwareCost:0}}},program:{schemaVersion:3,id:'paid-outbound-prefix',burns:[],thrustArcs:arcs,operations:[{id:'relay-capture',t:start+duration,kind:'dock',portId:d.relay.id},{id:'relay-release',t:start+16,kind:'undock',portId:d.relay.id}]}});
   const release=prefix.advanceTo(start+16);if(release.status!=='horizon'||release.logistics?.dockedPortId)throw new PlanningFailure('Outbound capture/release prefix failed');
   remaining=release.propellant;
  }
 }
 const ports=world.ports(departure,departure+56),id=`Tern:${ordinal}`,s:Scenario={...structuredClone(d.world.scenario),epoch:departure,duration:56,ship:{...structuredClone(ship),state:world.sample(d.origin.id,departure).y,propellant:fuel},logistics:{modelVersion:'powered-ports-v4',ports,cargoCapacity:.1,capture:{position:1e-7,velocity:1e-7},objective:{destinationId:d.relay.id,quota:.05,returnPortId:d.origin.id,minPropellant:.05,hardwareCost:0}}};
 const bundle:Bundle={scenario:s,program:{schemaVersion:3,id,burns:[],thrustArcs:arcs,operations:[{id:`${id}:relay`,t:departure+14,kind:'dock',portId:d.relay.id},{id:`${id}:release`,t:departure+16,kind:'undock',portId:d.relay.id},{id:`${id}:home`,t:departure+54,kind:'dock',portId:d.origin.id}]}};
 yield;
 const runner=new Runner(bundle),end=runner.advanceTo(departure+56),captures=runner.ledger.filter(e=>e.kind==='dock');
 if(end.status!=='horizon'||end.propellant<.05||captures.length!==2||captures.some(e=>e.positionError!+1e-8>=1e-7||e.deltaV+1e-8>=1e-7))throw new PlanningFailure(`Round-trip paid capture/reserve admission failed: ${end.status} ${end.detail}; ${JSON.stringify(captures)}`);
 // The lease contains canonical physical definitions, not sampled drawing paths.
 // Check every canonical grid point and all control/event boundaries before release.
 const times=[...new Set([...Array.from({length:56*256+1},(_,i)=>departure+i/256),...runner.portBoundaries(d.relay.id).map(b=>b.t)])];
 for(const id of [d.origin.id,d.relay.id])for(const t of times){const at=runner.portSample(id,t),owned=world.sample(id,t);if(Math.hypot(...at.y.map((x,i)=>x-owned.y[i]))>1e-10||Math.abs(at.propellant-owned.propellant)>1e-12)throw new PlanningFailure('Canonical target lease identity mismatch');}
 return {id,departure,arrival:departure+54,knownAt,bundle:runner.bundle,runner,evaluations,leaseChunks:world.chunks.filter(c=>c.data.end>departure&&c.data.start<departure+56).map(c=>c.data.id),capturePosition:Math.max(...captures.map(e=>e.positionError!)),captureVelocity:Math.max(...captures.map(e=>e.deltaV))};
}

export function planPair(...args:Parameters<typeof planPairJob>):Pair {const job=planPairJob(...args);let result=job.next();while(!result.done)result=job.next();return result.value;}
