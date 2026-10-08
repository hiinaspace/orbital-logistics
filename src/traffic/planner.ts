import {Runner} from '../sim/runner';
import {validateBundle,type Bundle,type ThrustArc,type Vec3} from '../sim/schema';
import {portState} from '../sim/logistics';
import type {Depot} from './resources';
export const CALENDAR_LIMIT=1_000_000;
export interface TransferTemplate {id:string;source:string;destination:string;referenceDeparture:number;duration:number;cargo:number;propellant:number;arcs:ThrustArc[];provenance:string}
export interface TrafficVessel {id:string;name:string;color:string;cargo:string;portId:string;propellant:number;route:string[]}
export interface TrafficDefinition {schemaVersion:1;id:string;name:string;description:string;provenance:string;extent:number;rotating:{name:string;rate:number;phase:number};world:Bundle;historyDuration:number;sampleStep:number;forecastDuration:number;stations:Depot[];templates:TransferTemplate[];vessels:TrafficVessel[]}
export interface Window {index:number;departure:number}
export interface EpisodeSource {id:string;shipId:string;voyage:number;templateId:string;admittedAt:number;departure:number;arrival:number;captureLocalEpoch:number;windowIndex:number;bundle:Bundle}
export interface Episode extends EpisodeSource {runner:Runner;execution:Runner;facts:ReturnType<Runner['snapshot']>['ledger'];nextFact:number}
const tau=2*Math.PI;
export const phase=(x:number)=>((x%tau)+tau)%tau;
export function validateTraffic(value:TrafficDefinition):TrafficDefinition {
 const d=structuredClone(value);d.world=validateBundle(d.world);
 const s=d.world.scenario,body=s.bodies[0],ports=s.logistics?.ports??[];
 if(d.schemaVersion!==1 || !d.id || !d.name || d.vessels.length<1 || d.vessels.length>4 ||
  ![d.historyDuration,d.forecastDuration,d.extent,d.rotating.rate,d.rotating.phase].every(Number.isFinite) || d.extent<=0 || d.historyDuration<16 || d.historyDuration>128 || d.sampleStep!==1/16 || d.forecastDuration<4 || d.forecastDuration>16 ||
  s.bodies.length!==1 || body.mu!==1 || body.rail.kind!=='fixed' || body.rail.position.some(x=>x!==0) ||
  s.ship.dryMass!==1 || s.ship.exhaustVelocity!==3 || s.ship.engine?.maxThrust!==1 || s.ship.engine.maxAcceleration!==undefined ||
  ports.length!==2 || ports.some(p=>p.rail.kind!=='circular' || p.rail.rate<=0 || p.rail.center.some(x=>x!==0) || p.rail.u.some((x,i)=>x!==[1,0,0][i]) || p.rail.v.some((x,i)=>x!==[0,1,0][i])))throw new Error('Unsupported continuous traffic domain');
 for(const depot of d.stations)if(!ports.some(p=>p.id===depot.id) || depot.berths<d.vessels.length || !Number.isInteger(depot.berths) ||
  ![depot.cargo,depot.propellant,depot.cargoCapacity,depot.tankCapacity,depot.cargoRate,depot.propellantRate].every(Number.isFinite) ||
  depot.cargo<0 || depot.cargo>depot.cargoCapacity || depot.propellant<0 || depot.propellant>depot.tankCapacity)throw new Error('Invalid depot');
 if(d.stations.length!==2 || new Set(d.stations.map(p=>p.id)).size!==2 || new Set(d.vessels.map(v=>v.id)).size!==d.vessels.length || new Set(d.templates.map(t=>t.id)).size!==d.templates.length)throw new Error('Invalid traffic identities');
 for(const t of d.templates)if(!ports.some(p=>p.id===t.source) || !ports.some(p=>p.id===t.destination) || t.source===t.destination || !Number.isFinite(t.referenceDeparture) || t.duration<=0 || t.duration>8 || !Number.isFinite(t.duration) || ![t.cargo,t.propellant].every(Number.isFinite) || t.cargo<0 || t.cargo>s.logistics!.cargoCapacity || t.propellant<0 || t.propellant>s.ship.tankCapacity || t.arcs.length!==2 || t.arcs[0].start!==0 || t.arcs[1].end!==t.duration)throw new Error('Invalid transfer template');
 for(const v of d.vessels) {
  if(!v.name || !/^#[0-9a-f]{6}$/i.test(v.color) || !ports.some(p=>p.id===v.portId) || !Number.isFinite(v.propellant) || v.propellant<0 || v.propellant>s.ship.tankCapacity || v.route.length<2 || v.route.length>8)throw new Error('Invalid traffic vessel');
  let port=v.portId;for(const id of v.route){const t=d.templates.find(t=>t.id===id);if(!t || t.source!==port)throw new Error('Disconnected route');port=t.destination;}
  if(port!==v.portId)throw new Error('Route must return to initial port');
 }
 return d;
}
export function nextWindow(d:TrafficDefinition,t:TransferTemplate,after:number,minIndex=-Infinity):Window {
 const from=d.world.scenario.logistics!.ports.find(p=>p.id===t.source)!,to=d.world.scenario.logistics!.ports.find(p=>p.id===t.destination)!;
 if(from.rail.kind!=='circular' || to.rail.kind!=='circular')throw new Error('Unsupported window rails');
 const period=tau/Math.abs(to.rail.rate-from.rail.rate);
 if(!Number.isFinite(period) || period<=0 || !Number.isFinite(after))throw new Error('Unsupported window');
 let index=Math.max(Math.ceil((after-t.referenceDeparture)/period),minIndex),departure=t.referenceDeparture+index*period;
 if(departure<after){index++;departure=t.referenceDeparture+index*period;}
 if(!Number.isSafeInteger(index) || departure+t.duration>CALENDAR_LIMIT || departure<after)throw new Error('Calendar domain exhausted');
 return {index,departure};
}
export function admitEpisode(d:TrafficDefinition,t:TransferTemplate,shipId:string,voyage:number,admittedAt:number,w:Window,cargo:number,fuel:number):Episode {
 if(Math.abs(cargo-t.cargo)>1e-12 || Math.abs(fuel-t.propellant)>1e-12)throw new Error('Unsupported departure loadout');
 const b=structuredClone(d.world),s=b.scenario,ports=s.logistics!.ports,source=ports.find(p=>p.id===t.source)!;
 if(source.rail.kind!=='circular')throw new Error('Unsupported source');
 const angle=phase(source.rail.rate*(w.departure-t.referenceDeparture)),c=Math.cos(angle),sn=Math.sin(angle);
 s.epoch=0;s.duration=Math.ceil(t.duration/s.policy.step)*s.policy.step;
 s.ship.id=shipId;s.ship.cargoMass=cargo;s.ship.propellant=fuel;
 s.policy.maxNodes=Math.min(65536,Math.ceil(s.duration/s.policy.step)+1024);
 ports.forEach(p=>{if(p.rail.kind==='circular')p.rail.phase=phase(p.rail.phase+p.rail.rate*w.departure);});
 s.ship.state=portState(source,0);
 const id=`${shipId}:${voyage}`;
 b.program={schemaVersion:3,id,burns:[],thrustArcs:t.arcs.map((a,i)=>({...a,id:`${id}:arc${i}`,direction:[c*a.direction[0]-sn*a.direction[1],sn*a.direction[0]+c*a.direction[1],a.direction[2]] as Vec3})),operations:[{id:`${id}:capture`,t:t.duration,kind:'dock',portId:t.destination}]};
 const runner=new Runner(b),terminal=runner.advanceTo(s.duration),dock=runner.ledger.find(e=>e.kind==='dock');
 if(terminal.status!=='horizon' || !dock || dock.portId!==t.destination || dock.positionError!+1e-8>=1e-7 || dock.deltaV+1e-8>=1e-7 || runner.sample(t.duration).propellant<.05)throw new Error('Powered transfer admission failed');
 return {id,shipId,voyage,templateId:t.id,admittedAt,departure:w.departure,arrival:w.departure+t.duration,captureLocalEpoch:t.duration,windowIndex:w.index,bundle:runner.bundle,runner,execution:runner,facts:runner.ledger,nextFact:0};
}
export function localAt(e:EpisodeSource,t:number):number {
 if(t===e.arrival)return e.captureLocalEpoch;
 const exact=e.bundle.program.thrustArcs!.flatMap(a=>[a.start,a.end]).find(local=>e.departure+local===t);
 return exact??Math.max(0,Math.min(e.captureLocalEpoch,t-e.departure));
}
