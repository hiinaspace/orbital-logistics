import {Runner,type Sample,type EventBoundary} from '../sim/runner';
import {portState} from '../sim/logistics';
import {bodyState} from '../sim/dynamics';
import type {Bundle,ThrustArc} from '../sim/schema';
import {sampleVessel,type VesselView,type ViewerEvent} from '../model-set/model';
import {resourcesAt,type ResourceAnchor} from '../traffic/resources';
import type {FleetFrame,FleetEvent} from '../traffic/engine';
import {shootLunar,LunarPlanningFailure,type SteeringSeed} from './shoot';
import {LunarWorld,validateLunar,GRID,LUNAR_CALENDAR,type LunarDefinition,type DepotChunk} from './world';
export interface LunarMission {id:number;knownAt:number;start:number;end:number;bundle:Bundle;samples:Sample[];boundaries:EventBoundary[];ledger:ViewerEvent[];evaluations:number;nodes:number;bytes:number}
export interface LunarDelta {domain:'lunar-service-v1';frontier:number;oldest:number;current:FleetFrame;anchor:FleetFrame;chunks:DepotChunk[];missions:LunarMission[];events:FleetEvent[];resources:ResourceAnchor[];stats:Record<string,number>;halt?:string}
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const seedOf=(a:ThrustArc):SteeringSeed=>({start:a.start,duration:a.end-a.start,keys:a.steering!.keys.map(k=>k.direction)});
export class LunarEngine {
 readonly definition:LunarDefinition;readonly world:LunarWorld;
 frontier=0;oldest=0;initialized=false;halt?:string;
 missions:LunarMission[]=[];events:FleetEvent[]=[];resources:ResourceAnchor[]=[];
 #postedChunks=new Set<number>();#postedMissions=new Set<number>();#postedEvents=new Set<string>();
 #forecast:ResourceAnchor;#fuel:number;#used=0;#ready=0;#retry=0;#job?:Generator<void,LunarMission>;
 #ground!:Sample;#attemptWindow=0;#runner?:Runner;#runnerBytes=0;#runnerNodes=0;#preparationBytes=0;#preparationNodes=0;#delivered=new Set<number>();#seeds:SteeringSeed[];#goals:number[];#count=0;
 stats:Record<string,number>={voyages:0,delivered:0,planningFailures:0,evaluations:0,integrationStages:0};
 constructor(value:LunarDefinition){
  this.definition=validateLunar(value);this.world=new LunarWorld(this.definition);this.world.extend(1);
  const b=this.definition.source.vessels[0].bundle;
  this.#seeds=b.program.thrustArcs!.map(seedOf);this.#goals=b.program.thrustArcs!.map(a=>this.phase(a.start));
  this.#fuel=b.scenario.ship.propellant;this.#ground={t:0,y:portState(b.scenario.logistics!.ports[0],0),propellant:this.#fuel,fuelUsed:0,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:0,fuelUsed:0,ports:[],dockedPortId:'Northhaven'}};
  this.#forecast={t:0,stocks:this.definition.stations.map(s=>({id:s.id,cargo:s.cargo,propellant:s.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};
  this.resources.push(structuredClone(this.#forecast));
 }
 phase(t:number){const c=bodyState(this.definition.source.vessels[0].bundle.scenario.bodies[1],t),p=this.world.state(t);return wrap(Math.atan2(p[1]-c[1],p[0]-c[0])-t);}
 window(after:number,goal:number){
  const until=Math.min(LUNAR_CALENDAR,after+.45);this.world.extend(until);
  let previous=after,a=wrap(this.phase(previous)-goal);
  for(let t=after+1/512;t<=until;t+=1/512){const b=wrap(this.phase(t)-goal);if(a<=0&&b>=0&&b-a<.5){let lo=previous,hi=t;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(wrap(this.phase(mid)-goal)<0)lo=mid;else hi=mid;}return (lo+hi)/2;}previous=t;a=b;}
  throw new LunarPlanningFailure('No lunar phase window');
 }
 *plan():Generator<void,LunarMission>{
  const d=this.definition,original=d.source.vessels[0].bundle,epoch=Math.ceil(Math.max(this.#ready,this.#retry,0)/GRID)*GRID;
  if(epoch+1>LUNAR_CALENDAR)throw Error('Lunar calendar limit reached');
  this.world.extend(epoch+1);
  const s=structuredClone(original.scenario),ports=s.logistics!.ports,pad=ports[0],depot=ports[1],rail=depot.rail;
  if(rail.kind!=='ballistic')throw Error('depot');
  const initial=resourcesAt(this.#forecast,d.stations,epoch);s.epoch=epoch;s.duration=1;s.ship.state=portState(pad,epoch);s.ship.propellant=this.#fuel;s.ship.cargoMass=0;
  for(const p of ports){const stock=initial.stocks.find(a=>a.id===p.id)!;p.cargo=stock.cargo;p.propellant=stock.propellant;p.cargoCapacity=d.stations.find(a=>a.id===p.id)!.cargoCapacity;p.tankCapacity=d.stations.find(a=>a.id===p.id)!.tankCapacity;}
  rail.epoch=epoch;rail.validUntil=epoch+1;rail.state=this.world.state(epoch);rail.policy.maxNodes=16384;
  if(pad.cargo<.05||pad.propellant<6-this.#fuel)throw new LunarPlanningFailure('Waiting for Northhaven supplies');
  const bootstrap=this.#count===0&&epoch===0;
  const service=pad.serviceDuration,departure=bootstrap?this.#seeds[0].start:this.window(epoch+service+.0005,this.#goals[0])-.0005;
  this.#attemptWindow=departure;
  let ascent:ThrustArc,evaluations=0,nextSeeds:SteeringSeed[]=[];
  if(bootstrap){ascent=structuredClone(original.program.thrustArcs![0]);nextSeeds[0]=seedOf(ascent);}
  else {const shot=yield* shootLunar(s,departure,portState(pad,departure),t=>this.world.state(t),this.#seeds[0],false);ascent=shot.arc;evaluations+=shot.evaluations;this.stats.evaluations+=shot.evaluations;this.stats.integrationStages+=shot.stages;nextSeeds[0]=shot.seed;}
  const ops:NonNullable<Bundle['program']['operations']>=[
   {id:'at-pad',kind:'dock',t:epoch,portId:pad.id},
   {id:'load',kind:'transfer',t:epoch,portId:pad.id,cargo:.05,propellant:6-this.#fuel},
   {id:'launch',kind:'launch',t:departure,portId:pad.id,thrustArcId:'ascent'},
   {id:'arrival',kind:'dock',t:ascent.end,portId:depot.id},
   {id:'unload',kind:'transfer',t:ascent.end,portId:depot.id,cargo:-.05,propellant:0}];
  yield;
  let out:Runner|undefined=new Runner({scenario:s,program:{schemaVersion:4,id:'lunar-outbound',burns:[],thrustArcs:[ascent],operations:ops}});
  const arrival=out.advanceTo(ascent.end+service);this.#preparationBytes=out.treeStorageBytes();this.#preparationNodes=out.retainedTreeNodes;this.checkPhysical();if(!['running','horizon'].includes(arrival.status)||arrival.logistics?.dockedPortId!==depot.id)throw new LunarPlanningFailure('Outbound physical admission failed: '+arrival.status);
  const topup=Math.max(0,4-arrival.propellant);if(depot.propellant<topup)throw new LunarPlanningFailure('Waiting for Crescent fuel');
  const back=bootstrap?this.#seeds[1].start:this.window(ascent.end+2*service,this.#goals[1]);
  let descent:ThrustArc;
  if(bootstrap){descent=structuredClone(original.program.thrustArcs![1]);nextSeeds[1]=seedOf(descent);}
  else {const shot=yield* shootLunar(s,back,this.world.state(back),t=>portState(pad,t),this.#seeds[1],true);descent=shot.arc;evaluations+=shot.evaluations;this.stats.evaluations+=shot.evaluations;this.stats.integrationStages+=shot.stages;nextSeeds[1]=shot.seed;}
  out=undefined;this.#preparationBytes=0;this.#preparationNodes=0;
  const end=Math.ceil((descent.end+.02)/GRID)*GRID; s.duration=end-epoch;rail.validUntil=end;
  ops.push({id:'top-up',kind:'transfer',t:ascent.end+service,portId:depot.id,cargo:0,propellant:topup},
   {id:'depart',kind:'undock',t:back,portId:depot.id},{id:'land',kind:'land',t:descent.end,portId:pad.id});
  ascent.id='ascent-'+this.#count;descent.id='descent-'+this.#count;ops.find(o=>o.kind==='launch')!.thrustArcId=ascent.id;
  yield;
  const bundle:Bundle={scenario:s,program:{schemaVersion:4,id:'lunar-service-'+this.#count,burns:[],thrustArcs:[ascent,descent],operations:ops}},runner=new Runner(bundle),last=runner.advanceTo(end);
  if(last.status!=='horizon'||last.logistics?.dockedPortId!==pad.id||last.propellant<.1)throw new LunarPlanningFailure('Round-trip physical admission failed: '+last.status);
  this.world.assertLease(runner,epoch,end);
  const bytes=runner.treeStorageBytes();this.#preparationBytes=bytes;this.#preparationNodes=runner.retainedTreeNodes;this.checkPhysical();if(bytes>32_000_000||runner.retainedTreeNodes>65536)throw new LunarPlanningFailure('Lunar candidate physical budget exceeded');
  const times=[...new Set([epoch,end,...Array.from({length:Math.ceil((end-epoch)*4096)},(_,i)=>epoch+i/4096),...runner.ledger.map(e=>e.t),...bundle.program.thrustArcs!.flatMap(a=>Array.from({length:Math.ceil((a.end-a.start)*65536)+1},(_,i)=>a.start+(a.end-a.start)*i/Math.ceil((a.end-a.start)*65536)))])].sort((a,b)=>a-b);
  if(times.length>20000)throw Error('Lunar drawing occurrence budget exceeded');
  const used=this.#used,global=(at:Sample):Sample=>({...at,fuelUsed:used+at.fuelUsed!,logistics:{...at.logistics!,fuelUsed:used+at.fuelUsed!}});
  if(this.frontier>epoch)throw new LunarPlanningFailure('Planning window passed before admission');
  const mission:LunarMission={id:this.#count,knownAt:this.frontier,start:epoch,end,bundle:runner.bundle,samples:times.map(t=>global(runner.sample(t))),boundaries:runner.eventBoundaries.map(b=>({t:b.t,before:global(b.before),after:global(b.after)})),ledger:runner.ledger,evaluations,nodes:runner.retainedTreeNodes,bytes};
  // Future resource facts are immutable only after the whole occurrence passes.
  let anchor=initial;const nextResources:ResourceAnchor[]=[];
  for(const e of mission.ledger.filter(e=>e.kind==='transfer')){
   anchor=resourcesAt(anchor,d.stations,e.t);const stock=anchor.stocks.find(s=>s.id===e.portId)!;
   stock.cargo-=e.cargoAfter!-e.cargoBefore!;stock.propellant-=e.propellantAfter-e.propellantBefore;
   if(stock.cargo< -1e-10||stock.propellant< -1e-10||stock.cargo>d.stations.find(p=>p.id===stock.id)!.cargoCapacity+1e-10||stock.propellant>d.stations.find(p=>p.id===stock.id)!.tankCapacity+1e-10)throw Error('Lunar shared stock invariant');
   nextResources.push(structuredClone(anchor));
  }
  this.#forecast=resourcesAt(anchor,d.stations,end);this.resources.push(...nextResources);this.#count++;
  this.#preparationBytes=0;this.#preparationNodes=0;this.#runner=runner;this.#runnerBytes=bytes;this.#runnerNodes=runner.retainedTreeNodes;this.#seeds=nextSeeds;this.#ready=end;this.#fuel=last.propellant;this.#used+=last.fuelUsed!;
  return mission;
 }
 current(t=this.frontier):FleetFrame {
  const d=this.definition,b=d.source.vessels[0].bundle,known=this.missions.filter(m=>m.start<=t),m=known.at(-1),pad=b.scenario.logistics!.ports[0];
  let at:Sample;
  if(m&&t<=m.end){const v:VesselView={id:'Tern',name:'Tern',color:'#efb878',cargo:'Supplies',ship:m.bundle.scenario.ship,ports:m.bundle.scenario.logistics!.ports,cargoCapacity:.05,arcs:m.bundle.program.thrustArcs!,continuousFuel:true,portSamples:{Crescent:this.world.chunks.flatMap(c=>c.data.samples)},samples:m.samples,boundaries:m.boundaries,ledger:m.ledger};at=sampleVessel(v,t);}
  else {const last=m?.samples.at(-1)??this.#ground;at={...last,t,y:portState(pad,t),thrust:undefined};}
  return {t,ships:[{...at,activity:{kind:at.logistics?.dockedPortId?'waiting':'flying'}}]};
 }
 advanceTo(target:number,budget=16){
  if(this.halt)return;
  target=Math.min(LUNAR_CALENDAR,target);if(!Number.isFinite(target)||target<this.frontier||!Number.isInteger(budget)||budget<1||budget>256)throw Error('Invalid lunar advancement');
  // Planning boundaries are canonical simulation times, independent of request
  // size or worker slice budget. Hold that boundary while the job yields.
  if(!this.#job&&Math.ceil(Math.max(this.#ready,this.#retry)/GRID)*GRID+1>LUNAR_CALENDAR){this.world.extend(Math.min(LUNAR_CALENDAR,target+.1));this.frontier=target;this.prune();if(target===LUNAR_CALENDAR)this.halt='Lunar calendar limit reached';return;}
  const boundary=Math.max(0,this.#ready-.1,this.#retry);
  if(!this.#job&&target>=boundary){this.frontier=boundary;this.prune();this.#job=this.plan();}
  if(this.#job)for(let i=0;i<budget;i++){try{const at=this.#job.next();if(at.done){this.missions.push(at.value);this.#job=undefined;this.initialized=true;break;}}
   catch(e){this.#job=undefined;this.#preparationBytes=0;this.#preparationNodes=0;if(!(e instanceof LunarPlanningFailure)){this.halt=(e as Error).message;throw e;}
    this.stats.evaluations+=e.evaluations;this.stats.integrationStages+=e.stages;this.stats.planningFailures++;this.#retry=Math.max(this.frontier+.08,this.#ready,this.#attemptWindow+.01);this.events.push({t:this.frontier,kind:'planning-failed',id:'lunar-retry-'+this.stats.planningFailures,shipId:'Tern',deltaV:0,fuelUsed:0,propellantBefore:this.#fuel,propellantAfter:this.#fuel,detail:e.message});this.initialized=true;break;}}
  if(this.initialized&&!this.#job)this.frontier=Math.min(target,Math.max(0,this.#ready-.1,this.#retry));
  this.prune();
  if(this.frontier>=LUNAR_CALENDAR)this.halt='Lunar calendar limit reached';
 }
 private checkPhysical(){const bytes=this.world.bytes+this.#runnerBytes+this.#preparationBytes;this.stats.peakPhysicalBytes=Math.max(this.stats.peakPhysicalBytes??0,bytes);if(bytes>40_000_000)throw Error('Lunar preparation physical budget exceeded');}
 private prune(){
  // Fold completed facts before evicting their drawing history.
  for(const m of this.missions){
   if(m.end<Math.max(0,this.frontier-this.definition.historyDuration)&&m.end>this.#ground.t)this.#ground=structuredClone(m.samples.at(-1)!);
   if(m.ledger.some(e=>e.id==='unload'&&e.t<=this.frontier))this.#delivered.add(m.id);
  }
  this.oldest=Math.max(0,this.frontier-this.definition.historyDuration);
  this.missions=this.missions.filter(m=>m.end>=this.oldest);this.events=this.events.filter(e=>e.t>=this.oldest);let i=0;while(i+1<this.resources.length&&this.resources[i+1].t<=this.oldest)i++;this.resources=this.resources.slice(i);this.world.evict(this.oldest);
  if(this.#runner&&this.frontier>=this.#ready-.1){this.#runner=undefined;this.#runnerBytes=0;this.#runnerNodes=0;}
  this.stats.voyages=this.#count;this.stats.delivered=this.#delivered.size*.05;
  if(this.world.bytes+this.#runnerBytes>40_000_000||this.missions.reduce((n,m)=>n+m.samples.length,0)>60000)throw Error('Lunar retained storage budget exceeded');
 }
 delta():LunarDelta {
  const chunks=this.world.chunks.filter(c=>!this.#postedChunks.has(c.data.id)).map(c=>c.data),missions=this.missions.filter(m=>!this.#postedMissions.has(m.id)),events=this.events.filter(e=>!this.#postedEvents.has(e.id));
  chunks.forEach(c=>this.#postedChunks.add(c.id));missions.forEach(m=>this.#postedMissions.add(m.id));events.forEach(e=>this.#postedEvents.add(e.id));
  this.stats.runnerNodes=this.world.nodes+this.#runnerNodes+this.#preparationNodes;this.stats.physicalBytes=this.world.bytes+this.#runnerBytes+this.#preparationBytes;
  return {domain:'lunar-service-v1',frontier:this.frontier,oldest:this.oldest,current:this.current(),anchor:this.current(this.oldest),chunks,missions,events,resources:this.resources,stats:{...this.stats},halt:this.halt};
 }
}
