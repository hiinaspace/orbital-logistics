import {portState} from '../sim/logistics';
import type {Runner,Sample,EventBoundary} from '../sim/runner';
import type {ViewSample,ViewerEvent} from '../model-set/model';
import {resourcesAt,type ResourceAnchor} from './resources';
import {admitEpisode,nextWindow,validateTraffic,localAt,CALENDAR_LIMIT,type TrafficDefinition,type TrafficVessel,type Episode,type EpisodeSource,type TransferTemplate} from './planner';
export interface FleetFrame {t:number;ships:ViewSample[]}
export interface FleetBoundary {t:number;before:FleetFrame;after:FleetFrame}
export interface FleetEvent extends ViewerEvent {shipId:string;episodeId?:string;localEpoch?:number}
export interface EpisodeRecord {source:EpisodeSource;samples:ViewSample[];boundaries:EventBoundary[];events:ViewerEvent[];updatedAt:number;faultAt?:number}
export interface TrafficDelta {frontier:number;oldest:number;frames:FleetFrame[];current:FleetFrame;boundaries:FleetBoundary[];resources:ResourceAnchor[];episodes:EpisodeRecord[];events:FleetEvent[];stats:Record<string,number>;halt?:string}
type Stage='attached'|'service'|'waiting'|'planned'|'flying'|'fault'|'unavailable';
interface Ship extends TrafficVessel {stage:Stage;cargoMass:number;fuel:number;used:number;routeIndex:number;voyage:number;eventAt:number;ready:boolean;reason?:string;windowIndex?:number;episode?:Episode;fault?:ViewSample;delivered:number}
// Narrow trusted test seam. Production uses the admitted Runner unchanged.
export interface TrafficHooks {planningWait?:(shipId:string,voyage:number,windowIndex:number)=>string|undefined;episodeAdapter?:(e:Episode)=>Runner}
const copy=<T>(x:T):T=>structuredClone(x);
export class TrafficEngine {
 readonly definition:TrafficDefinition;
 #ships:Ship[];#frontier=0;#grid=1;#frames:FleetFrame[]=[];#boundaries:FleetBoundary[]=[];#events:FleetEvent[]=[];#records:EpisodeRecord[]=[];#resources:ResourceAnchor[];#anchor:ResourceAnchor;#oldest=0;#halt?:string;
 constructor(value:TrafficDefinition,readonly hooks:TrafficHooks={}) {
  this.definition=validateTraffic(value);const d=this.definition;
  this.#ships=d.vessels.map(v=>({...copy(v),stage:'attached',cargoMass:0,fuel:v.propellant,used:0,routeIndex:0,voyage:0,eventAt:0,ready:false,delivered:0}));
  this.#anchor={t:0,stocks:d.stations.map(p=>({id:p.id,cargo:p.cargo,propellant:p.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};
  this.#resources=[copy(this.#anchor)];
  for(const s of this.#ships)this.#event(s,0,'dock',`${s.id}:initial`,{portId:s.portId,positionError:0});
  this.#batch(0);this.#record(0);
 }
 get frontier(){return this.#frontier;}
 get oldest(){return this.#oldest;}
 #template(s:Ship):TransferTemplate{return this.definition.templates.find(t=>t.id===s.route[s.routeIndex])!;}
 #event(s:Ship,t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<FleetEvent>={}) {
  this.#events.push({t,kind,id,shipId:s.id,deltaV:0,fuelUsed:0,propellantBefore:s.fuel,propellantAfter:s.fuel,...extra});
 }
 #shipSample(s:Ship,t:number,before=false):ViewSample {
  if(s.stage==='fault')return {...copy(s.fault!),t,activity:{kind:'fault',reason:s.reason,knownEpoch:s.fault!.t}};
  let sample:Sample;
  if(s.stage==='flying') {
   const e=s.episode!,local=localAt(e,t),boundary=before?e.execution.eventBoundaries.find(b=>b.t===local):undefined;
   sample=boundary?.before??e.execution.sample(local);
   return {...copy(sample),t,fuelUsed:s.used+(sample.fuelUsed??sample.logistics?.fuelUsed??0),logistics:{...copy(sample.logistics!),fuelUsed:s.used+(sample.fuelUsed??sample.logistics?.fuelUsed??0)},activity:{kind:'flying'}};
  }
  const port=this.definition.world.scenario.logistics!.ports.find(p=>p.id===s.portId)!;
  return {t,y:portState(port,t),propellant:s.fuel,fuelUsed:s.used,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:s.cargoMass,fuelUsed:s.used,ports:[],dockedPortId:s.portId,...(s.stage==='service'?{service:{id:`${s.id}:service`,portId:s.portId,end:s.eventAt,cargo:this.#template(s).cargo-s.cargoMass,propellant:this.#template(s).propellant-s.fuel}}:{})},activity:{kind:s.stage==='service'?'service':s.stage==='unavailable'?'unavailable':'waiting',reason:s.reason,...(s.stage==='planned'?{nextDeparture:s.eventAt}:s.stage==='waiting'?{retryAt:s.eventAt}:{})}};
 }
 #frame(t:number,before=false):FleetFrame{return {t,ships:this.#ships.map(s=>this.#shipSample(s,t,before))};}
 #record(t:number){const frame=this.#frame(t);if(this.#frames.at(-1)?.t===t)this.#frames[this.#frames.length-1]=frame;else this.#frames.push(frame);}
 #service(s:Ship,t:number) {
  s.stage='service';s.ready=false;s.eventAt=t+this.definition.world.scenario.logistics!.ports.find(p=>p.id===s.portId)!.serviceDuration;
  s.reason=undefined;this.#event(s,t,'transfer-start',`${s.id}:${s.voyage}:service-start:${t}`,{portId:s.portId});
 }
 #wait(s:Ship,t:number,reason:string,ready:boolean,minIndex=-Infinity) {
  try {let w=nextWindow(this.definition,this.#template(s),t,minIndex);if(w.departure<=t)w=nextWindow(this.definition,this.#template(s),t,w.index+1);s.stage='waiting';s.ready=ready;s.eventAt=w.departure;s.windowIndex=w.index;s.reason=reason;this.#event(s,t,'planning-failed',`${s.id}:${s.voyage}:retry:${w.index}`,{portId:s.portId,detail:`${reason}; retry at ${w.departure}`});}
  catch(error){s.stage='unavailable';s.eventAt=Infinity;s.reason=String((error as Error).message);this.#event(s,t,'unavailable',`${s.id}:${s.voyage}:unavailable`,{detail:s.reason,portId:s.portId});}
 }
 #plan(s:Ship,t:number,minIndex=-Infinity) {
  let attempted:number|undefined;
  try {
   const template=this.#template(s),w=nextWindow(this.definition,template,t,minIndex),wait=this.hooks.planningWait?.(s.id,s.voyage,w.index);
   attempted=w.index;
   if(wait){this.#wait(s,t,wait,true,w.index+1);return;}
   const episode=admitEpisode(this.definition,template,s.id,s.voyage,t,w,s.cargoMass,s.fuel);
   if(this.hooks.episodeAdapter){episode.execution=this.hooks.episodeAdapter(episode);episode.execution.advanceTo(episode.bundle.scenario.duration);episode.facts=episode.execution.ledger;}
   s.episode=episode;s.stage='planned';s.eventAt=episode.departure;s.windowIndex=w.index;s.reason=undefined;
   const times=[...new Set([0,episode.captureLocalEpoch,...Array.from({length:Math.ceil(episode.captureLocalEpoch*32)},(_,i)=>Math.min(i/32,episode.captureLocalEpoch)),...episode.runner.eventBoundaries.map(b=>b.t).filter(t=>t<=episode.captureLocalEpoch)])].sort((a,b)=>a-b);
   const global=(sample:Sample):ViewSample=>({...copy(sample),t:episode.departure+sample.t,fuelUsed:s.used+sample.fuelUsed!,logistics:{...copy(sample.logistics!),fuelUsed:s.used+sample.fuelUsed!},activity:{kind:sample.logistics?.dockedPortId?'waiting':'flying'}});
   const {runner:_r,execution:_x,facts:_f,nextFact:_n,...source}=episode;
   this.#records.push({source:copy(source),samples:times.map(t=>global(episode.runner.sample(t))),boundaries:episode.runner.eventBoundaries.filter(b=>b.t<=episode.captureLocalEpoch).map(b=>({t:episode.departure+b.t,before:global(b.before),after:global(b.after)})),events:episode.runner.ledger.map((e,i)=>({...e,t:episode.departure+e.t,id:`${episode.id}:event${i}`})),updatedAt:t});
  }catch(error){if((error as Error).message==='Powered transfer admission failed' && attempted!==undefined){this.#wait(s,t,'Transfer planning failed',true,attempted+1);return;}s.stage='unavailable';s.eventAt=Infinity;s.reason=(error as Error).message;this.#event(s,t,'unavailable',`${s.id}:${s.voyage}:unavailable`,{detail:s.reason,portId:s.portId});}
 }
 #nextShipEvent(s:Ship):number {
  if(s.stage!=='flying')return s.eventAt;
  const e=s.episode!,fact=e.facts[e.nextFact];return fact?e.departure+fact.t:e.arrival;
 }
 #batch(t:number) {
  const before=this.#frame(t,true),cursor=this.#events.length;
  // One shared epoch transaction: flows, completions, departures, flight facts,
  // arrivals/faults, newly started services. Never yield inside this batch.
  const resources=resourcesAt(this.#anchor,this.definition.stations,t);let resourceEvent=false;
  for(const s of this.#ships)if(s.stage==='service' && s.eventAt===t) {
   resourceEvent=true;const template=this.#template(s),stock=resources.stocks.find(p=>p.id===s.portId)!,depot=this.definition.stations.find(p=>p.id===s.portId)!;
   const dc=template.cargo-s.cargoMass,df=template.propellant-s.fuel;
   if(stock.cargo-dc<0 || stock.cargo-dc>depot.cargoCapacity || stock.propellant-df<0 || stock.propellant-df>depot.tankCapacity){this.#wait(s,t,'Station resources unavailable',false,(s.windowIndex??-Infinity)+1);continue;}
   this.#event(s,t,'transfer',`${s.id}:${s.voyage}:service`,{portId:s.portId,cargoBefore:s.cargoMass,cargoAfter:template.cargo,propellantBefore:s.fuel,propellantAfter:template.propellant,portCargoBefore:stock.cargo,portCargoAfter:stock.cargo-dc,portPropellantBefore:stock.propellant,portPropellantAfter:stock.propellant-df});
   stock.cargo-=dc;stock.propellant-=df;s.cargoMass=template.cargo;s.fuel=template.propellant;s.delivered+=Math.max(0,-dc);s.ready=true;this.#plan(s,t);
  }
  for(const s of this.#ships)if(s.stage==='waiting' && s.eventAt===t){if(s.ready)this.#plan(s,t,s.windowIndex);else this.#service(s,t);}
  for(const s of this.#ships)if(s.stage==='planned' && s.eventAt===t) {
   const template=this.#template(s);
   if(Math.abs(s.fuel-template.propellant)>1e-12 || Math.abs(s.cargoMass-template.cargo)>1e-12)throw new Error('Shared departure loadout invariant failed');
   this.#event(s,t,'undock',`${s.episode!.id}:departure`,{portId:s.portId});s.stage='flying';s.eventAt=Infinity;
  }
  for(const s of this.#ships)if(s.stage==='flying') {
   const e=s.episode!;
   while(e.facts[e.nextFact] && e.departure+e.facts[e.nextFact].t===t) {
    const index=e.nextFact++,fact=e.facts[index];this.#event(s,t,fact.kind,`${e.id}:event${index}`,{...fact,t,id:`${e.id}:event${index}`,episodeId:e.id,localEpoch:fact.t});
    if(fact.kind==='dock') {
     const result=e.execution.sample(fact.t);s.fuel=result.propellant;s.cargoMass=result.logistics!.cargoMass;s.used+=result.fuelUsed!;
     s.portId=this.#template(s).destination;s.routeIndex=(s.routeIndex+1)%s.route.length;s.voyage++;s.stage='attached';s.episode=undefined;s.eventAt=Infinity;break;
    }
    if(['fuel-depleted','unsupported-approach','collision','work-limit','operation-rejected','burn-rejected'].includes(fact.kind)) {
     const result=e.execution.sample(fact.t);s.fuel=result.propellant;s.cargoMass=result.logistics?.cargoMass??s.cargoMass;s.used+=result.fuelUsed!;s.fault={...copy(result),t,fuelUsed:s.used};s.reason=fact.detail??fact.kind;s.stage='fault';s.eventAt=Infinity;s.episode=undefined;
     const record=this.#records.find(r=>r.source.id===e.id)!;record.faultAt=t;record.updatedAt=t;
     this.#event(s,t,'fault',`${e.id}:fault`,{detail:s.reason});break;
    }
   }
  }
  for(const s of this.#ships)if(s.stage==='attached')this.#service(s,t);
  if(resourceEvent){this.#anchor=resources;if(this.#resources.at(-1)?.t===t)this.#resources[this.#resources.length-1]=copy(resources);else this.#resources.push(copy(resources));}
  this.#invariants(t);
  if(cursor!==this.#events.length){const after=this.#frame(t);this.#boundaries.push({t,before,after});this.#record(t);}
 }
 #invariants(t:number) {
  const resources=resourcesAt(this.#anchor,this.definition.stations,t),samples=this.#ships.map(s=>this.#shipSample(s,t));
  for(const stock of resources.stocks){const d=this.definition.stations.find(d=>d.id===stock.id)!;if(stock.cargo<0 || stock.cargo>d.cargoCapacity || stock.propellant<0 || stock.propellant>d.tankCapacity || samples.filter(s=>s.logistics?.dockedPortId===stock.id).length>d.berths)throw new Error('Shared stock/berth invariant failed');}
  if(samples.some(s=>s.propellant<0 || s.propellant>this.definition.world.scenario.ship.tankCapacity))throw new Error('Shared ship resource invariant failed');
 }
 advanceTo(target:number,workBudget=256):{frontier:number;yielded:boolean} {
  if(!Number.isFinite(target) || target<this.#frontier || !Number.isInteger(workBudget) || workBudget<1 || workBudget>4096)throw new Error('Invalid fleet advance');
  target=Math.min(CALENDAR_LIMIT,target);let work=0;
  while(this.#frontier<target && work<workBudget && !this.#halt) {
   const grid=this.#grid*this.definition.sampleStep,event=Math.min(...this.#ships.map(s=>this.#nextShipEvent(s))),next=Math.min(grid,event,target);
   if(next<=this.#frontier)throw new Error('Fleet event failed to advance');
   this.#frontier=next;
   if(next===event)this.#batch(next);
   if(next===grid){this.#record(next);this.#grid++;}
   work++;
  }
  if(this.#frontier===CALENDAR_LIMIT)this.#halt='Tested calendar limit reached';
  this.#evict();return {frontier:this.#frontier,yielded:this.#frontier<target};
 }
 #evict() {
  this.#oldest=Math.max(0,this.#frontier-this.definition.historyDuration);
  const keepAnchor=<T extends {t:number}>(rows:T[])=>{let i=0;while(i+1<rows.length && rows[i+1].t<=this.#oldest)i++;return rows.slice(i);};
  this.#frames=keepAnchor(this.#frames);this.#resources=keepAnchor(this.#resources);
  this.#boundaries=this.#boundaries.filter(b=>b.t>=this.#oldest);this.#events=this.#events.filter(e=>e.t>=this.#oldest);
  this.#records=this.#records.filter(r=>r.source.arrival>=this.#oldest || this.#ships.some(s=>s.episode?.id===r.source.id));
 }
 delta(after=-1):TrafficDelta {
  const active=this.#ships.flatMap(s=>s.episode?[s.episode]:[]),stats={frames:this.#frames.length,boundaries:this.#boundaries.length,events:this.#events.length,episodes:this.#records.length,resourceAnchors:this.#resources.length,runnerNodes:active.reduce((n,e)=>n+e.execution.retainedNodes+(e.execution===e.runner?0:e.runner.retainedNodes),0),delivered:this.#ships.reduce((n,s)=>n+s.delivered,0)};
  return copy({frontier:this.#frontier,oldest:this.#oldest,frames:this.#frames.filter(f=>f.t>after),current:this.#frame(this.#frontier),boundaries:this.#boundaries.filter(b=>b.t>=after),resources:[this.#resources[0],...this.#resources.slice(1).filter(r=>r.t>=after)],episodes:this.#records.filter(r=>r.updatedAt>=after),events:this.#events.filter(e=>e.t>=after),stats,...(this.#halt?{halt:this.#halt}:{})});
 }
 snapshot(){return copy({frontier:this.#frontier,ships:this.#ships.map(s=>({id:s.id,stage:s.stage,cargo:s.cargoMass,fuel:s.fuel,used:s.used,routeIndex:s.routeIndex,voyage:s.voyage,eventAt:Number.isFinite(s.eventAt)?s.eventAt:null,portId:s.portId,reason:s.reason,windowIndex:s.windowIndex,episode:s.episode?{id:s.episode.id,departure:s.episode.departure,nextFact:s.episode.nextFact}:undefined,fault:s.fault,delivered:s.delivered})),resources:resourcesAt(this.#anchor,this.definition.stations,this.#frontier),current:this.#frame(this.#frontier)});}
}
