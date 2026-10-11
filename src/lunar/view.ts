import {portState} from '../sim/logistics';
import {sampleVessel,type SceneView,type ViewSample,type VesselView} from '../model-set/model';
import type {FleetFrame,FleetEvent} from '../traffic/engine';
import type {ResourceAnchor} from '../traffic/resources';
import {validateLunar,type LunarDefinition,type DepotChunk} from './world';
import type {LunarDelta,LunarMission} from './engine';
const merge=<T>(a:T[],b:T[],key:(x:T)=>string|number)=>[...new Map([...a,...b].map(x=>[key(x),x])).values()];
const sorted=<T extends {t:number}>(a:T[])=>merge([],a,r=>r.t).sort((a,b)=>a.t-b.t);
export class LunarViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;current!:FleetFrame;stats:Record<string,number>={};
 chunks:DepotChunk[]=[];missions:LunarMission[]=[];events:FleetEvent[]=[];resources:ResourceAnchor[]=[];
 #anchors:FleetFrame[]=[];#held?:FleetFrame;#sizes=new Map<string,number>();
 #streams?:{key:string;ports:SceneView['portSamples'];samples:ViewSample[]};
 constructor(readonly definition:LunarDefinition){this.definition=validateLunar(definition);}
 ingest(p:LunarDelta,held=false){
  if(p.domain!=='lunar-service-v1')throw Error('Wrong lunar worker packet');
  if(held&&!this.#held)this.#held=this.current;
  this.frontier=p.frontier;this.watermark=p.oldest;this.current=p.current;this.halt=p.halt;this.stats={...p.stats};this.#anchors=sorted([...this.#anchors,p.anchor]);
  this.chunks=merge(this.chunks,p.chunks,c=>c.id).sort((a,b)=>a.start-b.start);
  this.missions=merge(this.missions,p.missions,m=>m.id).sort((a,b)=>a.start-b.start);
  this.events=merge(this.events,p.events,e=>e.id);this.resources=sorted([...this.resources,...p.resources]);
  for(const [prefix,rows] of [['c',p.chunks],['m',p.missions]] as const)for(const row of rows)this.#sizes.set(prefix+row.id,new TextEncoder().encode(JSON.stringify(row)).byteLength);
  if(!held)this.release();
  const live=new Set([...this.chunks.map(c=>'c'+c.id),...this.missions.map(m=>'m'+m.id)]);for(const k of this.#sizes.keys())if(!live.has(k))this.#sizes.delete(k);
  const bytes=[...this.#sizes.values()].reduce((n,b)=>n+b,0)+4096;
  if(bytes>36_000_000||this.chunks.length>8||this.missions.length>5)throw Error('Lunar held view budget exceeded');this.stats.viewBytes=bytes;
 }
 release(){
  this.#held=undefined;this.oldest=this.watermark;
  this.chunks=this.chunks.filter(c=>c.end>=this.oldest);this.missions=this.missions.filter(m=>m.end>=this.oldest);this.events=this.events.filter(e=>e.t>=this.oldest);
  let j=0;while(j+1<this.#anchors.length&&this.#anchors[j+1].t<=this.oldest)j++;this.#anchors=this.#anchors.slice(j);
  let i=0;while(i+1<this.resources.length&&this.resources[i+1].t<=this.oldest)i++;this.resources=this.resources.slice(i);
 }
 view(cursor:number):SceneView{
  if(cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside lunar history');
  const d=this.definition,source=d.source,b=source.vessels[0].bundle,s=b.scenario,known=this.missions.filter(m=>m.knownAt<=cursor),key=this.chunks.map(c=>c.id).join(',')+'|'+known.map(m=>m.id).join(',');
  if(this.#streams?.key!==key)this.#streams={key,ports:{Crescent:sorted(this.chunks.flatMap(c=>c.samples))},samples:sorted(known.flatMap(m=>m.samples))};
  const ports=this.#streams.ports,end=Math.min(this.chunks.at(-1)!.end,Math.max(cursor+.1,known.at(-1)?.end??cursor)),pad=s.logistics!.ports[0];
  const initial=[...this.#anchors].reverse().find(a=>a.t<=this.oldest)?.ships[0]??this.current.ships[0];
  // Whole admitted trips carry immutable dense strips. Sparse gaps remain
  // attached to the exact rotating pad; only drawing uses interpolation.
  const rows=this.#streams.samples;
  const samples=sorted([...(rows.length&&rows[0].t<=initial.t?[]:[initial]),...rows,...(this.current.t<=cursor?[this.current.ships[0]]:[]),...(this.#held&&this.#held.t<=cursor?[this.#held.ships[0]]:[])]);
  const last=samples.at(-1)!;if(last.t<end)samples.push({...last,t:end,y:portState(pad,end),thrust:undefined,activity:{kind:'waiting'}});
  const vessel:VesselView={...source.vessels[0],id:s.ship.id,ship:s.ship,ports:s.logistics!.ports,cargoCapacity:.05,arcs:known.flatMap(m=>m.bundle.program.thrustArcs!),continuousFuel:true,portSamples:ports,samples,boundaries:known.flatMap(m=>m.boundaries),ledger:[...known.flatMap(m=>m.ledger.map(e=>({...e,id:m.id+':'+e.id}))),...this.events.filter(e=>e.t<=cursor)]};
  // Pin the disposable held pose without feeding it to any physical provider.
  const at=sampleVessel(vessel,cursor);vessel.samples=sorted([...samples,at]);
  return {...source,id:d.id,name:d.name,vessels:[vessel],portSamples:ports,world:{bodies:s.bodies,ports:s.logistics!.ports,units:s.units},window:{start:this.oldest,end},traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.resources,depots:d.stations,stats:this.stats,halt:this.halt}};
 }
}
