import {validateBundle,type Scenario,type ThrustArc,type State,type Port,type Vec3} from '../sim/schema';
import {derivative,bodyState} from '../sim/dynamics';
import {Runner} from '../sim/runner';
import {portState,surfaceNormal} from '../sim/logistics';
import {paidCapture} from '../sim/capture';
import {prepareAtmosphericLeg,atmosphericStateAt,atmosphericForces} from '../sim/atmospheric-propulsion';
import {directionAt} from '../sim/steering';
import {prepareEntry,entryStateAt,type EntryFlight} from './entry';
import {entryForces,recoveredState} from '../sim/entry';
import {norm,scale,dot} from '../sim/vectors';
import type {SceneView,ViewSample,ViewerEvent} from './model';

export interface ApolloMission {
 modelVersion:'apollo-v1';schemaVersion:1;id:string;name:string;description:string;provenance:string;extent:number;
 scenario:Scenario;arcs:ThrustArc[];ports:Port[];launch:number;ascentEnd:number;landing:number;liftoff:number;entryStart:number;
 entry:Omit<EntryFlight,'scenario'|'id'|'name'|'extent'|'description'|'provenance'>;
 milestones:{t:number;name:string}[];
}
export const isApollo=(d:unknown):d is ApolloMission=>!!d&&typeof d==='object'&&(d as ApolloMission).modelVersion==='apollo-v1';
const ok=(condition:unknown,message:string)=>{if(!condition)throw Error('Apollo: '+message);};
export function prepareApollo(value:unknown){
 ok(isApollo(value),'unsupported mission');
 const d=structuredClone(value as ApolloMission),s=d.scenario,step=s.policy.step;
 ok(d.schemaVersion===1&&!s.logistics&&!s.rendezvous&&s.ship.cargoMass===0&&d.entry.modelVersion==='entry-rk4-v3'&&s.epoch===0&&s.duration<=128&&s.bodies.length===2&&s.bodies[0].rail.kind==='fixed'&&s.bodies[1].rail.kind==='circular','unsupported world');
 ok(0<d.launch&&d.launch<d.ascentEnd&&d.ascentEnd<d.landing&&d.landing<d.liftoff&&d.liftoff<d.entryStart&&d.entryStart<s.duration,'phase order');
 ok(d.ports.length===2&&d.ports.every(p=>p.rail.kind==='surface')&&d.ports[0].rail.kind==='surface'&&d.ports[0].rail.bodyId===s.bodies[0].id&&d.ports[1].rail.kind==='surface'&&d.ports[1].rail.bodyId===s.bodies[1].id,'surface supports');
 ok(d.arcs.length<=16&&d.milestones.length<=20&&d.arcs.every(a=>a.steering)&&d.milestones.every(m=>Number.isFinite(m.t)&&m.t>=0&&m.t<=s.duration),'control budget');
 ok(s.bodies[0].rail.kind==='fixed'&&s.bodies[0].rail.position.every(x=>x===0),'fixed origin');
 const spans=[[d.launch,d.ascentEnd],[d.ascentEnd,d.landing],[d.liftoff,d.entryStart]];
 ok(new Set(d.arcs.map(a=>a.id)).size===d.arcs.length&&d.arcs.every(a=>spans.filter(([start,end])=>a.start>=start&&a.end<=end).length===1),'every burn must belong to one flight phase');
 const scenario=(start:number,end:number,y:State,fuel:number):Scenario=>({...s,epoch:start,duration:Math.ceil((end-start)/step)*step,ship:{...s.ship,state:y,propellant:fuel}});
 const arcs=(start:number,end:number)=>d.arcs.filter(a=>a.start>=start&&a.end<=end);
 const vacuum=(start:number,end:number,y:State,fuel:number)=>{
  ok(end-start<64,'vacuum segment horizon');
  const vacuumScenario=scenario(start,end,y,fuel);
  // A larger exclusion shell certifies the whole vacuum leg against air entry;
  // it changes clearance admission only. Gravity has no radius dependence.
  vacuumScenario.bodies=structuredClone(s.bodies);
  vacuumScenario.bodies[0].radius+=d.entry.atmosphere.topHeight;
  const bundle=validateBundle({scenario:vacuumScenario,program:{schemaVersion:4,id:'apollo-segment',burns:[],thrustArcs:arcs(start,end)}});
  const runner=new Runner(bundle,{maxNodeStorageBytes:20_000_000});const final=runner.advanceTo(end);
  ok(final.status==='running'||final.status==='horizon','vacuum '+start+'→'+end+' stopped at '+final.t+' '+final.status+' '+final.detail+' '+JSON.stringify(final.y));return runner;
 };
 for(const [i,p] of d.ports.entries()){
  ok(p.rail.kind==='surface'&&p.rail.latitude===0&&p.rail.centerHeight===1e-5&&p.rail.radius===s.bodies[i].radius+1e-5,'support geometry');
  if(p.rail.kind==='surface'){
   ok(Number.isFinite(p.rail.phase)&&p.rail.u.join(',')==='1,0,0'&&p.rail.v.join(',')==='0,1,0'&&p.rail.center.every(x=>x===0),'support frame');
   const owner=s.bodies[i],spin=i===0?d.entry.atmosphere.spin[2]:owner.rail.kind==='circular'?owner.rail.rate:NaN;
   ok(p.rail.rate===spin,'support spin');
   p.rail.bodyRail=structuredClone(owner.rail);
  }
 }
 const moonRail=s.bodies[1].rail;
 if(moonRail.kind!=='circular')throw Error('Apollo: circular Moon required');
 ok(moonRail.kind==='circular'&&moonRail.center.every(x=>x===0)&&moonRail.u.join(',')==='1,0,0'&&moonRail.v.join(',')==='0,1,0'&&moonRail.radius>s.bodies[0].radius+s.bodies[1].radius+2e-5,'support separation');
 const release=(port:Port,t:number,fuel:number)=>{
  const a=d.arcs.find(a=>a.start===t);ok(a,'release burn');
  const y=portState(port,t),normal=surfaceNormal(port,t),body=s.bodies.find(b=>port.rail.kind==='surface'&&b.id===port.rail.bodyId)!;
  const b=bodyState(body,t),rail=body.rail,bodyAcceleration=rail.kind==='circular'?b.slice(0,3).map((v,i)=>-(v-rail.center[i])*rail.rate**2):[0,0,0];
  const gravity=derivative(s,t,y).slice(3);
  const force=Math.min(s.ship.engine!.maxThrust*a!.throttle,s.ship.engine!.maxAcceleration!*(s.ship.dryMass+fuel));
  const acceleration=gravity.map((v,i)=>v-bodyAcceleration[i]+force/(s.ship.dryMass+fuel)*a!.direction[i]) as Vec3;
  ok(dot(acceleration,normal)>0,'release requires outward acceleration');
 };
 release(d.ports[0],d.launch,s.ship.propellant);
 const initial=portState(d.ports[0],d.launch);
 ok(Math.max(...portState(d.ports[0],0).map((v,i)=>Math.abs(v-s.ship.state[i])))<1e-12,'initial support state');
 const ascentScenario=scenario(d.launch,d.ascentEnd,initial,s.ship.propellant);
 validateBundle({scenario:ascentScenario,program:{schemaVersion:4,id:'ascent',burns:[],thrustArcs:arcs(d.launch,d.ascentEnd)}});
 const ascent=prepareAtmosphericLeg({scenario:ascentScenario,atmosphere:d.entry.atmosphere,aero:{...d.entry.aero,dragArea:.015,liftToDrag:0},start:d.launch,end:d.ascentEnd,arcs:arcs(d.launch,d.ascentEnd)});
 ok(ascent.maxima.pressure<=d.entry.limits.dynamicPressure&&ascent.maxima.acceleration<=d.entry.limits.acceleration&&ascent.maxima.heat<=d.entry.limits.heatProxy,'ascent load limit exceeded');
 const upper=atmosphericStateAt(ascent,d.ascentEnd);
 ok(norm(upper.slice(0,3) as Vec3)>s.bodies[0].radius+d.entry.atmosphere.topHeight,'ascent seam inside air');
 const outbound=vacuum(d.ascentEnd,d.landing,upper.slice(0,6) as State,upper[6]),incoming=outbound.sample(d.landing);
 const capture=paidCapture(incoming.y,portState(d.ports[1],d.landing),{...s.ship,propellant:incoming.propellant},{position:2e-6,velocity:2e-6},'lunar surface');
 release(d.ports[1],d.liftoff,capture.propellantAfter);
 ok(capture.positionError+5e-7<2e-6&&capture.deltaV+1e-6<2e-6,'landing numerical margin');
 const departure=portState(d.ports[1],d.liftoff);
 const returning=vacuum(d.liftoff,d.entryStart,departure,capture.propellantAfter),entryInitial=returning.sample(d.entryStart);
 const entryScenario={...scenario(d.entryStart,d.entryStart+8,entryInitial.y,entryInitial.propellant),duration:8,policy:{...s.policy,maxNodes:32768}};
 const entry=prepareEntry({...d.entry,scenario:entryScenario,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance},{displayRate:16});
 const end=Math.max(s.duration,entry.contact.t+.5),fuelInitial=s.ship.propellant;
 const log=(portId?:string)=>({operationCursor:0,cargoMass:0,fuelUsed:0,ports:[],...(portId?{dockedPortId:portId}:{})});
 const support=(t:number,port:Port,fuel:number):ViewSample=>({t,y:portState(port,t),propellant:fuel,fuelUsed:fuelInitial-fuel,mass:s.ship.dryMass+fuel,burnCursor:0,status:'running',detail:'',axis:surfaceNormal(port,t),logistics:log(port.id)});
 const sample=(t:number,before=false):ViewSample=>{
  let q:ViewSample;
  if(t<d.launch||t===d.launch&&before)q=support(t,d.ports[0],fuelInitial);
  else if(t<d.ascentEnd){
   const z=atmosphericStateAt(ascent,t),a=d.arcs.find(a=>before?a.start<t&&t<=a.end:a.start<=t&&t<a.end),f=atmosphericForces(ascent.definition,t,z,a);
   q={t,y:z.slice(0,6) as State,propellant:z[6],mass:f.mass,burnCursor:0,status:'running',detail:'',...(a?{axis:directionAt(a,t-a.start),thrust:{id:a.id,force:f.force,acceleration:f.acceleration,direction:f.direction}}:{})};
  }else if(t<d.landing||t===d.landing&&before)q=outbound.sample(t);
  else if(t<d.liftoff||t===d.liftoff&&before)q=support(t,d.ports[1],capture.propellantAfter);
  else if(t<d.entryStart)q=returning.sample(t);
  else{
   const z=entryStateAt(entry,Math.min(t,entryScenario.epoch+entryScenario.duration),before),recovered=t>=entry.contact.t&&!before,f=entryForces(entry.definition,Math.min(t,entry.contact.t),z);
   q={t,y:recovered?recoveredState(entry.contact.pose,t):z.slice(0,6) as State,propellant:z[6],mass:f.mass,burnCursor:0,status:'running',detail:'',entryPhase:recovered?'recovered':t>=entry.brakingEpoch?'braking':t>=entry.entryEpoch?'entry':'coast',axis:f.axis,...(!recovered?{aero:f.aero,...(norm(f.force)>0?{thrust:{id:'terminal-braking',force:norm(f.force),acceleration:norm(f.force)/f.mass,direction:scale(f.force,1/norm(f.force))}}:{})}:{})};
  }
  q.fuelUsed=fuelInitial-q.propellant;if(q.logistics)q.logistics.fuelUsed=q.fuelUsed;return q;
 };
 const event=(t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<ViewerEvent>={}):ViewerEvent=>{
  const a=sample(t,true),b=sample(t);return {t,kind,id,deltaV:0,fuelUsed:a.propellant-b.propellant,propellantBefore:a.propellant,propellantAfter:b.propellant,...extra};
 };
 const ledger:ViewerEvent[]=[event(0,'dock','on-pad',{portId:d.ports[0].id}),event(d.launch,'launch','launch',{portId:d.ports[0].id}),
  ...outbound.ledger,...returning.ledger,...entry.view.vessels[0].ledger,
  event(d.landing,'land','lunar-landing',{portId:d.ports[1].id,positionError:capture.positionError,deltaV:capture.deltaV,fuelUsed:capture.fuelUsed}),
  event(d.liftoff,'launch','lunar-liftoff',{portId:d.ports[1].id}),
  ...d.milestones.map(m=>event(m.t,'milestone',m.name))];
 for(const a of ascent.definition.arcs){const p=sample(a.start).propellant,q=sample(a.end).propellant;ledger.push(event(a.start,'thrust-start',a.id),event(a.end,'thrust-end',a.id,{fuelUsed:p-q,deltaV:s.ship.exhaustVelocity*Math.log((s.ship.dryMass+p)/(s.ship.dryMass+q))}));}
 ledger.sort((a,b)=>a.t-b.t);
 const times=new Set([0,end,...ledger.map(e=>e.t),d.ascentEnd,d.entryStart,...d.arcs.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset))]);
 for(let t=0;t<end;t+=1/64)times.add(t);
 for(const [a,b] of [[d.launch,d.ascentEnd],[d.landing-1.2,d.landing],[d.liftoff,d.liftoff+1.2],[d.entryStart,entry.contact.t]]){
  for(let i=0,n=Math.ceil((b-a)*2048);i<=n;i++)times.add(a+(b-a)*i/n);
 }
 const ordered=[...times].sort((a,b)=>a-b);ok(ordered.length<=40000,'display sample budget');
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:d.extent,frameExtents:{Aster:2.2,Selene:.7,Cairn:.015,Tranquility:.015},
  stations:d.ports.map(p=>({id:p.id,role:'Surface terminal',berths:1})),rotating:{name:'Aster–Selene rotating',rate:moonRail.rate,phase:moonRail.phase},world:{bodies:s.bodies,ports:d.ports,units:s.units},portSamples:{},window:{start:0,end},atmosphere:d.entry.atmosphere,
  vessels:[{id:s.ship.id,name:'Odyssey',color:'#e6c98b',cargo:'Expedition',cargoCapacity:0,ship:s.ship,ports:d.ports,portSamples:{},arcs:d.arcs,glyph:'rocket',continuousFuel:true,interpolation:'hermite',
   samples:ordered.map(t=>{const q=sample(t);delete q.aero;return q;}),ledger,boundaries:[{t:d.launch,before:sample(d.launch,true),after:sample(d.launch)},{t:d.landing,before:sample(d.landing,true),after:sample(d.landing)},{t:d.liftoff,before:sample(d.liftoff,true),after:sample(d.liftoff)},{t:entry.contact.t,before:sample(entry.contact.t,true),after:sample(entry.contact.t)}],
   aerodynamics:{scenario:s,atmosphere:d.entry.atmosphere,aero:ascent.definition.aero},
   entry:{physics:entry.definition,recovery:entry.contact.pose,activeFrom:d.entryStart,entryEpoch:entry.entryEpoch,brakingEpoch:entry.brakingEpoch,heatScale:d.entry.presentation.heatScale}}],
  recoveries:{[s.ship.id]:{recoveryEpoch:entry.contact.t,relativeSpeed:entry.contact.relativeSpeed,waterEnergy:entry.contact.waterEnergy,impulse:entry.contact.impulse,maxima:entry.maxima,work:entry.work}}};
 const physicsBytes=outbound.treeStorageBytes()+returning.treeStorageBytes()+new TextEncoder().encode(JSON.stringify([ascent.nodes,entry.nodes])).byteLength;
 const work={physicsBytes,nodes:ascent.nodes.length+outbound.retainedTreeNodes+returning.retainedTreeNodes+entry.nodes.length,bytes:new TextEncoder().encode(JSON.stringify(view)).byteLength};
 ok(work.nodes<100000&&work.physicsBytes<40_000_000&&work.bytes<12_000_000,'aggregate budget '+JSON.stringify(work));
 return {definition:d,ascent,outbound,returning,capture,entry,view,work,sample};
}
