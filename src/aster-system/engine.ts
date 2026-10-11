import {StagedServiceEngine,type StagedServiceDefinition,type StagedServiceDelta,STAGED_LEAD,STAGED_HISTORY} from '../staged-service/engine';
import {CourierService,type CourierCycle} from '../libration/service';
import type {CourierDefinition} from '../libration/prepare';
import type {LibrationSchedule} from '../libration/query';
import {OrbiterStream,type OrbiterDefinition,type OrbiterDelta} from '../expedition/orbiter';
import type {Port} from '../sim/schema';
import type {VesselView,ViewSample} from '../model-set/model';
import type {ResourceAnchor} from '../traffic/resources';
import {prepareStagedApollo} from '../model-set/staged-apollo';
export interface AsterSystemDefinition {
 domain:'aster-system-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;
 source:StagedServiceDefinition;station:Port;courier:CourierDefinition;orbiters:OrbiterDefinition[];
}
export const isAsterSystem=(d:unknown):d is AsterSystemDefinition=>!!d&&typeof d==='object'&&(d as AsterSystemDefinition).domain==='aster-system-v1';
export interface AsterSystemDelta {
 domain:'aster-system-v1';frontier:number;oldest:number;base:StagedServiceDelta;
 courier:{template?:VesselView;schedule:LibrationSchedule;cycles:CourierCycle[];current:ViewSample};
 orbiters:(OrbiterDelta&{id:string;bytes:number})[];resources:ResourceAnchor[];stats:Record<string,number>;halt?:string;
}
export class AsterSystemEngine {
 readonly definition:AsterSystemDefinition;readonly staged:StagedServiceEngine;readonly courier:CourierService;readonly orbiters:OrbiterStream[];
 frontier=0;oldest=0;halt?:string;#sent=false;#packet?:AsterSystemDelta;#fatal=false;
 constructor(value:AsterSystemDefinition,compile:typeof prepareStagedApollo=prepareStagedApollo){
  if(!isAsterSystem(value)||value.schemaVersion!==1||!value.id||!value.name||value.orbiters?.length!==2||Object.keys(value).some(k=>!['domain','schemaVersion','id','name','description','provenance','source','station','courier','orbiters'].includes(k)))throw Error('Invalid Aster system composition');
  this.definition=structuredClone(value);const d=this.definition,w=d.source.source.world;
  const ids=[...w.bodies.map(b=>b.id),...d.source.source.ports.map(p=>p.id),d.source.source.stack.id,...Object.values(d.source.source.hardware).map(h=>h.id),d.courier.id,d.courier.pad.id,d.station.id,...d.orbiters.map(o=>o.id)];
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length||d.station.cargo!==0||d.station.propellant!==0||d.station.cargoCapacity!==1||d.station.tankCapacity!==0||d.source.source.entry.atmosphere.topHeight!==.2||d.orbiters.some(o=>!o.name||!/^#[0-9a-f]{6}$/i.test(o.color)||o.state.length!==6||o.state.some(x=>!Number.isFinite(x))))throw Error('Aster system identity/provider admission');
  this.staged=new StagedServiceEngine(d.source,compile);
  const scenario=structuredClone(this.staged.prepared.outbound.bundle.scenario);scenario.bodies=structuredClone(w.bodies);scenario.epoch=w.epoch;
  this.courier=new CourierService(scenario,d.station,d.courier);
  this.orbiters=d.orbiters.map(o=>new OrbiterStream(scenario,o,w.bodies[0].radius+.2));
 }
 advanceTo(target:number){
  if(this.#fatal)throw Error(this.halt);
  if(!Number.isFinite(target)||target<this.frontier||target>1_000_000||target-this.frontier>(this.#sent?8:32))throw Error('Aster system advance outside work budget');
  const oldest=Math.max(0,target-STAGED_HISTORY),end=Math.min(1_000_000,target+STAGED_LEAD);
  try{
   // Child state is private. Any rejection poisons this worker generation;
   // export cursors are never retried after a partial private advancement.
   this.courier.advanceTo(target,oldest);
   for(const o of this.orbiters)o.extend(end);
   const candidatePhysicalNodes=this.staged.prepared.work.nodes+this.courier.courier.work.nodes+this.orbiters.reduce((n,o)=>n+o.storage().nodes,0),candidatePhysicsBytes=this.staged.prepared.work.physicsBytes+this.courier.courier.work.physicsBytes+this.orbiters.reduce((n,o)=>n+o.storage().bytes,0);
   if(candidatePhysicalNodes>220000||candidatePhysicsBytes>80_000_000)throw Error('Aster candidate construction budget');
   this.staged.advanceTo(target);const base=this.staged.delta();
   const drawing=this.courier.drawing(oldest,target),orbiters=this.orbiters.map(o=>{
    const row=o.delta(this.#sent?this.frontier:0,oldest,target);
    const bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength;return {...row,id:o.definition.id,bytes};
   });
   const stats={...base.stats,...drawing.stats,cacheCompilations:2,physicsBytes:base.stats.physicsBytes+this.courier.courier.work.physicsBytes+orbiters.reduce((n,o)=>n+o.physicsBytes,0),physicalNodes:base.stats.physicalNodes+this.courier.courier.work.nodes+orbiters.reduce((n,o)=>n+o.nodes,0),workerDrawingBytes:base.stats.workerDrawingBytes+drawing.stats.courierDrawingBytes+orbiters.reduce((n,o)=>n+o.drawingBytes,0),workerDrawingSamples:base.stats.workerDrawingSamples+drawing.stats.courierDrawingSamples+orbiters.reduce((n,o)=>n+o.drawingSamples,0),candidatePhysicalNodes,candidatePhysicsBytes,cacheTemplateDrawingBytes:this.staged.prepared.work.bytes+this.courier.courier.work.drawingBytes,orbiterFaults:orbiters.filter(o=>o.fault).length,packetBytes:0};
   const courier={schedule:this.courier.courier.schedule,cycles:drawing.cycles,current:this.courier.sample(target),...(!this.#sent?{template:this.courier.courier.template}:{})};
   const packet:AsterSystemDelta={domain:'aster-system-v1',frontier:target,oldest,base,courier,orbiters,resources:this.courier.resources(base.resources,oldest,target),stats,halt:base.halt};
   stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
   this.validatePacket(packet);
   this.#packet=packet;this.frontier=target;this.oldest=oldest;this.halt=packet.halt;this.#sent=true;
  }catch(error){this.#fatal=true;this.halt='Aster system publication stopped: '+(error as Error).message;throw Error(this.halt);}
 }
 // Protected admission seam also supplies a deterministic rejection witness.
 protected validatePacket(p:AsterSystemDelta){
  if(p.stats.packetBytes>(p.base.template?64_000_000:48_000_000)||p.stats.physicalNodes>200000||p.stats.physicsBytes>70_000_000||p.stats.workerDrawingBytes>96_000_000||p.stats.workerDrawingSamples>275000||p.resources.length>24||p.orbiters.some(o=>o.bytes>2_000_000))throw Error('Aster system aggregate storage budget '+JSON.stringify(p.stats));
 }
 delta(){if(this.#fatal)throw Error(this.halt);if(!this.#packet)throw Error('Aster system has no published packet');return this.#packet;}
}
