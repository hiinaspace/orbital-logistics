import {prepareCourier,type CourierDefinition} from './prepare';
import {courierSample,courierLastCycle} from './query';
import {EXPEDITION_LEAD,type ExpeditionCycleRow} from '../expedition/engine';
import type {ResourceAnchor} from '../traffic/resources';
import type {Scenario,Port} from '../sim/schema';
export interface CourierCycle {index:number;id:string;row:ExpeditionCycleRow}
interface SupplyFact {t:number;refills:number;deliveries:number}
// Independent funded courier clock. The containing service owns publication.
export class CourierService {
 readonly courier:ReturnType<typeof prepareCourier>;
 #refills=0;#deliveries=0;#facts:SupplyFact[]=[{t:0,refills:0,deliveries:0}];#cycles=new Map<number,ExpeditionCycleRow>();#exported=new Set<number>();
 constructor(readonly scenario:Scenario,readonly station:Port,readonly definition:CourierDefinition){this.courier=prepareCourier(scenario,station,definition);}
 sample(t:number,left=false){return courierSample(this.courier.schedule,this.courier.template,t,this.courier.sample,left);}
 advanceTo(target:number,oldest:number){
  const d=this.definition,p=d.period;let refills=this.#refills,deliveries=this.#deliveries;
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
    if(before.logistics?.dockedPortId!==this.station.id||after.logistics?.dockedPortId!==this.station.id||before.logistics.cargoMass!==d.ship.cargoMass||after.logistics.cargoMass!==0)throw Error('Libration parcel consumption invariant');
    deliveries++;
   }
   facts.push({t:op.t,refills,deliveries});
  }
  // All new supply/consumption facts are checked before the shared fleet advances.
  this.#refills=refills;this.#deliveries=deliveries;this.#facts.push(...facts);
  let i=0;while(i+1<this.#facts.length&&this.#facts[i+1].t<=oldest)i++;this.#facts=this.#facts.slice(i);
 }
 resources(base:ResourceAnchor[],oldest:number,frontier:number):ResourceAnchor[]{
  const epochs=[...new Set([oldest,...base.map(r=>r.t),...this.#facts.map(r=>r.t)].filter(t=>t>=oldest&&t<=frontier))].sort((a,b)=>a-b);
  return epochs.map(t=>{
   const row=[...base].reverse().find(r=>r.t<=t)!,fact=[...this.#facts].reverse().find(r=>r.t<=t)!;
   return {...row,t,stocks:[...row.stocks,{id:this.station.id,cargo:0,propellant:0},{id:this.definition.pad.id,cargo:0,propellant:0}],fuelImported:row.fuelImported+fact.refills*this.courier.schedule.spent,cargoImported:row.cargoImported+fact.refills*this.courier.schedule.parcel,cargoExported:row.cargoExported+fact.deliveries*this.courier.schedule.parcel};
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
 drawing(oldest:number,frontier:number){
  const p=this.courier.schedule,end=Math.min(p.maxEpoch,frontier+EXPEDITION_LEAD),last=courierLastCycle(p,end),first=Math.floor(oldest/p.period);
  for(const k of this.#cycles.keys())if(k<first||k>last){this.#cycles.delete(k);this.#exported.delete(k);}
  const cycles:CourierCycle[]=[];
  for(let index=first;index<=last;index++){const row=this.#cycle(index);if(!this.#exported.has(index)){cycles.push({index,id:this.definition.id,row});this.#exported.add(index);}}
  const bytes=[...this.#cycles.values()].reduce((n,r)=>n+r.bytes,0),samples=[...this.#cycles.values()].reduce((n,r)=>n+r.samples.length,0);
  if(bytes>12_000_000||samples>24000)throw Error('Courier retained drawing budget');
  return {cycles,stats:{courierCompilations:1,courierTrips:Math.max(0,Math.floor((frontier-this.definition.landing)/p.period)+1),courierRefills:this.#refills,parcelsDelivered:this.#deliveries*p.parcel,courierCycles:this.#cycles.size,courierDrawingBytes:bytes,courierDrawingSamples:samples}};
 }
}
