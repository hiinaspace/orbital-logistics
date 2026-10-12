import {prepareCompact} from './prepare';
import {cycleRow,resourcesAt,type CycleRow} from './view';
import {sampleCompact} from './query';
import {STEP} from './physics';
import type {CompactDefinition,CompactProfile,CompactTemplate} from './types';
import type {ResourceAnchor} from '../traffic/resources';
export const COMPACT_LEAD=32,COMPACT_RETENTION=128;
export interface CompactDelta {domain:'compact-cycler-service-v1';frontier:number;oldest:number;halt?:string;template?:CompactTemplate;cycles:CycleRow[];resources:ResourceAnchor[];stats:Record<string,number>}
// Internal fault-injection seam; production uses the admitted funded cycle.
export interface FaultOptions {importCap?:number;rejectCaptureAt?:number;packetLimit?:number}
export class CompactEngine {
 #prepared:ReturnType<typeof prepareCompact>;#frontier=0;#oldest=0;#halt?:string;#fatal=false;#sent=false;#cycles=new Map<number,CycleRow>();#exported=new Set<number>();#packet?:CompactDelta;
 constructor(readonly definition:CompactDefinition,profile:CompactProfile,readonly faults:FaultOptions={}){if(!definition.continuous)throw Error('Compact continuous definition required');this.#prepared=prepareCompact(profile);}
 get frontier(){return this.#frontier;}get oldest(){return this.#oldest;}get halt(){return this.#halt;}
 advanceTo(target:number){
  if(this.#fatal)throw Error('Compact publication permanently stopped');if(this.#halt)return;
  if(!Number.isFinite(target)||target<this.frontier||target>1_000_000||target-this.frontier>(this.#sent?8:32))throw Error('Compact request budget');
  const p=this.#prepared.template;let head=target,halt: string|undefined;
  const first=Math.floor(this.frontier/p.period),last=Math.floor(target/p.period),due:{t:number;type:string;index:number}[]=[];
  for(let cycle=first;cycle<=last;cycle++){
   const offset=cycle*p.period;
   p.flows.forEach((f,index)=>{const t=offset+f.t;if(t>this.frontier&&t<=target)due.push({t,type:'flow',index});});
  }
  if(this.faults.rejectCaptureAt!==undefined&&this.faults.rejectCaptureAt>this.frontier&&this.faults.rejectCaptureAt<=target)due.push({t:this.faults.rejectCaptureAt,type:'capture',index:0});
  due.sort((a,b)=>a.t-b.t);if(due.length>12)throw Error('Compact operation work budget');
  for(const op of due){const f=p.flows[op.index];if(op.type==='capture'||f.kind==='import'&&f.fuel>(this.faults.importCap??Infinity)){head=Math.max(this.frontier,op.t-STEP);halt=op.type==='capture'?'Capture failed':'Supply unavailable';break;}}
  const oldest=Math.max(0,head-(COMPACT_RETENTION-COMPACT_LEAD)),end=halt?head:Math.min(1_000_000,head+COMPACT_LEAD),from=Math.floor(oldest/p.period),through=Math.floor(end/p.period);
  const next=new Map<number,CycleRow>();for(let index=from;index<=through;index++)next.set(index,this.#cycles.get(index)??cycleRow(p,index));
  const drawingBytes=[...next.values()].reduce((n,c)=>n+c.bytes,0),drawingSamples=[...next.values()].reduce((n,c)=>n+c.samples,0);
  if(next.size>5||drawingBytes>12_000_000||drawingSamples>40000)throw Error('Compact retained drawing budget');
  const epochs=new Set([oldest,head]);
  for(let k=Math.floor(oldest/p.period);k<=Math.floor(head/p.period);k++)for(const f of p.flows){const t=k*p.period+f.t;if(t>oldest&&t<=head)epochs.add(t);}
  const resources=[...epochs].sort((a,b)=>a-b).map(t=>resourcesAt(p,t));
  const count=(t:number)=>Math.max(0,Math.floor((head-t)/p.period)+1),fuelSpent=p.hardware.reduce((n,_,actor)=>n+sampleCompact({template:p,actor,oldest:0,end:1_000_000,maxEpoch:1_000_000},head).fuelUsed!,0);
  const stats={physicalNodes:p.work.nodes,physicsChecks:p.work.checks,cacheCompilations:1,templateBytes:p.work.bytes,retainedCycles:next.size,retainedDrawingBytes:drawingBytes,retainedDrawingSamples:drawingSamples,planningPending:0,cyclerTrips:count(p.events.find(e=>e.actor===0&&e.kind==='dock')!.t),deliveries:p.flows.filter(f=>f.kind==='delivery').reduce((n,f)=>n+count(f.t),0),parcelsDelivered:resources.at(-1)!.cargoExported,fuelImported:resources.at(-1)!.fuelImported,fuelSpent,packetBytes:0};
  const packet:CompactDelta={domain:'compact-cycler-service-v1',frontier:head,oldest,halt,cycles:[...next.values()].filter(c=>!this.#exported.has(c.index)),resources,stats,...(!this.#sent?{template:p}:{})};
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if(stats.packetBytes>(this.faults.packetLimit??16_000_000)){this.#fatal=true;throw Error('Compact packet budget');}
  // No frontier, flow or cache publication occurs before complete preflight.
  this.#frontier=head;this.#oldest=oldest;this.#halt=halt;this.#cycles=next;this.#exported=new Set(next.keys());this.#sent=true;this.#packet=packet;
 }
 delta(){if(!this.#packet)throw Error('Compact has no published packet');return structuredClone(this.#packet);}
}
