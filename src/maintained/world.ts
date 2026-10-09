import {Runner,type Sample,type EventBoundary} from '../sim/runner';
import {validateBundle,type Bundle,type Scenario,type State,type Port,type ThrustArc} from '../sim/schema';
import {orbitError,type Station,type ViewSample,type ViewerEvent} from '../model-set/model';
import {shootForcesJob,PlanningFailure} from './shoot';
import type {Depot} from '../traffic/resources';

export interface MaintainedDefinition {
 schemaVersion:1;domain:'maintained-relay-v1';id:string;name:string;description:string;provenance:string;extent:number;
 world:Bundle;reference:NonNullable<Station['maintenance']>['reference'];
 origin:{id:string;state:State};relay:{id:string;ship:Scenario['ship']};
 vessels:{id:string;name:string;color:string;cargo:string}[];stations:Depot[];
 rotating:{name:string;rate:number;phase:number};historyDuration:128;forecastDuration:40;
}
export interface ControlCheck {t:number;outcome:'skip'|'correct'|'failed';before:number[];after?:number[];evaluations:number;detail?:string}
export interface WorldChunk {
 id:number;start:number;end:number;knownAt:number;check:ControlCheck;
 station:ViewSample[];origin:{t:number;y:State}[];baseline:{t:number;y:State}[];
 arcs:ThrustArc[];ledger:ViewerEvent[];boundaries:EventBoundary[];
}
interface PhysicalChunk {data:WorldChunk;station:Runner;origin:Runner;baseline:Runner;usedBefore:number}
const copy=<T>(x:T):T=>structuredClone(x);
export const isMaintained=(d:{domain?:string}):d is MaintainedDefinition=>d.domain==='maintained-relay-v1';
export function validateMaintained(value:MaintainedDefinition):MaintainedDefinition {
 const d=copy(value),s=validateBundle(d.world).scenario;
 if(d.schemaVersion!==1 || d.domain!=='maintained-relay-v1' || !d.id || !d.name || d.historyDuration!==128 || d.forecastDuration!==40 || d.vessels.length!==1 || d.stations.length!==2 || s.epoch!==0 || s.logistics || s.policy.step!==1/256 || s.bodies.length!==2 || d.origin.id===d.relay.id || d.vessels[0].id!==s.ship.id || !Number.isFinite(d.extent) || d.extent<=0 || ![d.rotating.rate,d.rotating.phase].every(Number.isFinite))throw Error('Unsupported maintained service domain');
 for(const ship of [s.ship,d.relay.ship])if(!ship.engine || ship.propellant<=0 || ship.cargoMass<0)throw Error('Maintained service requires finite propulsion');
 d.relay.ship=validateBundle({scenario:{...s,ship:d.relay.ship},program:{schemaVersion:3,id:'relay-validation',burns:[]}}).scenario.ship;
 validateBundle({scenario:{...s,ship:{...s.ship,state:d.origin.state}},program:{schemaVersion:3,id:'origin-validation',burns:[]}});
 validateBundle({scenario:{...s,bodies:[{id:'reference',mu:1,radius:.001,rail:d.reference}]},program:{schemaVersion:3,id:'reference-validation',burns:[]}});
 const primary=s.bodies[0],perturber=s.bodies[1],r=perturber.rail;
 const same=(a:number[],b:number[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 if(primary.mu!==1||primary.radius!==1||primary.rail.kind!=='fixed'||!same(primary.rail.position,[0,0,0])||perturber.mu!==.004||perturber.radius!==.12||r.kind!=='circular'||r.radius!==6||!same(r.center,[0,0,0])||!same(r.u,[1,0,0])||!same(r.v,[0,1,0])||Math.abs(r.rate-Math.sqrt(1.004/216))>1e-15)throw Error('Unsupported maintained gravity field');
 if(d.reference.radius!==3 || Math.abs(d.reference.rate-Math.sqrt(1/27))>1e-15 || !same(d.reference.center,[0,0,0]) || !same(d.reference.u,[1,0,0]) || !same(d.reference.v,[0,1,0]) || d.relay.ship.dryMass!==4 || d.relay.ship.cargoMass!==0 || d.relay.ship.exhaustVelocity!==3 || d.relay.ship.engine!.maxThrust!==.06 || d.relay.ship.engine!.maxAcceleration!==.012 || s.ship.dryMass!==1 || s.ship.cargoMass!==.05 || s.ship.exhaustVelocity!==3 || s.ship.engine!.maxThrust!==.8 || s.ship.engine!.maxAcceleration!==.4)throw Error('Unsupported maintained orbit/hardware');
 if(!d.origin.id||d.relay.ship.id!==d.relay.id||new Set([d.origin.id,d.relay.id,s.ship.id,...s.bodies.map(b=>b.id)]).size!==5||![s.ship.state,d.origin.state,d.relay.ship.state].every(y=>y[2]===0&&y[5]===0)||!same(s.ship.state,d.origin.state))throw Error('Unsupported maintained identities/initial states');
 if(d.stations.some(p=>![d.origin.id,d.relay.id].includes(p.id)||p.berths!==1||p.cargo!==0||p.cargoCapacity!==0||p.cargoRate!==0||![p.propellantRate,p.propellant,p.tankCapacity].every(Number.isFinite)||p.propellantRate<0||p.tankCapacity<0||p.propellant<0||p.propellant>p.tankCapacity) || new Set(d.stations.map(p=>p.id)).size!==2 || d.stations.some(p=>p.id===d.relay.id && (p.propellant!==0||p.tankCapacity!==0||p.propellantRate!==0)))throw Error('Invalid maintained service inventories');
 d.world={scenario:s,program:{schemaVersion:3,id:'live-field',burns:[]}};return d;
}
export class MaintainedWorld {
 chunks:PhysicalChunk[]=[];end=0;used=0;checks=0;corrected=0;skipped=0;failed=0;evaluations=0;
 #station:Sample;#origin:State;#baseline:State;
 constructor(readonly definition:MaintainedDefinition,readonly controlBudget=64){const d=definition;this.#station={t:0,y:copy(d.relay.ship.state),propellant:d.relay.ship.propellant,burnCursor:0,status:'running',detail:''};this.#origin=copy(d.origin.state);this.#baseline=copy(d.relay.ship.state);}
 scenario(epoch:number,duration:number,state:State,fuel:number,relay=true):Scenario {
  const s=copy(this.definition.world.scenario);s.epoch=epoch;s.duration=duration;delete s.logistics;
  s.bodies.forEach(b=>b.radius+=.2);s.ship=relay?{...copy(this.definition.relay.ship),state:copy(state),propellant:fuel}:{id:this.definition.origin.id,state:copy(state),dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};return s;
 }
 *extend(through:number,knownAt:number):Generator<void,void> {
  if(!Number.isFinite(through)||through>10000+40||knownAt<0)throw Error('Maintained calendar domain exhausted');
  while(this.end<through){
   yield;
   const t=this.end,s=this.scenario(t,8,this.#station.y,this.#station.propellant),error=orbitError(s.ship.state,this.definition.reference),before=[error.position,error.velocity];
   const coast=new Runner({scenario:s,program:{schemaVersion:3,id:`coast-${t}`,burns:[]}});
   let runner=coast,arcs:ThrustArc[]=[],check:ControlCheck={t,outcome:'skip',before,evaluations:0};
   if(before[0]>.001 || before[1]>.0003) {
    try {
     const p=coast.sample(t+4).y,r=this.definition.reference,a=Math.atan2(p[1],p[0]),c=Math.cos(a),sn=Math.sin(a),target=[r.radius*c,r.radius*sn,0,-r.radius*r.rate*sn,r.radius*r.rate*c,0] as State;
     const shot=yield* shootForcesJob({...s,duration:4},[{start:t,end:t+1.9},{start:t+2.1,end:t+4}],target,undefined,this.controlBudget);
     arcs=shot.arcs.map((a,i)=>({...a,id:`maintain-${t}-${i}`}));runner=new Runner({scenario:s,program:{schemaVersion:3,id:`maintenance-${t}`,burns:[],thrustArcs:arcs}});
     const end=runner.sample(t+8),at=orbitError(runner.sample(t+4).y,r);
     if(end.status!=='horizon'||end.propellant<.1 || at.position>Math.max(.001,before[0]) || at.velocity>Math.max(.0003,before[1]))throw new PlanningFailure('Maintenance improvement/reserve gate failed',shot.evaluations);
     check={t,outcome:'correct',before,after:[at.position,at.velocity],evaluations:shot.evaluations};
    }catch(error){if(!(error instanceof PlanningFailure))throw error;runner=coast;arcs=[];check={t,outcome:'failed',before,evaluations:error.evaluations,detail:error.message};}
   }
   const origin=new Runner({scenario:this.scenario(t,8,this.#origin,0,false),program:{schemaVersion:3,id:`origin-${t}`,burns:[]}}),baseline=new Runner({scenario:this.scenario(t,8,this.#baseline,this.definition.relay.ship.propellant),program:{schemaVersion:3,id:`baseline-${t}`,burns:[]}});
   for(const r of [runner,origin,baseline]){yield;const end=r.advanceTo(t+8);if(end.status!=='horizon'||end.t!==t+8)throw Error(`Maintained world physical failure: ${end.status} at ${end.t}`);}
   const usedBefore=this.used,stationSample=(at:number):ViewSample=>{const p=runner.sample(at);return {...p,fuelUsed:usedBefore+(p.fuelUsed??0)};};
   const times=[...new Set([...Array.from({length:257},(_,i)=>t+i/32),...runner.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
   const ledger:ViewerEvent[]=runner.ledger;
   if(check.outcome==='failed')ledger.push({t,kind:'planning-failed',id:`maintenance-failed-${t}`,deltaV:0,fuelUsed:0,propellantBefore:s.ship.propellant,propellantAfter:s.ship.propellant,detail:check.detail});
   const data:WorldChunk={id:t/8,start:t,end:t+8,knownAt,check,station:times.map(stationSample),origin:times.map(at=>({t:at,y:origin.sample(at).y})),baseline:times.map(at=>({t:at,y:baseline.sample(at).y})),arcs,ledger,boundaries:runner.eventBoundaries.map(b=>({t:b.t,before:{...b.before,fuelUsed:usedBefore+(b.before.fuelUsed??0)},after:{...b.after,fuelUsed:usedBefore+(b.after.fuelUsed??0)}}))};
   this.chunks.push({data,station:runner,origin,baseline,usedBefore});this.used=usedBefore+(runner.sample(t+8).fuelUsed??0);this.#station=runner.sample(t+8);this.#origin=origin.sample(t+8).y;this.#baseline=baseline.sample(t+8).y;this.end=t+8;
   this.checks++;this.evaluations+=check.evaluations;if(check.outcome==='correct')this.corrected++;else if(check.outcome==='skip')this.skipped++;else this.failed++;
  }
 }
 ensure(through:number,knownAt:number){const job=this.extend(through,knownAt);while(!job.next().done){} }
 sample(id:string,t:number):Sample {
  if(![this.definition.origin.id,this.definition.relay.id].includes(id))throw Error('Unknown maintained target');
  const chunk=this.chunks.find(c=>c.data.start<=t&&c.data.end>t)??[...this.chunks].reverse().find(c=>c.data.end===t);if(!chunk)throw Error('No valid canonical maintained target at requested epoch');
  const sample=(id===this.definition.relay.id?chunk.station:chunk.origin).sample(t);if(sample.t!==t||!['running','horizon'].includes(sample.status))throw Error('Invalid maintained target epoch/status');
  return {...sample,fuelUsed:id===this.definition.relay.id?chunk.usedBefore+(sample.fuelUsed??0):0};
 }
 ports(start:number,end:number):Port[] {
  if(start%8!==6||end%8!==6)throw Error('Target lease must start/end in a quiet window');
  const d=this.definition,s=this.sample(d.relay.id,start),common={epoch:start,validUntil:end,policy:copy(d.world.scenario.policy),minClearance:.2,provenance:`Committed online target lease ${start}–${end}; immutable canonical chunk chain.`},arcs=this.chunks.flatMap(c=>c.data.arcs).filter(a=>a.start>=start&&a.end<=end);
  const base={cargo:0,cargoCapacity:0,propellant:0,tankCapacity:0,serviceDuration:.25};
  return [{...base,id:d.origin.id,rail:{...common,kind:'ballistic',state:this.sample(d.origin.id,start).y}},{...base,id:d.relay.id,rail:{...common,kind:'powered',state:s.y,propulsion:{dryMass:d.relay.ship.dryMass,propellant:s.propellant,tankCapacity:d.relay.ship.tankCapacity,exhaustVelocity:d.relay.ship.exhaustVelocity,engine:copy(d.relay.ship.engine!)},minPropellant:0,program:{schemaVersion:3,id:`station-lease-${start}`,burns:[],thrustArcs:arcs}}}];
 }
 evict(oldest:number){this.chunks=this.chunks.filter(c=>c.data.end>=oldest);if(this.chunks.length>15)throw Error('Retained maintained chunk budget exceeded');}
 get nodes(){return this.chunks.reduce((n,c)=>n+c.station.retainedNodes+c.origin.retainedNodes+c.baseline.retainedNodes,0);}
}
