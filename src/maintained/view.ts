import {sampleVessel,displayPortState,type SceneView,type VesselView,type ViewSample,type MaintainedView} from '../model-set/model';
import type {Port,State} from '../sim/schema';
import type {EventBoundary} from '../sim/runner';
import type {FleetFrame,FleetEvent,FleetBoundary} from '../traffic/engine';
import type {ResourceAnchor} from '../traffic/resources';
import type {MaintainedDefinition,WorldChunk} from './world';
import type {MaintainedDelta,VisitRecord} from './engine';
const merge=<T>(a:T[],b:T[],key:(x:T)=>string|number)=>b.length?[...new Map([...a,...b].map(x=>[key(x),x])).values()]:a;
const sorted=<T extends {t:number}>(rows:T[])=>merge([],rows,r=>r.t).sort((a,b)=>a.t-b.t);
export class MaintainedViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};current!:FleetFrame;
 frames:FleetFrame[]=[];events:FleetEvent[]=[];boundaries:FleetBoundary[]=[];resources:ResourceAnchor[]=[];chunks:WorldChunk[]=[];visits:VisitRecord[]=[];
 #sizes=new Map<string,number>();
 #heldCurrent?:FleetFrame;
 #streams?:{key:string;station:ViewSample[];origin:{t:number;y:State}[];baseline:{t:number;y:State}[];arcs:WorldChunk['arcs']};
 constructor(readonly definition:MaintainedDefinition){}
 ingest(p:MaintainedDelta,held=false){
  if(p.domain!=='maintained-relay-v1')throw Error('Wrong maintained worker packet');
  if(held&&!this.#heldCurrent)this.#heldCurrent=this.current;
  this.frontier=p.frontier;this.watermark=p.oldest;this.current=p.current;this.halt=p.halt;Object.assign(this.stats,p.stats);
  // Chunks are immutable and retries can resend the same forecast while the
  // head waits for a solver. Keep their cached drawing streams and byte counts.
  const chunkIds=new Set(this.chunks.map(c=>c.id)),newChunks=p.chunks.filter(c=>!chunkIds.has(c.id));
  const visitEpochs=new Map(this.visits.map(v=>[v.id,v.updatedAt])),newVisits=p.visits.filter(v=>visitEpochs.get(v.id)!==v.updatedAt);
  this.frames=sorted([...this.frames,...p.frames]);this.events=merge(this.events,p.events,e=>e.id).sort((a,b)=>a.t-b.t);this.boundaries=sorted([...this.boundaries,...p.boundaries]);this.resources=sorted([...this.resources,...p.resources]);this.chunks=merge(this.chunks,newChunks,c=>c.id).sort((a,b)=>a.start-b.start);this.visits=merge(this.visits,newVisits,v=>v.id);
  if(!held)this.release();
  const groups:[string,unknown[],(row:any)=>string|number][]=[['f',p.frames,r=>r.t],['b',p.boundaries,r=>r.t],['e',p.events,r=>r.id],['r',p.resources,r=>r.t],['c',newChunks,r=>r.id],['v',newVisits,r=>r.id]];
  for(const [prefix,rows,key] of groups)for(const row of rows)this.#sizes.set(`${prefix}:${key(row)}`,new TextEncoder().encode(JSON.stringify(row)).byteLength+4);
  const live=new Set([...this.frames.map(r=>`f:${r.t}`),...this.boundaries.map(r=>`b:${r.t}`),...this.events.map(r=>`e:${r.id}`),...this.resources.map(r=>`r:${r.t}`),...this.chunks.map(r=>`c:${r.id}`),...this.visits.map(r=>`v:${r.id}`)]);
  for(const key of this.#sizes.keys())if(!live.has(key))this.#sizes.delete(key);
  const bytes=4096+[...this.#sizes.values()].reduce((a,b)=>a+b,0);
  if(bytes>8_000_000||this.chunks.length>24||this.visits.length>7||this.frames.length>2200)throw Error('Maintained held view budget exceeded');this.stats.viewBytes=bytes;
 }
 release(){this.#heldCurrent=undefined;this.oldest=this.watermark;const anchor=<T extends {t:number}>(a:T[])=>{let i=0;while(i+1<a.length&&a[i+1].t<=this.oldest)i++;return a.slice(i);};this.frames=anchor(this.frames);this.resources=anchor(this.resources);this.boundaries=this.boundaries.filter(b=>b.t>=this.oldest);this.events=this.events.filter(e=>e.t>=this.oldest);this.chunks=this.chunks.filter(c=>c.end>=this.oldest);this.visits=this.visits.filter(v=>v.arrival+2>=this.oldest);}
 view(cursor:number):SceneView {
  if(cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside maintained history');
  const d=this.definition,world=d.world.scenario,chunks=this.chunks.filter(c=>c.knownAt<=cursor),end=Math.min(cursor+40,chunks.at(-1)!.end);
  const key=chunks.map(c=>c.id).join(',');
  if(this.#streams?.key!==key)this.#streams={key,station:sorted(chunks.flatMap(c=>c.station)),origin:sorted(chunks.flatMap(c=>c.origin)),baseline:sorted(chunks.flatMap(c=>c.baseline)),arcs:chunks.flatMap(c=>c.arcs)};
  const {station:stationSamples,origin,baseline,arcs}=this.#streams;
  const common={epoch:stationSamples[0].t,validUntil:end,policy:world.policy,minClearance:.2,provenance:'Disposable live display descriptor; physical providers remain in the worker.'};
  const base={cargo:0,cargoCapacity:0,propellant:0,tankCapacity:0,serviceDuration:.25};
  const ports:Port[]=[{...base,id:d.origin.id,rail:{...common,kind:'ballistic',state:origin[0].y}},{...base,id:d.relay.id,rail:{...common,kind:'powered',state:stationSamples[0].y,propulsion:{...d.relay.ship,engine:d.relay.ship.engine!},minPropellant:0,program:{schemaVersion:3,id:'display-controls',burns:[],thrustArcs:arcs}}}];
  const portSamples={[d.origin.id]:origin,[d.relay.id]:stationSamples.map(s=>({t:s.t,y:s.y}))};
  const maintained:MaintainedView={id:d.relay.id,name:d.relay.id,color:'#85c9c0',cargo:'Ballast',ship:d.relay.ship,ports:[],cargoCapacity:0,arcs,continuousFuel:true,portSamples:{},samples:stationSamples,ledger:chunks.flatMap(c=>c.ledger),boundaries:chunks.flatMap(c=>c.boundaries),baseline};
  const known=this.visits.filter(v=>v.knownAt<=cursor),plan=known.find(v=>v.departure+32>cursor && (v.faultAt===undefined||v.faultAt>cursor));
  // Past cursors need a committed right bracket and event-left states, even
  // when the cursor lies between drawing-grid samples. Keep one paused head
  // separately so acknowledging a pending reply cannot change that exact pose.
  const dense=known.flatMap(v=>(v.executionSamples??v.samples).filter(s=>s.t<=this.frontier&&s.t>=this.oldest));
  const actual=sorted([...dense,...this.frames.map(f=>f.ships[0]),this.current.ships[0],...(this.#heldCurrent?[this.#heldCurrent.ships[0]]:[])]);
  const shipArcs=known.flatMap(v=>v.bundle.program.thrustArcs!),boundary:EventBoundary[]=sorted([...known.flatMap(v=>v.executionBoundaries??v.boundaries).filter(b=>b.t<=this.frontier),...this.boundaries.map(b=>({t:b.t,before:b.before.ships[0],after:b.after.ships[0]}))]);
  const baseV:VesselView={...d.vessels[0],ship:world.ship,ports,cargoCapacity:.1,arcs:shipArcs,continuousFuel:true,portSamples,samples:actual,ledger:this.events.filter(e=>e.t<=cursor),boundaries:boundary};
  const at=sampleVessel(baseV,cursor),samples=actual.filter(s=>s.t<cursor);samples.push(at);
  const prediction=plan?{...baseV,samples:plan.samples,boundaries:plan.boundaries}:undefined;
  const plannedSamples=new Map(plan?.samples.map(s=>[s.t,s])??[]);
  // The admitted plan already has a dense drawing grid and exact event samples.
  // Do not overlay another cursor-relative grid and clone/interpolate it anew
  // on every reply. Unplanned attached coasts still get their drawing samples.
  const times=[...new Set([end,...Array.from({length:Math.ceil((end-cursor)*32)},(_,i)=>cursor+(i+1)/32).filter(t=>t<end && !(plan && t>=plan.departure && t<=plan.departure+32)),...(plan?plan.samples.filter(s=>s.t>cursor&&s.t<=end).map(s=>s.t):[])])].sort((a,b)=>a-b);
  for(const t of times){let s:ViewSample;
   if(plan&&t>=plan.departure&&t<=plan.departure+32)s=plannedSamples.get(t)??sampleVessel(prediction!,t);
   else if(at.activity?.kind==='fault')s={...at,t};
   else{const previous=samples.at(-1)!,id=previous.logistics?.dockedPortId??d.origin.id;s={...previous,t,y:displayPortState(ports.find(p=>p.id===id)!,portSamples,t),thrust:undefined,logistics:{...previous.logistics!,service:undefined}};}
   samples.push(s);
  }
  const vessel={...baseV,samples,ledger:[...baseV.ledger,...(plan?plan.events.filter(e=>e.t>cursor&&e.t<=end):[])],boundaries:[...boundary.filter(b=>b.t<=cursor),...(plan?plan.boundaries.filter(b=>b.t>cursor&&b.t<=end):[])]};
  return {schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:d.extent,rotating:d.rotating,stations:d.stations.map(p=>({...p,...(p.id===d.relay.id?{maintenance:{reference:d.reference,checks:chunks.map(c=>c.check)}}:{})})),vessels:[vessel],maintained:{[d.relay.id]:maintained},portSamples,world:{bodies:world.bodies,ports,units:world.units},window:{start:this.oldest,end},traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.resources,depots:d.stations,stats:this.stats,halt:this.halt}};
 }
}
