import type {SceneView,VesselView,ViewSample,ViewerEvent} from '../model-set/model';
import type {PassThroughTemplate} from './types';
import {samplePassThrough,FLEET_MAX_EPOCH} from './query';
import {createPassThroughView,passThroughResources} from './view';
import type {ResourceAnchor,Depot} from '../traffic/resources';
export const FLEET_LEAD=32,FLEET_CHUNK=8,FLEET_HISTORY=4*120.50467632722804,FLEET_RETENTION=FLEET_HISTORY+FLEET_LEAD;
export const FLEET_ROWS=40000,FLEET_BYTES=24_000_000,FLEET_CHUNKS=68;
export interface FleetServiceDefinition {domain:'cycler-fleet-service-v1';schemaVersion:1;id:string;name:string;artifactUrl?:string}
export const isFleetService=(v:unknown):v is FleetServiceDefinition=>(v as FleetServiceDefinition)?.domain==='cycler-fleet-service-v1';
export interface FleetChunk {index:number;start:number;end:number;vessels:{samples:ViewSample[];arcs:VesselView['arcs'];ledger:ViewerEvent[];boundaries:VesselView['boundaries']}[];bytes:number;samples:number}
export const fleetDepots=(p:PassThroughTemplate):Depot[]=>['Cairn','Haven'].map(id=>({id,role:'Surface parcels',cargo:0,propellant:0,cargoRate:0,propellantRate:0,cargoCapacity:1,tankCapacity:10,berths:id==='Cairn'?2:1}));
export function fleetResources(p:PassThroughTemplate,t:number):ResourceAnchor{return {...passThroughResources(p,t),stocks:['Cairn','Haven'].map(id=>({id,cargo:0,propellant:0})),fuelExported:0};}
export function fleetChunk(p:PassThroughTemplate,index:number):FleetChunk {
 const start=index*FLEET_CHUNK,end=Math.min(FLEET_MAX_EPOCH,start+FLEET_CHUNK);
 if(!Number.isInteger(index)||index<0||end<=start)throw Error('Fleet chunk calendar');
 const vessels=p.hardware.map((_,actor)=>{
  const sample=(t:number,left=false)=>samplePassThrough({template:p,actor,continuous:true},t,left),times=new Set([start,end]),arcs:VesselView['arcs']=[],ledger:ViewerEvent[]=[],boundaries:VesselView['boundaries']=[];
  for(let k=Math.max(0,Math.floor(start/p.duration)-1);k<=Math.floor(end/p.duration);k++){
   const offset=k*p.duration;
   for(const phase of p.phases[actor]){
    const a=offset+phase.start,b=offset+phase.end;if(b<start||a>end)continue;
    if(a>=start&&a<=end)times.add(a);if(b>=start&&b<=end)times.add(b);
    if(phase.rows)for(const r of phase.rows){const t=offset+r[0];if(t>=start&&t<=end)times.add(t);}
    else for(let t=Math.max(a,start);t<Math.min(b,end);t+=.5)times.add(t);
    if(actor>=2&&phase.control&&b>start&&a<end){const mid=(a+b)/2,q=sample(mid),direction=q.thrust?.direction??[1,0,0];arcs.push({id:k+':'+phase.control.id,start:Math.max(start,a),end:Math.min(end,b),direction,throttle:1});}
   }
   for(const e of p.events.filter(e=>e.actor===actor&&(actor>=2||e.kind==='maintenance'))){
    const t=offset+e.t;if(t<start||t>=end&&end!==FLEET_MAX_EPOCH||t>end)continue;
    times.add(t);const scale=actor<2?Math.exp(-k*p.recurrence!.carrierDeltaV[actor]/p.exhaustVelocity):1;
    const before=actor<2?(4+e.beforeFuel)*scale-4:e.beforeFuel,after=actor<2?(4+e.afterFuel)*scale-4:e.afterFuel;
    ledger.push({t,kind:e.kind==='maintenance'?'milestone':e.kind,id:k+':'+actor+':'+e.id,label:e.label,portId:e.port,deltaV:e.deltaV,fuelUsed:e.kind==='transfer'?0:before-after,propellantBefore:before,propellantAfter:after,positionError:e.positionError,cargoBefore:e.cargoBefore,cargoAfter:e.cargoAfter});
    if(e.kind!=='milestone')boundaries.push({t,before:sample(t,true),after:sample(t)});
   }
  }
  return {samples:[...times].sort((a,b)=>a-b).map(t=>sample(t)),arcs,ledger,boundaries};
 });
 const chunk: FleetChunk={index,start,end,vessels,bytes:0,samples:vessels.reduce((n,v)=>n+v.samples.length,0)};chunk.bytes=new TextEncoder().encode(JSON.stringify(chunk)).byteLength;
 if(chunk.bytes>2_000_000||chunk.samples>2500)throw Error('Fleet pending chunk budget');return chunk;
}
export function fleetBase(p:PassThroughTemplate,d:FleetServiceDefinition):SceneView {
 const scene=createPassThroughView(p,{schemaVersion:1,modelVersion:'cycler-fleet-set-v1',id:d.id,name:d.name});
 for(const v of scene.vessels.slice(0,2))delete v.ship.engine;
 scene.description='Wayfarer and Nomad carry Pipit and Wren between Aster and Selene, with long surface visits and parking orbits.';
 scene.provenance='Fictional maintained cycler recurrence: canonical forward-admitted acceleration commands, tightly bounded numerical phase projection and permanently paid carrier maintenance fuel. Geometry is cached by rotating symmetry; ground reloads are explicitly funded. Continuous operation retains rolling history; held scrubbing and Live share one clock.';
 return scene;
}
export function fleetWindow(base:SceneView,p:PassThroughTemplate,start:number,end:number,chunks:FleetChunk[]):SceneView {
 const vessels=base.vessels.map((v,actor)=>{
  const sample=(t:number)=>samplePassThrough({template:p,actor,continuous:true,oldest:start,end},t);
  const samples=chunks.flatMap(c=>c.vessels[actor].samples).filter(s=>s.t>=start&&s.t<=end);samples.push(sample(start),sample(end));
  const unique=[...new Map(samples.map(s=>[s.t,s])).values()].sort((a,b)=>a.t-b.t);
  return {...v,passThrough:{template:p,actor,continuous:true,oldest:start,end},samples:unique,
   arcs:chunks.flatMap(c=>c.vessels[actor].arcs).filter(a=>a.end>start&&a.start<end),ledger:chunks.flatMap(c=>c.vessels[actor].ledger).filter(e=>e.t>=start&&e.t<=end),boundaries:chunks.flatMap(c=>c.vessels[actor].boundaries).filter(b=>b.t>=start&&b.t<=end)};
 });
 if(vessels.reduce((n,v)=>n+v.samples.length,0)>FLEET_ROWS)throw Error('Fleet retained scene samples');
 return {...base,vessels,window:{start,end}};
}
