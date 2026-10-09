import type {Runner,EventBoundary} from '../sim/runner';
import type {ViewSample,ViewerEvent} from '../model-set/model';
import type {FleetFrame,FleetEvent,FleetBoundary} from '../traffic/engine';
import {resourcesAt,type ResourceAnchor} from '../traffic/resources';
import type {WorldChunk} from '../maintained/world';
import {PlanningFailure} from '../maintained/shoot';
import {AdaptiveWorld,type AdaptiveDefinition} from '../adaptive/world';
import {CoupledTrip} from '../adaptive/plan';
import {planServiceJob,serviceWork} from '../adaptive/planner';
import type {AdaptiveVisit,AdaptiveDelta,AdaptiveHooks} from '../adaptive/engine';
import {validateNetwork,networkDepots,type NetworkDefinition} from './model';
import {OriginIntervals} from './origin';
const copy=<T>(v:T):T=>structuredClone(v);
interface Lane {
 definition:AdaptiveDefinition;world:AdaptiveWorld;fuel:number;used:number;stage:'waiting'|'planned'|'flying'|'service'|'fault';
 serviceEnd:number;reason?:string;trip?:CoupledTrip;fact:number;ordinal:number;pairUsed:number;fault?:ViewSample;stationFault?:ViewSample;
 frames:FleetFrame[];boundaries:FleetBoundary[];events:FleetEvent[];visits:AdaptiveVisit[];chunks:WorldChunk[];
 stats:Record<string,number>;
}
export interface Reservation {stationId:string;shipId:string;tripId:string;capture:number;release:number;forecastIdentity:string}
export interface NetworkDelta {
 domain:'maintained-network-v1';frontier:number;oldest:number;lanes:(AdaptiveDelta&{ownerId:string;visitorId:string})[];resources:ResourceAnchor[];
 reservations:Reservation[];stats:Record<string,number>;halt?:string;
}
export interface NetworkHooks {failures?:Record<string,AdaptiveHooks['failAt']>;cache?:boolean}
interface Transaction {lanes:Lane[];anchor:ResourceAnchor;resources:ResourceAnchor[];control:boolean;t:number}
export class NetworkEngine {
 readonly definition:NetworkDefinition;readonly depots;readonly originIntervals:OriginIntervals;
 frontier=0;oldest=0;initialized=false;halt?:string;
 #lanes:Lane[];#anchor:ResourceAnchor;#resources:ResourceAnchor[];#grid=1;#control=0;#job?:Generator<void,Transaction>;
 #maxNodes=0;#maxRetained=0;#peakTransactionLanes=0;
 constructor(value:NetworkDefinition,readonly hooks:NetworkHooks={}){
  this.definition=validateNetwork(value);this.depots=networkDepots(this.definition);this.originIntervals=new OriginIntervals(hooks.cache!==false);
  this.#lanes=this.definition.lanes.map(d=>({definition:d,world:new AdaptiveWorld(d,undefined,undefined,this.originIntervals),fuel:d.world.scenario.ship.propellant,used:0,stage:'waiting',serviceEnd:Infinity,fact:0,ordinal:0,pairUsed:0,frames:[],boundaries:[],events:[],visits:[],chunks:[],stats:{completed:0,planningFailed:0,fuelDelivered:0,maxVisitEvaluations:0,trialControllerEvaluations:0,trialVisitorEvaluations:0,maxOpportunityEvaluations:0,maxOpportunityTrials:0}}));
  this.#anchor={t:0,stocks:this.depots.map(p=>({id:p.id,cargo:0,propellant:p.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};this.#resources=[copy(this.#anchor)];this.#job=this.#prepare(0,true);
 }
 #event(l:Lane,t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<FleetEvent>={}){l.events.push({t,kind,id,shipId:l.definition.vessels[0].id,deltaV:0,fuelUsed:0,propellantBefore:l.fuel,propellantAfter:l.fuel,...extra});}
 #sample(l:Lane,t:number,before=false):ViewSample {
  const d=l.definition;if(l.fault)return {...copy(l.fault),t,thrust:undefined,activity:{kind:'fault',reason:l.reason,knownEpoch:l.fault.t}};
  if(l.trip&&t>=l.trip.plan.schedule.departure&&t<=l.trip.plan.end){const s=l.trip.sample(t,before);return {...s,fuelUsed:l.pairUsed+(s.fuelUsed??0),logistics:{...s.logistics!,fuelUsed:l.pairUsed+(s.fuelUsed??0)}};}
  return {t,y:l.world.sample(d.origin.id,t).y,propellant:l.fuel,fuelUsed:l.used,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:.05,fuelUsed:l.used,ports:[],dockedPortId:d.origin.id,...(l.stage==='service'?{service:{id:'refuel',portId:d.origin.id,end:l.serviceEnd,cargo:0,propellant:d.world.scenario.ship.propellant-l.fuel}}:{})},activity:{kind:l.stage==='service'?'service':'waiting',reason:l.reason,...(l.trip?{nextDeparture:l.trip.plan.schedule.departure}:{retryAt:this.#control})}};
 }
 #frame(l:Lane,t:number,before=false):FleetFrame{return {t,ships:[this.#sample(l,t,before)]};}
 #fault(l:Lane,t:number,dependency:string,before:ViewSample){
  l.reason=`Coupled ${dependency} failed; ${l.definition.relay.id} future stopped`;l.stage='fault';l.fault=copy(before);l.stationFault=copy(l.trip!.world.chunks.flatMap(c=>c.data.boundaries).find(b=>b.t===t)?.before??l.world.sample(l.definition.relay.id,t));
  const v=l.visits.find(v=>v.id===l.trip!.plan.id)!;const record={...v,faultAt:t,updatedAt:t,samples:[...v.samples.filter(s=>s.t<t),copy(l.fault)],boundaries:v.boundaries.filter(b=>b.t<t),events:v.events.filter(e=>e.t<t)};l.visits=l.visits.map(v=>v.id===record.id?record:v);
  this.#event(l,t,'fault',`${l.trip!.plan.id}:fault`,{detail:l.reason});l.serviceEnd=Infinity;
 }
 #facts(l:Lane,t:number,before:ViewSample){
  const d=l.definition,trip=l.trip;if(!trip||l.stage==='fault')return;
  while(trip.events[l.fact]?.t===t){const e=trip.events[l.fact++],dependency=e.kind==='dock'&&e.portId===d.relay.id?'capture':e.kind==='transfer'&&e.portId===d.relay.id?'transfer':e.kind==='undock'&&e.portId===d.relay.id?'release':undefined;
   if(dependency&&dependency===this.hooks.failures?.[d.vessels[0].id]){this.#fault(l,t,dependency,before);break;}
   this.#event(l,t,e.kind,e.id,{...e,episodeId:trip.plan.id,localEpoch:e.t-trip.plan.schedule.departure});
   if(e.kind==='undock'&&e.portId===d.origin.id)l.stage='flying';
   if(e.kind==='transfer'&&e.portId===d.relay.id)l.stats.fuelDelivered+=trip.plan.delivery;
   if(e.kind==='dock'&&e.portId===d.origin.id){l.fuel=trip.home.propellantAfter;l.used=l.pairUsed+trip.burned;l.stage='service';l.serviceEnd=trip.plan.end;l.stats.completed++;this.#event(l,t,'transfer-start',`${trip.plan.id}:refuel-start`,{portId:d.origin.id});}
  }
 }
 #refuel(tx:Transaction,l:Lane){
  const t=tx.t,d=l.definition;if(l.stage!=='service'||l.serviceEnd!==t)return;
  const stock=resourcesAt(tx.anchor,this.depots,t),origin=stock.stocks.find(p=>p.id===d.origin.id)!,q=d.world.scenario.ship.propellant-l.fuel;
  if(origin.propellant>=q){const from=l.fuel,available=origin.propellant;origin.propellant-=q;l.fuel+=q;tx.anchor=stock;tx.resources.push(copy(stock));l.stage='waiting';l.serviceEnd=Infinity;l.trip=undefined;l.reason=undefined;
   this.#event(l,t,'transfer',`network-${d.vessels[0].id}-refuel-${t}`,{portId:d.origin.id,cargoBefore:.05,cargoAfter:.05,portPropellantBefore:available,portPropellantAfter:origin.propellant,propellantBefore:from,propellantAfter:l.fuel});
  }else{l.reason='Equator fuel unavailable';l.serviceEnd=t+8;l.trip=undefined;this.#event(l,t,'planning-failed',`network-${d.vessels[0].id}-fuel-retry-${t}`,{detail:l.reason});}
 }
 *#admit(l:Lane,t:number):Generator<void,void>{
  const previous=l.world.end;if(l.world.end<t+8)yield* l.world.extend(t+8,t);
  l.chunks.push(...l.world.chunks.filter(c=>c.data.start>=previous).map(c=>copy(c.data)));
  if(l.stage!=='waiting')return;
  const initial=l.world.chunks.find(c=>c.data.start===t)!,work=serviceWork();
  try{
   const trip=yield* planServiceJob(l.definition,initial.anchor,[initial.control],l.fuel,`network-${l.definition.vessels[0].id}-${l.ordinal}`,work,this.originIntervals);
   const tail=trip.world.chunks.filter(c=>c.data.start>=l.world.end);l.chunks.push(...tail.map(c=>copy(c.data)));l.world.chunks.push(...tail);l.world.anchor=copy(trip.world.anchor);
   for(const c of tail){l.world.checks++;l.world.evaluations+=c.data.check.evaluations;if(c.data.check.outcome==='correct')l.world.corrected++;if(c.data.check.outcome==='failed')l.world.failed++;}
   l.trip=trip;l.fact=0;l.stage='planned';l.reason=undefined;l.pairUsed=l.used;
   const view=(s:ViewSample):ViewSample=>({...s,fuelUsed:l.pairUsed+(s.fuelUsed??0),...(s.logistics?{logistics:{...s.logistics,fuelUsed:l.pairUsed+(s.fuelUsed??0)}}:{})});
   const times=[...new Set([...Array.from({length:Math.ceil((trip.plan.end-trip.plan.schedule.departure)*32)+1},(_,i)=>trip.plan.schedule.departure+i/32),trip.plan.end,...trip.events.map(e=>e.t)])].sort((a,b)=>a-b);
   l.visits.push({id:trip.plan.id,knownAt:t,departure:trip.plan.schedule.departure,arrival:trip.plan.schedule.homeArrival,end:trip.plan.end,plan:copy(trip.plan),evaluations:trip.plan.evaluations,samples:times.map(t=>view(trip.sample(t))),boundaries:trip.boundaries.map(b=>({t:b.t,before:view(b.before),after:view(b.after)})),events:trip.events,updatedAt:t});
   l.stats.maxVisitEvaluations=Math.max(l.stats.maxVisitEvaluations,trip.plan.evaluations);l.ordinal++;
  }catch(error){if(!(error instanceof PlanningFailure))throw error;l.reason=error.message;l.stats.planningFailed++;this.#event(l,t,'planning-failed',`network-${l.definition.vessels[0].id}-retry-${t}`,{detail:`${l.reason}; retry at ${t+8}`});}
  finally{l.stats.trialControllerEvaluations+=work.controller.used;l.stats.trialVisitorEvaluations+=work.visitor.used;l.stats.maxOpportunityEvaluations=Math.max(l.stats.maxOpportunityEvaluations,work.controller.used+work.visitor.used);l.stats.maxOpportunityTrials=Math.max(l.stats.maxOpportunityTrials,work.trials);}
 }
 *#prepare(t:number,control:boolean):Generator<void,Transaction>{
  const tx:Transaction={t,control,anchor:this.#anchor,resources:[...this.#resources],lanes:this.#lanes.map(l=>({...l,world:control&&!l.fault?l.world.fork():l.world,stats:{...l.stats},frames:[...l.frames],boundaries:[...l.boundaries],events:[...l.events],visits:[...l.visits],chunks:[...l.chunks]}))};
  let complete=false;try{
  const before=tx.lanes.map(l=>this.initialized?this.#frame(l,t,true):undefined),counts=tx.lanes.map(l=>l.events.length);
  // All due physical facts precede shared refuelling. Identity order makes
  // simultaneous requests deterministic. There is no yield in allocation.
  tx.lanes.forEach((l,i)=>this.#facts(l,t,before[i]?.ships[0]??this.#sample(l,t)));
  for(const l of tx.lanes)this.#refuel(tx,l);
  if(control)for(const l of tx.lanes)if(!l.fault){this.#peakTransactionLanes=Math.max(this.#peakTransactionLanes,1);yield* this.#admit(l,t);}
  for(let i=0;i<tx.lanes.length;i++){const l=tx.lanes[i];if(l.fault&&t>l.fault.t)continue;if(!this.initialized)this.#event(l,0,'dock',`network-${l.definition.vessels[0].id}-initial-dock`,{portId:l.definition.origin.id});const after=this.#frame(l,t);if(before[i]&&l.events.length!==counts[i])l.boundaries.push({t,before:before[i]!,after});if(t*16===Math.floor(t*16)||l.events.length!==counts[i])l.frames.push(after);}
  this.#invariants(tx);const proposed=new Set<Runner>(this.originIntervals.runners);for(const l of tx.lanes){l.world.runners.forEach(r=>proposed.add(r));l.trip?.runners.forEach(r=>proposed.add(r));}if([...proposed].reduce((n,r)=>n+r.retainedNodes,0)>140000)throw Error('Network retained physical storage budget exceeded');complete=true;return tx;
  }finally{if(!complete)for(let i=0;i<tx.lanes.length;i++){if(tx.lanes[i].world!==this.#lanes[i].world)tx.lanes[i].world.dispose();if(tx.lanes[i].trip!==this.#lanes[i].trip)tx.lanes[i].trip?.dispose();}}
 }
 #invariants(tx:Transaction){
  const occupied=new Map<string,number>();for(const l of tx.lanes){const s=this.#sample(l,tx.t);const id=s.logistics?.dockedPortId;if(id)occupied.set(id,(occupied.get(id)??0)+1);if(s.propellant<0||s.propellant>l.definition.world.scenario.ship.tankCapacity)throw Error('Network ship tank invariant');}
  const stock=resourcesAt(tx.anchor,this.depots,tx.t);for(const p of this.depots){const s=stock.stocks.find(s=>s.id===p.id)!;if(s.propellant<0||s.propellant>p.tankCapacity|| (occupied.get(p.id)??0)>p.berths)throw Error('Network stock/berth invariant');}
 }
 #nodes(lanes=this.#lanes){const runners=new Set<Runner>(this.originIntervals.runners);for(const l of lanes){l.world.runners.forEach(r=>runners.add(r));l.trip?.runners.forEach(r=>runners.add(r));}return [...runners].reduce((n,r)=>n+r.retainedNodes,0);}
 advanceTo(target:number,workBudget=128){
  if(!Number.isFinite(target)||target<this.frontier||!Number.isInteger(workBudget)||workBudget<1||workBudget>4096)throw Error('Invalid network advance');target=Math.min(10000,target);let work=0;
  while(work++<workBudget&&!this.halt){
   if(this.#job){let r:IteratorResult<void,Transaction>;try{r=this.#job.next();}catch(e){this.#job=undefined;this.halt=`Network invariant failed: ${(e as Error).message}`;break;}if(!r.done)continue;
    const tx=r.value;for(let i=0;i<this.#lanes.length;i++){const old=this.#lanes[i],fresh=tx.lanes[i];if(old.world!==fresh.world)old.world.dispose();if(old.trip!==fresh.trip)old.trip?.dispose();}this.#lanes=tx.lanes;this.#anchor=tx.anchor;this.#resources=tx.resources;this.frontier=tx.t;if(tx.control)this.#control=tx.t+8;if(this.#grid/16===tx.t)this.#grid++;this.initialized=true;this.#job=undefined;if(this.#lanes.every(l=>l.fault))this.halt='All network lanes stopped';this.#maxNodes=Math.max(this.#maxNodes,this.#nodes());this.#evict();continue;
   }
   if(this.frontier>=target)break;
   const next=Math.min(target,this.#grid/16,this.#control,...this.#lanes.filter(l=>!l.fault).flatMap(l=>[l.trip?.events[l.fact]?.t??Infinity,l.serviceEnd]));
   if(next<=this.frontier)throw Error('Network scheduler did not advance');this.#job=this.#prepare(next,next===this.#control);
  }
  if(this.frontier===10000)this.halt='Network calendar limit reached';return {frontier:this.frontier,yielded:!this.halt&&(!this.initialized||!!this.#job||this.frontier<target)};
 }
 #evict(){
  this.oldest=Math.max(0,this.frontier-128);const keep=<T extends {t:number}>(rows:T[])=>{let i=0;while(i+1<rows.length&&rows[i+1].t<=this.oldest)i++;return rows.slice(i);};this.#resources=keep(this.#resources);this.originIntervals.evict(this.frontier);
  for(const l of this.#lanes){l.frames=keep(l.frames);l.events=l.events.filter(e=>e.t>=this.oldest);l.boundaries=l.boundaries.filter(b=>b.t>=this.oldest);l.chunks=l.chunks.filter(c=>c.end>=this.oldest||!!l.fault&&c.start<=l.fault.t&&c.end>=l.fault.t);l.visits=l.visits.filter(v=>v.end>=this.oldest);if(!l.fault)l.world.evict(this.frontier);else{l.world.chunks=[];l.world.dispose();l.trip?.dispose();l.trip=undefined;}if(l.chunks.length>28||l.visits.length>6)throw Error('Network retained drawing budget exceeded');}
  this.#maxRetained=Math.max(this.#maxRetained,this.#nodes());if(this.#nodes()>140000)throw Error('Network retained physical storage budget exceeded');
 }
 delta(after=-1):NetworkDelta {
  if(!this.initialized)throw Error('Network initial epoch is not published');
  const resource=resourcesAt(this.#anchor,this.depots,this.frontier),stats:Record<string,number>={runnerNodes:this.#nodes(),maxCommittedNodes:this.#maxNodes,maxRetainedNodes:this.#maxRetained,originCacheNodes:this.originIntervals.nodes,originCacheHits:this.originIntervals.hits,originCacheMisses:this.originIntervals.misses,maxTransientNodes:this.originIntervals.peakResidentNodes,planningPending:this.#job?1:0,maxConcurrentPlanners:this.#peakTransactionLanes};
  const lanes=this.#lanes.map(l=>{const station=l.stationFault??l.world.sample(l.definition.relay.id,this.frontier),ship=this.#sample(l,this.frontier);const counters={...l.stats,frames:l.frames.length,chunks:l.chunks.length,visits:l.visits.length,controllerChecks:l.world.checks,controllerCorrected:l.world.corrected,controllerFailed:l.world.failed,controllerEvaluations:l.world.evaluations,stationFuel:station.propellant,stationFuelUsed:station.fuelUsed??0,shipFuelUsed:ship.fuelUsed??0};for(const [k,v]of Object.entries(counters))stats[k]=k.startsWith('max')?Math.max(stats[k]??0,v):(stats[k]??0)+v;
   const frontier=l.fault?.t??this.frontier;
   return {ownerId:l.definition.relay.id,visitorId:l.definition.vessels[0].id,domain:'adaptive-relay-v1' as const,frontier,oldest:Math.min(this.oldest,frontier),current:this.#frame(l,frontier),frames:l.frames.filter(f=>f.t>after&&f.t<=frontier),boundaries:l.boundaries.filter(b=>b.t>=after&&b.t<=frontier),chunks:l.chunks.filter(c=>c.knownAt>=after),visits:l.visits.filter(v=>v.updatedAt>=after),events:l.events.filter(e=>e.t>=after&&e.t<=frontier),resources:[],stats:counters,...(l.reason&&l.fault?{halt:l.reason}:{} )};});
  const fuel=resource.stocks.reduce((n,s)=>n+s.propellant,0)+stats.stationFuel+stats.stationFuelUsed+this.#lanes.reduce((n,l)=>{const s=this.#sample(l,this.frontier);return n+s.propellant+(s.fuelUsed??0);},0);
  const initial=this.depots.reduce((n,p)=>n+p.propellant,0)+this.#lanes.reduce((n,l)=>n+l.definition.relay.ship.propellant+l.definition.world.scenario.ship.propellant,0);stats.fuelBalanceError=fuel-initial-resource.fuelImported;
  const reservations=this.#lanes.flatMap(l=>l.trip&&!l.fault?[{stationId:l.definition.relay.id,shipId:l.definition.vessels[0].id,tripId:l.trip.plan.id,capture:l.trip.plan.schedule.relayArrival,release:l.trip.plan.schedule.release,forecastIdentity:l.trip.plan.id}]:[]);
  const p:NetworkDelta={domain:'maintained-network-v1',frontier:this.frontier,oldest:this.oldest,lanes,resources:[this.#resources[0],...this.#resources.slice(1).filter(r=>r.t>=after)],reservations,stats,...(this.halt?{halt:this.halt}:{})};const bytes=new TextEncoder().encode(JSON.stringify(p)).byteLength;if(bytes>16000000)throw Error('Network reply byte budget exceeded');p.stats.packetBytes=bytes;return copy(p);
 }
 snapshot(){const p=this.delta();return {frontier:p.frontier,current:{t:this.frontier,ships:p.lanes.map(l=>l.current.ships[0])},resources:resourcesAt(this.#anchor,this.depots,this.frontier),stats:p.stats,halt:p.halt};}
}
