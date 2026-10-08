import {sampleVessel,type SceneView,type VesselView,type ViewSample} from '../model-set/model';
import {portState} from '../sim/logistics';
import type {EventBoundary} from '../sim/runner';
import type {TrafficDefinition} from './planner';
import type {TrafficDelta,FleetFrame,FleetBoundary,FleetEvent,EpisodeRecord} from './engine';
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
   const actual=merge(this.frames,[this.current],f=>f.t).sort((a,b)=>a.t-b.t).map(f=>f.ships[index]);
   const boundaries:EventBoundary[]=this.boundaries.map(b=>({t:b.t,before:b.before.ships[index],after:b.after.ships[index]}));
   const base:VesselView={...v,ship:s.ship,ports:s.logistics!.ports,cargoCapacity:s.logistics!.cargoCapacity,arcs,continuousFuel:true,portSamples:{},samples:actual,ledger:this.events.filter(e=>e.shipId===v.id),boundaries};
   const at=sampleVessel(base,cursor),samples=actual.filter(a=>a.t<cursor);samples.push(at);
   const plan=records.find(r=>r.source.arrival>cursor && (r.faultAt===undefined || r.faultAt>cursor));
   let previous=at;
   const epochs=[...new Set([end,...Array.from({length:Math.ceil((end-cursor)*16)},(_,i)=>cursor+(i+1)/16).filter(t=>t<end),...(plan?plan.samples.filter(a=>a.t>cursor && a.t<end).map(a=>a.t):[])])].sort((a,b)=>a-b);
   for(const t of epochs) {
    let next:ViewSample;
    if(plan && t>=plan.source.departure && t<=plan.source.arrival) {
     const pv={...base,arcs,samples:plan.samples,boundaries:plan.boundaries};next=sampleVessel(pv,t);
    }else if(previous.activity?.kind==='fault')next={...previous,t};
    else {
     const port=s.logistics!.ports.find(p=>p.id===previous.logistics?.dockedPortId);
     if(!port)throw new Error('Missing trajectory coverage');
     next={...previous,t,y:portState(port,t),thrust:undefined,logistics:{...previous.logistics!,...(previous.logistics?.service && t>=previous.logistics.service.end?{service:undefined}:{})}};
    }
    samples.push(next);previous=next;
   }
   const future=plan?plan.events.filter(e=>e.t>cursor && e.t<=end):[];
   return {...base,samples,ledger:[...base.ledger.filter(e=>e.t<=cursor),...future],boundaries:[...boundaries.filter(b=>b.t<=cursor),...(plan?plan.boundaries.filter(b=>b.t>cursor && b.t<=end):[])]};
  });
  return {schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:d.stations,rotating:d.rotating,vessels,portSamples:{},world:{bodies:s.bodies,ports:s.logistics!.ports,units:s.units},window:{start:this.oldest,end},traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.resources,depots:d.stations,stats:{...this.stats,viewFrames:this.frames.length,viewEpisodes:this.episodes.length},halt:this.halt}};
 }
}
