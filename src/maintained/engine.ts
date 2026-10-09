import type {Runner,Sample,EventBoundary} from '../sim/runner';
import type {Bundle} from '../sim/schema';
import {orbitError,type ViewSample,type ViewerEvent} from '../model-set/model';
import {resourcesAt,type ResourceAnchor} from '../traffic/resources';
import type {FleetFrame,FleetBoundary,FleetEvent} from '../traffic/engine';
import {MaintainedWorld,validateMaintained,type MaintainedDefinition,type WorldChunk} from './world';
import {planPairJob,type Pair} from './planner';
import {PlanningFailure} from './shoot';
const copy=<T>(v:T):T=>structuredClone(v);
export interface VisitRecord {
 id:string;knownAt:number;departure:number;arrival:number;bundle:Bundle;leaseChunks:number[];evaluations:number;
 executionSamples?:ViewSample[];executionBoundaries?:EventBoundary[];samples:ViewSample[];boundaries:EventBoundary[];events:ViewerEvent[];faultAt?:number;updatedAt:number;
}
export interface MaintainedDelta {
 domain:'maintained-relay-v1';frontier:number;oldest:number;current:FleetFrame;frames:FleetFrame[];boundaries:FleetBoundary[];
 chunks:WorldChunk[];visits:VisitRecord[];events:FleetEvent[];resources:ResourceAnchor[];stats:Record<string,number>;halt?:string;
}
export interface MaintainedHooks {controlBudget?:number;flightAdapter?:(bundle:Bundle)=>Runner;attachedReleaseFailure?:boolean;planningBudget?:number}
export class MaintainedEngine {
 readonly definition:MaintainedDefinition;readonly world:MaintainedWorld;
 frontier=0;oldest=0;initialized=false;halt?:string;
 #job?:Generator<void,void>;#jobEpoch=0;#grid=1;#control=0;
 #stage:'waiting'|'planned'|'flying'|'service'|'fault'='waiting';#fuel:number;#used=0;#reason?:string;#serviceEnd=Infinity;#fault?:ViewSample;
 #pair?:Pair;#execution?:Runner;#facts:ViewerEvent[]=[];#fact=0;#ordinal=0;
 #frames:FleetFrame[]=[];#boundaries:FleetBoundary[]=[];#events:FleetEvent[]=[];#visits:VisitRecord[]=[];#chunks:WorldChunk[]=[];#resources:ResourceAnchor[];#anchor:ResourceAnchor;
 #completed=0;#planningFailed=0;#maxSolverWork=0;
 constructor(value:MaintainedDefinition,readonly hooks:MaintainedHooks={}){
  const d=this.definition=validateMaintained(value);this.world=new MaintainedWorld(d,hooks.controlBudget);this.#fuel=d.world.scenario.ship.propellant;
  this.#anchor={t:0,stocks:d.stations.map(p=>({id:p.id,cargo:0,propellant:p.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};this.#resources=[copy(this.#anchor)];this.#job=this.#tick(0);
 }
 #event(t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<FleetEvent>={}){this.#events.push({t,kind,id,shipId:this.definition.vessels[0].id,deltaV:0,fuelUsed:0,propellantBefore:this.#fuel,propellantAfter:this.#fuel,...extra});}
 *#tick(t:number):Generator<void,void>{
  const previous=this.world.end;yield* this.world.extend(t+40,t);
  this.#chunks.push(...this.world.chunks.filter(c=>c.data.start>=previous).map(c=>copy(c.data)));
  if(this.#stage==='waiting'){
   const at=this.world.sample(this.definition.relay.id,t),error=orbitError(at.y,this.definition.reference);
   if(error.position>.02||error.velocity>.005){this.#reason='Relay outside maintenance envelope';this.#event(t,'planning-failed',`envelope-${t}`,{detail:this.#reason});this.#planningFailed++;return;}
   try{
    const pair=yield* planPairJob(this.definition,this.world,t+6,t,this.#fuel,this.#ordinal,this.hooks.planningBudget);
    this.#pair=pair;this.#execution=this.hooks.flightAdapter?.(pair.bundle)??pair.runner;this.#execution.advanceTo(pair.departure+32);
    this.#facts=this.#execution.ledger.filter(e=>e.t<=pair.arrival);this.#fact=0;this.#stage='planned';this.#reason=undefined;
    const used=this.#used,toView=(s:Sample):ViewSample=>({...s,fuelUsed:used+(s.fuelUsed??0),logistics:{...s.logistics!,fuelUsed:used+(s.fuelUsed??0)},activity:{kind:'flying'}});
    const times=[...new Set([...Array.from({length:1025},(_,i)=>pair.departure+i/32),...pair.runner.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
    this.#visits.push({id:pair.id,knownAt:t,departure:pair.departure,arrival:pair.arrival,bundle:pair.bundle,leaseChunks:pair.leaseChunks,evaluations:pair.evaluations,samples:times.map(t=>toView(pair.runner.sample(t))),boundaries:pair.runner.eventBoundaries.map(b=>({t:b.t,before:toView(b.before),after:toView(b.after)})),events:pair.runner.ledger,updatedAt:t});this.#maxSolverWork=Math.max(this.#maxSolverWork,pair.evaluations);this.#ordinal++;
   }catch(error){if(!(error instanceof PlanningFailure))throw error;this.#reason=error.message;this.#planningFailed++;this.#event(t,'planning-failed',`visit-retry-${t}`,{detail:`${this.#reason}; retry at ${t+8}`});}
  }
 }
 #sample(t:number,before=false):ViewSample {
  const d=this.definition;
  if(this.#stage==='fault')return {...copy(this.#fault!),t,activity:{kind:'fault',reason:this.#reason,knownEpoch:this.#fault!.t}};
  if(this.#stage==='flying' && this.#pair){const r=this.#execution!,s=before?r.eventBoundaries.find(b=>b.t===t)?.before??r.sample(t):r.sample(t);return {...copy(s),t,fuelUsed:this.#used+(s.fuelUsed??0),logistics:{...copy(s.logistics!),fuelUsed:this.#used+(s.fuelUsed??0)},activity:{kind:'flying'}};}
  return {t,y:this.world.sample(d.origin.id,t).y,propellant:this.#fuel,fuelUsed:this.#used,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:d.world.scenario.ship.cargoMass,fuelUsed:this.#used,ports:[],dockedPortId:d.origin.id,...(this.#stage==='service'?{service:{id:'refuel',portId:d.origin.id,end:this.#serviceEnd,cargo:0,propellant:d.world.scenario.ship.propellant-this.#fuel}}:{})},activity:{kind:this.#stage==='service'?'service':'waiting',reason:this.#reason,...(this.#pair?{nextDeparture:this.#pair.departure}:{retryAt:this.#control})}};
 }
 #frame(t:number,before=false):FleetFrame{return {t,ships:[this.#sample(t,before)]};}
 #commit(t:number){
  const before=this.#frame(t,true),count=this.#events.length,d=this.definition;
  if(this.#stage==='planned' && this.#pair?.departure===t){this.#event(t,'undock',`${this.#pair.id}:departure`,{portId:d.origin.id});this.#stage='flying';}
  if(this.#stage==='flying'){
   const pair=this.#pair!,runner=this.#execution!;
   while(this.#facts[this.#fact]?.t===t){const e=this.#facts[this.#fact++];
    if(this.hooks.attachedReleaseFailure && e.kind==='undock' && e.portId===d.relay.id){
     this.halt='Attached release failure; maintenance cannot continue';this.#fault={...before.ships[0],t};this.#fuel=this.#fault.propellant;this.#used=this.#fault.fuelUsed??this.#used;this.#reason=this.halt;this.#stage='fault';
     const record=this.#visits.find(v=>v.id===pair.id)!;record.faultAt=t;record.updatedAt=t;record.executionSamples=[...record.samples.filter(s=>s.t<t),copy(this.#fault)];record.executionBoundaries=[...runner.eventBoundaries.filter(b=>b.t<t),{t,before:copy(this.#fault),after:copy(this.#fault)}];
     this.#event(t,'fault',`${pair.id}:attached-fault`,{detail:this.halt});break;
    }
    this.#event(t,e.kind,e.id,{...e,episodeId:pair.id,localEpoch:e.t-pair.departure});
    if(e.kind==='dock'&&e.portId===d.origin.id&&t===pair.arrival){const s=runner.sample(t);this.#fuel=s.propellant;this.#used+=s.fuelUsed??0;this.#stage='service';this.#serviceEnd=t+2;this.#completed++;this.#pair=undefined;this.#execution=undefined;this.#event(t,'transfer-start',`${pair.id}:refuel-start`,{portId:d.origin.id});break;}
   }
   if(this.#stage==='flying'){
    const at=runner.sample(t);
    if(at.t<t||!['running','horizon'].includes(at.status)){
     const record=this.#visits.find(v=>v.id===pair.id)!;record.faultAt=at.t;record.updatedAt=t;
     const used=this.#used,paid=(s:Sample):ViewSample=>({...s,fuelUsed:used+(s.fuelUsed??0),logistics:{...s.logistics!,fuelUsed:used+(s.fuelUsed??0)},activity:{kind:'flying'}});
     record.executionSamples=record.samples.filter(s=>s.t<=at.t).map(s=>paid(runner.sample(s.t)));
     if(record.executionSamples.at(-1)?.t!==at.t)record.executionSamples.push(paid(at));
     record.executionBoundaries=runner.eventBoundaries.map(b=>({t:b.t,before:paid(b.before),after:paid(b.after)}));
     this.#fuel=at.propellant;this.#fault=copy(paid(at));this.#used=this.#fault.fuelUsed!;this.#stage='fault';this.#reason=`${at.status}: ${at.detail}`;
     if(at.logistics?.dockedPortId===d.relay.id)this.halt='Attached flight fault; maintenance cannot continue';
     this.#event(at.t,'fault',`${pair.id}:fault`,{detail:this.#reason});this.#pair=undefined;this.#execution=undefined;
    }
   }
  }
  if(this.#stage==='service'&&this.#serviceEnd===t){
   const stock=resourcesAt(this.#anchor,d.stations,t),origin=stock.stocks.find(p=>p.id===d.origin.id)!,amount=d.world.scenario.ship.propellant-this.#fuel;
   if(origin.propellant>=amount){const beforeFuel=this.#fuel,beforeStock=origin.propellant;origin.propellant-=amount;this.#fuel+=amount;this.#anchor=stock;this.#resources.push(copy(stock));this.#stage='waiting';this.#serviceEnd=Infinity;this.#event(t,'transfer',`refuel-${t}`,{portId:d.origin.id,cargoBefore:d.world.scenario.ship.cargoMass,cargoAfter:d.world.scenario.ship.cargoMass,portCargoBefore:0,portCargoAfter:0,propellantBefore:beforeFuel,propellantAfter:this.#fuel,portPropellantBefore:beforeStock,portPropellantAfter:origin.propellant});}
   else{this.#reason='Origin fuel unavailable';this.#serviceEnd=t+8;this.#event(t,'planning-failed',`refuel-retry-${t}`,{detail:this.#reason});}
  }
  const after=this.#frame(t);if(this.#events.length!==count)this.#boundaries.push({t,before,after});if(t*16===Math.floor(t*16)||this.#events.length!==count)this.#frames.push(after);
 }
 // Generator jobs yield between individual canonical trial integrations. Neither
 // request size nor a worker yield changes the scheduled physical epoch or result.
 advanceTo(target:number,workBudget=128){
  if(!Number.isFinite(target)||target<this.frontier||!Number.isInteger(workBudget)||workBudget<1||workBudget>4096)throw Error('Invalid maintained advance');target=Math.min(10000,target);let work=0;
  while(work++<workBudget&&!this.halt){
   if(this.#job){const result=this.#job.next();if(!result.done)continue;this.#job=undefined;
    if(!this.initialized){this.initialized=true;this.#event(0,'dock','initial-dock',{portId:this.definition.origin.id});this.#control=8;this.#frames.push(this.#frame(0));}
    else{this.frontier=this.#jobEpoch;this.#control+=8;this.#commit(this.frontier);if(this.#grid/16===this.frontier)this.#grid++;}
    continue;
   }
   if(this.frontier>=target)break;
   const fact=this.#stage==='flying'?this.#facts[this.#fact]?.t??this.#pair!.arrival:Infinity,event=Math.min(this.#stage==='planned'?this.#pair!.departure:Infinity,fact,this.#serviceEnd),grid=this.#grid/16,next=Math.min(target,grid,event,this.#control);
   if(next<=this.frontier)throw Error('Maintained scheduler did not advance');
   if(next===this.#control){this.#jobEpoch=next;this.#job=this.#tick(next);continue;}
   this.frontier=next;if(next===grid)this.#grid++;this.#commit(next);
  }
  if(this.frontier===10000)this.halt='Maintained calendar limit reached';
  if(this.initialized)this.#evict();return {frontier:this.frontier,yielded:!this.halt&&(!this.initialized||!!this.#job||this.frontier<target)};
 }
 #evict(){
  this.oldest=Math.max(0,this.frontier-128);const keep=<T extends {t:number}>(rows:T[])=>{let i=0;while(i+1<rows.length&&rows[i+1].t<=this.oldest)i++;return rows.slice(i);};
  this.#frames=keep(this.#frames);this.#resources=keep(this.#resources);this.#events=this.#events.filter(e=>e.t>=this.oldest);this.#boundaries=this.#boundaries.filter(b=>b.t>=this.oldest);this.#chunks=this.#chunks.filter(c=>c.end>=this.oldest);this.#visits=this.#visits.filter(v=>v.arrival+2>=this.oldest);this.world.evict(this.frontier);
  if(this.#chunks.length>23||this.#visits.length>6||this.world.nodes>50000||this.#visits.reduce((n,v)=>n+v.samples.length,0)>65536)throw Error('Maintained retained storage budget exceeded');
 }
 delta(after=-1):MaintainedDelta {
  const activeNodes=this.#execution?.retainedNodes??0,station=this.world.sample(this.definition.relay.id,this.frontier);
  const delta:MaintainedDelta={domain:'maintained-relay-v1',frontier:this.frontier,oldest:this.oldest,current:this.#frame(this.frontier),frames:this.#frames.filter(f=>f.t>after),boundaries:this.#boundaries.filter(b=>b.t>=after),chunks:this.#chunks.filter(c=>c.knownAt>=after),visits:this.#visits.filter(v=>v.updatedAt>=after),events:this.#events.filter(e=>e.t>=after),resources:[this.#resources[0],...this.#resources.slice(1).filter(r=>r.t>=after)],stats:{frames:this.#frames.length,chunks:this.#chunks.length,physicalChunks:this.world.chunks.length,visits:this.#visits.length,runnerNodes:this.world.nodes+(this.#pair?3*(this.#pair.runner.retainedNodes+64):0)+(this.#execution&&this.#execution!==this.#pair?.runner?3*(activeNodes+64):0),completed:this.#completed,planningFailed:this.#planningFailed,controllerChecks:this.world.checks,controllerCorrected:this.world.corrected,controllerFailed:this.world.failed,controllerEvaluations:this.world.evaluations,maxVisitEvaluations:this.#maxSolverWork,planningPending:this.#job?1:0,stationFuel:station.propellant,stationFuelUsed:station.fuelUsed??0,shipFuelUsed:this.#sample(this.frontier).fuelUsed??this.#used},...(this.halt?{halt:this.halt}:{})};
  const bytes=new TextEncoder().encode(JSON.stringify(delta)).byteLength;if(bytes>8_000_000)throw Error('Maintained reply byte budget exceeded');delta.stats.packetBytes=bytes;return copy(delta);
 }
 snapshot(){const p=this.delta();return {frontier:p.frontier,current:p.current,resources:resourcesAt(this.#anchor,this.definition.stations,this.frontier),stats:p.stats,halt:p.halt};}
}
