import {ExpeditionViewStore} from './view';
import {EXPEDITION_LEAD,type ExpeditionDelta} from './engine';
import {type ExpeditionFleetDefinition,type ExpeditionFleetDelta,type ExpeditionFleetEvent} from './fleet';
import {sampleVessel,type SceneView,type VesselView,type ViewSample} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
export class ExpeditionFleetViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};current:ViewSample[]=[];
 #stores:ExpeditionViewStore[];#rows:ViewSample[]=[];#resources:ResourceAnchor[]=[];#events:ExpeditionFleetEvent[]=[];#fault?:ViewSample;#template?:SceneView;
 constructor(readonly definition:ExpeditionFleetDefinition){this.#stores=definition.actors.map(()=>new ExpeditionViewStore(definition.source,true));}
 ingest(p:ExpeditionFleetDelta,held=false){
  if(p.domain!=='apollo-fleet-v1'||p.frontier<this.frontier||p.schedules.length!==2)throw Error('Wrong fleet worker packet');
  if(p.template){if(this.#template)throw Error('Duplicate fleet cache');this.#template=p.template;}if(!this.#template)throw Error('Missing fleet cache');
  this.frontier=p.frontier;this.watermark=p.oldest;this.halt=p.halt;this.stats={...p.stats};this.current=p.current;this.#fault=p.orbiter.fault;
  this.#rows=[...new Map([...this.#rows,...p.orbiter.samples].map(q=>[q.t,q])).values()].sort((a,b)=>a.t-b.t);
  this.#resources=[...new Map([...this.#resources,...p.resources].map(q=>[q.t,q])).values()].sort((a,b)=>a.t-b.t);
  this.#events=[...new Map([...this.#events,...p.events].map(q=>[q.id,q])).values()];
  for(const [i,store] of this.#stores.entries()){
   const delta:ExpeditionDelta={domain:'apollo-continuous-v1',frontier:p.frontier,oldest:p.oldest,schedule:p.schedules[i],current:p.current[i],resources:p.resources,events:p.events.filter(e=>e.shipId===this.definition.actors[i].id),stats:p.stats,halt:p.halt,preparedCycles:p.preparedCycles[i],...(p.template?{template:p.template}:{})};
   store.ingest(delta,held);
  }
  if(!held)this.release();
  if(this.#rows.length>5500||this.#resources.length>6||this.#events.length>4)throw Error('Fleet held drawing/resource budget');
 }
 release(){
  this.oldest=this.watermark;for(const s of this.#stores)s.release();
  let i=0;while(i+1<this.#rows.length&&this.#rows[i+1].t<=this.oldest)i++;this.#rows=this.#rows.slice(i);
  i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
  this.#events=this.#events.filter(e=>e.t>=this.oldest);
 }
 view(cursor:number):SceneView{
  if(!this.#template||cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside fleet history');
  const d=this.definition,template=this.#template,end=Math.min(1_000_000,this.frontier+EXPEDITION_LEAD),views=this.#stores.map(s=>s.view(cursor,end));
  const ports=[...views.map(v=>v.vessels[0].expedition!.pad),...template.world.ports.filter(p=>p.id!==template.vessels[0].expedition?.pad.id&&p.id!==d.source.source.ports[0].id)];
  const depots:Depot[]=ports.map(p=>({id:p.id,role:'Surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:d.source.maxImport,cargoRate:0,propellantRate:0}));
  const vessels=views.map(v=>{
   const ship=v.vessels[0],samples=ship.samples.filter(q=>q.t>=this.oldest&&q.t<=end);
   if(samples.at(-1)?.t!==end)samples.push(sampleVessel(ship,end));
   return {...ship,ports,samples,arcs:ship.arcs.filter(a=>a.start<end&&a.end>this.oldest),ledger:ship.ledger.filter(e=>e.t<=end),boundaries:ship.boundaries.filter(b=>b.t<=end)};
  });
  const fault=this.#fault,rows=this.#rows.filter(q=>q.t<=end);
  if(fault&&end>fault.t)rows.push({...fault,t:end});
  const orbiter:VesselView={id:d.orbiter.id,name:d.orbiter.name,color:d.orbiter.color,cargo:'Orbital observation',ship:{id:d.orbiter.id,state:d.orbiter.state,dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1},ports:[],portSamples:{},cargoCapacity:0,continuousFuel:true,interpolation:'hermite',samples:rows,arcs:[],boundaries:[],ledger:fault&&fault.t<=cursor?[{t:fault.t,kind:'fault',id:d.orbiter.id+':fault',deltaV:0,fuelUsed:0,propellantBefore:0,propellantAfter:0,detail:fault.activity?.reason}]:[]};
  const retainedDrawingBytes=this.#stores.reduce((n,s)=>n+s.stats.retainedDrawingBytes,0),retainedDrawingSamples=this.#stores.reduce((n,s)=>n+s.stats.retainedDrawingSamples,0)+this.#rows.length;
  if(retainedDrawingBytes>72_000_000||retainedDrawingSamples>245500||vessels.reduce((n,v)=>n+v.samples.length,rows.length)>160000)throw Error('Fleet aggregate drawing budget');
  Object.assign(this.stats,{retainedDrawingBytes,retainedDrawingSamples,viewCycles:this.#stores.reduce((n,s)=>n+s.stats.viewCycles,0),orbiterSamples:this.#rows.length});
  return {...template,id:d.id,name:d.name,description:d.description,provenance:d.provenance,world:{...template.world,ports},stations:ports.map(p=>({id:p.id,role:'Surface terminal',berths:1})),vessels:[...vessels,orbiter],window:{start:this.oldest,end},recoveries:Object.assign({},...views.map(v=>v.recoveries)),traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.#resources,depots,stats:this.stats,halt:this.halt}};
 }
}
