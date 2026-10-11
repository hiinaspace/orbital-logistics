import {sampleVessel,type SceneView,type VesselView,type ViewSample,type ViewerEvent} from '../model-set/model';
import {type ExpeditionDefinition,type ExpeditionDelta,type ExpeditionCycleRow,type PreparedExpeditionCycle,expeditionDepots} from './engine';
import {scheduledSample,flightSample,rotate,rotateState,occurrence,expeditionId,expeditionPort,type ExpeditionSchedule} from './query';
import type {ResourceAnchor} from '../traffic/resources';
export class ExpeditionViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};current!:ViewSample;
 #templateBytes=0;#template?:SceneView;#schedule?:ExpeditionSchedule;#held=false;#resources:ResourceAnchor[]=[];#events:ViewerEvent[]=[];
 #exported=new Set<number>();#cycles=new Map<number,ExpeditionCycleRow>();
 constructor(readonly definition:ExpeditionDefinition,readonly requirePrepared=false){}
 ingest(p:ExpeditionDelta,held=false){
  if(p.domain!=='apollo-continuous-v1'||p.frontier<this.frontier||p.oldest>p.frontier)throw Error('Wrong expedition worker packet');
  if(p.template){if(this.#template)throw Error('Duplicate expedition cache');this.#template=p.template;this.#templateBytes=new TextEncoder().encode(JSON.stringify(p.template)).byteLength;}
  if(!this.#template)throw Error('Missing expedition cache');
  for(const c of p.preparedCycles??[]){if(c.actorId!==p.schedule.instance?.id||c.templateId!==this.#template.id||!Number.isInteger(c.index)||c.index<0||c.row.samples.length>40000||!Number.isFinite(c.row.bytes)||c.row.bytes>12_000_000)throw Error('Invalid prepared expedition cycle');this.#cycles.set(c.index,c.row);}
  this.#schedule=p.schedule;this.frontier=p.frontier;this.watermark=p.oldest;this.current=p.current;this.halt=p.halt;this.stats={...p.stats};
  this.#resources=[...new Map([...this.#resources,...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
  this.#events=[...new Map([...this.#events,...p.events].map(e=>[e.id,e])).values()];
  this.#held=held;if(!held)this.release();
 }
 release(){
  this.#held=false;this.oldest=this.watermark;
  let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
  this.#events=this.#events.filter(e=>e.t>=this.oldest);
  for(const k of this.#cycles.keys())if((this.#schedule!.instance?.epochOffset??0)+(k+1)*this.#schedule!.period<this.oldest){this.#cycles.delete(k);this.#exported.delete(k);}
 }
 #cycle(index:number){
  const cached=this.#cycles.get(index);if(cached)return cached;if(this.requirePrepared)throw Error('Missing worker-prepared expedition cycle');
  const s=this.#schedule!,base=this.#template!.vessels[0],offset=(s.instance?.epochOffset??0)+index*s.period,a=(index*s.angle+(s.instance?.rotationOffset??0))%(2*Math.PI);
  const sample=(t:number,left=false)=>scheduledSample(s,base,t,(local,before)=>before?base.boundaries.find(b=>b.t===local)?.before??sampleVessel(base,local):sampleVessel(base,local),left);
  const flight=base.samples.filter(q=>q.t<=s.recovery+2&&q.t+offset<=s.maxEpoch).map(q=>flightSample(s,q,index,q.t+offset));
  const times=new Set<number>();
  for(let t=s.recovery+2;t<s.period&&offset+t<=s.maxEpoch;t+=.25)times.add(offset+t);
  for(const t of [s.recovery+1,s.recovery+2,s.recovery+s.transport,s.period-3,s.period-2,s.period])if(offset+t<=s.maxEpoch)times.add(offset+t);
  const arcs=base.arcs.map(b=>({...b,id:expeditionId(s,index,b.id),start:b.start+offset,end:b.end+offset,direction:rotate(b.direction,a),...(b.steering?{steering:{...b.steering,keys:b.steering.keys.map(k=>({...k,direction:rotate(k.direction,a)}))}}:{})}));
  const ledger:ViewerEvent[]=base.ledger.filter(e=>e.t<=s.recovery).map(e=>({...e,t:e.t+offset,id:expeditionId(s,index,e.id),portId:expeditionPort(s,e.portId),...(e.kind==='milestone'?{label:e.label??e.id}:{})}));
  for(const [t,name] of [[s.recovery+1,'Ocean recovery'],[s.recovery+s.transport,'Ground turnaround']] as const){
   if(offset+t>s.maxEpoch)continue;const before=sample(offset+t,true),after=sample(offset+t);ledger.push({t:offset+t,kind:'milestone',id:expeditionId(s,index,name),label:name,deltaV:0,fuelUsed:0,propellantBefore:before.propellant,propellantAfter:after.propellant});
  }
  const boundaryTimes=[...base.boundaries.map(b=>offset+b.t),offset+(s.recovery+s.transport),(s.instance?.epochOffset??0)+(index+1)*s.period-s.refuelLead].filter(t=>t<=s.maxEpoch);
  const boundaries=boundaryTimes.map(t=>({t,before:sample(t,true),after:sample(t)}));
  const row={bytes:0,boundaries,samples:[...new Map([...flight,...[...times].map(t=>sample(t)),...boundaries.map(b=>b.after)].map(q=>[q.t,q])).values()].sort((a,b)=>a.t-b.t),arcs,ledger};row.bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength;this.#cycles.set(index,row);return row;
 }
 exportPreparedCycles():PreparedExpeditionCycle[]{return [...this.#cycles.entries()].filter(([k])=>!this.#exported.has(k)).map(([index,row])=>{this.#exported.add(index);return {index,row,actorId:this.#schedule!.instance?.id,templateId:this.#template!.id};});}
 view(cursor:number,through?:number):SceneView{
  if(!this.#template||!this.#schedule||cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside expedition history');
  const template=this.#template,p=this.#schedule,base=template.vessels[0],active=occurrence(p,cursor),end=through??Math.min(p.maxEpoch,Math.max(cursor+.1,this.frontier+32,(p.instance?.epochOffset??0)+(active.index+1)*p.period));
  if(end<cursor||end>p.maxEpoch)throw Error('Expedition forecast outside calendar');
  const delay=p.instance?.epochOffset??0,first=Math.max(0,Math.floor((this.oldest-delay)/p.period)),last=Math.max(0,Math.floor((end-delay)/p.period));
  for(const k of this.#cycles.keys())if(k<first||k>last){this.#cycles.delete(k);this.#exported.delete(k);}
  const cycleCap=Math.ceil((128+32+p.period+1)/p.period)+1;
  if(last-first+1>cycleCap)throw Error('Expedition materialization budget');
  const rows=Array.from({length:last-first+1},(_,i)=>this.#cycle(first+i));
  const retainedBytes=[...this.#cycles.values()].reduce((n,c)=>n+c.bytes,0),retainedSamples=[...this.#cycles.values()].reduce((n,c)=>n+c.samples.length,0);
  if(retainedBytes>36_000_000||retainedSamples>120000)throw Error('Expedition retained drawing budget');
  const expedition={...p,template:base},stub={...base,expedition,samples:[{...base.samples[0],t:this.oldest},{...base.samples[0],t:end}]};
  const at=(t:number)=>sampleVessel(stub,t);
  const prelude:ViewSample[]=[];for(let t=this.oldest;t<Math.min(delay,end);t+=.25)prelude.push(at(t));
  const samples=[...new Map([...prelude,...rows.flatMap(r=>r.samples).filter(q=>q.t>this.oldest&&q.t<end),at(this.oldest),at(cursor),at(end)].map(q=>[q.t,q])).values()].sort((a,b)=>a.t-b.t);
  if(samples.length>110000)throw Error('Expedition drawing sample budget');
  const a=active.angle,offset=active.offset,entry=base.entry!;
  const pose={...entry.recovery,t:entry.recovery.t+offset,y:rotateState(entry.recovery.y,a)};
  const ports=base.ports.map(port=>port.id===p.instance?.sourcePadId?p.pad:port),actor=p.instance;
  const vessel:VesselView={...base,...(actor?{id:actor.id,name:actor.name,color:actor.color,ship:{...base.ship,id:actor.id},ports}:{}),expedition,samples,arcs:rows.flatMap(r=>r.arcs),ledger:[...rows.flatMap(r=>r.ledger).filter(e=>e.t>=this.oldest&&e.t<=end),...this.#events.filter(e=>e.t>=this.oldest&&e.t<=cursor)],
   boundaries:rows.flatMap(r=>r.boundaries).filter(b=>b.t>=this.oldest&&b.t<=end),entry:{...entry,activeFrom:entry.activeFrom!+offset,entryEpoch:entry.entryEpoch+offset,brakingEpoch:entry.brakingEpoch+offset,recovery:pose}};
  this.stats.retainedDrawingBytes=retainedBytes;this.stats.retainedDrawingSamples=retainedSamples;this.stats.viewCycles=this.#cycles.size;this.stats.viewSamples=samples.length;this.stats.cacheTemplateBytes=this.#templateBytes;
  return {...template,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,vessels:[vessel],window:{start:this.oldest,end},
   recoveries:{[vessel.id]:{...template.recoveries![base.id],recoveryEpoch:p.recovery+offset}},
   traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.#resources,depots:expeditionDepots(this.definition),stats:this.stats,halt:this.halt}};
 }
}
