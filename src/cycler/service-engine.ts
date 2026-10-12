import {prepareRecurringFleet} from './fleet';
import {samplePassThrough,FLEET_MAX_EPOCH,fleetEventCount,fleetOccurrence} from './query';
import {fleetChunk,fleetResources,FLEET_LEAD,FLEET_HISTORY,FLEET_RETENTION,FLEET_CHUNK,FLEET_ROWS,FLEET_BYTES,FLEET_CHUNKS,type FleetChunk,type FleetServiceDefinition} from './service-view';
import type {RecurringFleetProfile,PassThroughTemplate} from './types';
import type {ResourceAnchor} from '../traffic/resources';
import {STEP} from '../compact/physics';
export interface FleetDelta {domain:'cycler-fleet-service-v1';frontier:number;oldest:number;halt?:string;template?:PassThroughTemplate;chunks:FleetChunk[];resources:ResourceAnchor[];stats:Record<string,number>}
export interface FleetFaults {importCap?:number;rejectAt?:number;packetLimit?:number}
export class FleetEngine {
 #template:PassThroughTemplate;#frontier=0;#oldest=0;#halt?:string;#fatal=false;#sent=false;#chunks=new Map<number,FleetChunk>();#exported=new Set<number>();#packet?:FleetDelta;
 constructor(readonly definition:FleetServiceDefinition,profile:RecurringFleetProfile,readonly faults:FleetFaults={}){
  if(definition.domain!=='cycler-fleet-service-v1'||definition.schemaVersion!==1||!definition.id||!definition.name)throw Error('Fleet service definition');this.#template=prepareRecurringFleet(profile);
 }
 get frontier(){return this.#frontier;}get oldest(){return this.#oldest;}get halt(){return this.#halt;}
 advanceTo(target:number){
  if(this.#fatal)throw Error('Fleet publication permanently stopped');if(this.#halt)return;
  if(!Number.isFinite(target)||target<this.frontier||target>FLEET_MAX_EPOCH||target-this.frontier>(this.#sent?8:FLEET_LEAD))throw Error('Fleet request budget');
  const p=this.#template,due:{t:number;id:string;fuel?:number}[]=[];let head=target,halt:string|undefined;
  for(let k=Math.floor(this.frontier/p.duration);k<=Math.floor(target/p.duration);k++)for(const [i,f] of p.flows.entries()){
   const t=k*p.duration+f.t;if(t>this.frontier&&t<=target)due.push({t,id:k+':flow:'+i,fuel:f.kind==='import'?f.fuel:undefined});
  }
  if(this.faults.rejectAt!==undefined&&this.faults.rejectAt>this.frontier&&this.faults.rejectAt<=target)due.push({t:this.faults.rejectAt,id:'capture'});
  due.sort((a,b)=>a.t-b.t);if(due.length>16)throw Error('Fleet operation work budget');
  for(const e of due)if(e.id==='capture'||e.fuel!==undefined&&e.fuel>(this.faults.importCap??Infinity)){head=Math.max(this.frontier,e.t-STEP);halt=e.id==='capture'?'Maintenance or capture failed':'Ground supply unavailable';break;}
  const oldest=Math.max(0,head-FLEET_HISTORY),end=Math.min(FLEET_MAX_EPOCH,halt?head:head+FLEET_LEAD),next=new Map<number,FleetChunk>();
  const first=Math.floor(oldest/FLEET_CHUNK),last=Math.floor(end/FLEET_CHUNK);
  for(let index=first;index<=last;index++){if(index*FLEET_CHUNK>=FLEET_MAX_EPOCH)continue;next.set(index,this.#chunks.get(index)??fleetChunk(p,index));}
  const bytes=[...next.values()].reduce((n,c)=>n+c.bytes,0),samples=[...next.values()].reduce((n,c)=>n+c.samples,0);
  if(next.size>FLEET_CHUNKS||bytes>FLEET_BYTES||samples>FLEET_ROWS)throw Error('Fleet aggregate drawing budget');
  const epochs=new Set([oldest,head]);for(let k=Math.floor(oldest/p.duration);k<=Math.floor(head/p.duration);k++)for(const f of p.flows){const t=k*p.duration+f.t;if(t>oldest&&t<=head)epochs.add(t);}
  const resources=[...epochs].sort((a,b)=>a-b).map(t=>fleetResources(p,t));if(resources.length>40)throw Error('Fleet resource anchor budget');
  const carrierFuel=[0,1].map(actor=>samplePassThrough({template:p,actor,continuous:true},head).propellant),fuelSpent=p.hardware.reduce((n,_,actor)=>n+samplePassThrough({template:p,actor,continuous:true},head).fuelUsed!,0);
  const stats={physicalNodes:p.work.nodes,physicsChecks:p.work.checks,cacheCompilations:1,templateBytes:p.work.bytes,retainedChunks:next.size,retainedDrawingBytes:bytes,retainedDrawingSamples:samples,planningPending:0,deliveries:p.flows.filter(f=>f.kind==='delivery').reduce((n,f)=>n+fleetEventCount(p,head,f.t),0),parcelsDelivered:resources.at(-1)!.cargoExported,fuelImported:resources.at(-1)!.fuelImported,fuelSpent,carrierFuel:carrierFuel.reduce((a,b)=>a+b),maintenanceClosures:2*fleetOccurrence(p,head).index,packetBytes:0,retention:FLEET_RETENTION};
  const packet:FleetDelta={domain:'cycler-fleet-service-v1',frontier:head,oldest,halt,chunks:[...next.values()].filter(c=>!this.#exported.has(c.index)),resources,stats,...(!this.#sent?{template:p}:{})};
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;if(stats.packetBytes>(this.faults.packetLimit??16_000_000)){this.#fatal=true;throw Error('Fleet packet budget');}
  this.#frontier=head;this.#oldest=oldest;this.#halt=halt;this.#chunks=next;this.#exported=new Set(next.keys());this.#sent=true;this.#packet=packet;
 }
 delta(){if(!this.#packet)throw Error('Fleet has no published packet');return structuredClone(this.#packet);}
}
