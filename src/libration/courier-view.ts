import {EXPEDITION_LEAD,type ExpeditionCycleRow} from '../expedition/engine';
import {sampleLibration,courierLastCycle,type LibrationSchedule} from './query';
import type {CourierDefinition} from './prepare';
import type {CourierCycle} from './service';
import type {Port} from '../sim/schema';
import type {SceneView,VesselView,ViewSample} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
export interface CourierDrawingDelta {template?:VesselView;schedule:LibrationSchedule;cycles:CourierCycle[]}
export class CourierViewStore {
 #template?:VesselView;#schedule?:LibrationSchedule;#cycles=new Map<number,ExpeditionCycleRow>();
 constructor(readonly definition:CourierDefinition,readonly station:Port,readonly aggregateBytes=84_000_000,readonly aggregateSamples=270000){}
 fork(){const s=new CourierViewStore(this.definition,this.station,this.aggregateBytes,this.aggregateSamples);s.#template=this.#template;s.#schedule=this.#schedule;s.#cycles=new Map(this.#cycles);return s;}
 ingest(p:CourierDrawingDelta,oldest:number){
  if(p.schedule.period!==this.definition.period)throw Error('Wrong courier schedule');
  if(p.template){if(this.#template||p.template.id!==this.definition.id)throw Error('Courier cache identity');this.#template=p.template;}
  if(!this.#template)throw Error('Missing courier cache');
  if(this.#schedule&&JSON.stringify(this.#schedule)!==JSON.stringify(p.schedule))throw Error('Changed courier schedule');
  this.#schedule=p.schedule;
  for(const c of p.cycles){if(c.id!==this.definition.id||!Number.isInteger(c.index)||c.index<0||!Number.isFinite(c.row.bytes)||c.row.bytes>2_000_000||c.row.samples.length>4000||c.row.samples[0]?.t!==c.index*p.schedule.period||c.row.samples.at(-1)?.t!==(c.index+1)*p.schedule.period||this.#cycles.has(c.index))throw Error('Wrong courier cycle ownership');this.#cycles.set(c.index,c.row);}
  this.release(oldest);if(this.#cycles.size>7)throw Error('Courier held cycle budget');
 }
 release(oldest:number){for(const [i,r]of this.#cycles)if(r.samples.at(-1)!.t<=oldest)this.#cycles.delete(i);}
 validatePrepared(oldest:number,frontier:number){
  const p=this.#schedule;if(!p||!this.#template)throw Error('Missing courier cache');
  const last=courierLastCycle(p,Math.min(p.maxEpoch,frontier+EXPEDITION_LEAD));
  for(let i=Math.floor(oldest/p.period);i<=last;i++)if(!this.#cycles.has(i))throw Error('Missing worker-prepared courier cycle');
  const bytes=[...this.#cycles.values()].reduce((n,r)=>n+r.bytes,0),samples=[...this.#cycles.values()].reduce((n,r)=>n+r.samples.length,0);if(bytes>12_000_000||samples>24000)throw Error('Courier retained drawing budget');return {bytes,samples};
 }
 compose(base:SceneView,oldest:number,frontier:number,resources:ResourceAnchor[]):SceneView{
  const v=this.#template!,p=this.#schedule!,end=Math.min(p.maxEpoch,frontier+EXPEDITION_LEAD),first=Math.floor(oldest/p.period),last=courierLastCycle(p,end),rows:ExpeditionCycleRow[]=[];
  for(let i=first;i<=last;i++){const r=this.#cycles.get(i);if(!r)throw Error('Missing worker-prepared courier cycle');rows.push(r);}
  const station=this.station,pad=this.definition.pad,ports=[...base.world.ports,pad,station];
  const courier:VesselView={...v,ports:v.ports,portSamples:{},libration:{...p,template:v},samples:rows.flatMap(r=>r.samples).filter((q,i,a)=>q.t>=oldest&&q.t<=end&&(i===0||q.t>a[i-1].t)),arcs:rows.flatMap(r=>r.arcs).filter(a=>a.start<end&&a.end>oldest),ledger:rows.flatMap(r=>r.ledger).filter(e=>e.t>=oldest&&e.t<=end),boundaries:rows.flatMap(r=>r.boundaries).filter(b=>b.t>=oldest&&b.t<=end)};
  // Exact window endpoints bracket arbitrary held cursors; no propagation here.
  const dummy={...courier,samples:[{...v.samples[0],t:oldest},{...v.samples.at(-1)!,t:end}]};
  if(courier.samples[0]?.t!==oldest)courier.samples.unshift(sampleLibration(dummy,oldest));
  if(courier.samples.at(-1)?.t!==end)courier.samples.push(sampleLibration(dummy,end));
  const depots:Depot[]=[...base.traffic!.depots,{id:pad.id,role:'Lunar surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:this.definition.maxImport,cargoRate:0,propellantRate:0},{id:station.id,role:'Libration relay',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:0,cargoRate:0,propellantRate:0}];
  const bytes=[...this.#cycles.values()].reduce((n,r)=>n+r.bytes,0),samples=[...this.#cycles.values()].reduce((n,r)=>n+r.samples.length,0);
  const stats={...base.traffic!.stats};Object.assign(stats,{retainedDrawingBytes:base.traffic!.stats.retainedDrawingBytes+bytes,retainedDrawingSamples:base.traffic!.stats.retainedDrawingSamples+samples,courierCycles:this.#cycles.size});
  if(bytes>12_000_000||samples>24000||stats.retainedDrawingBytes>this.aggregateBytes||stats.retainedDrawingSamples>this.aggregateSamples||courier.samples.length>24000)throw Error('Libration drawing budget');
  return {...base,world:{...base.world,ports},stations:[...base.stations,{id:pad.id,role:'Lunar surface terminal',berths:1},{id:station.id,role:'Libration relay',berths:1}],vessels:[...base.vessels,courier],frameExtents:{...base.frameExtents,[pad.id]:.015,[station.id]:1.5},traffic:{...base.traffic!,resources,depots,stats}};
 }
}
