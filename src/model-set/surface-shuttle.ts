import {Runner,type EventBoundary} from '../sim/runner';
import {paidCapture} from '../sim/capture';
import {validateBundle,type Bundle,type Port,type State,type ThrustArc,type Vec3} from '../sim/schema';
import {portState} from '../sim/logistics';
import {type SceneView,type ViewSample,type VesselView,type ViewerEvent} from './model';

interface Shape {duration:number;keys:number[]}
export interface SurfaceShuttle {
 schemaVersion:1;modelVersion:'surface-shuttle-v1';id:string;name:string;extent:number;description:string;provenance:string;
 world:Bundle;pad:Port;depot:Port;launch:number;release:number;ascent:Shape;descent:Shape;
}
export const isSurfaceShuttle=(v:unknown):v is SurfaceShuttle=>!!v&&typeof v==='object'&&(v as SurfaceShuttle).modelVersion==='surface-shuttle-v1';
const copy=<T>(x:T):T=>structuredClone(x),limits={position:1e-7,velocity:1e-7};
function check(v:unknown,s:string):asserts v {if(!v)throw Error('Surface shuttle: '+s);}
function linear(a:number[][],b:number[]){
 const m=a.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<4;i++){
  let j=i;for(let k=i+1;k<4;k++)if(Math.abs(m[k][i])>Math.abs(m[j][i]))j=k;
  check(Math.abs(m[j][i])>1e-12,'singular steering correction');[m[i],m[j]]=[m[j],m[i]];
  const f=m[i][i];for(let k=i;k<=4;k++)m[i][k]/=f;
  for(let j=0;j<4;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=4;k++)m[j][k]-=f*m[i][k];}
 }
 return m.map(r=>r[4]);
}
export function shuttleArc(shape:Shape,start:number,rotation:number,id:string):ThrustArc {
 const end=start+shape.duration,keys=shape.keys.map((a,i)=>({offset:(end-start)*i/(shape.keys.length-1),direction:[Math.cos(a+rotation),Math.sin(a+rotation),0] as Vec3}));
 return {id,start,end,throttle:1,direction:keys[0].direction,steering:{kind:'spherical-smoothstep-v1',keys}};
}
export interface ShuttleShot {runner:Runner;capture:ReturnType<typeof paidCapture>;evaluations:number;end:number}
function shoot(d:SurfaceShuttle,shape:Shape,start:number,rotation:number,state:State,fuel:number,id:string,target:State):ShuttleShot {
 const s=copy(d.world.scenario),end=start+shape.duration;
 s.epoch=start;s.duration=Math.ceil(shape.duration/s.policy.step)*s.policy.step;s.ship.state=copy(state);s.ship.propellant=fuel;
 check(shape.keys.length===5&&shape.keys.every(Number.isFinite),'five steering keys required');
 const mutable=id==='ascent'?[1,2,3,4]:[0,1,2,3],seed=mutable.map(i=>shape.keys[i]);let evaluations=0;
 const evaluate=(x:number[])=>{
  check(++evaluations<=80,'steering work limit');
  const keys=[...shape.keys];mutable.forEach((k,i)=>keys[k]=x[i]);
  const trial=copy(s);trial.bodies[0].radius=.5;
  const runner=new Runner({scenario:trial,program:{schemaVersion:4,id:'steering-trial',burns:[],thrustArcs:[shuttleArc({...shape,keys},start,rotation,id)]}}),at=runner.advanceTo(end);
  check(at.t===end&&['running','horizon'].includes(at.status),'unsafe steering trial');
  const residual=[0,1,3,4].map(i=>at.y[i]-target[i]);return {keys,residual,norm:Math.hypot(...residual)};
 };
 let x=[...seed],at=evaluate(x);
 for(let n=0;n<8&&at.norm>2e-11;n++){
  const cols=x.map((_,j)=>{const v=[...x];v[j]+=1e-5;return evaluate(v).residual.map((a,i)=>(a-at.residual[i])/1e-5);});
  const dx=linear(Array.from({length:4},(_,i)=>cols.map(c=>c[i])),at.residual.map(a=>-a));let accepted=false;
  for(const f of [1,.5,.25,.125]){
   const next=x.map((a,i)=>a+f*dx[i]);if(next.some((a,i)=>Math.abs(a-seed[i])>.2))continue;
   let candidate;try{candidate=evaluate(next);}catch{continue;}
   if(candidate.norm<at.norm){x=next;at=candidate;accepted=true;break;}
  }
  check(accepted,'no steering improvement');
 }
 check(at.norm<2e-11,'steering did not converge');
 const runner=new Runner({scenario:s,program:{schemaVersion:4,id,burns:[],thrustArcs:[shuttleArc({...shape,keys:at.keys},start,rotation,id)]}}),last=runner.advanceTo(end);
 check(last.t===end&&['running','horizon'].includes(last.status),id+' '+last.status+' '+last.detail);
 const capture=paidCapture(last.y,target,{...s.ship,propellant:last.propellant},limits,id);
 check(capture.positionError<2e-8&&capture.deltaV<2e-8&&capture.propellantAfter>=.05,'endpoint match/reserve');
 return {runner,capture,evaluations,end};
}
export interface SurfaceShuttleRun {definition:SurfaceShuttle;outbound:ShuttleShot;inbound:ShuttleShot;view:SceneView}
export function prepareSurfaceShuttle(value:SurfaceShuttle):SurfaceShuttleRun {
 check(isSurfaceShuttle(value)&&value.schemaVersion===1,'unsupported version');
 const d=copy(value);d.world=validateBundle(d.world);const s=d.world.scenario;
 check(s.epoch===0&&s.duration<=32&&!s.logistics&&!s.rendezvous&&d.world.program.burns.length===0&&!d.world.program.thrustArcs?.length,'unsupported world');
 check(s.bodies[0].mu===1&&s.bodies[0].radius===1&&s.bodies[0].rail.kind==='fixed'&&JSON.stringify(s.bodies[0].rail.position)==='[0,0,0]','unsupported primary');
 check([d.launch,d.release,d.extent,d.ascent.duration,d.descent.duration].every(Number.isFinite),'invalid numeric metadata');
 check(!s.bodies.some(b=>[d.pad.id,d.depot.id,s.ship.id].includes(b.id)),'conflicting IDs');
 check(d.pad.rail.kind==='surface'&&d.pad.rail.bodyRail===undefined&&d.depot.rail.kind==='circular'&&s.bodies[0].rail.kind==='fixed'&&d.pad.rail.bodyId===s.bodies[0].id&&d.pad.rail.radius===s.bodies[0].radius+d.pad.rail.centerHeight&&d.pad.rail.centerHeight===1e-6,'invalid supported pad');
 check(d.pad.id!==d.depot.id&&JSON.stringify(d.pad.rail.center)===JSON.stringify(s.bodies[0].rail.position)&&JSON.stringify(d.pad.rail.u)==='[1,0,0]'&&JSON.stringify(d.pad.rail.v)==='[0,1,0]'&&Math.abs(d.pad.rail.rate)<1&&d.pad.rail.phase===0,'unsupported pad basis/spin');
 check(Number.isFinite(d.depot.rail.phase)&&d.depot.rail.radius>1&&d.depot.rail.radius<2&&Math.abs(d.depot.rail.rate-Math.sqrt(s.bodies[0].mu/d.depot.rail.radius**3))<1e-15&&JSON.stringify(d.depot.rail.center)==='[0,0,0]'&&JSON.stringify(d.depot.rail.u)==='[1,0,0]'&&JSON.stringify(d.depot.rail.v)==='[0,1,0]','invalid depot');
 check(s.ship.id!==d.pad.id&&s.ship.id!==d.depot.id&&s.policy.step===1/1024&&s.ship.dryMass===1&&s.ship.cargoMass===.05&&s.ship.propellant===6&&s.ship.tankCapacity===6&&s.ship.exhaustVelocity===3&&s.ship.engine?.maxThrust===32&&s.ship.engine.maxAcceleration===1.2,'unsupported hardware');
 check(d.ascent.duration>1&&d.ascent.duration<3&&d.descent.duration>1&&d.descent.duration<3&&d.launch>0,'invalid flight duration');
 const arrival=d.launch+d.ascent.duration,touchdown=d.release+d.descent.duration,end=touchdown+.5;
 check(d.release>=arrival+.5&&end<=s.duration&&d.extent>0,'invalid mission calendar');
 const pad=(t:number)=>portState(d.pad,t),depot=(t:number)=>portState(d.depot,t);
 check(JSON.stringify(s.ship.state)===JSON.stringify(pad(0)),'invalid initial support');
 const out=shoot(d,d.ascent,d.launch,d.pad.rail.rate*d.launch,pad(d.launch),s.ship.propellant,'ascent',depot(arrival));
 const back=shoot(d,d.descent,d.release,d.pad.rail.rate*touchdown,depot(d.release),out.capture.propellantAfter,'descent',pad(touchdown));
 const burned=s.ship.propellant-back.capture.propellantAfter,outUsed=s.ship.propellant-out.capture.propellantAfter;
 const log=(used:number,port?:string)=>({operationCursor:0,cargoMass:.05,fuelUsed:used,ports:[],...(port?{dockedPortId:port}:{})});
 const sample=(t:number,before=false):ViewSample=>{
  const held=(y:State,fuel:number,used:number,port:string):ViewSample=>({t,y,propellant:fuel,fuelUsed:used,burnCursor:0,status:'running',detail:'',logistics:log(used,port),activity:{kind:'waiting'}});
  if(t<d.launch||before&&t===d.launch)return held(pad(t),6,0,d.pad.id);
  const free=(shot:ShuttleShot,used:number):ViewSample=>{const b=before?shot.runner.eventBoundaries.find(e=>e.t===t)?.before:undefined,a=b??shot.runner.sample(t);return {...a,fuelUsed:used+(a.fuelUsed??0),logistics:log(used+(a.fuelUsed??0)),activity:{kind:'flying'}};};
  if(t<arrival||before&&t===arrival)return free(out,0);
  if(t<d.release||before&&t===d.release)return held(depot(t),out.capture.propellantAfter,outUsed,d.depot.id);
  if(t<touchdown||before&&t===touchdown)return free(back,outUsed);
  return held(pad(t),back.capture.propellantAfter,burned,d.pad.id);
 };
 const event=(t:number,kind:ViewerEvent['kind'],id:string,portId:string,fuel:number):ViewerEvent=>({t,kind,id,portId,deltaV:0,fuelUsed:0,propellantBefore:fuel,propellantAfter:fuel});
 const {y:_,...dock}=out.capture,{y:__,...land}=back.capture;
 const ledger:ViewerEvent[]=[event(0,'dock','pad-support',d.pad.id,6),event(d.launch,'launch','lift-off',d.pad.id,6),...out.runner.ledger,{t:arrival,kind:'dock',id:'arrival',portId:d.depot.id,...dock},event(d.release,'undock','departure',d.depot.id,out.capture.propellantAfter),...back.runner.ledger,{t:touchdown,kind:'land',id:'landing',portId:d.pad.id,...land}];
 const arcs=[...out.runner.bundle.program.thrustArcs!,...back.runner.bundle.program.thrustArcs!];
 const times=[...new Set([0,end,...Array.from({length:Math.ceil(end*32)+1},(_,i)=>Math.min(end,i/32)),...ledger.map(e=>e.t),...arcs.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset)),...[out,back].flatMap(shot=>{const start=shot.runner.bundle.scenario.epoch,n=Math.ceil((shot.end-start)*1024);return Array.from({length:n+1},(_,i)=>start+(shot.end-start)*i/n);})])].sort((a,b)=>a-b);
 const boundaries:EventBoundary[]=[...new Set(ledger.map(e=>e.t))].filter(t=>t>0).map(t=>({t,before:sample(t,true),after:sample(t)})),ports=[d.pad,d.depot];
 const v:VesselView={id:s.ship.id,name:s.ship.id,color:'#efbf7c',cargo:'Supplies',glyph:'rocket',initialAxis:[1,0,0],interpolation:'hermite',ship:s.ship,ports,cargoCapacity:.05,continuousFuel:true,portSamples:{},arcs,samples:times.map(t=>sample(t)),ledger,boundaries};
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:d.extent,rotating:{name:'Surface rotating',rate:d.pad.rail.rate,phase:d.pad.rail.phase},stations:[{id:d.pad.id,role:'Surface pad',berths:1},{id:d.depot.id,role:'Low orbital depot',berths:1}],vessels:[v],portSamples:{},world:{bodies:s.bodies,ports,units:s.units},window:{start:d.launch-.1,end}};
 check(out.runner.retainedNodes+back.runner.retainedNodes<40000&&v.samples.length<16000&&new TextEncoder().encode(JSON.stringify(view)).byteLength<8_000_000,'storage budget exceeded');
 return {definition:d,outbound:out,inbound:back,view};
}
