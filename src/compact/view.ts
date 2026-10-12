import type {SceneView,VesselView,ViewSample,ViewerEvent} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
import {world} from './prepare';
import {sampleCompact,ownSample,rotate} from './query';
import type {CompactTemplate,CompactDefinition,CompactPlayback} from './types';
export interface CycleRow {index:number;vessels:{samples:ViewSample[];arcs:VesselView['arcs'];ledger:ViewerEvent[];boundaries:VesselView['boundaries']}[];bytes:number;samples:number}
export const depots=(p:CompactTemplate):Depot[]=>world(p).ports.map(x=>({id:x.id,role:'Supply',cargo:0,propellant:0,cargoRate:0,propellantRate:0,cargoCapacity:1,tankCapacity:10,berths:1}));
export function resourcesAt(p:CompactTemplate,t:number):ResourceAnchor {
 let fuelImported=0,cargoImported=0,cargoExported=0;
 for(const f of p.flows){const count=Math.max(0,Math.floor((t-f.t)/p.period)+1);if(f.kind==='import'){fuelImported+=count*f.fuel;cargoImported+=count*f.cargo;}else cargoExported+=count*f.cargo;}
 return {t,stocks:world(p).ports.map(x=>({id:x.id,cargo:0,propellant:0})),fuelImported,cargoImported,cargoExported,fuelExported:0};
}
export function cycleRow(p:CompactTemplate,index:number):CycleRow {
 const offset=index*p.period,angle=p.rate*offset%(2*Math.PI),playback=(actor:number):CompactPlayback=>({template:p,actor,oldest:0,end:1_000_000,maxEpoch:1_000_000});
 const vessels=p.hardware.map((hardware,actor)=>{
  const times=new Set([0,p.period,...p.events.filter(e=>e.actor===actor).map(e=>e.t)]);
  for(const phase of p.phases[actor]){times.add(phase.start);times.add(phase.end);const h=phase.kind==='flight'?(phase.control?1/128:1/32):1/8;for(let t=phase.start;t<phase.end;t+=h)times.add(t);}
  const sample=(t:number,left=false)=>sampleCompact(playback(actor),offset+t,left);
  const samples=[...times].filter(t=>offset+t<=1_000_000).sort((a,b)=>a-b).map(t=>sample(t));
  const arcs=p.phases[actor].filter(x=>x.control).map(x=>{const c=x.control!,v=c.keys.find(k=>Math.hypot(...k.slice(1))>1e-9)!.slice(1),n=Math.hypot(...v);return {id:index+':'+c.id,start:offset+c.start,end:offset+c.end,direction:rotate(v.map(x=>x/n),angle),throttle:1};});
  const ledger=p.events.filter(e=>e.actor===actor&&offset+e.t<=1_000_000).map(e=>({t:offset+e.t,kind:e.kind,id:index+':'+e.id,label:e.label,portId:e.port,deltaV:e.deltaV,fuelUsed:e.fuelUsed,propellantBefore:e.beforeFuel,propellantAfter:e.afterFuel,positionError:e.positionError}));
  const boundaries=p.events.filter(e=>e.actor===actor&&offset+e.t<=1_000_000).map(e=>({t:offset+e.t,before:sample(e.t,true),after:sample(e.t)}));
  return {samples,arcs,ledger,boundaries};
 });
 const row={index,vessels,bytes:0,samples:vessels.reduce((n,v)=>n+v.samples.length,0)};row.bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength;
 if(row.bytes>6_000_000||row.samples>12000)throw Error('Compact cycle drawing budget');return row;
}
export function createView(p:CompactTemplate,d:CompactDefinition,start:number,end:number,cycles:CycleRow[]):SceneView {
 const w=world(p),vessels:VesselView[]=p.hardware.map((hardware,actor)=>{
  const q=ownSample(p,actor,0),playback={template:p,actor,oldest:start,end,maxEpoch:d.continuous?1_000_000:p.period};
  const samples=cycles.flatMap(c=>c.vessels[actor].samples).filter(s=>s.t>=start&&s.t<=end);samples.push(sampleCompact(playback,start),sampleCompact(playback,end));
  const unique=[...new Map(samples.map(s=>[s.t,s])).values()].sort((a,b)=>a.t-b.t);
  const ledger=cycles.flatMap(c=>c.vessels[actor].ledger).filter(e=>e.t>=start&&e.t<=end),arcs=cycles.flatMap(c=>c.vessels[actor].arcs).filter(a=>a.end>start&&a.start<end).map(a=>({...a,start:Math.max(start,a.start),end:Math.min(end,a.end)}));
  return {compact:playback,id:hardware.id,name:hardware.name,color:hardware.color,cargo:actor?'Parcels':'Carried vehicles',cargoCapacity:hardware.cargo,ship:{id:hardware.id,state:q.y,dryMass:hardware.dryMass,cargoMass:hardware.cargo,propellant:hardware.fuel,tankCapacity:hardware.fuel,exhaustVelocity:p.exhaustVelocity,engine:{maxThrust:hardware.maxForce,maxAcceleration:hardware.maxAcceleration}},ports:w.ports,portSamples:{},samples:unique,arcs,ledger,boundaries:cycles.flatMap(c=>c.vessels[actor].boundaries).filter(b=>b.t>=start&&b.t<=end),interpolation:'hermite',continuousFuel:true,glyph:'rocket'};
 });
 if(vessels.reduce((n,v)=>n+v.samples.length,0)>40000)throw Error('Compact retained sample budget');
 return {compact:p,schemaVersion:1,id:d.id,name:d.name,description:'Wayfarer coasts past Aster while Pipit carries parcels between Cairn and Haven.',provenance:'Fictional airless Aster–Selene cycler. Full-field canonical forward propagation; bounded acceleration commands, paid captures and resupply. Synchronous supported pads and the actual-field Beacon equilibrium allow exact rotated reuse. Separate tanks; explicit supply imports and parcel consumption.',extent:7.1,frameExtents:{Aster:4,Selene:1.4,Cairn:2,Haven:1,Beacon:2},world:w,rotating:{name:'Aster–Selene rotating',rate:p.rate,phase:0},window:{start,end},stations:w.ports.map(x=>({id:x.id,role:x.id==='Beacon'?'Cycler resupply':'Surface parcels',berths:1})),portSamples:{},vessels,playback:{rateScale:1,trailSpan:80,forecastSpan:80,maxZoom:1e6}};
}
