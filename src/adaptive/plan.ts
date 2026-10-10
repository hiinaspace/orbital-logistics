import {surfaceDuration,surfaceDeltaV,surfaceFuel,surfaceInterface,surfaceSample,surfaceEvents,surfaceHash,admitSurfaceFlight,groundState,descentReserve,type SurfaceFlight} from '../surface-flexible/contracts';
import {Runner,type EventBoundary} from '../sim/runner';
import type {OriginIntervals} from '../network/origin';
const proofToken=Symbol('coupled-proof');
import {paidCapture,CaptureFailure} from '../sim/capture';
import {validateBundle,type Bundle,type Scenario,type State} from '../sim/schema';
import {PlanningFailure,shootForcesJob,type PropagationBudget} from '../maintained/shoot';
import {transferSeed} from '../maintained/seed';
import type {ViewSample,ViewerEvent} from '../model-set/model';
import {AdaptiveWorld,quiet,type AdaptiveDefinition,type Anchor,type Control,type Ownership} from './world';
const copy=<T>(v:T):T=>structuredClone(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const key=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const limits={position:1e-7,velocity:1e-7};
export interface Schedule {departure:number;relayArrival:number;release:number;homeArrival:number}
export interface CoupledPlan {
 schemaVersion:1;modelVersion:'coupled-service-v1'|'surface-coupled-v1';surface?:{version:'orison-airless-contracts-v1';hash:string;launch:number;touchdown:number};id:string;knownAt:number;end:number;
 base:Anchor;controls:Control[];schedule:Schedule;visitorId:string;fuel:number;delivery:number;
 outbound:Bundle;inbound:Bundle;evaluations:number;
}
export function legScenario(d:AdaptiveDefinition,epoch:number,duration:number,state:State,fuel:number):Scenario{
 const s=copy(d.world.scenario);s.epoch=epoch;s.duration=duration;delete s.logistics;delete s.rendezvous;s.ship.state=copy(state);s.ship.propellant=fuel;return s;
}
export function economicalSeed(from:State,to:State,duration:number,mass:number){
 const r0=Math.hypot(from[0],from[1]),r1=Math.hypot(to[0],to[1]),cos=(from[0]*to[0]+from[1]*to[1])/(r0*r1);
 if(cos>-.9999)return transferSeed(from,to,duration,mass);
 if(from[2]!==0||to[2]!==0||from[0]*from[4]-from[1]*from[3]<=0)throw new PlanningFailure('Unsupported antipodal seed plane/direction');
 const a=(r0+r1)/2,v0=Math.sqrt(2/r0-1/a),v1=Math.sqrt(2/r1-1/a);
 return [(-from[1]/r0*v0-from[3])*mass/1.6,(from[0]/r0*v0-from[4])*mass/1.6,0,(to[3]+to[1]/r1*v1)*mass/1.8,(to[4]-to[0]/r1*v1)*mass/1.8,0];
}
function paid(d:AdaptiveDefinition,runner:Runner,target:State,t:number,label:string){const s=runner.advanceTo(t);if(s.status!=='horizon'||s.t!==t)throw new PlanningFailure('Flight did not complete');let c;try{c=paidCapture(s.y,target,{...d.world.scenario.ship,propellant:s.propellant},limits,label);}catch(error){if(!(error instanceof CaptureFailure))throw error;throw new PlanningFailure(error.message);}if(c.positionError+1e-8>=limits.position||c.deltaV+1e-8>=limits.velocity)throw new PlanningFailure('Paid capture numerical allowance failed');return c;}
export const tripStart=(p:CoupledPlan)=>p.surface?.launch??p.schedule.departure;
export const tripTouchdown=(p:CoupledPlan)=>p.surface?.touchdown??p.schedule.homeArrival;
export const orbitalOrigin=(d:AdaptiveDefinition,w:AdaptiveWorld,t:number,leg:'ascent'|'descent')=>d.surface?surfaceInterface(t,leg):w.sample(d.origin.id,t).y;
export function ascentCorrection(d:AdaptiveDefinition,fuel:number){const a=surfaceSample({leg:'ascent',start:0,rotation:0,fuel,used:0,id:'ascent-proof'},surfaceDuration);return paidCapture(a.y,surfaceInterface(surfaceDuration,'ascent'),{...d.world.scenario.ship,propellant:a.propellant},limits,'ascent exit');}
export const orbitalFuel=(d:AdaptiveDefinition,fuel:number)=>d.surface?ascentCorrection(d,fuel).propellantAfter:fuel;
function validateSchedule(s:Schedule,end:number,surface?:CoupledPlan['surface'],knownAt=0){
 if(surface&&(surface.version!=='orison-airless-contracts-v1'||surface.hash!==surfaceHash||surface.launch!==s.departure-surfaceDuration||surface.touchdown!==s.homeArrival+surfaceDuration||surface.launch<knownAt||end!==surface.touchdown+2))throw Error('Invalid composed ground schedule');
 if(!Object.values(s).every(quiet)||s.relayArrival-s.departure<12||s.relayArrival-s.departure>16||s.release-s.relayArrival<8||s.release-s.relayArrival>40||s.homeArrival-s.release<12||s.homeArrival-s.release>16||end!==(surface?surface.touchdown:s.homeArrival)+2||end-s.departure>64+(surface?surfaceDuration:0))throw Error('Unsupported coupled schedule');
 // Transfer completes half a unit after arrival, in a quiet ownership window.
 if(!quiet(s.relayArrival+.5))throw Error('Transfer completion outside quiet interval');
}
function leg(d:AdaptiveDefinition,b:Bundle,t:number,duration:number,state:State,fuel:number){
 const value=validateBundle(b),template=legScenario(d,t,duration,state,fuel);template.policy.maxNodes=Math.ceil(duration/template.policy.step)+1024;const expected=validateBundle({scenario:template,program:value.program});
 if(key(value.scenario)!==key(expected.scenario)||value.program.burns.length||value.program.operations!==undefined||value.program.thrustArcs?.length!==2)throw Error('Coupled flight hardware/anchor mismatch');
 return new Runner(value);
}
export class CoupledTrip {
 readonly world:AdaptiveWorld;readonly outbound:Runner;readonly inbound:Runner;
 readonly capture:ReturnType<typeof paidCapture>;readonly home:ReturnType<typeof paidCapture>;
 readonly events:ViewerEvent[];readonly burned:number;readonly deltaV:number;readonly stationBurned:number;
 readonly beforeTransferFuel:number;readonly afterTransferFuel:number;readonly localFlights:SurfaceFlight[]=[];readonly localBurned:number=0;readonly orbitalBurned:number;readonly ascentMatch?:ReturnType<typeof paidCapture>;readonly handoff:ReturnType<typeof paidCapture>;#release?:()=>void;
 dispose(){this.#release?.();this.#release=undefined;this.world.dispose();}
 constructor(readonly definition:AdaptiveDefinition,readonly plan:CoupledPlan,originIntervals?:OriginIntervals,proof?:{token:symbol;pre:AdaptiveWorld;world:AdaptiveWorld}){
  this.plan=freeze(copy(plan));this.definition=freeze(copy(definition));
  const p=this.plan,d=this.definition,s=p.schedule;validateSchedule(s,p.end,p.surface,p.knownAt);
  if(p.schemaVersion!==1||p.modelVersion!==(d.surface?'surface-coupled-v1':'coupled-service-v1')||Boolean(p.surface)!==Boolean(d.surface)||p.visitorId!==d.world.scenario.ship.id||p.base.visitorFuel!==undefined||p.base.t!==p.knownAt||!Number.isFinite(p.fuel)||p.fuel<.05||p.fuel>d.world.scenario.ship.tankCapacity)throw Error('Invalid coupled plan identity/anchor');
  if(p.controls.length!==(Math.ceil(p.end/8)*8-p.base.t)/8||p.controls.some((c,i)=>c.t!==p.base.t+i*8||c.check.t!==c.t||c.arcs.length>2||c.arcs.some(a=>a.start<c.t||a.end>c.t+4)))throw Error('Invalid frozen controller chain');
  if(proof&&proof.token!==proofToken)throw Error('Invalid prepared proof');
  const pre=proof?.pre??new AdaptiveWorld(d,p.base,undefined,originIntervals);if(!proof){const preJob=pre.extend(Math.ceil((s.relayArrival+.5)/8)*8,p.knownAt,[],p.controls);while(!preJob.next().done){}}
  this.outbound=leg(d,p.outbound,s.departure,s.relayArrival-s.departure,orbitalOrigin(d,pre,s.departure,'ascent'),orbitalFuel(d,p.fuel));
  this.capture=freeze(paid(d,this.outbound,pre.sample(d.relay.id,s.relayArrival).y,s.relayArrival,d.relay.id));
  const stationFuel=pre.sample(d.relay.id,s.relayArrival+.5).propellant,amount=Math.max(0,d.relay.ship.tankCapacity-stationFuel);
  if(!Number.isFinite(p.delivery)||Math.abs(p.delivery-amount)>1e-12||p.delivery<0||p.delivery>this.capture.propellantAfter)throw Error('Coupled delivery does not match funded top-up');
  this.beforeTransferFuel=this.capture.propellantAfter;this.afterTransferFuel=this.capture.propellantAfter-p.delivery;
  pre.chunks=[];pre.dispose(); // Captures/top-up are scalar facts; drop the unloaded replay.
  this.world=proof?.world??new AdaptiveWorld(d,p.base,undefined,originIntervals);if(!proof){const job=this.world.extend(Math.ceil(p.end/8)*8,p.knownAt,this.ownership(),p.controls);while(!job.next().done){}}
  this.inbound=leg(d,p.inbound,s.release,s.homeArrival-s.release,this.world.sample(d.relay.id,s.release).y,this.afterTransferFuel);
  this.handoff=freeze(paid(d,this.inbound,orbitalOrigin(d,this.world,s.homeArrival,'descent'),s.homeArrival,d.origin.id));
  const outUsed=(this.outbound.sample(s.relayArrival).fuelUsed??0)+this.capture.fuelUsed,inUsed=(this.inbound.sample(s.homeArrival).fuelUsed??0)+this.handoff.fuelUsed;
  if(p.surface){
   this.ascentMatch=freeze(ascentCorrection(d,p.fuel));
   const ascent:SurfaceFlight={leg:'ascent',start:p.surface.launch,rotation:.1*p.surface.launch,fuel:p.fuel,used:0,id:p.id,hash:surfaceHash};
   const descent:SurfaceFlight={leg:'descent',start:s.homeArrival,rotation:.1*p.surface.touchdown,fuel:this.handoff.propellantAfter,used:p.fuel-orbitalFuel(d,p.fuel)+outUsed+inUsed,id:p.id,hash:surfaceHash};
   if(descent.fuel<descentReserve())throw new PlanningFailure('Descent and touchdown reserve unfunded');
   admitSurfaceFlight(ascent);admitSurfaceFlight(descent);
   const endpoint=surfaceSample(descent,p.surface.touchdown);
   this.home=freeze(paidCapture(endpoint.y,groundState(p.surface.touchdown),{...d.world.scenario.ship,propellant:endpoint.propellant},limits,d.origin.id));
   if(this.home.positionError+1e-8>=limits.position||this.home.deltaV+1e-8>=limits.velocity)throw new PlanningFailure('Touchdown numerical allowance failed');
   this.localFlights=freeze([ascent,descent]);this.localBurned=p.fuel-surfaceFuel(p.fuel)+descent.fuel-endpoint.propellant;
  }else this.home=this.handoff;
  if(this.home.propellantAfter<.05)throw new PlanningFailure('Funded return reserve failed');
  this.burned=(this.outbound.sample(s.relayArrival).fuelUsed??0)+(this.inbound.sample(s.homeArrival).fuelUsed??0)+this.capture.fuelUsed+this.handoff.fuelUsed+this.localBurned+(this.ascentMatch?.fuelUsed??0)+(p.surface?this.home.fuelUsed:0);this.orbitalBurned=this.burned-this.localBurned;
  this.deltaV=[...this.outbound.ledger,...this.inbound.ledger].filter(e=>e.kind==='thrust-end').reduce((n,e)=>n+e.deltaV,0)+this.capture.deltaV+this.handoff.deltaV+(this.ascentMatch?.deltaV??0)+(p.surface?2*surfaceDeltaV+this.home.deltaV:0);
  this.stationBurned=this.world.anchor.used-p.base.used;
  this.events=freeze([{t:tripStart(p),kind:p.surface?'launch':'undock',id:`${p.id}:depart`,portId:d.origin.id,deltaV:0,fuelUsed:0,propellantBefore:p.fuel,propellantAfter:p.fuel},...this.localFlights.filter(f=>f.leg==='ascent').flatMap(surfaceEvents),...(p.surface?[{t:s.departure,kind:'handoff',id:p.id+':ascent-exit',...this.ascentMatch}]:[]),...this.outbound.ledger,
   {t:s.relayArrival,kind:'dock',id:`${p.id}:relay`,portId:d.relay.id,...this.capture},
   {t:s.relayArrival,kind:'transfer-start',id:`${p.id}:fuel-start`,portId:d.relay.id,deltaV:0,fuelUsed:0,propellantBefore:this.beforeTransferFuel,propellantAfter:this.beforeTransferFuel},
   {t:s.relayArrival+.5,kind:'transfer',id:`${p.id}:fuel`,portId:d.relay.id,deltaV:0,fuelUsed:0,propellantBefore:this.beforeTransferFuel,propellantAfter:this.afterTransferFuel,portPropellantBefore:stationFuel,portPropellantAfter:stationFuel+p.delivery,cargoBefore:.05,cargoAfter:.05},
   {t:s.release,kind:'undock',id:`${p.id}:release`,portId:d.relay.id,deltaV:0,fuelUsed:0,propellantBefore:this.afterTransferFuel,propellantAfter:this.afterTransferFuel},...this.inbound.ledger,
   ...(p.surface?[{t:s.homeArrival,kind:'handoff',id:p.id+':descent-entry',...this.handoff},...this.localFlights.filter(f=>f.leg==='descent').flatMap(surfaceEvents)]:[]),
   {t:tripTouchdown(p),kind:p.surface?'land':'dock',id:`${p.id}:home`,portId:d.origin.id,...this.home}].map(e=>{const {y,...event}=e as ViewerEvent&{y?:State};return event;}).sort((a,b)=>a.t-b.t));
  this.#release=originIntervals?.watch(this);
  try{originIntervals?.reserve();}catch(error){this.dispose();throw error;}
 }
 ownership():Ownership[]{const s=this.plan.schedule,id=this.plan.visitorId;return [{t:s.relayArrival,kind:'capture',visitorId:id,fuel:this.capture.propellantAfter},{t:s.relayArrival+.5,kind:'transfer',visitorId:id,amount:this.plan.delivery},{t:s.release,kind:'release',visitorId:id}];}
 sample(t:number,before=false):ViewSample{
  const p=this.plan,s=p.schedule,d=this.definition;if(t<tripStart(p)||t>p.end)throw Error('Outside coupled episode');
  if(p.surface&&before&&t===tripStart(p))return {t,y:groundState(t),propellant:p.fuel,fuelUsed:0,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:.05,fuelUsed:0,ports:[],dockedPortId:d.origin.id},activity:{kind:'waiting'}};
  const log=(used:number,port?:string)=>({operationCursor:0,cargoMass:.05,fuelUsed:used,ports:[],...(port?{dockedPortId:port}:{})});
  const free=(r:Runner,usedBefore:number)=>{const boundary=before?r.eventBoundaries.find(b=>b.t===t)?.before:undefined,a=boundary??r.sample(t),used=usedBefore+(a.fuelUsed??0);return {...a,fuelUsed:used,logistics:log(used),activity:{kind:'flying' as const}};};
  const local=this.localFlights.find(f=>(before?t>f.start&&t<=f.start+surfaceDuration:t>=f.start&&t<f.start+surfaceDuration));if(local)return surfaceSample(local,t,before);
  const ascentUsed=d.surface?p.fuel-orbitalFuel(d,p.fuel):0;
  if(t<s.relayArrival||before&&t===s.relayArrival)return free(this.outbound,ascentUsed);
  if(t<s.release||before&&t===s.release){const transferred=t>s.relayArrival+.5||t===s.relayArrival+.5&&!before,used=ascentUsed+(this.outbound.sample(s.relayArrival).fuelUsed??0)+this.capture.fuelUsed,fuel=transferred?this.afterTransferFuel:this.beforeTransferFuel;return {t,y:this.world.sample(d.relay.id,t).y,propellant:fuel,fuelUsed:used,burnCursor:0,status:'running',detail:'',logistics:{...log(used,d.relay.id),...(!transferred?{service:{id:`${p.id}:fuel`,portId:d.relay.id,end:s.relayArrival+.5,cargo:0,propellant:-p.delivery}}:{})},activity:{kind:transferred?'waiting':'service'}};}
  if(t<s.homeArrival||before&&t===s.homeArrival)return free(this.inbound,ascentUsed+(this.outbound.sample(s.relayArrival).fuelUsed??0)+this.capture.fuelUsed);
  return {t,y:this.world.sample(d.origin.id,t).y,propellant:this.home.propellantAfter,fuelUsed:this.burned,burnCursor:0,status:'running',detail:'',logistics:{...log(this.burned,d.origin.id),service:{id:`${p.id}:origin-refuel`,portId:d.origin.id,end:p.end,cargo:0,propellant:d.world.scenario.ship.propellant-this.home.propellantAfter}},activity:{kind:'service'}};
 }
 get boundaries():EventBoundary[]{const times=[...new Set(this.events.map(e=>e.t))].filter(t=>t>tripStart(this.plan));return times.map(t=>({t,before:this.sample(t,true),after:this.sample(t)}));}
 static *createJob(d:AdaptiveDefinition,p:CoupledPlan,originIntervals?:OriginIntervals):Generator<void,CoupledTrip>{
  const s=p.schedule;validateSchedule(s,p.end,p.surface,p.knownAt);
  const pre=new AdaptiveWorld(d,p.base,undefined,originIntervals);let world:AdaptiveWorld|undefined,releaseOutbound:(()=>void)|undefined,complete=false;
  try{yield* pre.extend(Math.ceil((s.relayArrival+.5)/8)*8,p.knownAt,[],p.controls);
   // Capture is independently re-executed before deriving loaded ownership.
   yield;originIntervals?.reserve(2*(Math.ceil((s.relayArrival-s.departure)*256)+1024));
   const outbound=leg(d,p.outbound,s.departure,s.relayArrival-s.departure,orbitalOrigin(d,pre,s.departure,'ascent'),orbitalFuel(d,p.fuel)),capture=paid(d,outbound,pre.sample(d.relay.id,s.relayArrival).y,s.relayArrival,d.relay.id);releaseOutbound=originIntervals?.hold(outbound);
   const events:Ownership[]=[{t:s.relayArrival,kind:'capture',visitorId:p.visitorId,fuel:capture.propellantAfter},{t:s.relayArrival+.5,kind:'transfer',visitorId:p.visitorId,amount:p.delivery},{t:s.release,kind:'release',visitorId:p.visitorId}];
   world=new AdaptiveWorld(d,p.base,undefined,originIntervals);yield* world.extend(Math.ceil(p.end/8)*8,p.knownAt,events,p.controls);yield;
   originIntervals?.reserve(2*(16*256+1024));const trip=new CoupledTrip(d,p,originIntervals,{token:proofToken,pre,world});complete=true;return trip;
  }finally{pre.dispose();releaseOutbound?.();if(!complete)world?.dispose();}
 }
 get runners(){return [...this.world.runners,this.outbound,this.inbound];}
 get nodes(){return [...new Set(this.runners)].reduce((n,r)=>n+r.retainedNodes,0);}
}
export function* buildPlanJob(d:AdaptiveDefinition,base:Anchor,prefix:Control[],schedule:Schedule,fuel:number,id:string,work?:{controller:PropagationBudget;visitor:PropagationBudget},guide?:AdaptiveWorld,residentNodes=0,originIntervals?:OriginIntervals):Generator<void,CoupledTrip>{
 const cleanups:(()=>void)[]=[];let created:CoupledTrip|undefined,complete=false;try{
 const s=schedule,surface:CoupledPlan['surface']=d.surface?{version:d.surface.version,hash:d.surface.hash,launch:s.departure-surfaceDuration,touchdown:s.homeArrival+surfaceDuration}:undefined,end=(surface?.touchdown??s.homeArrival)+2;validateSchedule(s,end,surface,base.t);
 const incomingEnd=Math.ceil((s.relayArrival+.5)/8)*8;
 // The ranking guide already owns exactly this unloaded canonical prefix.
 // Reuse its immutable runners; no interpolation or new propagation origin.
 const pre=guide?guide.fork():new AdaptiveWorld(d,base,work?.controller,originIntervals);cleanups.push(()=>pre.dispose());
 if(guide){pre.chunks=pre.chunks.filter(c=>c.data.start<incomingEnd);const last=pre.chunks.at(-1);if(!last||pre.chunks.length!==(incomingEnd-base.t)/8||pre.chunks.some((c,i)=>c.data.start!==base.t+i*8)||last.data.end!==incomingEnd||key(pre.chunks[0].anchor)!==key(base)||key(guide.definition)!==key(d))throw Error('Invalid incoming guide prefix');pre.anchor=copy(last.endAnchor);}
 else yield* pre.extend(incomingEnd,base.t,[],undefined);
 // Immutable controls already committed at the head must match this candidate.
 for(const control of prefix)if(key(pre.controls.find(c=>c.t===control.t))!==key(control))throw Error('Candidate changed committed owner prefix');
 const outScenario=legScenario(d,s.departure,s.relayArrival-s.departure,orbitalOrigin(d,pre,s.departure,'ascent'),orbitalFuel(d,fuel)),outTarget=pre.sample(d.relay.id,s.relayArrival).y;
 const out=yield* shootForcesJob(outScenario,[{start:s.departure,end:s.departure+1.6},{start:s.relayArrival-1.8,end:s.relayArrival}],outTarget,economicalSeed(outScenario.ship.state,outTarget,outScenario.duration,1.05+orbitalFuel(d,fuel)),96,'sphere',work?.visitor,'sensitivity');
 const capture=paid(d,out.runner,outTarget,s.relayArrival,d.relay.id),delivery=Math.max(0,d.relay.ship.tankCapacity-pre.sample(d.relay.id,s.relayArrival+.5).propellant),remaining=capture.propellantAfter-delivery;
 if(remaining<.05)throw new PlanningFailure('Donor cannot fund station top-up');
 const releaseOut=originIntervals?.hold(out.runner);if(releaseOut)cleanups.push(releaseOut);
 const owner=new AdaptiveWorld(d,base,work?.controller,originIntervals),events:Ownership[]=[{t:s.relayArrival,kind:'capture',visitorId:d.world.scenario.ship.id,fuel:capture.propellantAfter},{t:s.relayArrival+.5,kind:'transfer',visitorId:d.world.scenario.ship.id,amount:delivery},{t:s.release,kind:'release',visitorId:d.world.scenario.ship.id}];
 cleanups.push(()=>owner.dispose());
 // Capture/transfer occur after the control pulses. Controls through that
 // block are unchanged; the subsequent controls must solve with loaded mass.
 yield* owner.extend(incomingEnd,base.t,events,pre.controls);
 yield* owner.extend(Math.ceil(end/8)*8,base.t,events);
 if(owner.chunks.some(c=>c.data.check.outcome==='failed'))throw new PlanningFailure('Candidate station maintenance failed');
 if(Math.hypot(...owner.sample(d.relay.id,s.relayArrival).y.map((x,i)=>x-outTarget[i]))>1e-12)throw Error('Docking changed its proven incoming target');
 pre.chunks=[];pre.dispose(); // Incoming proof/amount are now immutable scalar facts.
 const returnScenario=legScenario(d,s.release,s.homeArrival-s.release,owner.sample(d.relay.id,s.release).y,remaining),homeTarget=orbitalOrigin(d,owner,s.homeArrival,'descent');
 const back=yield* shootForcesJob(returnScenario,[{start:s.release,end:s.release+1.6},{start:s.homeArrival-1.8,end:s.homeArrival}],homeTarget,economicalSeed(returnScenario.ship.state,homeTarget,returnScenario.duration,1.05+remaining),96,'sphere',work?.visitor,'sensitivity');
 const releaseBack=originIntervals?.hold(back.runner);if(releaseBack)cleanups.push(releaseBack);
 const outBundle=out.runner.bundle,backBundle=back.runner.bundle;outBundle.program.id=`${id}:out`;backBundle.program.id=`${id}:back`;outBundle.program.thrustArcs!.forEach((a,i)=>a.id=`${id}:out:${i}`);backBundle.program.thrustArcs!.forEach((a,i)=>a.id=`${id}:back:${i}`);
 const plan:CoupledPlan={schemaVersion:1,modelVersion:d.surface?'surface-coupled-v1':'coupled-service-v1',...(surface?{surface}:{}),id,knownAt:base.t,end,base:copy(base),controls:owner.controls,schedule:copy(s),visitorId:d.world.scenario.ship.id,fuel,delivery,outbound:outBundle,inbound:backBundle,evaluations:out.evaluations+back.evaluations};yield;
 const trip=created=originIntervals?yield* CoupledTrip.createJob(d,plan,originIntervals):new CoupledTrip(d,plan);
 // The network registry accounts for all owners and deduplicates shared
 // canonical hub intervals. The legacy per-candidate sum counts those
 // intervals repeatedly and cannot be used alongside that global authority.
 if(originIntervals)originIntervals.reserve();
 else if(residentNodes+owner.nodes+trip.nodes+out.runner.retainedNodes+back.runner.retainedNodes>220000)throw Error('Candidate physical storage budget exceeded');
 // A deterministic replay of every identical grid input is a regression
 // oracle, not admission work. Keep the event/block anchor checks here.
 for(const chunk of owner.chunks)for(const t of [chunk.data.start,chunk.data.end,...chunk.data.boundaries.map(b=>b.t)])for(const id of [d.origin.id,d.relay.id])if(key(owner.sample(id,t))!==key(trip.world.sample(id,t)))throw Error('Reconstructed coupled owner mismatch');
 for(let i=0;i<owner.chunks.length;i++)if(key(owner.chunks[i].data.boundaries)!==key(trip.world.chunks[i].data.boundaries))throw Error('Reconstructed event-left/right ownership mismatch');
 for(const leg of [trip.outbound,trip.inbound])for(const seg of leg.coastSegments(leg.bundle.scenario.epoch+leg.bundle.scenario.duration)){for(const state of [seg.y0,seg.y1]){const r=Math.hypot(...state.slice(0,3));if(r<1.7||r>3.4)throw new PlanningFailure('Outside routine service orbital corridor');}}
 complete=true;return trip;
 }finally{if(!complete)created?.dispose();cleanups.forEach(release=>release());}
}
export function buildPlan(...args:Parameters<typeof buildPlanJob>){const job=buildPlanJob(...args);let r=job.next();while(!r.done)r=job.next();return r.value;}
