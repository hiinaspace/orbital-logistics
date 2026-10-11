import {validateBundle,type Scenario,type ThrustArc,type State,type Port,type Vec3} from '../sim/schema';
import {Runner} from '../sim/runner';
import {portState,surfaceNormal} from '../sim/logistics';
import {bodyState,derivative} from '../sim/dynamics';
import {paidCapture} from '../sim/capture';
import {prepareAtmosphericLeg,atmosphericStateAt,atmosphericForces,type AtmosphericRun} from '../sim/atmospheric-propulsion';
import {directionAt} from '../sim/steering';
import {entryForces,recoveredState} from '../sim/entry';
import {prepareEntry,entryStateAt,type EntryFlight,type EntryResult} from './entry';
import {dot,norm,scale} from '../sim/vectors';
import type {SceneView,VesselView,ViewSample,ViewerEvent} from './model';

export type Part='booster'|'orbiter'|'lander';
export interface MissionHardware extends Omit<Scenario['ship'],'state'|'cargoMass'> {name:string;color:string}
export interface StagedApolloMission {
 schemaVersion:1;modelVersion:'staged-apollo-v1';id:string;name:string;extent:number;description:string;provenance:string;
 world:Omit<Scenario,'ship'>;ports:Port[];hardware:Record<Part,MissionHardware>;stack:{id:string;name:string;color:string};
 launch:number;boosterSeparation:number;ascentEnd:number;lunarSeparation:number;landing:number;liftoff:number;lunarDock:number;entryStart:number;boosterEntryStart:number;
 programs:Record<'stack'|'orbiterOutbound'|'orbiterReturn'|'lander'|'booster',ThrustArc[]>;
 dragAreas:{stack:number;upper:number;booster:number};
 entry:Omit<EntryFlight,'scenario'|'id'|'name'|'extent'|'description'|'provenance'>;
}
export interface PartAccount {id:string;propellant:number;consumedFuel:number;ownerId:string;y:State}
export interface MissionAccounts {t:number;remainingFuel:number;consumedFuel:number;dryMass:number;activeMass:number;parts:Record<Part,PartAccount>}
export const isStagedApollo=(d:unknown):d is StagedApolloMission=>!!d&&typeof d==='object'&&(d as StagedApolloMission).modelVersion==='staged-apollo-v1';
const ok=(x:unknown,m:string):void=>{if(!x)throw Error('Staged Apollo: '+m);};
const keys=(x:object,allowed:string[],label:string)=>ok(Object.keys(x).every(k=>allowed.includes(k)),label+' unknown physical field');
const parts:Part[]=['booster','orbiter','lander'];

