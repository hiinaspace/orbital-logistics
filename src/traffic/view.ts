import {sampleVessel,type SceneView,type VesselView,type ViewSample} from '../model-set/model';
import {portState} from '../sim/logistics';
import type {EventBoundary} from '../sim/runner';
import type {TrafficDefinition} from './planner';
import {DENSE_SAMPLE_BUDGET,type TrafficDelta,type FleetFrame,type FleetBoundary,type FleetEvent,type EpisodeRecord} from './engine';
import type {ResourceAnchor} from './resources';
const merge=<T>(a:T[],b:T[],key:(x:T)=>string|number):T[]=>[...new Map([...a,...b].map(x=>[key(x),x])).values()];
// Disposable display history. It is never a source for physical restarts.
export class TrafficViewStore {
 frames:FleetFrame[]=[];boundaries:FleetBoundary[]=[];events:FleetEvent[]=[];episodes:EpisodeRecord[]=[];resources:ResourceAnchor[]=[];
 frontier=0;oldest=0;watermark=0;current!:FleetFrame;stats:Record<string,number>={};halt?:string;
 constructor(readonly definition:TrafficDefinition){}
 ingest(p:TrafficDelta,held=false) {
  this.frontier=p.frontier;this.watermark=p.oldest;this.current=p.current;this.stats=p.stats;this.halt=p.halt;
  this.frames=merge(this.frames,p.frames,f=>f.t).sort((a,b)=>a.t-b.t);
  this.boundaries=merge(this.boundaries,p.boundaries,b=>b.t).sort((a,b)=>a.t-b.t);
  this.events=merge(this.events,p.events,e=>e.id).sort((a,b)=>a.t-b.t);
  this.episodes=merge(this.episodes,p.episodes,r=>r.source.id);
  this.resources=merge(this.resources,p.resources,r=>r.t).sort((a,b)=>a.t-b.t);
  if(!held)this.release();
  // One pending <=1-unit reply may bring one extra episode while eviction is held.
  if(this.episodes.reduce((n,r)=>n+r.samples.length+(r.executionSamples?.length??0),0)>DENSE_SAMPLE_BUDGET+16384)throw new Error('Held episode drawing budget exceeded');
 }
 release() {
  this.oldest=this.watermark;
  const anchor=<T extends {t:number}>(rows:T[])=>{let i=0;while(i+1<rows.length && rows[i+1].t<=this.oldest)i++;return rows.slice(i);};
  this.frames=anchor(this.frames);this.resources=anchor(this.resources);
  this.boundaries=this.boundaries.filter(b=>b.t>=this.oldest);this.events=this.events.filter(e=>e.t>=this.oldest);
  this.episodes=this.episodes.filter(r=>r.source.arrival>=this.oldest);
 }
 view(cursor:number):SceneView {
  if(cursor<this.oldest || cursor>this.frontier)throw new Error('Cursor outside retained traffic');
  const d=this.definition,s=d.world.scenario,end=this.frontier+d.forecastDuration;
  const known=this.episodes.filter(r=>r.source.admittedAt<=cursor);
  const vessels=d.vessels.map((v,index):VesselView=>{
   const records=known.filter(r=>r.source.shipId===v.id),arcs=records.flatMap(r=>r.source.bundle.program.thrustArcs!.map(a=>({...a,start:a.start+r.source.departure,end:a.end+r.source.departure})));
   // Immutable Runner identity guarantees prediction/execution equivalence in
   // production. A divergent executor supplies its own committed dense prefix.
   // Fleet event frames win at attachment/service/fault epochs.
   const dense=records.filter(r=>r.source.arrival>=cursor-12).flatMap(r=>(r.executionSamples??r.samples).filter(p=>p.t>=Math.max(this.oldest,cursor-12) && p.t<=cursor && p.t<r.source.arrival && (r.faultAt===undefined || p.t<r.faultAt)));
   const actual=merge(dense,merge(this.frames,[this.current],f=>f.t).map(f=>f.ships[index]),f=>f.t).sort((a,b)=>a.t-b.t);
   const boundaries:EventBoundary[]=merge(records.flatMap(r=>r.executionBoundaries??r.boundaries).filter(b=>b.t<=cursor),this.boundaries.map(b=>({t:b.t,before:b.before.ships[index],after:b.after.ships[index]})),b=>b.t).sort((a,b)=>a.t-b.t);
   const trajectories=records.filter(r=>r.source.departure<=cursor && (r.executionSamples??r.samples).length>0).map(r=>({start:r.source.departure,end:Math.min(r.source.arrival,r.faultAt??Infinity),through:cursor,samples:r.executionSamples??r.samples,boundaries:r.executionBoundaries??r.boundaries,arcs:r.executionArcs}));
   const base:VesselView={...v,ship:s.ship,ports:s.logistics!.ports,cargoCapacity:s.logistics!.cargoCapacity,arcs,continuousFuel:true,portSamples:{},samples:actual,ledger:this.events.filter(e=>e.shipId===v.id),boundaries,trajectories};
   const at=sampleVessel(base,cursor),samples=actual.filter(a=>a.t<cursor);samples.push(at);
   const plan=records.find(r=>r.source.arrival>cursor && (r.faultAt===undefined || r.faultAt>cursor));
   const plannedSamples=plan?new Map(plan.samples.map(p=>[p.t,p])):undefined;
   let previous=at;
   const epochs=[...new Set([end,...Array.from({length:Math.ceil((end-cursor)*16)},(_,i)=>cursor+(i+1)/16).filter(t=>t<end),...(plan?plan.samples.filter(a=>a.t>cursor && a.t<end).map(a=>a.t):[])])].sort((a,b)=>a-b);
   for(const t of epochs) {
    let next:ViewSample;
    if(plan && t>=plan.source.departure && t<=plan.source.arrival) {
     const pv={...base,trajectories:undefined,arcs,samples:plan.samples,boundaries:plan.boundaries};next=plannedSamples!.get(t)??sampleVessel(pv,t);
    }else if(previous.activity?.kind==='fault')next={...previous,t};
    else {
     const port=s.logistics!.ports.find(p=>p.id===previous.logistics?.dockedPortId);
     if(!port)throw new Error('Missing trajectory coverage');
     next={...previous,t,y:portState(port,t),thrust:undefined,logistics:{...previous.logistics!,...(previous.logistics?.service && t>=previous.logistics.service.end?{service:undefined}:{})}};
    }
    samples.push(next);previous=next;
   }
   const future=plan?plan.events.filter(e=>e.t>cursor && e.t<=end):[];
   return {...base,samples,trajectories:[...trajectories,...(plan?[{start:Math.max(cursor,plan.source.departure),end:plan.source.arrival,through:plan.source.arrival,samples:plan.samples,boundaries:plan.boundaries}]:[])],ledger:[...base.ledger.filter(e=>e.t<=cursor),...future],boundaries:[...boundaries.filter(b=>b.t<=cursor),...(plan?plan.boundaries.filter(b=>b.t>cursor && b.t<=end):[])]};
  });
  return {schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:d.stations,rotating:d.rotating,vessels,portSamples:{},world:{bodies:s.bodies,ports:s.logistics!.ports,units:s.units},window:{start:this.oldest,end},traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.resources,depots:d.stations,stats:{...this.stats,viewFrames:this.frames.length,viewEpisodes:this.episodes.length},halt:this.halt}};
 }
}
