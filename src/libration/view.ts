import {ExpeditionFleetViewStore} from '../expedition/fleet-view';
import {EXPEDITION_LEAD,type ExpeditionCycleRow} from '../expedition/engine';
import {sampleLibration,courierLastCycle,type LibrationSchedule} from './query';
import type {LibrationDefinition,LibrationDelta} from './engine';
import type {SceneView,VesselView,ViewSample} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
export class LibrationViewStore {
 readonly base:ExpeditionFleetViewStore;frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};
 #template?:VesselView;#schedule?:LibrationSchedule;#cycles=new Map<number,ExpeditionCycleRow>();#resources:ResourceAnchor[]=[];
 constructor(readonly definition:LibrationDefinition){this.base=new ExpeditionFleetViewStore(definition.source);}
 ingest(p:LibrationDelta,held=false){
  if(p.domain!=='libration-service-v1'||p.base.frontier<this.frontier||p.schedule.period!==this.definition.courier.period)throw Error('Wrong libration worker packet');
  if(p.template){if(this.#template||p.template.id!==this.definition.courier.id)throw Error('Libration cache identity');this.#template=p.template;}
  if(!this.#template)throw Error('Missing libration cache');
  this.#schedule=p.schedule;
  for(const c of p.cycles){if(c.id!==this.definition.courier.id||!Number.isInteger(c.index)||c.index<0||c.row.bytes>2_000_000||c.row.samples.length>4000||c.row.samples[0].t!==c.index*p.schedule.period||c.row.samples.at(-1)!.t!==(c.index+1)*p.schedule.period||this.#cycles.has(c.index))throw Error('Wrong courier cycle ownership');this.#cycles.set(c.index,c.row);}
  this.base.ingest(p.base,held);this.frontier=p.base.frontier;this.watermark=p.base.oldest;this.halt=p.base.halt;this.stats={...p.stats};this.#resources=[...new Map([...this.#resources,...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
  if(!held)this.release();
  if(this.#cycles.size>7||this.#resources.length>24)throw Error('Libration held cycle budget');
 }
 release(){this.base.release();this.oldest=this.watermark;let anchor=0;while(anchor+1<this.#resources.length&&this.#resources[anchor+1].t<=this.oldest)anchor++;this.#resources=this.#resources.slice(anchor);for(const [i,r]of this.#cycles)if(r.samples.at(-1)!.t<=this.oldest)this.#cycles.delete(i);}
 view(cursor:number):SceneView{
  const base=this.base.view(cursor),v=this.#template!,p=this.#schedule!,end=Math.min(p.maxEpoch,this.frontier+EXPEDITION_LEAD),first=Math.floor(this.oldest/p.period),last=courierLastCycle(p,end),rows:ExpeditionCycleRow[]=[];
  for(let i=first;i<=last;i++){const r=this.#cycles.get(i);if(!r)throw Error('Missing worker-prepared courier cycle');rows.push(r);}
  const station=this.definition.station,pad=this.definition.courier.pad,ports=[...base.world.ports,pad,station];
  const courier:VesselView={...v,ports:v.ports,portSamples:{},libration:{...p,template:v},samples:rows.flatMap(r=>r.samples).filter((q,i,a)=>q.t>=this.oldest&&q.t<=end&&(i===0||q.t>a[i-1].t)),arcs:rows.flatMap(r=>r.arcs).filter(a=>a.start<end&&a.end>this.oldest),ledger:rows.flatMap(r=>r.ledger).filter(e=>e.t>=this.oldest&&e.t<=end),boundaries:rows.flatMap(r=>r.boundaries).filter(b=>b.t>=this.oldest&&b.t<=end)};
  // Exact window endpoints bracket arbitrary held cursors; no propagation here.
  const dummy={...courier,samples:[{...v.samples[0],t:this.oldest},{...v.samples.at(-1)!,t:end}]};
  if(courier.samples[0]?.t!==this.oldest)courier.samples.unshift(sampleLibration(dummy,this.oldest));
  if(courier.samples.at(-1)?.t!==end)courier.samples.push(sampleLibration(dummy,end));
  const depots:Depot[]=[...base.traffic!.depots,{id:pad.id,role:'Lunar surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:this.definition.courier.maxImport,cargoRate:0,propellantRate:0},{id:station.id,role:'Libration relay',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:0,cargoRate:0,propellantRate:0}];
  const bytes=[...this.#cycles.values()].reduce((n,r)=>n+r.bytes,0),samples=[...this.#cycles.values()].reduce((n,r)=>n+r.samples.length,0);
  Object.assign(this.stats,{retainedDrawingBytes:this.base.stats.retainedDrawingBytes+bytes,retainedDrawingSamples:this.base.stats.retainedDrawingSamples+samples,courierCycles:this.#cycles.size});
  if(bytes>12_000_000||samples>24000||this.stats.retainedDrawingBytes>84_000_000||this.stats.retainedDrawingSamples>270000||courier.samples.length>24000)throw Error('Libration drawing budget');
  return {...base,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,world:{...base.world,ports},stations:[...base.stations,{id:pad.id,role:'Lunar surface terminal',berths:1},{id:station.id,role:'Libration relay',berths:1}],vessels:[...base.vessels,courier],frameExtents:{...base.frameExtents,[pad.id]:.015,[station.id]:1.5},traffic:{...base.traffic!,resources:this.#resources,depots,stats:this.stats}};
 }
}
