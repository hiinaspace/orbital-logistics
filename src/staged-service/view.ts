import type {SceneView,VesselView,ViewSample,ViewerEvent} from '../model-set/model';
import {type StagedServiceDefinition,type StagedServiceDelta,stagedServiceDepots,STAGED_LEAD,STAGED_HISTORY} from './engine';
import {STAGED_ACTORS,stagedDrawingSample,stagedFlightSample,stagedOccurrence,stagedPresent,stagedId,type StagedActor,type StagedSchedule,type StagedVessel} from './query';
import {rotate,rotateState} from '../expedition/query';
import type {ResourceAnchor} from '../traffic/resources';
export interface StagedCycleRow {samples:ViewSample[];arcs:VesselView['arcs'];ledger:ViewerEvent[];boundaries:VesselView['boundaries'];bytes:number}
export interface PreparedStagedCycle {index:number;templateId:string;rows:Record<StagedActor,StagedCycleRow>;bytes:number}
export class StagedServiceViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};current!:StagedServiceDelta['current'];accounts!:StagedServiceDelta['accounts'];
 #template?:SceneView;#templates?:Record<StagedActor,VesselView>;#schedule?:StagedSchedule;#templateBytes=0;
 #resources:ResourceAnchor[]=[];#events:StagedServiceDelta['events']=[];#cycles=new Map<number,PreparedStagedCycle>();#exported=new Set<number>();
 constructor(readonly definition:StagedServiceDefinition,readonly requirePrepared=false){}
 // Shared immutable drawing rows; ingestion mutates only the fork's containers.
 fork(){
  const s=new StagedServiceViewStore(this.definition,this.requirePrepared);
  Object.assign(s,{frontier:this.frontier,oldest:this.oldest,watermark:this.watermark,halt:this.halt,stats:{...this.stats},current:this.current,accounts:this.accounts});
  s.#template=this.#template;s.#templates=this.#templates;s.#schedule=this.#schedule;s.#templateBytes=this.#templateBytes;
  s.#resources=[...this.#resources];s.#events=[...this.#events];s.#cycles=new Map(this.#cycles);s.#exported=new Set(this.#exported);return s;
 }
 ingest(p:StagedServiceDelta,held=false){
  if(p.domain!=='staged-continuous-v1'||!Number.isFinite(p.frontier)||!Number.isFinite(p.oldest)||p.frontier<this.frontier||p.oldest>p.frontier||p.oldest<0||p.frontier>p.schedule.maxEpoch)throw Error('Wrong staged expedition worker packet');
  if(p.template){
   if(this.#template)throw Error('Duplicate staged expedition cache');
   const d=this.definition.source,templates=Object.fromEntries(STAGED_ACTORS.map(key=>[key,p.template!.vessels.find(v=>v.id===(key==='stack'?d.stack.id:d.hardware[key].id))!])) as Record<StagedActor,VesselView>;
   if(STAGED_ACTORS.some(key=>!templates[key]))throw Error('Missing staged expedition template part');
   this.#template=p.template;this.#templates=templates;this.#templateBytes=new TextEncoder().encode(JSON.stringify(p.template)).byteLength;
  }
  if(!this.#template||!this.#templates)throw Error('Missing staged expedition cache');
  if(this.#schedule&&JSON.stringify(this.#schedule)!==JSON.stringify(p.schedule))throw Error('Changed staged expedition schedule');
  for(const c of p.preparedCycles){
   if(c.templateId!==this.#template.id||!Number.isInteger(c.index)||c.index<0||c.index*p.schedule.period>p.schedule.maxEpoch||!Number.isFinite(c.bytes)||c.bytes<0||c.bytes>28_000_000||STAGED_ACTORS.some(key=>!c.rows[key]||c.rows[key].samples.length>90000||c.rows[key].samples.some(q=>!Number.isFinite(q.t)||q.t<c.index*p.schedule.period||q.t>Math.min((c.index+1)*p.schedule.period,p.schedule.maxEpoch))))throw Error('Invalid worker-prepared staged cycle');
  }
  for(const c of p.preparedCycles)this.#cycles.set(c.index,c);
  this.#schedule=p.schedule;this.frontier=p.frontier;this.watermark=p.oldest;this.current=p.current;this.accounts=p.accounts;this.halt=p.halt;this.stats={...p.stats};
  this.#resources=[...new Map([...this.#resources,...p.resources].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
  this.#events=[...new Map([...this.#events,...p.events].map(e=>[e.id,e])).values()];
  if(!held)this.release();
 }
 validatePrepared(){
  if(!this.#template||!this.#schedule)throw Error('Missing staged cache');
  const p=this.#schedule,first=Math.floor(this.oldest/p.period),last=Math.floor(Math.min(p.maxEpoch,this.frontier+STAGED_LEAD)/p.period);
  for(let i=first;i<=last;i++)if(!this.#cycles.has(i))throw Error('Missing worker-prepared staged cycle');
  const bytes=[...this.#cycles.values()].reduce((n,c)=>n+c.bytes,0),samples=[...this.#cycles.values()].reduce((n,c)=>n+STAGED_ACTORS.reduce((m,k)=>m+c.rows[k].samples.length,0),0);if(bytes>84_000_000||samples>240000)throw Error('Staged retained drawing budget');return {bytes,samples};
 }
 release(){
  this.oldest=this.watermark;let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
  this.#events=this.#events.filter(e=>e.t>=this.oldest);
  for(const k of this.#cycles.keys())if((k+1)*this.#schedule!.period<this.oldest){this.#cycles.delete(k);this.#exported.delete(k);}
 }
 #cycle(index:number):PreparedStagedCycle {
  const cached=this.#cycles.get(index);if(cached)return cached;if(this.requirePrepared)throw Error('Missing worker-prepared staged cycle');
  const p=this.#schedule!,templates=this.#templates!,offset=index*p.period,angle=(index*p.angle)%(2*Math.PI),end=Math.min((index+1)*p.period,p.maxEpoch);
  const rows=Object.fromEntries(STAGED_ACTORS.map(id=>{
   const base=templates[id],at=(t:number,left=false)=>stagedDrawingSample(p,templates,id,t,left);
   const samples=base.samples.filter(q=>q.t+offset<=end&&stagedPresent(p,id,q.t+offset)).map(q=>stagedFlightSample(p,id,q,index,q.t+offset));
   const global=(t:number)=>t===p.period?(index+1)*p.period:t===p.period-3?(index+1)*p.period-3:t===p.period-p.refuelLead?(index+1)*p.period-p.refuelLead:offset+t;
   const times=new Set<number>(p.seams.map(global).filter(t=>t<=end));
   for(let t=p.period-3;t<p.period;t+=.25)if(offset+t<=end)times.add(offset+t);
   const boundaryTimes=p.seams.map(global).filter(t=>t<=end),boundaries=boundaryTimes.map(t=>({t,before:at(t,true),after:at(t)}));
   const localArcs=[...base.arcs,...(base.entry?[{id:'terminal-braking',start:base.entry.brakingEpoch,end:base.entry.recovery.t,direction:[0,0,0] as [number,number,number],throttle:1}]:[])];
   const arcs=localArcs.filter(a=>offset+a.start<end).map(a=>({...a,id:stagedId(index,a.id),start:offset+a.start,end:Math.min(end,offset+a.end),direction:rotate(a.direction,angle),...(a.steering?{steering:{...a.steering,keys:a.steering.keys.map(k=>({...k,direction:rotate(k.direction,angle)}))}}:{})}));
   const ledger:ViewerEvent[]=base.ledger.filter(e=>offset+e.t<=end).map(e=>({...e,t:offset+e.t,id:stagedId(index,e.id),...(e.kind==='milestone'?{label:e.label??e.id}:{})}));
   if(id==='booster'||id==='orbiter')for(const [local,label] of [[p.parts[id].recovery+1,'Ocean recovery'],[p.parts[id].recovery+p.transport,'Ground turnaround']] as const){
    if(offset+local>end)continue;const a=at(offset+local,true),b=at(offset+local);ledger.push({t:offset+local,kind:'milestone',id:stagedId(index,id+':'+label),label,deltaV:0,fuelUsed:0,propellantBefore:a.propellant,propellantAfter:b.propellant});
   }
   const row:StagedCycleRow={samples:[...new Map([...samples,...[...times].map(t=>at(t)),...boundaries.map(b=>b.after)].map(q=>[q.t,q])).values()].sort((a,b)=>a.t-b.t),arcs,ledger,boundaries,bytes:0};
   row.bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength;return [id,row];
  })) as Record<StagedActor,StagedCycleRow>;
  const cycle={index,templateId:this.#template!.id,rows,bytes:STAGED_ACTORS.reduce((n,id)=>n+rows[id].bytes,0)};
  if(cycle.bytes>28_000_000||STAGED_ACTORS.some(id=>rows[id].samples.length>90000))throw Error('Staged expedition drawing cycle budget');
  this.#cycles.set(index,cycle);return cycle;
 }
 exportPreparedCycles():PreparedStagedCycle[]{return [...this.#cycles.values()].filter(c=>!this.#exported.has(c.index)).map(c=>{this.#exported.add(c.index);return c;});}
 view(cursor:number,through?:number):SceneView {
  if(!this.#template||!this.#templates||!this.#schedule||!Number.isFinite(cursor)||cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside staged expedition history');
  const p=this.#schedule,template=this.#template,active=stagedOccurrence(p,cursor),end=through??Math.min(p.maxEpoch,this.frontier+STAGED_LEAD);
  if(!Number.isFinite(end)||end<cursor||end>p.maxEpoch)throw Error('Staged expedition forecast outside calendar');
  const first=Math.floor(this.oldest/p.period),last=Math.floor(end/p.period),cap=Math.ceil((STAGED_HISTORY+STAGED_LEAD+p.period)/p.period)+1;
  if(last-first+1>cap)throw Error('Staged expedition materialization budget');
  for(const k of this.#cycles.keys())if(k<first||k>last){this.#cycles.delete(k);this.#exported.delete(k);}
  const cycles=Array.from({length:last-first+1},(_,i)=>this.#cycle(first+i));
  const retainedBytes=[...this.#cycles.values()].reduce((n,c)=>n+c.bytes,0),retainedSamples=[...this.#cycles.values()].reduce((n,c)=>n+STAGED_ACTORS.reduce((m,id)=>m+c.rows[id].samples.length,0),0);
  if(retainedBytes>84_000_000||retainedSamples>240000)throw Error('Staged expedition retained drawing budget');
  const vessels=STAGED_ACTORS.map(id=>{
   const base=this.#templates![id],at=(t:number)=>stagedDrawingSample(p,this.#templates!,id,t),rows=cycles.map(c=>c.rows[id]);
   const samples:ViewSample[]=[];
   for(const row of rows)for(const q of row.samples)if(q.t>this.oldest&&q.t<end){if(samples.at(-1)?.t===q.t)samples[samples.length-1]=q;else samples.push(q);}
   for(const q of [at(this.oldest),at(cursor),at(end)]){let lo=0,hi=samples.length;while(lo<hi){const mid=(lo+hi)>>>1;if(samples[mid].t<q.t)lo=mid+1;else hi=mid;}if(samples[lo]?.t===q.t)samples[lo]=q;else samples.splice(lo,0,q);}
   const result:StagedVessel={...base,stagedService:{schedule:p,templates:this.#templates!,id},samples,arcs:rows.flatMap(r=>r.arcs).filter(a=>a.end>=this.oldest&&a.start<=end),
    ledger:[...rows.flatMap(r=>r.ledger).filter(e=>e.t>=this.oldest&&e.t<=end),...this.#events.filter(e=>e.shipId===base.id&&e.t>=this.oldest&&e.t<=cursor)],
    boundaries:rows.flatMap(r=>r.boundaries).filter(b=>b.t>=this.oldest&&b.t<=end)};
   // Entry evaluation is owned by the unrotated template and query adapter.
   // Global entry metadata is retained only for display layers/readouts.
   if(base.entry)result.entry={...base.entry,activeFrom:base.entry.activeFrom!+active.offset,entryEpoch:base.entry.entryEpoch+active.offset,brakingEpoch:base.entry.brakingEpoch+active.offset,recovery:{...base.entry.recovery,t:base.entry.recovery.t+active.offset,y:rotateState(base.entry.recovery.y,active.angle)}};
   return result;
  });
  const recoveries=Object.fromEntries(Object.entries(template.recoveries??{}).map(([id,r])=>[id,{...r,recoveryEpoch:r.recoveryEpoch+active.offset}]));
  const assemblies=template.assemblies?{separations:template.assemblies.separations.map(s=>({...s,t:s.t+active.offset,state:rotateState(s.state,active.angle),momentumBefore:rotate(s.momentumBefore as [number,number,number],active.angle),momentumAfter:rotate(s.momentumAfter as [number,number,number],active.angle)})),dock:{...template.assemblies.dock,t:template.assemblies.dock.t+active.offset}}:undefined;
  this.stats.retainedDrawingBytes=retainedBytes;this.stats.retainedDrawingSamples=retainedSamples;this.stats.viewCycles=this.#cycles.size;this.stats.viewSamples=vessels.reduce((n,v)=>n+v.samples.length,0);this.stats.cacheTemplateBytes=this.#templateBytes;
  return {...template,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,vessels,window:{start:this.oldest,end},recoveries,assemblies,
   traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.#resources,depots:stagedServiceDepots(this.definition),stats:this.stats,halt:this.halt}};
 }
}
