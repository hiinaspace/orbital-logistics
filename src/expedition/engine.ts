import {prepareApollo,type ApolloMission} from '../model-set/apollo';
import type {SceneView,ViewSample,ViewerEvent} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
import {scheduledSample,type ExpeditionSchedule} from './query';
export interface ExpeditionDefinition {
 modelVersion:'apollo-continuous-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;
 source:ApolloMission;maxImport:number;
}
export const isExpedition=(d:unknown):d is ExpeditionDefinition=>!!d&&typeof d==='object'&&(d as ExpeditionDefinition).modelVersion==='apollo-continuous-v1';
export const EXPEDITION_LEAD=32,HISTORY=128;
export interface ExpeditionDelta {
 domain:'apollo-continuous-v1';frontier:number;oldest:number;template?:SceneView;schedule:ExpeditionSchedule;
 current:ViewSample;resources:ResourceAnchor[];events:ViewerEvent[];stats:Record<string,number>;halt?:string;
}
export class ExpeditionEngine {
 readonly definition:ExpeditionDefinition;readonly prepared:ReturnType<typeof prepareApollo>;readonly schedule:ExpeditionSchedule;
 frontier=0;oldest=0;halt?:string;#sent=false;#events:ViewerEvent[]=[];#resources:ResourceAnchor[];#refills=0;
 constructor(value:ExpeditionDefinition){
  if(!isExpedition(value)||value.schemaVersion!==1||!Number.isFinite(value.maxImport)||value.maxImport<=0||value.maxImport>6)throw Error('Invalid continuous expedition');
  this.definition=structuredClone(value);
  const raw=value.source;
  if(!raw.entry.atmosphere.spin.slice(0,2).every(x=>x===0))throw Error('Unsupported expedition symmetry');
  this.prepared=prepareApollo(raw);
  const d=this.prepared.definition,s=d.scenario,moon=s.bodies[1].rail,pad=d.ports[0].rail;
  if(moon.kind!=='circular'||pad.kind!=='surface'||!d.entry.atmosphere.spin.slice(0,2).every(x=>x===0)||moon.rate<=pad.rate)throw Error('Unsupported expedition symmetry');
  const period=2*Math.PI/(moon.rate-pad.rate),recovery=this.prepared.entry.contact.t,fuel=s.ship.propellant,spent=fuel-this.prepared.entry.contact.before[6];
  if(period<=recovery+7||spent<=0||spent>value.maxImport||s.ship.tankCapacity<fuel)throw Error('Expedition turnaround or supply budget');
  this.schedule={period,angle:pad.rate*period,recovery,spent,fuel,dryMass:s.ship.dryMass,launch:d.launch,pad:d.ports[0],transport:4,refuelLead:2,maxEpoch:1_000_000};
  this.#resources=[this.#resource(0,0)];
 }
 #resource(t:number,count:number):ResourceAnchor{
  return {t,stocks:this.prepared.definition.ports.map(p=>({id:p.id,cargo:0,propellant:0})),cargoImported:0,cargoExported:0,fuelImported:count*this.schedule.spent,fuelExported:0};
 }
 sample(t:number,before=false){return scheduledSample(this.schedule,this.prepared.view.vessels[0],t,(local,left)=>this.prepared.sample(local,left),before);}
 advanceTo(target:number){
  if(!Number.isFinite(target)||target<this.frontier||target>this.schedule.maxEpoch||target-this.frontier>4096)throw Error('Expedition advance outside budget');
  const p=this.schedule;
  let operations=0,counted=this.#refills;const pendingEvents:ViewerEvent[]=[],pendingResources:ResourceAnchor[]=[];
  while((counted+1)*p.period-p.refuelLead<=target){
   if(++operations>64)throw Error('Expedition operation budget');
   const count=counted+1,t=count*p.period-p.refuelLead;
   const before=this.sample(t,true),after=this.sample(t),amount=after.propellant-before.propellant;
   if(before.logistics?.dockedPortId!==p.pad.id||amount<0||amount>this.definition.maxImport+1e-10||Math.abs(amount-p.spent)>1e-10)throw Error('Expedition refuel invariant');
   // The standing ground supply imports the measured deficit, then atomically
   // debits that depot into the supported ship. No airborne fuel creation.
   pendingEvents.push({t,kind:'transfer',id:count+':ground-refuel',portId:p.pad.id,deltaV:0,fuelUsed:0,propellantBefore:before.propellant,propellantAfter:after.propellant,detail:'Ground supply imported '+amount.toFixed(6)+' propellant; depot debited into ship'});
   counted=count;pendingResources.push(this.#resource(t,count));
  }
  this.#refills=counted;this.#events.push(...pendingEvents);this.#resources.push(...pendingResources);
  this.frontier=target;if(target===this.schedule.maxEpoch)this.halt='Exhibit calendar ended';this.oldest=Math.max(0,target-HISTORY);
  this.#events=this.#events.filter(e=>e.t>=this.oldest);
  let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
 }
 delta():ExpeditionDelta{
  const p=this.schedule,result:ExpeditionDelta={domain:'apollo-continuous-v1',frontier:this.frontier,oldest:this.oldest,halt:this.halt,schedule:p,current:this.sample(this.frontier),resources:this.#resources,events:this.#events,
   stats:{planningPending:0,cacheCompilations:1,cacheHits:Math.floor(this.frontier/p.period),completedTrips:Math.max(0,Math.floor((this.frontier-p.recovery)/p.period)+1),refills:this.#refills,physicsBytes:this.prepared.work.physicsBytes,physicalNodes:this.prepared.work.nodes,packetBytes:0}};
  if(!this.#sent){result.template=this.prepared.view;this.#sent=true;}
  result.stats.packetBytes=new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if(result.stats.packetBytes>9_000_000)throw Error('Expedition worker packet budget');
  return result;
 }
}
export function expeditionDepots(d:ExpeditionDefinition):Depot[]{
 return d.source.ports.map(p=>({id:p.id,role:'Surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:d.maxImport,cargoRate:0,propellantRate:0}));
}
