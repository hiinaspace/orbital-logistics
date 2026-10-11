import {ExpeditionFleetEngine,type ExpeditionFleetDefinition,type ExpeditionFleetDelta} from '../expedition/fleet';
import {EXPEDITION_LEAD,HISTORY,type ExpeditionCycleRow} from '../expedition/engine';
import {prepareCourier,type CourierDefinition} from './prepare';
import {courierSample,courierLastCycle,type LibrationSchedule} from './query';
import {type ResourceAnchor} from '../traffic/resources';
import type {Port} from '../sim/schema';
import type {VesselView,ViewSample} from '../model-set/model';
export interface LibrationDefinition {domain:'libration-service-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;source:ExpeditionFleetDefinition;station:Port;courier:CourierDefinition}
export const isLibration=(d:unknown):d is LibrationDefinition=>!!d&&typeof d==='object'&&(d as LibrationDefinition).domain==='libration-service-v1';
export interface CourierCycle {index:number;id:string;row:ExpeditionCycleRow}
export interface LibrationDelta {domain:'libration-service-v1';base:ExpeditionFleetDelta;template?:VesselView;schedule:LibrationSchedule;cycles:CourierCycle[];resources:ResourceAnchor[];current:ViewSample;stats:Record<string,number>}
interface SupplyFact {t:number;refills:number;deliveries:number}
export class LibrationEngine {
 readonly definition:LibrationDefinition;readonly base:ExpeditionFleetEngine;readonly courier:ReturnType<typeof prepareCourier>;
 #sent=false;#refills=0;#deliveries=0;#facts:SupplyFact[]=[{t:0,refills:0,deliveries:0}];#cycles=new Map<number,ExpeditionCycleRow>();#exported=new Set<number>();
 constructor(value:LibrationDefinition){
  if(!isLibration(value)||value.schemaVersion!==1||!value.id||!value.name)throw Error('Invalid libration service');
  this.definition=structuredClone(value);const source=this.definition.source.source.source,station=this.definition.station;
  const ids=[station.id,value.courier.id,value.courier.pad.id,...value.source.actors.map(a=>a.id),...value.source.actors.map(a=>a.padId),value.source.orbiter.id,...source.scenario.bodies.map(b=>b.id),source.ports[1].id];
  if(ids.some(x=>!x)||new Set(ids).size!==ids.length||source.entry.atmosphere.topHeight!==.2||station.cargo!==0||station.propellant!==0||station.cargoCapacity!==1||station.tankCapacity!==0)throw Error('Libration identity/provider admission');
  this.courier=prepareCourier(source.scenario,station,this.definition.courier);
  this.base=new ExpeditionFleetEngine(this.definition.source);
 }
 get frontier(){return this.base.frontier;}get oldest(){return this.base.oldest;}get halt(){return this.base.halt;}
 sample(t:number,left=false){return courierSample(this.courier.schedule,this.courier.template,t,this.courier.sample,left);}
 advanceTo(target:number){
  if(!Number.isFinite(target)||target<this.frontier||target>1_000_000||target-this.frontier>(this.frontier===0?32:8))throw Error('Libration advance outside work budget');
  const d=this.definition.courier,p=d.period;let refills=this.#refills,deliveries=this.#deliveries;
  const due:{t:number;kind:'refill'|'delivery'}[]=[];
  for(let k=refills; k*p+d.refill<=target;k++){due.push({t:k*p+d.refill,kind:'refill'});if(due.length>4)throw Error('Libration transaction budget');}
  for(let k=deliveries;k*p+d.unload<=target;k++){due.push({t:k*p+d.unload,kind:'delivery'});if(due.length>4)throw Error('Libration transaction budget');}
  due.sort((a,b)=>a.t-b.t);const facts:SupplyFact[]=[];
  for(const op of due){
   const before=this.sample(op.t,true),after=this.sample(op.t);
   if(op.kind==='refill'){
    if(before.logistics?.dockedPortId!==d.pad.id||after.logistics?.dockedPortId!==d.pad.id||Math.abs(after.propellant-before.propellant-this.courier.schedule.spent)>1e-10||after.propellant-before.propellant>d.maxImport||before.logistics.cargoMass!==0||after.logistics.cargoMass!==d.ship.cargoMass)throw Error('Libration funded refill invariant');
    refills++;
   }else{
    if(before.logistics?.dockedPortId!==this.definition.station.id||after.logistics?.dockedPortId!==this.definition.station.id||before.logistics.cargoMass!==d.ship.cargoMass||after.logistics.cargoMass!==0)throw Error('Libration parcel consumption invariant');
    deliveries++;
   }
   facts.push({t:op.t,refills,deliveries});
  }
  // All new supply/consumption facts are checked before the shared fleet advances.
  this.base.advanceTo(target);this.#refills=refills;this.#deliveries=deliveries;this.#facts.push(...facts);
  let i=0;while(i+1<this.#facts.length&&this.#facts[i+1].t<=this.oldest)i++;this.#facts=this.#facts.slice(i);
 }
 #resources(base:ResourceAnchor[]):ResourceAnchor[]{
  const epochs=[...new Set([this.oldest,...base.map(r=>r.t),...this.#facts.map(r=>r.t)].filter(t=>t>=this.oldest&&t<=this.frontier))].sort((a,b)=>a-b);
  return epochs.map(t=>{
   const row=[...base].reverse().find(r=>r.t<=t)!,fact=[...this.#facts].reverse().find(r=>r.t<=t)!;
   return {...row,t,stocks:[...row.stocks,{id:this.definition.station.id,cargo:0,propellant:0},{id:this.definition.courier.pad.id,cargo:0,propellant:0}],fuelImported:row.fuelImported+fact.refills*this.courier.schedule.spent,cargoImported:row.cargoImported+fact.refills*this.courier.schedule.parcel,cargoExported:row.cargoExported+fact.deliveries*this.courier.schedule.parcel};
  });
 }
 #cycle(index:number):ExpeditionCycleRow{
  const found=this.#cycles.get(index);if(found)return found;
  const p=this.courier.schedule,v=this.courier.template,offset=index*p.period,angle=p.rate*offset%(2*Math.PI),c=Math.cos(angle),s=Math.sin(angle),rot=(a:number[])=>[c*a[0]-s*a[1],s*a[0]+c*a[1],a[2]] as [number,number,number];
  const id=(x:string)=>v.id+':'+index+':'+x;
  const q=(t:number,left=false)=>this.sample(offset+t,left);
  const row:ExpeditionCycleRow={samples:v.samples.map(x=>q(x.t)),arcs:v.arcs.map(a=>({...a,id:id(a.id),start:offset+a.start,end:offset+a.end,direction:rot(a.direction),steering:{...a.steering!,keys:a.steering!.keys.map(k=>({...k,direction:rot(k.direction)}))}})),ledger:v.ledger.filter(e=>e.t>0).map(e=>({...e,id:id(e.id),t:offset+e.t})),boundaries:v.boundaries.filter(b=>b.t<p.period).map(b=>({t:offset+b.t,before:q(b.t,true),after:q(b.t)})),bytes:0};
  row.bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength;if(row.bytes>2_000_000||row.samples.length>4000)throw Error('Courier cycle allocation budget');
  this.#cycles.set(index,row);return row;
 }
 delta():LibrationDelta{
  const base=this.base.delta(),p=this.courier.schedule,end=Math.min(p.maxEpoch,this.frontier+EXPEDITION_LEAD),last=courierLastCycle(p,end),first=Math.floor(this.oldest/p.period);
  for(const k of this.#cycles.keys())if(k<first||k>last){this.#cycles.delete(k);this.#exported.delete(k);}
  const cycles:CourierCycle[]=[];
  for(let index=first;index<=last;index++){const row=this.#cycle(index);if(!this.#exported.has(index)){cycles.push({index,id:this.definition.courier.id,row});this.#exported.add(index);}}
  const drawingBytes=[...this.#cycles.values()].reduce((n,r)=>n+r.bytes,0),drawingSamples=[...this.#cycles.values()].reduce((n,r)=>n+r.samples.length,0);
  const stats={...base.stats,cacheCompilations:base.stats.cacheCompilations+1,courierCompilations:1,courierTrips:Math.max(0,Math.floor((this.frontier-this.definition.courier.landing)/p.period)+1),courierRefills:this.#refills,parcelsDelivered:this.#deliveries*p.parcel,courierCycles:this.#cycles.size,courierDrawingBytes:drawingBytes,courierDrawingSamples:drawingSamples,physicsBytes:base.stats.physicsBytes+this.courier.work.physicsBytes,physicalNodes:base.stats.physicalNodes+this.courier.work.nodes,workerDrawingBytes:base.stats.workerDrawingBytes+drawingBytes,workerDrawingSamples:base.stats.workerDrawingSamples+drawingSamples,packetBytes:0};
  const packet:LibrationDelta={domain:'libration-service-v1',base,schedule:p,cycles,resources:this.#resources(base.resources),current:this.sample(this.frontier),stats,...(!this.#sent?{template:this.courier.template}:{})};this.#sent=true;
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if(stats.packetBytes>(packet.template?36_000_000:16_000_000)||stats.physicalNodes>165000||stats.physicsBytes>60_000_000||stats.workerDrawingBytes>84_000_000||drawingBytes>12_000_000||drawingSamples>24000||packet.resources.length>22)throw Error('Libration aggregate storage budget');
  return packet;
 }
}
