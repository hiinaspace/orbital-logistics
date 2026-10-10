import {surfaceCacheStats,type SurfaceFlight} from '../surface-flexible/contracts';
import type {EventBoundary} from '../sim/runner';
import type {FleetFrame,FleetBoundary,FleetEvent} from '../traffic/engine';
import {resourcesAt,type ResourceAnchor} from '../traffic/resources';
import type {ViewSample,ViewerEvent} from '../model-set/model';
import type {WorldChunk} from '../maintained/world';
import {PlanningFailure} from '../maintained/shoot';
import {AdaptiveWorld,validateAdaptive,type AdaptiveDefinition} from './world';
import {CoupledTrip,tripStart,tripTouchdown,type CoupledPlan} from './plan';
import {planServiceJob,serviceWork} from './planner';
const copy=<T>(v:T):T=>structuredClone(v);
export interface AdaptiveVisit {
 id:string;knownAt:number;departure:number;arrival:number;end:number;plan:CoupledPlan;localFlights?:SurfaceFlight[];evaluations:number;
 samples:ViewSample[];boundaries:EventBoundary[];events:ViewerEvent[];updatedAt:number;faultAt?:number;
}
export interface AdaptiveDelta {
 domain:'adaptive-relay-v1'|'surface-flexible-v1';frontier:number;oldest:number;current:FleetFrame;frames:FleetFrame[];boundaries:FleetBoundary[];
 chunks:WorldChunk[];visits:AdaptiveVisit[];events:FleetEvent[];resources:ResourceAnchor[];stats:Record<string,number>;halt?:string;
}
export interface AdaptiveHooks {failAt?:'capture'|'transfer'|'release'}
export class AdaptiveEngine {
 readonly definition:AdaptiveDefinition;world:AdaptiveWorld;
 frontier=0;oldest=0;initialized=false;halt?:string;
 #job?:Generator<void,void>;#jobEpoch=0;#grid=1;#control=0;
 #stage:'waiting'|'planned'|'flying'|'service'|'fault'='waiting';#fuel:number;#used=0;#reason?:string;#serviceEnd=Infinity;#fault?:ViewSample;#haltStation?:ViewSample;
 #trip?:CoupledTrip;#fact=0;#ordinal=0;#pairUsed=0;
 #frames:FleetFrame[]=[];#boundaries:FleetBoundary[]=[];#events:FleetEvent[]=[];#visits:AdaptiveVisit[]=[];#chunks:WorldChunk[]=[];#resources:ResourceAnchor[];#anchor:ResourceAnchor;
 #completed=0;#planningFailed=0;#delivered=0;#maxNodes=0;#maxSolverWork=0;#trialController=0;#trialVisitor=0;#maxOpportunity=0;#maxTrials=0;
 constructor(value:AdaptiveDefinition,readonly hooks:AdaptiveHooks={}){
  const d=this.definition=validateAdaptive(value);this.world=new AdaptiveWorld(d);this.#fuel=d.world.scenario.ship.propellant;
  this.#anchor={t:0,stocks:d.stations.map(p=>({id:p.id,cargo:0,propellant:p.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};this.#resources=[copy(this.#anchor)];this.#job=this.#tick(0);
 }
 #event(t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<FleetEvent>={}){this.#events.push({t,kind,id,shipId:this.definition.vessels[0].id,deltaV:0,fuelUsed:0,propellantBefore:this.#fuel,propellantAfter:this.#fuel,...extra});}
 *#tick(t:number):Generator<void,void>{
  const previous=this.world.end;if(this.world.end<t+8)yield* this.world.extend(t+8,t);
  this.#chunks.push(...this.world.chunks.filter(c=>c.data.start>=previous).map(c=>copy(c.data)));
  if(this.#stage!=='waiting')return;
  const initial=this.world.chunks.find(c=>c.data.start===t)!;
  const work=serviceWork();try{
   const trip=yield* planServiceJob(this.definition,initial.anchor,[initial.control],this.#fuel,`adaptive-${this.#ordinal}`,work);
   this.#maxNodes=Math.max(this.#maxNodes,this.world.nodes+trip.nodes);if(this.#maxNodes>180000)throw Error('Coupled physical storage budget exceeded');
   // Only this whole proven object is promoted. No speculative controls,
   // ownership changes or donor credits escaped while the generator yielded.
   const tail=trip.world.chunks.filter(c=>c.data.start>=this.world.end);this.#chunks.push(...tail.map(c=>copy(c.data)));
   const promoted=this.world.fork();promoted.chunks.push(...tail);promoted.anchor=copy(trip.world.anchor);
   for(const c of tail){promoted.checks++;promoted.evaluations+=c.data.check.evaluations;if(c.data.check.outcome==='correct')promoted.corrected++;if(c.data.check.outcome==='failed')promoted.failed++;}
   this.world=promoted;this.#trip=trip;this.#fact=0;this.#stage='planned';this.#reason=undefined;this.#pairUsed=this.#used;
   const times=[...new Set([...Array.from({length:Math.ceil((trip.plan.end-tripStart(trip.plan))*32)+1},(_,i)=>tripStart(trip.plan)+i/32),trip.plan.end,...trip.events.map(e=>e.t)])].filter(t=>t<=trip.plan.end).sort((a,b)=>a-b);
   const view=(s:ViewSample):ViewSample=>({...s,fuelUsed:this.#pairUsed+(s.fuelUsed??0),...(s.logistics?{logistics:{...s.logistics,fuelUsed:this.#pairUsed+(s.fuelUsed??0)}}:{})});
   this.#visits.push({id:trip.plan.id,knownAt:t,departure:tripStart(trip.plan),arrival:tripTouchdown(trip.plan),end:trip.plan.end,plan:copy(trip.plan),...(this.definition.surface?{localFlights:trip.localFlights.map(f=>({...f,used:f.used+this.#pairUsed}))}:{}),evaluations:trip.plan.evaluations,samples:times.map(t=>view(trip.sample(t))),boundaries:trip.boundaries.map(b=>({t:b.t,before:view(b.before),after:view(b.after)})),events:trip.events,updatedAt:t});
   this.#maxSolverWork=Math.max(this.#maxSolverWork,trip.plan.evaluations);this.#ordinal++;
  }catch(error){if(!(error instanceof PlanningFailure))throw error;this.#reason=error.message;this.#planningFailed++;this.#event(t,'planning-failed',`adaptive-retry-${t}`,{detail:`${this.#reason}; retry at ${t+8}`});}finally{this.#trialController+=work.controller.used;this.#trialVisitor+=work.visitor.used;this.#maxOpportunity=Math.max(this.#maxOpportunity,work.controller.used+work.visitor.used);this.#maxTrials=Math.max(this.#maxTrials,work.trials);}
 }
 #sample(t:number,before=false):ViewSample{
  const d=this.definition;
  if(this.#stage==='fault')return {...copy(this.#fault!),t,activity:{kind:'fault',reason:this.#reason,knownEpoch:this.#fault!.t}};
  if(this.#trip&&t>=tripStart(this.#trip.plan)&&t<=this.#trip.plan.end){const s=this.#trip.sample(t,before);return {...s,fuelUsed:this.#pairUsed+(s.fuelUsed??0),logistics:{...s.logistics!,fuelUsed:this.#pairUsed+(s.fuelUsed??0)}};}
  return {t,y:this.world.sample(d.origin.id,t).y,propellant:this.#fuel,fuelUsed:this.#used,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:d.world.scenario.ship.cargoMass,fuelUsed:this.#used,ports:[],dockedPortId:d.origin.id,...(this.#stage==='service'?{service:{id:'refuel',portId:d.origin.id,end:this.#serviceEnd,cargo:0,propellant:d.world.scenario.ship.propellant-this.#fuel}}:{})},activity:{kind:this.#stage==='service'?'service':'waiting',reason:this.#reason,...(this.#trip?{nextDeparture:tripStart(this.#trip.plan)}:{retryAt:this.#control})}};
 }
 #frame(t:number,before=false):FleetFrame{return {t,ships:[this.#sample(t,before)]};}
 #commit(t:number){
  const before=this.#frame(t,true),count=this.#events.length,d=this.definition,trip=this.#trip;
  if(trip&&this.#stage!=='fault'){
   while(trip.events[this.#fact]?.t===t){const e=trip.events[this.#fact++];
    const dependency=e.kind==='dock'&&e.portId===d.relay.id?'capture':e.kind==='transfer'&&e.portId===d.relay.id?'transfer':e.kind==='undock'&&e.portId===d.relay.id?'release':undefined;
    if(dependency&&dependency===this.hooks.failAt){this.halt=`Coupled ${dependency} failed; dependent station future stopped`;this.#fault=copy(before.ships[0]);this.#haltStation=copy(trip.world.chunks.flatMap(c=>c.data.boundaries).find(b=>b.t===t)?.before??trip.world.sample(d.relay.id,t));this.#reason=this.halt;this.#stage='fault';const record=this.#visits.find(v=>v.id===trip.plan.id)!;record.faultAt=t;record.updatedAt=t;if(!d.surface){record.samples=record.samples.filter(s=>s.t<t);record.samples.push(copy(this.#fault));record.boundaries=record.boundaries.filter(b=>b.t<t);record.events=record.events.filter(e=>e.t<t);}this.#event(t,'fault',`${trip.plan.id}:fault`,{detail:this.halt});break;}
    this.#event(t,e.kind,e.id,{...e,episodeId:trip.plan.id,localEpoch:e.t-tripStart(trip.plan)});
    if((e.kind==='undock'||e.kind==='launch')&&e.portId===d.origin.id)this.#stage='flying';
    if(e.kind==='transfer'&&e.portId===d.relay.id)this.#delivered+=trip.plan.delivery;
    if((e.kind==='dock'||e.kind==='land')&&e.portId===d.origin.id){this.#fuel=trip.home.propellantAfter;this.#used=this.#pairUsed+trip.burned;this.#stage='service';this.#serviceEnd=trip.plan.end;this.#completed++;this.#event(t,'transfer-start',`${trip.plan.id}:refuel-start`,{portId:d.origin.id});}
   }
  }
  if(this.#stage==='service'&&this.#serviceEnd===t){const stock=resourcesAt(this.#anchor,d.stations,t),origin=stock.stocks.find(p=>p.id===d.origin.id)!,q=d.world.scenario.ship.propellant-this.#fuel;
   if(origin.propellant>=q){const from=this.#fuel,beforeStock=origin.propellant;origin.propellant-=q;this.#fuel+=q;this.#anchor=stock;this.#resources.push(copy(stock));this.#stage='waiting';this.#serviceEnd=Infinity;this.#trip=undefined;this.#event(t,'transfer',`adaptive-refuel-${t}`,{portId:d.origin.id,cargoBefore:.05,cargoAfter:.05,portPropellantBefore:beforeStock,portPropellantAfter:origin.propellant,propellantBefore:from,propellantAfter:this.#fuel});}
   else{this.#reason='Origin fuel unavailable';this.#serviceEnd=t+8;this.#trip=undefined;this.#event(t,'planning-failed',`adaptive-fuel-retry-${t}`,{detail:this.#reason});}
  }
  const after=this.#frame(t);if(this.#events.length!==count)this.#boundaries.push({t,before,after});if(t*16===Math.floor(t*16)||this.#events.length!==count)this.#frames.push(after);
 }
 advanceTo(target:number,workBudget=128){
  if(!Number.isFinite(target)||target<this.frontier||!Number.isInteger(workBudget)||workBudget<1||workBudget>4096)throw Error('Invalid adaptive advance');target=Math.min(10000,target);let work=0;
  while(work++<workBudget&&!this.halt){
   if(this.#job){const r=this.#job.next();if(!r.done)continue;this.#job=undefined;
    if(!this.initialized){this.initialized=true;this.#event(0,'dock','adaptive-initial-dock',{portId:this.definition.origin.id});this.#control=8;this.#frames.push(this.#frame(0));}
    else{this.frontier=this.#jobEpoch;this.#control+=8;this.#commit(this.frontier);if(this.#grid/16===this.frontier)this.#grid++;}continue;
   }
   if(this.frontier>=target)break;
   const fact=this.#trip?.events[this.#fact]?.t??Infinity,grid=this.#grid/16,next=Math.min(target,grid,fact,this.#serviceEnd,this.#control);
   if(next<=this.frontier)throw Error('Adaptive scheduler did not advance');
   if(next===this.#control){this.#jobEpoch=next;this.#job=this.#tick(next);continue;}
   this.frontier=next;if(next===grid)this.#grid++;this.#commit(next);
  }
  if(this.frontier===10000)this.halt='Adaptive calendar limit reached';if(this.initialized)this.#evict();return {frontier:this.frontier,yielded:!this.halt&&(!this.initialized||!!this.#job||this.frontier<target)};
 }
 #evict(){
  this.oldest=Math.max(0,this.frontier-128);const keep=<T extends {t:number}>(rows:T[])=>{let i=0;while(i+1<rows.length&&rows[i+1].t<=this.oldest)i++;return rows.slice(i);};
  this.#frames=keep(this.#frames);this.#resources=keep(this.#resources);this.#events=this.#events.filter(e=>e.t>=this.oldest);this.#boundaries=this.#boundaries.filter(b=>b.t>=this.oldest);this.#chunks=this.#chunks.filter(c=>c.end>=this.oldest);this.#visits=this.#visits.filter(v=>v.end>=this.oldest);this.world.evict(this.frontier);
  if(this.#chunks.length>28||this.#visits.length>6||this.world.nodes>65000)throw Error('Adaptive retained storage budget exceeded');
 }
 delta(after=-1):AdaptiveDelta{
  const station=this.#haltStation??this.world.sample(this.definition.relay.id,this.frontier),ship=this.#sample(this.frontier),stock=resourcesAt(this.#anchor,this.definition.stations,this.frontier),origin=stock.stocks.find(p=>p.id===this.definition.origin.id)!;
  const total=origin.propellant+station.propellant+ship.propellant+(station.fuelUsed??0)+(ship.fuelUsed??0),expected=this.definition.stations.find(p=>p.id===this.definition.origin.id)!.propellant+this.definition.relay.ship.propellant+this.definition.world.scenario.ship.propellant+stock.fuelImported;
  const p:AdaptiveDelta={domain:this.definition.domain,frontier:this.frontier,oldest:this.oldest,current:this.#frame(this.frontier),frames:this.#frames.filter(f=>f.t>after),boundaries:this.#boundaries.filter(b=>b.t>=after),chunks:this.#chunks.filter(c=>c.knownAt>=after),visits:this.#visits.filter(v=>v.updatedAt>=after),events:this.#events.filter(e=>e.t>=after),resources:[this.#resources[0],...this.#resources.slice(1).filter(r=>r.t>=after)],stats:{...(this.definition.surface?surfaceCacheStats():{}),frames:this.#frames.length,chunks:this.#chunks.length,physicalChunks:this.world.chunks.length,visits:this.#visits.length,runnerNodes:this.world.nodes+(this.#trip?.nodes??0),maxPromotionNodes:this.#maxNodes,completed:this.#completed,planningFailed:this.#planningFailed,controllerChecks:this.world.checks,controllerCorrected:this.world.corrected,controllerFailed:this.world.failed,controllerEvaluations:this.world.evaluations,maxVisitEvaluations:this.#maxSolverWork,trialControllerEvaluations:this.#trialController,trialVisitorEvaluations:this.#trialVisitor,maxOpportunityEvaluations:this.#maxOpportunity,maxOpportunityTrials:this.#maxTrials,planningPending:this.#job?1:0,stationFuel:station.propellant,stationFuelUsed:station.fuelUsed??0,shipFuelUsed:ship.fuelUsed??0,fuelDelivered:this.#delivered,fuelBalanceError:total-expected},...(this.halt?{halt:this.halt}:{})};
  const bytes=new TextEncoder().encode(JSON.stringify(p)).byteLength;if(bytes>8_000_000)throw Error('Adaptive reply byte budget exceeded');p.stats.packetBytes=bytes;return copy(p);
 }
 snapshot(){const p=this.delta();return {frontier:p.frontier,current:p.current,resources:resourcesAt(this.#anchor,this.definition.stations,this.frontier),stats:p.stats,halt:p.halt};}
}