export function validateStagedApollo(value:unknown):StagedApolloMission {
 ok(isStagedApollo(value),'unsupported mission');const d=structuredClone(value as StagedApolloMission);
 keys(d,['schemaVersion','modelVersion','id','name','extent','description','provenance','world','ports','hardware','stack','launch','boosterSeparation','ascentEnd','lunarSeparation','landing','liftoff','lunarDock','entryStart','boosterEntryStart','programs','dragAreas','entry'],'mission');
 ok(d.schemaVersion===1&&d.world&&d.hardware&&d.programs&&d.entry&&d.stack&&d.dragAreas,'missing assembly');
 keys(d.world,['schemaVersion','modelVersion','id','units','epoch','duration','policy','bodies'],'world');
 keys(d.world.policy,['step','maxNodes','maxSubdivision'],'policy');keys(d.hardware,parts,'hardware');
 keys(d.stack,['id','name','color'],'stack');keys(d.dragAreas,['stack','upper','booster'],'drag areas');
 const w=d.world,b=w.bodies;
 ok(w.epoch===0&&w.duration<=128&&w.duration>0&&w.policy.step>=1/4096&&w.policy.step<=1/512&&w.policy.maxNodes<=65536,'world/work budget');
 ok(b.length===2&&b[0].rail.kind==='fixed'&&b[0].rail.position.every(x=>x===0)&&b[1].rail.kind==='circular','two-body planar world');
 const moon=b[1].rail;ok(moon.kind==='circular'&&moon.center.every(x=>x===0)&&moon.u.join(',')==='1,0,0'&&moon.v.join(',')==='0,1,0','Moon symmetry');
 const order=[0,d.launch,d.boosterSeparation,d.ascentEnd,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,d.entryStart,w.duration];
 ok(order.every(Number.isFinite)&&order.every((t,i)=>!i||t>order[i-1]),'phase order');
 ok(Number.isFinite(d.boosterEntryStart)&&d.boosterEntryStart>d.boosterSeparation&&d.boosterEntryStart+8<=w.duration,'booster recovery horizon');
 ok(Object.values(d.dragAreas).every(x=>Number.isFinite(x)&&x>0),'aerodynamic area');
 ok(d.ports.length===2,'two surface supports');
 for(const [i,p] of d.ports.entries()){
  ok(p.rail.kind==='surface','surface support required');if(p.rail.kind!=='surface')throw Error('Staged Apollo: support');
  keys(p,['id','rail','cargo','cargoCapacity','propellant','tankCapacity','serviceDuration'],'port');
  const r=p.rail,owner=b[i];keys(r,['kind','bodyId','bodyRail','latitude','centerHeight','center','u','v','radius','rate','phase'],'support');
  ok(p.cargo===0&&p.propellant===0&&[p.cargoCapacity,p.tankCapacity,p.serviceDuration].every(x=>Number.isFinite(x)&&x>=0),'supported inventory');
  ok(r.bodyId===owner.id&&r.latitude===0&&r.centerHeight===1e-5&&r.radius===owner.radius+1e-5&&r.center.every(x=>x===0)&&r.u.join(',')==='1,0,0'&&r.v.join(',')==='0,1,0','surface geometry');
  ok(Number.isFinite(r.phase)&&r.rate===(i===0?d.entry.atmosphere.spin[2]:moon.kind==='circular'?moon.rate:NaN),'surface spin');
  r.bodyRail=structuredClone(owner.rail);
 }
 const names=[d.id,d.name,d.description,d.provenance];
 ok(names.every(x=>typeof x==='string'&&x.length>0)&&Number.isFinite(d.extent)&&d.extent>0,'presentation');
 const ids=[...parts.map(p=>d.hardware[p].id),d.stack.id,...b.map(b=>b.id),...d.ports.map(p=>p.id)];
 ok(new Set(ids).size===ids.length&&ids.every(x=>typeof x==='string'&&x.length>0),'identities');
 for(const h of [d.stack,...parts.map(p=>d.hardware[p])])ok(typeof h.name==='string'&&!!h.name&&/^#[0-9a-f]{6}$/i.test(h.color),'hardware presentation');
 for(const p of parts){
  const h=d.hardware[p];keys(h,['id','name','color','dryMass','propellant','tankCapacity','exhaustVelocity','engine'],'hardware');
  ok(h.engine&&h.engine.maxThrust>0&&h.engine.maxAcceleration!>0,'bounded hardware');keys(h.engine!,['maxThrust','maxAcceleration'],'engine');
  validateBundle({scenario:{...w,duration:1,ship:hardwareShip(h,portState(d.ports[0],0),h.propellant,0)},program:{schemaVersion:4,id:'hardware',burns:[],thrustArcs:[]}});
 }
 const windows={stack:[d.launch,d.boosterSeparation],orbiterOutbound:[d.boosterSeparation,d.lunarSeparation],orbiterReturn:[d.lunarDock,d.entryStart],lander:[d.lunarSeparation,d.lunarDock],booster:[d.boosterSeparation,d.boosterEntryStart]};
 keys(d.programs,Object.keys(windows),'programs');
 const all=Object.values(d.programs).flat();for(const a of all){keys(a,['id','start','end','direction','throttle','steering'],'arc');if(a.steering){keys(a.steering,['kind','keys'],'steering');for(const k of a.steering.keys)keys(k,['offset','direction'],'steering key');}}ok(all.length<=24&&new Set(all.map(a=>a.id)).size===all.length,'control budget/identities');
 for(const [name,[a,z]] of Object.entries(windows)){
  const arcs=d.programs[name as keyof typeof windows];
  ok(Array.isArray(arcs)&&arcs.every(q=>q.steering&&q.start>=a&&q.end<=z),'arc ownership '+name);
 }
 ok(d.programs.stack.some(a=>a.start===d.launch)&&d.programs.stack.some(a=>a.end===d.boosterSeparation)&&d.programs.lander.some(a=>a.start===d.lunarSeparation)&&d.programs.lander.some(a=>a.start===d.liftoff),'powered support releases');
 ok(d.programs.lander.every(a=>a.end<=d.landing||a.start>=d.liftoff),'burn during lunar support');
 ok(d.entry.modelVersion==='entry-rk4-v3'&&d.entry.atmosphere.spin.slice(0,2).every(x=>x===0),'absolute epoch entry');
 return d;
}
function hardwareShip(h:MissionHardware,y:State,fuel:number,attached:number):Scenario['ship'] {
 return {id:h.id,state:[...y],dryMass:h.dryMass+attached,cargoMass:0,propellant:fuel,tankCapacity:h.tankCapacity,exhaustVelocity:h.exhaustVelocity,engine:structuredClone(h.engine)};
}

export function prepareStagedApollo(value:unknown){
 const d=validateStagedApollo(value),w=d.world,h=d.hardware,step=w.policy.step,end=w.duration;
 const scenario=(part:Part,start:number,stop:number,y:State,fuel:number,attached=0):Scenario=>({...structuredClone(w),epoch:start,duration:Math.ceil((stop-start)/step)*step,ship:hardwareShip(h[part],y,fuel,attached)});
 const vacuum=(part:Part,start:number,stop:number,y:State,fuel:number,attached:number,arcs:ThrustArc[])=>{
  ok(stop-start<64,'vacuum horizon');const s=scenario(part,start,stop,y,fuel,attached);
  s.bodies[0].radius+=d.entry.atmosphere.topHeight;
  const runner=new Runner(validateBundle({scenario:s,program:{schemaVersion:4,id:part+'-segment',burns:[],thrustArcs:arcs}}),{maxNodeStorageBytes:25_000_000});
  const q=runner.advanceTo(stop);ok(q.t===stop&&(q.status==='running'||q.status==='horizon'),part+' segment failed '+q.status+' '+q.detail);return runner;
 };
 const atmosphere=(part:Part,start:number,stop:number,y:State,fuel:number,attached:number,area:number,arcs:ThrustArc[]):AtmosphericRun=>{
  const s=scenario(part,start,stop,y,fuel,attached);
  validateBundle({scenario:s,program:{schemaVersion:4,id:part+'-air',burns:[],thrustArcs:arcs}});
  const run=prepareAtmosphericLeg({scenario:s,atmosphere:d.entry.atmosphere,aero:{...d.entry.aero,dragArea:area,liftToDrag:0},start,end:stop,arcs});
  ok(run.maxima.pressure<=d.entry.limits.dynamicPressure&&run.maxima.acceleration<=d.entry.limits.acceleration&&run.maxima.heat<=d.entry.limits.heatProxy,part+' ascent load limit');return run;
 };
 const release=(port:Port,t:number,s:Scenario,arc:ThrustArc)=>{
  const y=portState(port,t),owner=w.bodies.find(b=>port.rail.kind==='surface'&&b.id===port.rail.bodyId)!,rail=owner.rail,pose=bodyState(owner,t);
  const supportAcceleration=rail.kind==='circular'?pose.slice(0,3).map((v,i)=>-(v-rail.center[i])*rail.rate**2):[0,0,0],gravity=derivative(s,t,y).slice(3),m=s.ship.dryMass+s.ship.propellant;
  const f=Math.min(s.ship.engine!.maxThrust*arc.throttle,s.ship.engine!.maxAcceleration!*m),v=gravity.map((x,i)=>x-supportAcceleration[i]+f/m*arc.direction[i]) as Vec3;
  ok(dot(v,surfaceNormal(port,t))>0,'release requires outward acceleration');
 };
 const upperReserved=h.orbiter.dryMass+h.orbiter.propellant+h.lander.dryMass+h.lander.propellant;
 const parentScenario=scenario('booster',d.launch,d.boosterSeparation,portState(d.ports[0],d.launch),h.booster.propellant,upperReserved);
 release(d.ports[0],d.launch,parentScenario,d.programs.stack[0]);
 const stack=atmosphere('booster',d.launch,d.boosterSeparation,parentScenario.ship.state,h.booster.propellant,upperReserved,d.dragAreas.stack,d.programs.stack);
 const split=atmosphericStateAt(stack,d.boosterSeparation),splitY=split.slice(0,6) as State;
 const landerReserved=h.lander.dryMass+h.lander.propellant;
 const upperAirArcs=d.programs.orbiterOutbound.filter(a=>a.start<d.ascentEnd);
 ok(upperAirArcs.every(a=>a.end<=d.ascentEnd),'upper burn crossing air handoff');
 const upper=atmosphere('orbiter',d.boosterSeparation,d.ascentEnd,splitY,h.orbiter.propellant,landerReserved,d.dragAreas.upper,upperAirArcs);
 const parked=atmosphericStateAt(upper,d.ascentEnd);
 ok(norm(parked.slice(0,3) as Vec3)>w.bodies[0].radius+d.entry.atmosphere.topHeight,'upper air handoff');
 const outbound=vacuum('orbiter',d.ascentEnd,d.lunarSeparation,parked.slice(0,6) as State,parked[6],landerReserved,d.programs.orbiterOutbound.filter(a=>a.start>=d.ascentEnd));
 const lunarSplit=outbound.sample(d.lunarSeparation),lunarY=lunarSplit.y;
 const parking=vacuum('orbiter',d.lunarSeparation,d.lunarDock,lunarY,lunarSplit.propellant,0,[]);
 const descent=vacuum('lander',d.lunarSeparation,d.landing,lunarY,h.lander.propellant,0,d.programs.lander.filter(a=>a.end<=d.landing));
 const incoming=descent.sample(d.landing),capture=paidCapture(incoming.y,portState(d.ports[1],d.landing),{...h.lander,cargoMass:0,propellant:incoming.propellant},{position:2e-6,velocity:2e-6},'lunar surface');
 ok(capture.positionError+5e-7<2e-6&&capture.deltaV+1e-6<2e-6,'landing numerical margin');
 const departure=portState(d.ports[1],d.liftoff),landerAscentArcs=d.programs.lander.filter(a=>a.start>=d.liftoff);
 release(d.ports[1],d.liftoff,scenario('lander',d.liftoff,d.lunarDock,departure,capture.propellantAfter),landerAscentArcs[0]);
 const ascent=vacuum('lander',d.liftoff,d.lunarDock,departure,capture.propellantAfter,0,landerAscentArcs);
 const dockIncoming=ascent.sample(d.lunarDock),orbiterTarget=parking.sample(d.lunarDock);
 const dock=paidCapture(dockIncoming.y,orbiterTarget.y,{...h.lander,cargoMass:0,propellant:dockIncoming.propellant},{position:2e-6,velocity:2e-6},'lunar orbiter');
 ok(dock.positionError+5e-7<2e-6&&dock.deltaV+1e-6<2e-6,'docking numerical margin');
 const attachedReturn=h.lander.dryMass+dock.propellantAfter;
 const returning=vacuum('orbiter',d.lunarDock,d.entryStart,orbiterTarget.y,orbiterTarget.propellant,attachedReturn,d.programs.orbiterReturn);
 const returnEntry=returning.sample(d.entryStart);
 const entry=(part:Part,t:number,y:State,fuel:number,attached:number):EntryResult=>prepareEntry({...d.entry,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,scenario:{...scenario(part,t,t+8,y,fuel,attached),duration:8,policy:{...w.policy,maxNodes:32768}},presentation:{...d.entry.presentation,name:h[part].name,color:h[part].color}},{displayRate:16});
 const orbiterEntry=entry('orbiter',d.entryStart,returnEntry.y,returnEntry.propellant,attachedReturn);
 const boosterAir=atmosphere('booster',d.boosterSeparation,d.boosterEntryStart,splitY,split[6],0,d.dragAreas.booster,d.programs.booster);
 const boosterEntryInitial=atmosphericStateAt(boosterAir,d.boosterEntryStart);
 const boosterEntry=entry('booster',d.boosterEntryStart,boosterEntryInitial.slice(0,6) as State,boosterEntryInitial[6],0);
 ok(Math.max(orbiterEntry.contact.t,boosterEntry.contact.t)+.5<end,'recovery outside finite mission');
 const support=(part:Part,t:number,port:Port,fuel:number,attached=0):ViewSample=>({t,y:portState(port,t),propellant:fuel,mass:h[part].dryMass+attached+fuel,fuelUsed:h[part].propellant-fuel,burnCursor:0,status:'running',detail:'',axis:surfaceNormal(port,t),logistics:{operationCursor:0,cargoMass:0,fuelUsed:h[part].propellant-fuel,ports:[],dockedPortId:port.id}});
 const airSample=(r:AtmosphericRun,t:number,before:boolean):ViewSample=>{
  const z=atmosphericStateAt(r,t),a=r.definition.arcs.find(a=>before?a.start<t&&t<=a.end:a.start<=t&&t<a.end),f=atmosphericForces(r.definition,t,z,a);
  return {t,y:z.slice(0,6) as State,propellant:z[6],mass:f.mass,burnCursor:0,status:'running',detail:'',aero:f.aero,...(a?{axis:directionAt(a,t-a.start),thrust:{id:a.id,force:f.force,acceleration:f.acceleration,direction:f.direction}}:{})};
 };
 const entrySample=(r:EntryResult,t:number,before:boolean):ViewSample=>{
  const stop=Math.min(t,r.contact.t),left=before&&t===r.contact.t,z=entryStateAt(r,stop,left),recovered=t>=r.contact.t&&!left,f=entryForces(r.definition,stop,z);
  return {t,y:recovered?recoveredState(r.contact.pose,t):z.slice(0,6) as State,propellant:z[6],mass:f.mass,burnCursor:0,status:'running',detail:'',entryPhase:recovered?'recovered':t>=r.brakingEpoch?'braking':t>=r.entryEpoch?'entry':'coast',axis:recovered?scale(recoveredState(r.contact.pose,t).slice(0,3) as Vec3,1/norm(recoveredState(r.contact.pose,t).slice(0,3) as Vec3)):f.axis,...(!recovered?{aero:f.aero,...(norm(f.force)>0?{thrust:{id:'terminal-braking',force:norm(f.force),acceleration:norm(f.force)/f.mass,direction:scale(f.force,1/norm(f.force))}}:{})}:{})};
 };
 const stackSample=(t:number,before=false):ViewSample=>t<d.launch||t===d.launch&&before?support('booster',t,d.ports[0],h.booster.propellant,upperReserved):airSample(stack,Math.min(t,d.boosterSeparation),before);
 const orbiterSample=(t:number,before=false):ViewSample=>{
  let q:ViewSample;
  if(t<d.boosterSeparation||t===d.boosterSeparation&&before){q={...stackSample(t,before),propellant:h.orbiter.propellant,mass:h.orbiter.dryMass+h.orbiter.propellant+landerReserved};delete q.thrust;}
  else if(t<d.ascentEnd)q=airSample(upper,t,before);
  else if(t<d.lunarSeparation||t===d.lunarSeparation&&before)q=outbound.sample(t);
  else if(t<d.lunarDock||t===d.lunarDock&&before)q=parking.sample(t);
  else if(t<d.entryStart)q=returning.sample(t);
  else q=entrySample(orbiterEntry,t,before);
  q.mass=h.orbiter.dryMass+q.propellant+(t<d.lunarSeparation||t===d.lunarSeparation&&before?landerReserved:t>d.lunarDock||t===d.lunarDock&&!before?attachedReturn:0);
  q.fuelUsed=h.orbiter.propellant-q.propellant;return q;
 };
 const sample=(id:string,t:number,before=false):ViewSample=>{
  ok(Number.isFinite(t)&&t>=0&&t<=end,'query outside finite mission');
  let q:ViewSample;
  if(id===d.stack.id){q=stackSample(t,before);q={...q,t};q.fuelUsed=h.booster.propellant-q.propellant;}
  else if(id===h.booster.id){q=t<d.boosterSeparation||t===d.boosterSeparation&&before?stackSample(t,before):t<d.boosterEntryStart?airSample(boosterAir,t,before):entrySample(boosterEntry,t,before);q.fuelUsed=h.booster.propellant-q.propellant;if(t<d.boosterSeparation){q={...q,mass:h.booster.dryMass+q.propellant};delete q.thrust;}}
  else if(id===h.orbiter.id)q=orbiterSample(t,before);
  else if(id===h.lander.id){
   if(t<d.lunarSeparation||t===d.lunarSeparation&&before){q={...orbiterSample(t,before),propellant:h.lander.propellant,mass:h.lander.dryMass+h.lander.propellant};delete q.thrust;delete q.aero;delete q.logistics;}
   else if(t<d.landing||t===d.landing&&before)q=descent.sample(t);
   else if(t<d.liftoff||t===d.liftoff&&before)q=support('lander',t,d.ports[1],capture.propellantAfter);
   else if(t<d.lunarDock||t===d.lunarDock&&before)q=ascent.sample(t);
   else {q={...orbiterSample(t,before),propellant:dock.propellantAfter,mass:h.lander.dryMass+dock.propellantAfter};delete q.thrust;delete q.aero;delete q.logistics;}
   q.mass=h.lander.dryMass+q.propellant;q.fuelUsed=h.lander.propellant-q.propellant;
  }else throw Error('Staged Apollo: unknown part '+id);
  if(q.logistics)q.logistics={...q.logistics,fuelUsed:q.fuelUsed!};
  return q;
 };
 const accounts=(t:number,before=false):MissionAccounts=>{
  const booster=sample(h.booster.id,t,before),orbiter=sample(h.orbiter.id,t,before),lander=sample(h.lander.id,t,before),preBoost=t<d.boosterSeparation||before&&t===d.boosterSeparation,freeLander=(t>d.lunarSeparation||t===d.lunarSeparation&&!before)&&(t<d.lunarDock||t===d.lunarDock&&before);
  const make=(p:Part,q:ViewSample,ownerId:string):PartAccount=>({id:h[p].id,propellant:q.propellant,consumedFuel:h[p].propellant-q.propellant,ownerId,y:[...q.y]});
  const records={booster:make('booster',booster,preBoost?d.stack.id:h.booster.id),orbiter:make('orbiter',orbiter,preBoost?d.stack.id:h.orbiter.id),lander:make('lander',lander,preBoost?d.stack.id:freeLander?h.lander.id:h.orbiter.id)};
  const remainingFuel=Object.values(records).reduce((n,p)=>n+p.propellant,0),consumedFuel=Object.values(records).reduce((n,p)=>n+p.consumedFuel,0),dryMass=parts.reduce((n,p)=>n+h[p].dryMass,0),initial=parts.reduce((n,p)=>n+h[p].propellant,0);
  ok(Math.abs(initial-remainingFuel-consumedFuel)<1e-10&&Object.values(records).every(p=>p.propellant>=0),'tank conservation');
  return {t,parts:records,remainingFuel,consumedFuel,dryMass,activeMass:dryMass+remainingFuel};
 };
 const splitRecord=(t:number,parentId:string,children:string[],y:State,beforeMass:number,afterMass:number)=>{
  ok(Math.abs(beforeMass-afterMass)<1e-12,'split mass conservation');
  return {t,parentId,children,state:[...y] as State,beforeMass,afterMass,momentumBefore:y.slice(3).map(x=>x*beforeMass),momentumAfter:y.slice(3).map(x=>x*afterMass)};
 };
 const separations=[splitRecord(d.boosterSeparation,d.stack.id,[h.booster.id,h.orbiter.id],splitY,stack.definition.scenario.ship.dryMass+split[6],h.booster.dryMass+split[6]+upperReserved),
  splitRecord(d.lunarSeparation,h.orbiter.id,[h.orbiter.id,h.lander.id],lunarY,outbound.bundle.scenario.ship.dryMass+lunarSplit.propellant,h.orbiter.dryMass+lunarSplit.propellant+h.lander.dryMass+h.lander.propellant)];
 const event=(id:string,t:number,kind:ViewerEvent['kind'],name:string,extra:Partial<ViewerEvent>={}):ViewerEvent=>{
  const a=sample(id,t,true),b=sample(id,t);return {t,kind,id:name,...(kind==='separation'||kind==='dock'?{label:name}:{}),deltaV:0,fuelUsed:0,propellantBefore:a.propellant,propellantAfter:b.propellant,...extra};
 };
 const ledger:Record<string,ViewerEvent[]>={[d.stack.id]:[event(d.stack.id,0,'dock','On Cairn',{portId:d.ports[0].id}),event(d.stack.id,d.launch,'launch','Launch',{portId:d.ports[0].id}),event(d.stack.id,d.boosterSeparation,'separation','Booster separation')],
  [h.booster.id]:[...boosterEntry.view.vessels[0].ledger],
  [h.orbiter.id]:[...outbound.ledger,...returning.ledger,...orbiterEntry.view.vessels[0].ledger,event(h.orbiter.id,d.lunarSeparation,'separation','Lander separation'),event(h.orbiter.id,d.lunarDock,'milestone','Lander aboard')],
  [h.lander.id]:[...descent.ledger,...ascent.ledger,event(h.lander.id,d.landing,'land','Lunar landing',{portId:d.ports[1].id,positionError:capture.positionError,deltaV:capture.deltaV,fuelUsed:capture.fuelUsed}),event(h.lander.id,d.liftoff,'launch','Lunar liftoff',{portId:d.ports[1].id}),event(h.lander.id,d.lunarDock,'dock','Orbiter rendezvous',{positionError:dock.positionError,deltaV:dock.deltaV,fuelUsed:dock.fuelUsed})]};
 const airEvents=(id:string,r:AtmosphericRun)=>{
  for(const a of r.definition.arcs){const p=sample(id,a.start).propellant,q=sample(id,a.end,true).propellant,m=r.definition.scenario.ship.dryMass;
   ledger[id].push(event(id,a.start,'thrust-start',a.id),event(id,a.end,'thrust-end',a.id,{fuelUsed:p-q,deltaV:r.definition.scenario.ship.exhaustVelocity*Math.log((m+p)/(m+q))}));
  }
 };
 airEvents(d.stack.id,stack);airEvents(h.orbiter.id,upper);airEvents(h.booster.id,boosterAir);
 const milestone=(id:string,t:number,name:string)=>ledger[id].push(event(id,t,'milestone',name));
 milestone(h.orbiter.id,d.ascentEnd,'Parking orbit');milestone(h.orbiter.id,d.programs.orbiterOutbound.find(a=>a.id.includes('translunar'))!.start,'Translunar departure');
 const loi=d.programs.orbiterOutbound.find(a=>a.id.includes('lunar-orbit'))!;milestone(h.orbiter.id,loi.end,'Lunar parking orbit');
 milestone(h.orbiter.id,d.programs.orbiterReturn[0].start,'Transearth departure');milestone(h.orbiter.id,d.entryStart,'Entry handoff');
 const boundaries=[d.launch,d.boosterSeparation,d.ascentEnd,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,d.entryStart,d.boosterEntryStart,boosterEntry.contact.t,orbiterEntry.contact.t];
 const arcs:Record<string,ThrustArc[]>={[d.stack.id]:d.programs.stack,[h.booster.id]:d.programs.booster,[h.orbiter.id]:[...d.programs.orbiterOutbound,...d.programs.orbiterReturn],[h.lander.id]:d.programs.lander};
 const lives:Record<string,NonNullable<VesselView['lifetime']>>={[d.stack.id]:{start:0,end:d.boosterSeparation,retired:true},[h.booster.id]:{start:d.boosterSeparation,end,parentId:d.stack.id},[h.orbiter.id]:{start:d.boosterSeparation,end,parentId:d.stack.id},[h.lander.id]:{start:d.lunarSeparation,end:d.lunarDock,retired:true,parentId:h.orbiter.id}};
 const vessel=(metadata:StagedApolloMission['stack'],p:Part):VesselView=>{
  const id=metadata.id,lifetime=lives[id],times=new Set([0,end,...boundaries,...arcs[id].flatMap(a=>[a.start,a.end,...a.steering!.keys.map(k=>a.start+k.offset)]),...ledger[id].map(e=>e.t)]);
  for(let t=0;t<end;t+=1/64)times.add(t);
  const spans=id===d.stack.id?[[d.launch,d.boosterSeparation]]:id===h.booster.id?[[d.boosterSeparation,boosterEntry.contact.t]]:id===h.orbiter.id?[[d.boosterSeparation,d.ascentEnd],[d.entryStart,orbiterEntry.contact.t]]:[[d.lunarSeparation,d.landing],[d.liftoff,d.lunarDock]];
  for(const [a,b] of spans)for(let i=0,n=Math.ceil((b-a)*2048);i<=n;i++)times.add(a+(b-a)*i/n);
  const e=id===h.booster.id?boosterEntry:id===h.orbiter.id?orbiterEntry:undefined;
  const area=id===d.stack.id?d.dragAreas.stack:id===h.booster.id?d.dragAreas.booster:d.dragAreas.upper;
  const active=metadata.id===d.stack.id?'stack':p;
  return {...metadata,ship:{...hardwareShip(h[p],portState(d.ports[0],0),h[p].propellant,0),id},glyph:id===d.stack.id?'stack':'rocket',cargo:'Expedition',cargoCapacity:0,continuousFuel:true,interpolation:'hermite',ports:d.ports,portSamples:{},arcs:arcs[id],lifetime,
   ...(lifetime.parentId?{attachment:{before:lifetime.parentId,after:id===h.lander.id?h.orbiter.id:undefined}}:{}),
   initialAxis:directionAt(d.programs.stack.at(-1)!,d.boosterSeparation-d.programs.stack.at(-1)!.start),
   samples:[...times].sort((a,b)=>a-b).map(t=>{const q=sample(id,t);delete q.aero;if(t<lifetime.start||(lifetime.retired?t>=lifetime.end:t>lifetime.end))q.opacity=0;return q;}),ledger:ledger[id].sort((a,b)=>a.t-b.t),boundaries:boundaries.map(t=>({t,before:sample(id,t,true),after:sample(id,t)})),
   ...(id!==h.lander.id?{aerodynamics:{scenario:scenario(p,0,end,portState(d.ports[0],0),h[p].propellant,active==='stack'?upperReserved:0),atmosphere:d.entry.atmosphere,aero:{...d.entry.aero,dragArea:area,liftToDrag:0}}}:{}),
   ...(e?{entry:{physics:e.definition,recovery:e.contact.pose,activeFrom:e.definition.scenario.epoch,entryEpoch:e.entryEpoch,brakingEpoch:e.brakingEpoch,heatScale:d.entry.presentation.heatScale}}:{})};
 };
 const recovery=(r:EntryResult)=>({recoveryEpoch:r.contact.t,relativeSpeed:r.contact.relativeSpeed,waterEnergy:r.contact.waterEnergy,impulse:r.contact.impulse,maxima:r.maxima,work:r.work});
 const moon=w.bodies[1].rail;if(moon.kind!=='circular')throw Error('Staged Apollo: Moon');
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:d.extent,frameExtents:{Aster:2.2,Selene:.7,Cairn:.015,Tranquility:.015,[d.stack.id]:.3,[h.booster.id]:.3,[h.orbiter.id]:.4,[h.lander.id]:.16},
  stations:d.ports.map(p=>({id:p.id,role:'Surface terminal',berths:1})),rotating:{name:'Aster–Selene rotating',rate:moon.rate,phase:moon.phase},
  world:{bodies:w.bodies,ports:d.ports,units:w.units},portSamples:{},window:{start:0,end},atmosphere:d.entry.atmosphere,
  vessels:[vessel(d.stack,'booster'),...parts.map(p=>vessel(h[p],p))],recoveries:{[h.booster.id]:recovery(boosterEntry),[h.orbiter.id]:recovery(orbiterEntry)},assemblies:{separations,dock:{t:d.lunarDock,carrierId:h.orbiter.id,partId:h.lander.id,positionError:dock.positionError,deltaV:dock.deltaV,fuelUsed:dock.fuelUsed}}};
 const runners=[outbound,parking,descent,ascent,returning],air=[stack,upper,boosterAir],entries=[boosterEntry,orbiterEntry];
 const physicsBytes=runners.reduce((n,r)=>n+r.treeStorageBytes(),0)+new TextEncoder().encode(JSON.stringify([...air.map(r=>r.nodes),...entries.map(r=>r.nodes)])).byteLength;
 const work={physicsBytes,nodes:runners.reduce((n,r)=>n+r.retainedTreeNodes,0)+[...air,...entries].reduce((n,r)=>n+r.nodes.length,0),bytes:new TextEncoder().encode(JSON.stringify(view)).byteLength};
 ok(work.nodes<=160000&&work.physicsBytes<=60_000_000&&work.bytes<=24_000_000,'aggregate budget '+JSON.stringify(work));
 for(const t of new Set([0,end,...boundaries,...Object.values(arcs).flat().flatMap(a=>[a.start,a.end])]))for(const left of [true,false])accounts(t,left);
 const recoveries={booster:boosterEntry.contact.t,orbiter:orbiterEntry.contact.t},spent={booster:h.booster.propellant-boosterEntry.contact.before[6],orbiter:h.orbiter.propellant-orbiterEntry.contact.before[6],lander:h.lander.propellant-dock.propellantAfter};
 return {definition:d,view,work,sample,accounts,recoveries,spent,stack,upper,outbound,parking,descent,ascent,returning,boosterAir,boosterEntry,orbiterEntry,capture,dock,separations};
}
