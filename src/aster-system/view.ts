import {StagedServiceViewStore} from '../staged-service/view';
import {CourierViewStore} from '../libration/courier-view';
import type {AsterSystemDefinition,AsterSystemDelta} from './engine';
import type {SceneView,VesselView,ViewSample} from '../model-set/model';
import type {ResourceAnchor} from '../traffic/resources';
export class AsterSystemViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};
 #base:StagedServiceViewStore;#courier:CourierViewStore;#rows=new Map<string,ViewSample[]>();#faults=new Map<string,ViewSample>();#resources:ResourceAnchor[]=[];#rowBytes=new WeakMap<ViewSample,number>();#drawingBytes=0;#drawingSamples=0;
 constructor(readonly definition:AsterSystemDefinition){this.#base=new StagedServiceViewStore(definition.source,true);this.#courier=new CourierViewStore(definition.courier,definition.station,96_000_000,275000);}
 ingest(p:AsterSystemDelta,held=false){
  if(p.domain!=='aster-system-v1'||!Number.isFinite(p.frontier)||p.frontier<this.frontier||p.frontier!==p.base.frontier||p.oldest!==p.base.oldest||p.oldest<this.watermark||p.orbiters.length!==this.definition.orbiters.length||p.stats.packetBytes>(p.base.template?64_000_000:48_000_000))throw Error('Wrong Aster system worker packet');
  const oldest=held?this.oldest:p.oldest,base=this.#base.fork(),courier=this.#courier.fork(),rows=new Map(this.#rows),faults=new Map(this.#faults);
  base.ingest(p.base,held);const stageBudget=base.validatePrepared();courier.ingest(p.courier,oldest);const courierBudget=courier.validatePrepared(oldest,p.frontier);
  const ids=new Set<string>();
  for(const o of p.orbiters){
   if(ids.has(o.id)||!this.definition.orbiters.some(d=>d.id===o.id)||o.bytes>2_000_000||o.samples.length>5400||!Number.isFinite(o.end)||o.end>1_000_000||o.samples.some((q,i)=>!Number.isFinite(q.t)||q.t<0||q.t>o.end||q.y.length!==6||q.y.some(x=>!Number.isFinite(x))||i>0&&q.t<=o.samples[i-1].t)||o.fault&&(o.fault.t!==o.end||o.fault.activity?.kind!=='fault'||o.fault.activity.knownEpoch!==o.fault.t))throw Error('Invalid Aster orbiter rows');
   ids.add(o.id);const prior=faults.get(o.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(o.fault))throw Error('Changed orbiter fault validity');
   if(o.fault)faults.set(o.id,o.fault);
   const known=new Map((rows.get(o.id)??[]).map(q=>[q.t,q]));for(const q of o.samples)if(!known.has(q.t))known.set(q.t,q);
   let r=[...known.values()].sort((a,b)=>a.t-b.t);
   let i=0;while(i+1<r.length&&r[i+1].t<=oldest)i++;r=r.slice(i);
   if(r.length>5500||!r.length||!o.fault&&r.at(-1)!.t<Math.min(1_000_000,p.frontier+32))throw Error('Orbiter held drawing/coverage budget');rows.set(o.id,r);
  }
  if(p.resources.some((r,i)=>!Number.isFinite(r.t)||r.t>p.frontier||i>0&&r.t<=p.resources[i-1].t||r.stocks.length!==4||new Set(r.stocks.map(s=>s.id)).size!==4||[r.fuelImported,r.fuelExported,r.cargoImported,r.cargoExported,...r.stocks.flatMap(s=>[s.cargo,s.propellant])].some(x=>!Number.isFinite(x)||x<0)))throw Error('Invalid Aster resource anchors');
  let resources=[...new Map([...this.#resources,...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);let i=0;while(i+1<resources.length&&resources[i+1].t<=oldest)i++;resources=resources.slice(i);
  if(resources.length>26||!resources.length||resources[0].t>oldest)throw Error('Aster held resource budget');
  const drawingBytes=[...rows.values()].reduce((n,r)=>n+2+r.reduce((m,q)=>{let bytes=this.#rowBytes.get(q);if(bytes===undefined){bytes=new TextEncoder().encode(JSON.stringify(q)).byteLength;this.#rowBytes.set(q,bytes);}return m+bytes+1;},0),0),drawingSamples=[...rows.values()].reduce((n,r)=>n+r.length,0);
  if(drawingBytes>4_000_000||drawingSamples>11000)throw Error('Aster held free-craft drawing budget');
  if(stageBudget.bytes+courierBudget.bytes+drawingBytes>96_000_000||stageBudget.samples+courierBudget.samples+drawingSamples>275000)throw Error('Aster combined drawing budget');
  // No visible backing store changes until every candidate container admits.
  this.#base=base;this.#courier=courier;this.#rows=rows;this.#faults=faults;this.#resources=resources;this.#drawingBytes=drawingBytes;this.#drawingSamples=drawingSamples;
  this.frontier=p.frontier;this.oldest=oldest;this.watermark=p.oldest;this.halt=p.halt;this.stats={...p.stats};
 }
 release(){this.#base.release();this.oldest=this.watermark;this.#courier.release(this.oldest);for(const [id,r]of this.#rows){let i=0;while(i+1<r.length&&r[i+1].t<=this.oldest)i++;this.#rows.set(id,r.slice(i));}let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);}
 view(cursor:number):SceneView{
  if(cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside Aster system history');
  const base=this.#courier.compose(this.#base.view(cursor),this.oldest,this.frontier,this.#resources),end=base.window.end;
  const orbiters:VesselView[]=this.definition.orbiters.map(d=>{
   const fault=this.#faults.get(d.id),rows=this.#rows.get(d.id)!.filter(q=>q.t<=end);if(fault&&end>fault.t)rows.push({...fault,t:end});
   return {id:d.id,name:d.name,color:d.color,cargo:'Orbital observation',ship:{id:d.id,state:d.state,dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1},ports:[],portSamples:{},cargoCapacity:0,continuousFuel:true,interpolation:'hermite',samples:rows,arcs:[],boundaries:[],ledger:fault&&fault.t<=cursor?[{t:fault.t,kind:'fault',id:d.id+':fault',deltaV:0,fuelUsed:0,propellantBefore:0,propellantAfter:0,detail:fault.activity?.reason}]:[]};
  });
  const extraBytes=this.#drawingBytes,extraSamples=this.#drawingSamples;
  Object.assign(this.stats,{retainedDrawingBytes:base.traffic!.stats.retainedDrawingBytes+extraBytes,retainedDrawingSamples:base.traffic!.stats.retainedDrawingSamples+extraSamples,viewCycles:this.#base.stats.viewCycles,viewSamples:base.vessels.reduce((n,v)=>n+v.samples.length,0)+extraSamples});
  if(this.stats.retainedDrawingBytes>96_000_000||this.stats.retainedDrawingSamples>275000)throw Error('Aster system retained drawing budget');
  return {...base,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,vessels:[...base.vessels,...orbiters],traffic:{...base.traffic!,stats:this.stats,halt:this.halt}};
 }
}
