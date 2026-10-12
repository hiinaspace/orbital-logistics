import type {CompactDefinition,CompactTemplate} from './types';
import {createView,depots,type CycleRow} from './view';
import {COMPACT_LEAD,COMPACT_RETENTION,type CompactDelta} from './engine';
import type {ResourceAnchor} from '../traffic/resources';
import type {SceneView} from '../model-set/model';
export class CompactViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};#template?:CompactTemplate;#cycles=new Map<number,CycleRow>();#resources:ResourceAnchor[]=[];
 constructor(readonly definition:CompactDefinition){}
 ingest(p:CompactDelta,held=false){
  if(![p.frontier,p.oldest].every(Number.isFinite)||p.frontier>1_000_000||p.oldest<0||p.oldest<this.watermark||p.frontier-this.frontier>(this.#template?8:32)||p.domain!=='compact-cycler-service-v1'||p.frontier<this.frontier||p.oldest>p.frontier||p.cycles.length>5||new TextEncoder().encode(JSON.stringify(p)).byteLength>16_000_000)throw Error('Compact worker packet admission');
  if(p.template&&this.#template)throw Error('Duplicate compact template');const template=this.#template??p.template;if(!template)throw Error('Missing compact template');
  const next=new Map(this.#cycles);for(const c of p.cycles){if(!Number.isInteger(c.index)||c.index<0||c.vessels.length!==2||c.samples>12000||c.bytes>6_000_000)throw Error('Invalid compact cycle');next.set(c.index,c);}
  const oldest=held?this.oldest:p.oldest,limit=Math.min(p.halt?p.frontier:p.frontier+COMPACT_LEAD,oldest+COMPACT_RETENTION),first=Math.floor(oldest/template.period),last=Math.floor(limit/template.period),retainedLast=Math.floor(Math.min(p.halt?p.frontier:p.frontier+COMPACT_LEAD,1_000_000)/template.period);
  if(p.frontier-oldest>COMPACT_RETENTION)throw Error('Compact held history budget');
  for(const k of next.keys())if(k<first||k>Math.max(last,retainedLast))next.delete(k);
  if(next.size>5||[...next.values()].reduce((n,c)=>n+c.samples,0)>40000||[...next.values()].reduce((n,c)=>n+c.bytes,0)>12_000_000)throw Error('Compact frontend retained budget');
  for(let k=first;k<=last;k++)if(!next.has(k))throw Error('Missing compact cycle coverage');
  if(!p.resources.length||p.resources.length>32||p.resources[0].t!==p.oldest||p.resources.at(-1)!.t!==p.frontier||p.resources.some((r,i)=>!Number.isFinite(r.t)||r.t<p.oldest||r.t>p.frontier||(i>0&&r.t<=p.resources[i-1].t)||r.stocks.length!==3||![r.fuelImported,r.cargoImported,r.cargoExported].every(x=>Number.isFinite(x)&&x>=0)))throw Error('Invalid compact resources');
  const facts=[...new Map([...(held?this.#resources.filter(r=>r.t<p.oldest):[]),...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);let i=0;while(i+1<facts.length&&facts[i+1].t<=oldest)i++;
  this.#template=template;this.#cycles=next;this.#resources=facts.slice(i);this.frontier=p.frontier;this.watermark=p.oldest;this.halt=p.halt;this.stats={...p.stats};if(!held)this.oldest=p.oldest;
 }
 release(){this.oldest=this.watermark;let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);}
 view(cursor:number):SceneView {
  if(!this.#template||cursor<this.oldest||cursor>this.frontier)throw Error('Compact cursor outside history');
  const p=this.#template,end=Math.min(this.halt?this.frontier:this.frontier+COMPACT_LEAD,this.oldest+COMPACT_RETENTION,1_000_000),first=Math.floor(this.oldest/p.period),last=Math.floor(end/p.period);
  const rows:CycleRow[]=[];for(let k=first;k<=last;k++){const row=this.#cycles.get(k);if(!row)throw Error('Missing prepared compact drawing cycle');rows.push(row);}
  const scene=createView(p,this.definition,this.oldest,end,rows);scene.traffic={frontier:this.frontier,oldest:this.oldest,resources:this.#resources,depots:depots(p),stats:this.stats,halt:this.halt};return scene;
 }
}
