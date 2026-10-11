import {prepareStagedApollo,type StagedApolloMission,type MissionAccounts} from '../model-set/staged-apollo';
import type {SceneView,ViewSample,ViewerEvent,VesselView} from '../model-set/model';
import type {ResourceAnchor,Depot} from '../traffic/resources';
import {STAGED_PARTS,STAGED_ACTORS,scheduledStagedSample,stagedOccurrence,stagedPresent,stagedId,type StagedActor,type StagedSchedule} from './query';
import {StagedServiceViewStore,type PreparedStagedCycle} from './view';

export const STAGED_LEAD=32,STAGED_HISTORY=128;
export interface StagedServiceDefinition {
 modelVersion:'staged-continuous-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;source:StagedApolloMission;maxImport:number;
}
export const isStagedService=(d:unknown):d is StagedServiceDefinition=>!!d&&typeof d==='object'&&(d as StagedServiceDefinition).modelVersion==='staged-continuous-v1';
export interface StagedServiceEvent extends ViewerEvent {shipId:string}
export interface StagedServiceDelta {
 domain:'staged-continuous-v1';frontier:number;oldest:number;schedule:StagedSchedule;template?:SceneView;preparedCycles:PreparedStagedCycle[];
 current:Record<StagedActor,ViewSample>;accounts:MissionAccounts;resources:ResourceAnchor[];events:StagedServiceEvent[];stats:Record<string,number>;halt?:string;
}
export class StagedServiceEngine {
 readonly definition:StagedServiceDefinition;readonly prepared:ReturnType<typeof prepareStagedApollo>;readonly schedule:StagedSchedule;
 readonly templates:Record<StagedActor,VesselView>;
 frontier=0;oldest=0;halt?:string;#sent=false;#refills=0;#events:StagedServiceEvent[]=[];#resources:ResourceAnchor[];#drawing:StagedServiceViewStore;
 constructor(value:StagedServiceDefinition,compile:typeof prepareStagedApollo=prepareStagedApollo){
  if(!isStagedService(value)||value.schemaVersion!==1||!value.id||!value.name||!Number.isFinite(value.maxImport)||value.maxImport<=0||value.maxImport>100||Object.keys(value).some(k=>!['modelVersion','schemaVersion','id','name','description','provenance','source','maxImport'].includes(k)))throw Error('Invalid continuous staged expedition');
  this.definition=structuredClone(value);this.prepared=compile(this.definition.source);
  const d=this.prepared.definition,w=d.world,moon=w.bodies[1]?.rail,pad=d.ports[0];
  if(w.epoch!==0||w.bodies.length!==2||moon.kind!=='circular'||pad.rail.kind!=='surface'||moon.rate<=pad.rail.rate||!d.entry.atmosphere.spin.slice(0,2).every(x=>x===0)||w.bodies[0].rail.kind!=='fixed'||w.bodies[0].rail.position.some(x=>x!==0)||moon.center.some(x=>x!==0)||JSON.stringify([moon.u,moon.v])!==JSON.stringify([[1,0,0],[0,1,0]]))throw Error('Unsupported staged expedition symmetry');
  const period=2*Math.PI/(moon.rate-pad.rail.rate),recoveries=this.prepared.recoveries;
  if(period<=Math.max(recoveries.booster,recoveries.orbiter)+7||period<=w.duration||STAGED_PARTS.some(key=>!Number.isFinite(this.prepared.spent[key])||this.prepared.spent[key]<0||this.prepared.spent[key]>=d.hardware[key].propellant)||STAGED_PARTS.reduce((n,key)=>n+this.prepared.spent[key],0)>value.maxImport)throw Error('Staged expedition turnaround or supply budget');
  this.templates=Object.fromEntries(STAGED_ACTORS.map(key=>[key,this.prepared.view.vessels.find(v=>v.id===(key==='stack'?d.stack.id:d.hardware[key].id))!])) as Record<StagedActor,VesselView>;
  if(STAGED_ACTORS.some(key=>!this.templates[key]?.lifetime)||!this.templates.booster.entry||!this.templates.orbiter.entry)throw Error('Missing staged expedition ownership or recovery');
  const parts=Object.fromEntries(STAGED_PARTS.map(key=>[key,{id:d.hardware[key].id,fuel:d.hardware[key].propellant,spent:this.prepared.spent[key],dryMass:d.hardware[key].dryMass,tankCapacity:d.hardware[key].tankCapacity,recovery:recoveries[key==='lander'?'orbiter':key]}])) as StagedSchedule['parts'];
  const seams=new Set([0,period,period-3,period-2,...Object.values(recoveries).flatMap(t=>[t,t+1,t+2,t+4])]);
  for(const base of Object.values(this.templates)){for(const b of base.boundaries)seams.add(b.t);for(const a of base.arcs){seams.add(a.start);seams.add(a.end);for(const k of a.steering?.keys??[])seams.add(a.start+k.offset);}}
  this.schedule={period,angle:pad.rail.rate*period,pad,duration:w.duration,transport:4,refuelLead:2,maxEpoch:1_000_000,parts,lifetimes:Object.fromEntries(STAGED_ACTORS.map(key=>[key,this.templates[key].lifetime!])) as StagedSchedule['lifetimes'],seams:[...seams].sort((a,b)=>a-b)};
  this.#resources=[this.#resource(0,0)];this.#drawing=new StagedServiceViewStore(this.definition);
 }
 sample(id:StagedActor,t:number,before=false){return scheduledStagedSample(this.schedule,this.templates,id,t,(key,local,left)=>this.prepared.sample(this.templates[key].id,local,left),before);}
 accounts(t:number,before=false):MissionAccounts {
  const p=this.schedule,o=stagedOccurrence(p,t,before),finite=this.prepared.accounts(Math.min(o.local,p.duration),before);
  const reassembled=o.local>p.period-3||o.local===p.period-3&&!before;
  const parts=Object.fromEntries(STAGED_PARTS.map(key=>{
   const q=this.sample(key,t,before),carrier=key==='lander'?'orbiter':key,transport=o.offset+(p.parts[carrier].recovery+p.transport);
   const supported=t>transport||t===transport&&!before,ownerId=reassembled?this.templates.stack.id:supported?'ground:'+p.parts[carrier].id:finite.parts[key].ownerId;
   return [key,{id:p.parts[key].id,propellant:q.propellant,consumedFuel:q.fuelUsed!,ownerId,y:[...q.y]}];
  })) as MissionAccounts['parts'];
  const remainingFuel=STAGED_PARTS.reduce((n,key)=>n+parts[key].propellant,0),consumedFuel=STAGED_PARTS.reduce((n,key)=>n+parts[key].consumedFuel,0),dryMass=STAGED_PARTS.reduce((n,key)=>n+p.parts[key].dryMass,0);
  return {t,parts,remainingFuel,consumedFuel,dryMass,activeMass:dryMass+remainingFuel};
 }
 #resource(t:number,count:number):ResourceAnchor {return {t,stocks:this.prepared.definition.ports.map(p=>({id:p.id,cargo:0,propellant:0})),cargoImported:0,cargoExported:0,fuelImported:count*STAGED_PARTS.reduce((n,key)=>n+this.schedule.parts[key].spent,0),fuelExported:0};}
 advanceTo(target:number){
  const p=this.schedule;if(!Number.isFinite(target)||target<this.frontier||target>p.maxEpoch||target>this.frontier+4096)throw Error('Staged expedition advance outside budget');
  let count=this.#refills,operations=0;const events:StagedServiceEvent[]=[],resources:ResourceAnchor[]=[];
  while((count+1)*p.period-p.refuelLead<=target){
   if(++operations>64)throw Error('Staged expedition transaction work budget');
   const cycle=count+1,t=cycle*p.period-p.refuelLead;
   if(!stagedPresent(p,'stack',t))throw Error('Staged refill without reassembly');
   const before=this.accounts(t,true),after=this.accounts(t);let imported=0;
   for(const key of STAGED_PARTS){
    const a=before.parts[key],b=after.parts[key],tank=p.parts[key],amount=b.propellant-a.propellant;
    if(a.ownerId!==this.templates.stack.id||b.ownerId!==this.templates.stack.id||amount<0||Math.abs(amount-tank.spent)>1e-10||b.propellant>tank.tankCapacity||Math.abs(a.consumedFuel-b.consumedFuel)>1e-10)throw Error('Staged expedition supported refuel invariant');
    imported+=amount;events.push({t,kind:'transfer',shipId:tank.id,id:stagedId(cycle,key+':ground-refuel'),portId:p.pad.id,deltaV:0,fuelUsed:0,propellantBefore:a.propellant,propellantAfter:b.propellant,detail:'Ground supply imported '+amount.toFixed(6)+' propellant; depot debited into '+tank.id});
   }
   if(imported>this.definition.maxImport+1e-10||Math.abs(after.remainingFuel-before.remainingFuel-imported)>1e-10)throw Error('Staged expedition supply invariant');
   count=cycle;resources.push(this.#resource(t,count));
  }
  this.#refills=count;this.#events.push(...events);this.#resources.push(...resources);this.frontier=target;this.oldest=Math.max(0,target-STAGED_HISTORY);
  if(target===p.maxEpoch)this.halt='Exhibit calendar ended';
  this.#events=this.#events.filter(e=>e.t>=this.oldest);let i=0;while(i+1<this.#resources.length&&this.#resources[i+1].t<=this.oldest)i++;this.#resources=this.#resources.slice(i);
 }
 delta():StagedServiceDelta {
  const p=this.schedule,current=Object.fromEntries(STAGED_ACTORS.map(key=>[key,this.sample(key,this.frontier)])) as StagedServiceDelta['current'];
  const stats={planningPending:0,cacheCompilations:1,cacheHits:Math.floor(this.frontier/p.period),completedTrips:Math.max(0,Math.floor((this.frontier-Math.max(p.parts.booster.recovery,p.parts.orbiter.recovery))/p.period)+1),refills:this.#refills,physicsBytes:this.prepared.work.physicsBytes,physicalNodes:this.prepared.work.nodes,packetBytes:0,workerDrawingBytes:0,workerDrawingSamples:0};
  const packet:StagedServiceDelta={domain:'staged-continuous-v1',frontier:this.frontier,oldest:this.oldest,schedule:p,current,accounts:this.accounts(this.frontier),resources:this.#resources,events:this.#events,stats,preparedCycles:[],halt:this.halt};
  if(!this.#sent)packet.template=this.prepared.view;
  this.#drawing.ingest(packet);this.#drawing.view(this.frontier,Math.min(p.maxEpoch,this.frontier+STAGED_LEAD));packet.preparedCycles=this.#drawing.exportPreparedCycles();
  stats.workerDrawingBytes=this.#drawing.stats.retainedDrawingBytes;stats.workerDrawingSamples=this.#drawing.stats.retainedDrawingSamples;
  stats.packetBytes=new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if(stats.packetBytes>(packet.template?64_000_000:48_000_000)||stats.workerDrawingBytes>84_000_000||stats.workerDrawingSamples>240000||stats.physicsBytes>60_000_000||stats.physicalNodes>160000)throw Error('Staged expedition aggregate physical/packet budget '+JSON.stringify(stats));
  this.#sent=true;return packet;
 }
}
export function stagedServiceDepots(d:StagedServiceDefinition):Depot[]{return d.source.ports.map(p=>({id:p.id,role:'Surface terminal',berths:1,cargo:0,cargoCapacity:1,propellant:0,tankCapacity:d.maxImport,cargoRate:0,propellantRate:0}));}
