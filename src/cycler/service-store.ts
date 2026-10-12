import {fleetBase,fleetWindow,fleetDepots,FLEET_LEAD,FLEET_RETENTION,FLEET_CHUNK,FLEET_ROWS,FLEET_BYTES,FLEET_CHUNKS,type FleetServiceDefinition,type FleetChunk} from './service-view';
import {FLEET_MAX_EPOCH} from './query';
import type {FleetDelta} from './service-engine';
import type {PassThroughTemplate} from './types';
import type {ViewSample,SceneView} from '../model-set/model';
import type {ResourceAnchor} from '../traffic/resources';
const encoded=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
function validSample(q:ViewSample,start:number,end:number){
 return q&&Number.isFinite(q.t)&&q.t>=start&&q.t<=end&&Array.isArray(q.y)&&q.y.length===6&&q.y.every(Number.isFinite)&&Number.isFinite(q.propellant)&&q.propellant>=0&&Number.isFinite(q.fuelUsed)&&q.fuelUsed!>=0&&Number.isFinite(q.mass)&&q.mass!>0;
}
function validateChunk(c:FleetChunk){
 if(!Number.isInteger(c.index)||c.index<0||c.start!==c.index*FLEET_CHUNK||c.end!==Math.min(FLEET_MAX_EPOCH,c.start+FLEET_CHUNK)||!Array.isArray(c.vessels)||c.vessels.length!==4||!Number.isInteger(c.samples)||c.samples<1||c.samples>2500||!Number.isInteger(c.bytes)||c.bytes<1||c.bytes>2_000_000)throw Error('Invalid fleet chunk');
 for(const v of c.vessels){
  if(!Array.isArray(v.samples)||!v.samples.length||v.samples[0].t!==c.start||v.samples.at(-1)!.t!==c.end||v.samples.some((q,i)=>!validSample(q,c.start,c.end)||i>0&&q.t<=v.samples[i-1].t))throw Error('Invalid fleet drawing sample');
  if(!Array.isArray(v.arcs)||v.arcs.length>16||v.arcs.some(a=>!Number.isFinite(a.start)||!Number.isFinite(a.end)||a.start<c.start||a.end>c.end||a.end<=a.start||a.direction.length!==3||!a.direction.every(Number.isFinite)))throw Error('Invalid fleet drawing arc');
  if(!Array.isArray(v.ledger)||v.ledger.length>40||new Set(v.ledger.map(e=>e.id)).size!==v.ledger.length||v.ledger.some(e=>!Number.isFinite(e.t)||e.t<c.start||e.t>c.end||!e.id||![e.deltaV??0,e.fuelUsed??0,e.propellantBefore??0,e.propellantAfter??0].every(x=>Number.isFinite(x)&&x>=0)))throw Error('Invalid fleet drawing ledger');
  if(!Array.isArray(v.boundaries)||v.boundaries.length>40||v.boundaries.some(b=>!Number.isFinite(b.t)||b.before.t!==b.t||b.after.t!==b.t||!validSample(b.before,c.start,c.end)||!validSample(b.after,c.start,c.end)))throw Error('Invalid fleet drawing boundary');
 }
 if(c.samples!==c.vessels.reduce((n,v)=>n+v.samples.length,0)||c.bytes!==encoded({...c,bytes:0}))throw Error('Fleet derived chunk budget');
}
export class FleetViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};#template?:PassThroughTemplate;#base?:SceneView;#chunks=new Map<number,FleetChunk>();#resources:ResourceAnchor[]=[];
 constructor(readonly definition:FleetServiceDefinition){}
 ingest(p:FleetDelta,held=false){
  if(p.domain!=='cycler-fleet-service-v1'||![p.frontier,p.oldest].every(Number.isFinite)||p.frontier<this.frontier||p.frontier>FLEET_MAX_EPOCH||p.oldest<this.watermark||p.oldest<0||p.oldest>p.frontier||p.frontier-this.frontier>(this.#template?8:FLEET_LEAD)||p.chunks.length>FLEET_CHUNKS||new TextEncoder().encode(JSON.stringify(p)).byteLength>16_000_000)throw Error('Fleet worker packet admission');
  if(p.template&&this.#template)throw Error('Duplicate fleet template');const template=this.#template??(p.template?structuredClone(p.template):undefined);if(!template?.recurrence)throw Error('Missing maintained fleet template');
  const oldest=held?this.oldest:p.oldest,end=Math.min(FLEET_MAX_EPOCH,p.halt?p.frontier:p.frontier+FLEET_LEAD,oldest+FLEET_RETENTION);
  if(p.frontier-oldest>FLEET_RETENTION)throw Error('Fleet held history budget');
  const next=new Map(this.#chunks),incoming=new Set<number>();
  for(const c of p.chunks){
   if(incoming.has(c.index)||next.has(c.index))throw Error('Duplicate fleet chunk');
   validateChunk(c);incoming.add(c.index);next.set(c.index,structuredClone(c));
  }
  const first=Math.floor(oldest/FLEET_CHUNK),last=Math.floor(end/FLEET_CHUNK),workerLast=Math.floor(Math.min(FLEET_MAX_EPOCH,p.halt?p.frontier:p.frontier+FLEET_LEAD)/FLEET_CHUNK);
  for(const k of next.keys())if(k<first||k>Math.max(last,workerLast))next.delete(k);
  if(next.size>FLEET_CHUNKS||[...next.values()].reduce((n,c)=>n+c.samples,0)>FLEET_ROWS||[...next.values()].reduce((n,c)=>n+c.bytes,0)>FLEET_BYTES)throw Error('Fleet frontend aggregate budget');
  for(let k=first;k<=last;k++)if(k*FLEET_CHUNK<FLEET_MAX_EPOCH&&!next.has(k))throw Error('Missing fleet chunk coverage');
  if(!p.resources.length||p.resources.length>40||p.resources[0].t!==p.oldest||p.resources.at(-1)!.t!==p.frontier||p.resources.some((r,i)=>!Number.isFinite(r.t)||r.t<p.oldest||r.t>p.frontier||i>0&&r.t<=p.resources[i-1].t||r.stocks.length!==2||![r.fuelImported,r.cargoImported,r.cargoExported].every(x=>Number.isFinite(x)&&x>=0)))throw Error('Fleet resource anchors');
  const facts=[...new Map([...(held?this.#resources.filter(r=>r.t<p.oldest):[]),...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);let i=0;while(i+1<facts.length&&facts[i+1].t<=oldest)i++;
  if(facts.length-i>42)throw Error('Fleet held resource budget');
  const base=this.#base??fleetBase(template,this.definition);
  this.#template=template;this.#base=base;this.#chunks=next;this.#resources=facts.slice(i);this.frontier=p.frontier;this.watermark=p.oldest;this.halt=p.halt;this.stats={...p.stats};if(!held)this.oldest=p.oldest;
 }
 release(){this.oldest=this.watermark;let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);}
 view(cursor:number):SceneView {
  if(!this.#template||!this.#base||cursor<this.oldest||cursor>this.frontier)throw Error('Fleet cursor outside retained history');
  const end=Math.min(FLEET_MAX_EPOCH,this.halt?this.frontier:this.frontier+FLEET_LEAD,this.oldest+FLEET_RETENTION),chunks=[...this.#chunks.values()].filter(c=>c.end>=this.oldest&&c.start<=end).sort((a,b)=>a.index-b.index);
  const scene=fleetWindow(this.#base,this.#template,this.oldest,end,chunks);scene.traffic={frontier:this.frontier,oldest:this.oldest,resources:this.#resources,depots:fleetDepots(this.#template),stats:this.stats,halt:this.halt};return scene;
 }
}
