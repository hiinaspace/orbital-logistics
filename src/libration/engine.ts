import {CourierService,type CourierCycle} from './service';
export type {CourierCycle} from './service';
import {ExpeditionFleetEngine,type ExpeditionFleetDefinition,type ExpeditionFleetDelta} from '../expedition/fleet';
import {prepareCourier,type CourierDefinition} from './prepare';
import type {LibrationSchedule} from './query';
import {type ResourceAnchor} from '../traffic/resources';
import type {Port} from '../sim/schema';
import type {VesselView,ViewSample} from '../model-set/model';
export interface LibrationDefinition {domain:'libration-service-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;source:ExpeditionFleetDefinition;station:Port;courier:CourierDefinition}
export const isLibration=(d:unknown):d is LibrationDefinition=>!!d&&typeof d==='object'&&(d as LibrationDefinition).domain==='libration-service-v1';
export interface LibrationDelta {domain:'libration-service-v1';base:ExpeditionFleetDelta;template?:VesselView;schedule:LibrationSchedule;cycles:CourierCycle[];resources:ResourceAnchor[];current:ViewSample;stats:Record<string,number>}
export class LibrationEngine {
 readonly definition:LibrationDefinition;readonly base:ExpeditionFleetEngine;readonly courier:ReturnType<typeof prepareCourier>;
 #sent=false;readonly service:CourierService;
 constructor(value:LibrationDefinition){
  if(!isLibration(value)||value.schemaVersion!==1||!value.id||!value.name)throw Error('Invalid libration service');
  this.definition=structuredClone(value);const source=this.definition.source.source.source,station=this.definition.station;
  const ids=[station.id,value.courier.id,value.courier.pad.id,...value.source.actors.map(a=>a.id),...value.source.actors.map(a=>a.padId),value.source.orbiter.id,...source.scenario.bodies.map(b=>b.id),source.ports[1].id];
  if(ids.some(x=>!x)||new Set(ids).size!==ids.length||source.entry.atmosphere.topHeight!==.2||station.cargo!==0||station.propellant!==0||station.cargoCapacity!==1||station.tankCapacity!==0)throw Error('Libration identity/provider admission');
  this.service=new CourierService(source.scenario,station,this.definition.courier);this.courier=this.service.courier;
  this.base=new ExpeditionFleetEngine(this.definition.source);
 }
 get frontier(){return this.base.frontier;}get oldest(){return this.base.oldest;}get halt(){return this.base.halt;}
 sample(t:number,left=false){return this.service.sample(t,left);}
 advanceTo(target:number){
  if(!Number.isFinite(target)||target<this.frontier||target>1_000_000||target-this.frontier>(this.frontier===0?32:8))throw Error('Libration advance outside work budget');
  this.service.advanceTo(target,Math.max(0,target-128));this.base.advanceTo(target);
 }
 delta():LibrationDelta{
  const base=this.base.delta(),p=this.courier.schedule,{cycles,stats:courierStats}=this.service.drawing(this.oldest,this.frontier);
  const stats={...base.stats,...courierStats,cacheCompilations:base.stats.cacheCompilations+1,physicsBytes:base.stats.physicsBytes+this.courier.work.physicsBytes,physicalNodes:base.stats.physicalNodes+this.courier.work.nodes,workerDrawingBytes:base.stats.workerDrawingBytes+courierStats.courierDrawingBytes,workerDrawingSamples:base.stats.workerDrawingSamples+courierStats.courierDrawingSamples,packetBytes:0};
  const packet:LibrationDelta={domain:'libration-service-v1',base,schedule:p,cycles,resources:this.service.resources(base.resources,this.oldest,this.frontier),current:this.sample(this.frontier),stats,...(!this.#sent?{template:this.courier.template}:{})};this.#sent=true;
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if(stats.packetBytes>(packet.template?36_000_000:16_000_000)||stats.physicalNodes>165000||stats.physicsBytes>60_000_000||stats.workerDrawingBytes>84_000_000||stats.courierDrawingBytes>12_000_000||stats.courierDrawingSamples>24000||packet.resources.length>22)throw Error('Libration aggregate storage budget');
  return packet;
 }
}
