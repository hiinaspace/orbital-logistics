import {Runner} from '../sim/runner';
import {validateBundle,type State,type ThrustArc} from '../sim/schema';
import {paidCapture} from '../sim/capture';
import {AdaptiveWorld,validateAdaptive,type AdaptiveDefinition,type Ownership} from '../adaptive/world';
import {groundState,groundPort,surfaceHardware} from '../surface-flexible/contracts';
import {type SceneView,type ViewSample,type VesselView,type ViewerEvent} from './model';

interface FlightShape {duration:number;arcs:{start:number;duration:number;keys:number[]}[]}
export interface DirectSurfaceSet {
 schemaVersion:1;modelVersion:'direct-surface-v1';id:string;name:string;extent:number;description:string;provenance:string;
 service:AdaptiveDefinition;arrival:number;release:number;ascent:FlightShape;descent:FlightShape;
}
export const isDirectSurface=(v:unknown):v is DirectSurfaceSet=>!!v&&typeof v==='object'&&(v as DirectSurfaceSet).modelVersion==='direct-surface-v1';
const limits={position:1e-7,velocity:1e-7},copy=<T>(v:T):T=>structuredClone(v);
const check=(ok:unknown,message:string)=>{if(!ok)throw Error('Direct surface flight: '+message);};
const drain=(job:Generator<void,void>)=>{while(!job.next().done){}};
function solve(a:number[][],b:number[]){
 const m=a.map((r,i)=>[...r,b[i]]),n=b.length;
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;
  check(Math.abs(m[p][i])>1e-12,'singular flight correction');[m[i],m[p]]=[m[p],m[i]];
  const d=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}
 }
 return m.map(r=>r[n]);
}
export function directArcs(shape:FlightShape,start:number,rotation:number,id:string):ThrustArc[]{
 return shape.arcs.map((a,i)=>{const keys=a.keys.map((v,j)=>({offset:((start+a.start+a.duration)-(start+a.start))*j/(a.keys.length-1),direction:[Math.cos(v+rotation),Math.sin(v+rotation),0] as [number,number,number]}));return {id:id+':'+i,start:start+a.start,end:start+a.start+a.duration,throttle:1,direction:keys[0].direction,steering:{kind:'spherical-smoothstep-v1',keys}};});
}
function scenario(d:AdaptiveDefinition,start:number,end:number,state:State,fuel:number){
 const s=copy(d.world.scenario);s.epoch=start;s.duration=Math.ceil((end-start)/s.policy.step)*s.policy.step;s.policy.maxNodes=20000;s.policy.step=1/1024;s.duration=Math.ceil((end-start)/s.policy.step)*s.policy.step;
 s.ship.state=copy(state);s.ship.propellant=fuel;s.ship.engine=copy(surfaceHardware);delete s.logistics;return s;
}
export interface DirectShot {runner:Runner;shape:FlightShape;evaluations:number;capture:ReturnType<typeof paidCapture>}
function shoot(d:AdaptiveDefinition,shape:FlightShape,start:number,rotation:number,state:State,fuel:number,target:State,leg:'ascent'|'descent'):DirectShot{
 const end=start+shape.duration,seed=copy(shape);
 const original=[seed.arcs[0].keys[1],seed.arcs[1].keys[1],seed.arcs[0].duration,seed.arcs[1].duration];
 const s=scenario(d,start,end,state,fuel);let evaluations=0;
 const evaluate=(v:number[])=>{
  check(++evaluations<=100,'flight correction work budget exceeded');
  const a=copy(seed);a.arcs[0].keys[1]=v[0];a.arcs[1].keys[1]=v[1];a.arcs[0].duration=v[2];a.arcs[1].duration=v[3];a.arcs[1].start=a.duration-v[3];
  check(v[2]>.1&&v[3]>.1&&v[2]+v[3]<a.duration,'invalid powered duration');
  const trial=copy(s);
  // Numerical boundary-value trials may miss the pad. Only the final replay
  // with the real radius/support/collision rules is admissible.
  trial.bodies[0].radius=.5;
  const r=new Runner({scenario:trial,program:{schemaVersion:4,id:'direct-trial',burns:[],thrustArcs:directArcs(a,start,rotation,leg)}});
  const at=r.advanceTo(end);check(at.t===end&&['running','horizon'].includes(at.status),'unsafe correction trial');
  const residual=[0,1,3,4].map(i=>at.y[i]-target[i]);return {a,residual,norm:Math.hypot(...residual)};
 };
 let x=[...original],at=evaluate(x);
 for(let iteration=0;at.norm>2e-11&&iteration<10;iteration++){
  const columns=x.map((_,j)=>{const v=[...x],h=1e-5;v[j]+=h;const b=evaluate(v);return b.residual.map((z,i)=>(z-at.residual[i])/h);});
  const dx=solve(Array.from({length:4},(_,i)=>columns.map(c=>c[i])),at.residual.map(z=>-z));let accepted=false;
  for(const f of [1,.5,.25,.125]){
   const v=x.map((z,i)=>z+f*dx[i]);if(v.some((z,i)=>Math.abs(z-original[i])>(i<2?1:.2)))continue;
   let b;try{b=evaluate(v);}catch{continue;}
   if(b.norm<at.norm){x=v;at=b;accepted=true;break;}
  }
  check(accepted,'no safe steering improvement: '+leg+' residual '+at.norm);
 }
 check(at.norm<2e-11,'flight correction did not converge');
 check((1.05+fuel)*3<=surfaceHardware.maxThrust,'surface force ceiling exceeded');
 const arcs=directArcs(at.a,start,rotation,leg);
 // The finite exhibit owns pad support and station attachment; this Runner
 // propagates the entire free-flight leg with the real field and collision sphere.
 const bundle=validateBundle({scenario:s,program:{schemaVersion:4,id:leg,burns:[],thrustArcs:arcs}}),runner=new Runner(bundle),terminal=runner.advanceTo(end);
 check(terminal.t===end&&['running','horizon'].includes(terminal.status),leg+': '+terminal.status+' '+terminal.detail);
 const raw=terminal;
 const capture=paidCapture(raw.y,target,{...s.ship,propellant:raw.propellant},limits,d.origin.id);
 check(capture.positionError<2e-8&&capture.deltaV<2e-8,'endpoint correction exceeded numerical allowance');
 check(capture.propellantAfter>=.05,'return reserve exhausted');
 return {runner,shape:at.a,evaluations,capture};
}
export interface DirectSurfaceRun {definition:DirectSurfaceSet;world:AdaptiveWorld;outbound:DirectShot;inbound:DirectShot;delivery:number;view:SceneView}
export function prepareDirectSurface(value:DirectSurfaceSet):DirectSurfaceRun {
 check(isDirectSurface(value)&&value.schemaVersion===1,'unsupported version');
 const d=copy(value),service=validateAdaptive(d.service),a=d.arrival,b=d.release;
 check(service.world.scenario.ship.propellant===6&&service.world.scenario.ship.tankCapacity===6&&JSON.stringify(service.origin.state)===JSON.stringify(groundState(0)),'invalid ground ship hardware/pose');
 check(Number.isFinite(a)&&Number.isFinite(b)&&a%8>=4&&a%8<7.5&&b%8>=4&&b%8<8&&b>a+.5&&b-a<=80,'invalid service calendar');
 for(const shape of [d.ascent,d.descent]){
  check(shape.duration>1&&shape.duration<4&&shape.arcs.length===2,'unsupported flight family');
  check(shape.arcs[0].start===0&&shape.arcs[0].start+shape.arcs[0].duration<shape.arcs[1].start&&Math.abs(shape.arcs[1].start+shape.arcs[1].duration-shape.duration)<1e-12,'unsupported burn/coast ordering');
  check(shape.arcs.every(v=>v.keys.length===3&&v.keys.every(Number.isFinite)&&v.duration>0&&v.start>=0&&v.start+v.duration<=shape.duration+1e-12),'invalid steering');
  directArcs(shape,0,0,'validate').forEach(arc=>validateBundle({scenario:scenario(service,0,8,groundState(0),6),program:{schemaVersion:4,id:'steering-validation',burns:[],thrustArcs:[arc]}}));
 }
 const departure=a-d.ascent.duration,touchdown=b+d.descent.duration,end=Math.ceil(touchdown+2);
 check(departure>0&&end<=96&&d.extent>0,'mission range exceeded');
 const pre=new AdaptiveWorld(service,undefined,undefined,undefined,groundState);drain(pre.extend(Math.ceil((a+.5)/8)*8,0));
 check(pre.failed===0,'incoming station maintenance failed');
 const out=shoot(service,d.ascent,departure,.1*departure,groundState(departure),6,pre.sample(service.relay.id,a).y,'ascent');
 const delivery=Math.max(0,service.relay.ship.tankCapacity-pre.sample(service.relay.id,a+.5).propellant);
 const remaining=out.capture.propellantAfter-delivery;
 check(remaining>.05,'station supply unfunded');
 const events:Ownership[]=[{t:a,kind:'capture',visitorId:'Tern',fuel:out.capture.propellantAfter},{t:a+.5,kind:'transfer',visitorId:'Tern',amount:delivery},{t:b,kind:'release',visitorId:'Tern'}];
 const owner=new AdaptiveWorld(service,undefined,undefined,undefined,groundState);drain(owner.extend(Math.ceil((a+.5)/8)*8,0,events,pre.controls));drain(owner.extend(Math.ceil(end/8)*8,0,events));
 check(owner.failed===0,'loaded station maintenance failed');
 check(Math.hypot(...owner.sample(service.relay.id,a).y.map((v,i)=>v-pre.sample(service.relay.id,a).y[i]))<1e-12,'loaded arrival changed');
 const back=shoot(service,d.descent,b,.1*touchdown,owner.sample(service.relay.id,b).y,remaining,groundState(touchdown),'descent');
 pre.dispose();
 const usedOut=6-out.capture.propellantAfter,totalUsed=usedOut+remaining-back.capture.propellantAfter;
 const log=(used:number,port?:string)=>({operationCursor:0,cargoMass:.05,fuelUsed:used,ports:[],...(port?{dockedPortId:port}:{})});
 const shipSample=(t:number,before=false):ViewSample=>{
  if(t<departure||before&&t===departure)return {t,y:groundState(t),propellant:6,fuelUsed:0,burnCursor:0,status:'running',detail:'',logistics:log(0,service.origin.id),activity:{kind:'waiting'}};
  if(t<a||before&&t===a){const boundary=before?out.runner.eventBoundaries.find(e=>e.t===t)?.before:undefined,s=boundary??out.runner.sample(t);return {...s,logistics:log(s.fuelUsed??0),activity:{kind:'flying'}};}
  if(t<b||before&&t===b){const fuel=t<a+.5||before&&t===a+.5?out.capture.propellantAfter:remaining;return {t,y:owner.sample(service.relay.id,t).y,propellant:fuel,fuelUsed:usedOut,burnCursor:0,status:'running',detail:'',logistics:log(usedOut,service.relay.id),activity:{kind:t<a+.5?'service':'waiting'}};}
  if(t<touchdown||before&&t===touchdown){const boundary=before?back.runner.eventBoundaries.find(e=>e.t===t)?.before:undefined,s=boundary??back.runner.sample(t);return {...s,fuelUsed:usedOut+(s.fuelUsed??0),logistics:log(usedOut+(s.fuelUsed??0)),activity:{kind:'flying'}};}
  return {t,y:groundState(t),propellant:back.capture.propellantAfter,fuelUsed:totalUsed,burnCursor:0,status:'running',detail:'',logistics:log(totalUsed,service.origin.id),activity:{kind:'waiting'}};
 };
 const event=(t:number,kind:ViewerEvent['kind'],id:string,portId:string,before:number,after:number):ViewerEvent=>({t,kind,id,portId,deltaV:0,fuelUsed:0,propellantBefore:before,propellantAfter:after});
 const {y:_,...capture}=out.capture,{y:__,...landing}=back.capture;
 const ledger:ViewerEvent[]=[event(0,'dock','pad-support',service.origin.id,6,6),event(departure,'launch','lift-off',service.origin.id,6,6),...out.runner.ledger,{t:a,kind:'dock' as const,id:'Meridian-arrival',portId:service.relay.id,...capture},
 event(a,'transfer-start','supply-start',service.relay.id,out.capture.propellantAfter,out.capture.propellantAfter),
 {...event(a+.5,'transfer','supply',service.relay.id,out.capture.propellantAfter,remaining),cargoBefore:.05,cargoAfter:.05,portPropellantBefore:owner.sample(service.relay.id,a+.5).propellant-delivery,portPropellantAfter:owner.sample(service.relay.id,a+.5).propellant},
 event(b,'undock','Meridian-departure',service.relay.id,remaining,remaining),...back.runner.ledger,{t:touchdown,kind:'land' as const,id:'touchdown',portId:service.origin.id,...landing}].sort((x,y)=>x.t-y.t);
 const vesselKeys=(...shots:DirectShot[])=>shots.flatMap(s=>s.runner.bundle.program.thrustArcs!.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset)));
 const times=[...new Set([0,end,departure,a,b,touchdown,...Array.from({length:end*32+1},(_,i)=>i/32),...ledger.map(e=>e.t),...vesselKeys(out,back),
 ...[out,back].flatMap(({runner:r})=>{const start=r===out.runner?departure:b,duration=r===out.runner?d.ascent.duration:d.descent.duration;return Array.from({length:Math.ceil(duration*1024)+1},(_,i)=>start+duration*i/Math.ceil(duration*1024));})])].sort((x,y)=>x-y);
 const boundaries=[...new Set(ledger.map(e=>e.t))].filter(t=>t>0).map(t=>({t,before:shipSample(t,true),after:shipSample(t)}));
 const ports=[groundPort(service.origin.id),{...groundPort(service.origin.id),id:service.relay.id,propellant:service.relay.ship.propellant,tankCapacity:service.relay.ship.tankCapacity,rail:{kind:'ballistic' as const,epoch:0,validUntil:end,state:service.relay.ship.state,policy:service.world.scenario.policy,minClearance:.2,provenance:'Frozen coupled station stream'}}];
 const portSamples={Meridian:owner.chunks.flatMap(c=>c.data.station.filter(s=>s.t<=end).map(s=>({t:s.t,y:s.y})))};
 const v:VesselView={...service.vessels[0],glyph:'rocket',interpolation:'hermite',initialAxis:[1,0,0],ship:out.runner.bundle.scenario.ship,ports,cargoCapacity:.05,continuousFuel:true,portSamples,arcs:[...out.runner.bundle.program.thrustArcs!,...back.runner.bundle.program.thrustArcs!],samples:times.map(t=>shipSample(t)),ledger,boundaries};
 const maintained:NonNullable<SceneView['maintained']>={Meridian:{id:'Meridian',name:'Meridian',color:'#85c9c0',cargo:'Station',ship:service.relay.ship,ports:[],cargoCapacity:0,continuousFuel:true,portSamples:{},arcs:owner.chunks.flatMap(c=>c.data.arcs).filter(a=>a.end<=end),samples:owner.chunks.flatMap(c=>c.data.station).filter(s=>s.t<=end),ledger:owner.chunks.flatMap(c=>c.data.ledger).filter(e=>e.t<=end),boundaries:owner.chunks.flatMap(c=>c.data.boundaries).filter(e=>e.t<=end),baseline:owner.chunks.flatMap(c=>c.data.baseline).filter(s=>s.t<=end)}};
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:[{id:'Equator',role:'Surface pad',berths:1},{id:'Meridian',role:'Maintained relay',berths:1,inventoryOwner:'propulsion',maintenance:{reference:service.reference,checks:owner.chunks.map(c=>c.data.check)}}],rotating:service.rotating,vessels:[v],maintained,portSamples,world:{bodies:service.world.scenario.bodies,ports,units:service.world.scenario.units},window:{start:departure-.1,end}};
 check(owner.nodes+out.runner.retainedNodes+back.runner.retainedNodes<100000,'physical storage budget exceeded');
 check(new TextEncoder().encode(JSON.stringify(view)).byteLength<12_000_000,'display storage budget exceeded');
 return {definition:d,world:owner,outbound:out,inbound:back,delivery,view};
}
