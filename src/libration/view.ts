import {ExpeditionFleetViewStore} from '../expedition/fleet-view';
import {CourierViewStore} from './courier-view';
import type {LibrationDefinition,LibrationDelta} from './engine';
import type {SceneView} from '../model-set/model';
import type {ResourceAnchor} from '../traffic/resources';
export class LibrationViewStore {
 readonly base:ExpeditionFleetViewStore;frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};
 #courier:CourierViewStore;#resources:ResourceAnchor[]=[];
 constructor(readonly definition:LibrationDefinition){this.base=new ExpeditionFleetViewStore(definition.source);this.#courier=new CourierViewStore(definition.courier,definition.station);}
 ingest(p:LibrationDelta,held=false){
  if(p.domain!=='libration-service-v1'||p.base.frontier<this.frontier)throw Error('Wrong libration worker packet');
  this.#courier.ingest(p,held?this.oldest:p.base.oldest);this.base.ingest(p.base,held);
  this.frontier=p.base.frontier;this.watermark=p.base.oldest;this.halt=p.base.halt;this.stats={...p.stats};
  this.#resources=[...new Map([...this.#resources,...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
  if(!held)this.release();if(this.#resources.length>24)throw Error('Libration held resource budget');
 }
 release(){this.base.release();this.oldest=this.watermark;this.#courier.release(this.oldest);let anchor=0;while(anchor+1<this.#resources.length&&this.#resources[anchor+1].t<=this.oldest)anchor++;this.#resources=this.#resources.slice(anchor);}
 view(cursor:number):SceneView{
  const scene=this.#courier.compose(this.base.view(cursor),this.oldest,this.frontier,this.#resources);for(const key of ['retainedDrawingBytes','retainedDrawingSamples','courierCycles'])this.stats[key]=scene.traffic!.stats[key];
  return {...scene,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,traffic:{...scene.traffic!,stats:this.stats}};
 }
}
