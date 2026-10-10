import {validateBundle,type Scenario,type State,type Vec3,type ThrustArc} from '../sim/schema';
import {portState} from '../sim/logistics';
import {derivative} from '../sim/dynamics';
import {paidCapture} from '../sim/capture';
import {norm,dot,scale,subtract} from '../sim/vectors';
import {directionAt} from '../sim/steering';
import {prepareAtmosphericLeg,atmosphericStateAt,atmosphericForces,type AtmosphericRun} from '../sim/atmospheric-propulsion';
import {entryForces,recoveredState,type EntryState} from '../sim/entry';
import {prepareEntry,validateEntry,entryStateAt,type EntryFlight,type EntryResult} from './entry';
import {setEvents,stockAt,type SceneView,type VesselView,type ViewSample,type ViewerEvent} from './model';
import type {StagedFlight} from './staging';

export interface AtmosphericMission extends Omit<StagedFlight,'modelVersion'> {
 modelVersion:'atmospheric-mission-v1'|'atmospheric-mission-v2';atmosphere:EntryFlight['atmosphere'];ascentAero:EntryFlight['aero'];entryAero:EntryFlight['aero'];
 guidance:EntryFlight['guidance'];recovery:EntryFlight['recovery'];limits:EntryFlight['limits'];heatScale:number;
 entryStarts:{booster:number;payload:number};
}
export const isAtmosphericMission=(v:unknown):v is AtmosphericMission=>!!v&&typeof v==='object'&&['atmospheric-mission-v1','atmospheric-mission-v2'].includes((v as AtmosphericMission).modelVersion);
const ok=(test:unknown,message:string)=>{if(!test)throw new Error('Atmospheric mission: '+message);};
const keys=(o:object,allowed:string[])=>ok(!!o&&Object.keys(o).every(k=>allowed.includes(k)),'unknown physical field');
const shipFields=['id','name','color','dryMass','propellant','tankCapacity','exhaustVelocity','engine'];
function entryDefinition(d:AtmosphericMission,ship:Scenario['ship'],duration=8):EntryFlight {
 const {logistics:_logistics,rendezvous:_rendezvous,...world}=d.world;
 return {kind:'entry-flight-v1',schemaVersion:1,modelVersion:d.modelVersion==='atmospheric-mission-v2'?'entry-rk4-v2':'entry-rk4-v1',id:ship.id+'-entry',name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,
  scenario:{...world,epoch:0,duration,ship},atmosphere:d.atmosphere,aero:d.entryAero,guidance:d.guidance,recovery:d.recovery,limits:d.limits,presentation:{name:ship.id,color:'#85c9c0',heatScale:d.heatScale},rotating:d.rotating};
}
export function validateAtmosphericMission(value:unknown):AtmosphericMission {
 ok(isAtmosphericMission(value)&&(value as AtmosphericMission).schemaVersion===1,'unsupported version');
 const d=structuredClone(value as AtmosphericMission),spatial=d.modelVersion==='atmospheric-mission-v2';
 keys(d,['schemaVersion','modelVersion','id','name','extent','description','provenance','stations','rotating','world','separation','booster','payload','stack','programs','atmosphere','ascentAero','entryAero','guidance','recovery','limits','heatScale','entryStarts']);
 keys(d.booster,shipFields);keys(d.payload,[...shipFields,'cargoMass']);keys(d.stack,['id','name','color']);keys(d.separation,['id','t']);keys(d.entryStarts,['booster','payload']);keys(d.programs,['stack','booster','payload']);
 keys(d.world,['schemaVersion','modelVersion','id','units','epoch','duration','policy','bodies','logistics']);
 const w=d.world,ports=w.logistics?.ports??[],pad=ports.find(p=>p.rail.kind==='surface'),depot=ports.find(p=>p.rail.kind==='circular');
 ok(w.epoch===0&&w.duration<=16&&w.duration>=1&&w.policy.step>=1/4096&&w.policy.step<=1/512&&w.policy.maxNodes<=32768,'world/work budget');
 ok(w.bodies.length===1&&w.bodies[0].rail.kind==='fixed'&&ports.length===2&&pad&&depot,'one fixed primary, pad and circular station required');
 keys(w.logistics!,['modelVersion','ports','cargoCapacity','capture','objective']);
 for(const p of ports){keys(p,['id','rail','cargo','cargoCapacity','propellant','tankCapacity','serviceDuration']);keys(p.rail,['kind','bodyId','centerHeight','center','u','v','radius','rate','phase',...(spatial&&p.rail.kind==='surface'?['latitude']:[])]);}
 const body=w.bodies[0],center=body.rail.kind==='fixed'?body.rail.position:[0,0,0] as Vec3;
 ok(pad!.rail.kind==='surface'&&pad!.rail.rate===d.atmosphere.spin[2]&&(spatial||pad!.rail.phase===Math.PI/2)&&pad!.rail.centerHeight===d.recovery.height&&pad!.rail.radius===body.radius+pad!.rail.centerHeight,'pad/air/water support mismatch');
 ok(depot!.rail.kind==='circular'&&depot!.rail.radius>body.radius+d.atmosphere.topHeight&&JSON.stringify(depot!.rail.center)===JSON.stringify(center),'station must clear atmosphere');
 ok(d.stations.length===2&&new Set(d.stations.map(s=>s.id)).size===2&&d.stations.every(s=>ports.some(p=>p.id===s.id)&&s.berths===1),'invalid berths');
 const ids=[d.stack.id,d.booster.id,d.payload.id];ok(new Set(ids).size===3&&ids.every(id=>id&&!ports.some(p=>p.id===id)&&id!==body.id),'invalid vehicle identities');
 for(const h of [d.stack,d.booster,d.payload])ok(h.name&&/^#[0-9a-f]{6}$/i.test(h.color),'invalid presentation');
 // Reuse strict atmospheric admission and legacy hardware/rail sanitation.
 for(const h of [d.booster,d.payload]){
  keys(h.engine!,['maxThrust','maxAcceleration']);
  const ship={id:h.id,dryMass:h.dryMass,cargoMass:h===d.payload?d.payload.cargoMass:0,propellant:h.propellant,tankCapacity:h.tankCapacity,exhaustVelocity:h.exhaustVelocity,engine:h.engine,state:[center[0]+body.radius+d.atmosphere.topHeight+.1,center[1],center[2],0,0,0] as State};
  validateEntry(entryDefinition(d,ship));validateEntry({...entryDefinition(d,ship),aero:d.ascentAero});
 }
 ok(center.every(v=>v===0)&&d.ascentAero.liftToDrag===0,'fixed origin and ascent without lift required');
 ok(!spatial||w.logistics!.modelVersion==='surface-ports-v5'&&pad!.rail.kind==='surface'&&pad!.rail.latitude!==undefined,'spatial mission requires latitude-aware surface support');
 for(const [key,h] of [['stack',d.booster],['booster',d.booster],['payload',d.payload]] as const){
  const p=d.programs[key];ok(p.schemaVersion===4&&p.burns.length===0,'steered finite program required');
  const validated=validateBundle({scenario:{...w,ship:{...h,state:portState(pad!,0),cargoMass:key==='booster'?0:d.payload.cargoMass}},program:p});
  d.programs[key]=validated.program;
  ok(p.thrustArcs!.every(a=>a.steering)&&(spatial||p.thrustArcs!.every(a=>a.direction[2]===0&&a.steering?.keys.every(k=>k.direction[2]===0))),'out-of-plane thrust requires spatial mission version');
 }
 const a=d.programs.stack.thrustArcs!,b=d.programs.booster.thrustArcs!,u=d.programs.payload.thrustArcs!,ops=d.programs.payload.operations!;
 ok(a.length===1&&a[0].end===d.separation.t&&a[0].throttle>0&&a[0].start>0,'one launch arc ending at separation required');
 ok(b.length===1&&b[0].start===d.separation.t&&b[0].end===d.entryStarts.booster&&d.programs.booster.operations!.length===0,'one boostback followed by recovery required');
 ok(u.length===2&&u[0].start===d.separation.t&&u[1].end===d.entryStarts.payload,'insertion and deorbit required');
 ok(ops.length===3&&ops[0].kind==='dock'&&ops[1].kind==='transfer'&&ops[2].kind==='undock'&&ops.every(o=>o.portId===depot!.id)&&ops[0].t===ops[1].t&&ops[0].t>u[0].end&&ops[2].t>=ops[1].t+depot!.serviceDuration&&ops[2].t===u[1].start&&ops[1].cargo===-d.payload.cargoMass&&ops[1].propellant===0,'one finite delivery and return required');
 ok(pad!.rail.kind==='surface'&&pad!.rail.bodyId===body.id&&JSON.stringify(pad!.rail.center)===JSON.stringify(center)&&JSON.stringify(pad!.rail.u)==='[1,0,0]'&&JSON.stringify(pad!.rail.v)==='[0,1,0]','unsupported pad frame');
 const lowerOps=d.programs.stack.operations!;
 ok(lowerOps.length===2&&lowerOps[0].kind==='dock'&&lowerOps[0].t===0&&lowerOps[1].kind==='launch'&&lowerOps[1].t===a[0].start&&lowerOps.every(o=>o.portId===pad!.id),'supported launch required');
 ok([d.entryStarts.booster,d.entryStarts.payload].every(t=>Number.isFinite(t)&&t>0&&t<w.duration),'invalid recovery handoffs');
 return d;
}
export interface AtmosphericMissionRun {
 definition:AtmosphericMission;stack:AtmosphericRun;boostback:AtmosphericRun;insertion:AtmosphericRun;deorbit:AtmosphericRun;
 boosterEntry:EntryResult;payloadEntry:EntryResult;capture:ReturnType<typeof paidCapture>;view:SceneView;
 work:{nodes:number;trials:number;evaluations:number;roots:number;displaySamples:number;bytes:number};
}
export function prepareAtmosphericMission(value:unknown):AtmosphericMissionRun {
 const d=validateAtmosphericMission(value),w=d.world,ports=w.logistics!.ports,pad=ports.find(p=>p.rail.kind==='surface')!,depot=ports.find(p=>p.rail.kind==='circular')!,split=d.separation.t,end=w.duration;
 const hardware=(h:AtmosphericMission['booster'],z:EntryState,cargo:number):Scenario['ship']=>({id:h.id,dryMass:h.dryMass,cargoMass:cargo,propellant:z[6],tankCapacity:h.tankCapacity,exhaustVelocity:h.exhaustVelocity,engine:h.engine,state:z.slice(0,6) as State});
 const leg=(ship:Scenario['ship'],start:number,end:number,arcs:ThrustArc[])=>prepareAtmosphericLeg({scenario:{...w,logistics:undefined,ship},atmosphere:d.atmosphere,aero:d.ascentAero,start,end,arcs});
 const boost=d.programs.stack.thrustArcs![0],launch=boost.start,initial=[...portState(pad,launch),d.booster.propellant] as EntryState;
 const parentShip={...hardware(d.booster,initial,d.payload.cargoMass),id:d.stack.id,dryMass:d.booster.dryMass+d.payload.dryMass+d.payload.propellant};
 const release=atmosphericForces({scenario:{...w,ship:parentShip},atmosphere:d.atmosphere,aero:d.ascentAero,start:launch,end:split,arcs:[boost]},launch,initial,boost),p=initial.slice(0,3).map((x,i)=>x-(w.bodies[0].rail as {position:Vec3}).position[i]) as Vec3,normal=scale(p,1/norm(p)),velocity=initial.slice(3,6) as Vec3;
 const g=derivative({...w,ship:parentShip},launch,initial.slice(0,6) as State).slice(3) as Vec3;
 const radialAcceleration=dot(g,normal)+dot(release.aero.drag.map((x,i)=>x+release.aero.lift[i]+release.force*release.direction[i]) as Vec3,normal)/release.mass+(norm(velocity)**2-dot(velocity,normal)**2)/norm(p);
 ok(radialAcceleration>1e-6,'insufficient outward launch force');
 const stack=leg(parentShip,launch,split,[boost]),separated=atmosphericStateAt(stack,split);
 const boostback=leg(hardware(d.booster,separated,0),split,d.entryStarts.booster,d.programs.booster.thrustArcs!);
 const upperInitial=[...separated.slice(0,6),d.payload.propellant] as EntryState;
 const arrival=d.programs.payload.operations![0].t,departure=d.programs.payload.operations![2].t,unloaded=arrival+depot.serviceDuration;
 const insertion=leg(hardware(d.payload,upperInitial,d.payload.cargoMass),split,arrival,[d.programs.payload.thrustArcs![0]]);
 const incoming=atmosphericStateAt(insertion,arrival),target=portState(depot,arrival);
 const capture=paidCapture(incoming.slice(0,6) as State,target,hardware(d.payload,incoming,d.payload.cargoMass),w.logistics!.capture,'Lantern');
 // Independent convergence allowance is part of admission, not a free capture.
 ok(capture.positionError+1e-8<w.logistics!.capture.position&&capture.deltaV+1e-8<w.logistics!.capture.velocity,'capture numerical margin exhausted');
 const departing=[...portState(depot,departure),capture.propellantAfter] as EntryState;
 const deorbit=leg(hardware(d.payload,departing,0),departure,d.entryStarts.payload,[d.programs.payload.thrustArcs![1]]);
 // Local entry clocks are allowed only for the validated autonomous fixed world.
 // The adapter shifts every public event, pose and phase threshold atomically.
 const recovery=(h:AtmosphericMission['booster'],run:AtmosphericRun,cargo:number)=>{
  const t=run.definition.end,z=atmosphericStateAt(run,t),duration=Math.floor(Math.min(8,end-t)/w.policy.step)*w.policy.step;
  return prepareEntry(entryDefinition(d,hardware(h,z,cargo),duration),{displayRate:16});
 };
 const boosterEntry=recovery(d.booster,boostback,0),payloadEntry=recovery(d.payload,deorbit,0);
 const record=(r:EntryResult,offset:number)=>({recoveryEpoch:offset+r.contact.t,relativeSpeed:r.contact.relativeSpeed,waterEnergy:r.contact.waterEnergy,impulse:r.contact.impulse,maxima:r.maxima,work:r.work});
 const metadata=(r:EntryResult,offset:number)=>({physics:r.definition,recovery:{...r.contact.pose,t:r.contact.pose.t+offset},activeFrom:offset,entryEpoch:r.entryEpoch+offset,brakingEpoch:r.brakingEpoch+offset,heatScale:d.heatScale});
 const entrySample=(r:EntryResult,offset:number,t:number,before:boolean,cumulativeInitial:number,nonfuel:number):ViewSample=>{
  const local=Math.min(r.definition.scenario.duration,t-offset),z=entryStateAt(r,local,before),recovered=t>=offset+r.contact.t&&!before,f=entryForces(r.definition,local,z),meta=metadata(r,offset);
  return {t,y:recovered?recoveredState(meta.recovery,t):z.slice(0,6) as State,propellant:z[6],fuelUsed:cumulativeInitial-z[6],mass:nonfuel+z[6],burnCursor:0,status:'running',detail:'',axis:recovered?scale(subtract(recoveredState(meta.recovery,t).slice(0,3) as Vec3,meta.recovery.center),1/(w.bodies[0].radius+d.recovery.height)):f.axis,
   entryPhase:recovered?'recovered':t>=meta.brakingEpoch?'braking':t>=meta.entryEpoch?'entry':'coast',
   ...(recovered?{}:{aero:f.aero,...(norm(f.force)>0?{thrust:{id:'terminal-braking',force:norm(f.force),acceleration:norm(f.force)/f.mass,direction:scale(f.force,1/norm(f.force))}}:{})})};
 };
 const flightSample=(r:AtmosphericRun,t:number,before=false):ViewSample=>{
  const z=atmosphericStateAt(r,t),a=r.definition.arcs.find(a=>before?a.start<t&&t<=a.end:a.start<=t&&t<a.end),f=atmosphericForces(r.definition,t,z,a);
  return {t,y:z.slice(0,6) as State,propellant:z[6],fuelUsed:r.definition.scenario.ship.propellant-z[6],mass:f.mass,burnCursor:0,status:'running',detail:'',aero:f.aero,...(a?{axis:directionAt(a,t-a.start),thrust:{id:a.id,force:f.force,acceleration:f.acceleration,direction:f.direction}}:{})};
 };
  const logistics=(t:number,cargoMass:number,fuelUsed:number,dockedPortId?:string)=>({operationCursor:0,cargoMass,fuelUsed,ports:[],...(dockedPortId?{dockedPortId}:{}),...(t>=arrival&&t<unloaded&&dockedPortId===depot.id?{service:{id:'unload',portId:depot.id,end:unloaded,cargo:-d.payload.cargoMass,propellant:0}}:{})});
 const parentSample=(t:number,before=false):ViewSample=>{
  const s=t<launch||t===launch&&before?{t,y:portState(pad,t),propellant:d.booster.propellant,fuelUsed:0,mass:parentShip.dryMass+parentShip.cargoMass+d.booster.propellant,burnCursor:0,status:'running' as const,detail:'',axis:scale(portState(pad,t).slice(0,3) as Vec3,1/(w.bodies[0].radius+d.recovery.height))}:flightSample(stack,t,before);
  s.logistics=logistics(t,d.payload.cargoMass,s.fuelUsed!,t<launch||t===launch&&before?pad.id:undefined);return s;
 };
 const lowerSample=(t:number,before=false):ViewSample=>{
  const s=t<d.entryStarts.booster||t===d.entryStarts.booster&&before?flightSample(boostback,t,before):entrySample(boosterEntry,d.entryStarts.booster,t,before,separated[6],d.booster.dryMass);
  s.fuelUsed=separated[6]-s.propellant;s.logistics=logistics(t,0,s.fuelUsed);return s;
 };
 const upperSample=(t:number,before=false):ViewSample=>{
  const cargo=t<unloaded||t===unloaded&&before?d.payload.cargoMass:0;
  let s:ViewSample;
  if(t<arrival||t===arrival&&before)s=flightSample(insertion,t,before);
  else if(t<departure||t===departure&&before)s={t,y:portState(depot,t),propellant:capture.propellantAfter,mass:d.payload.dryMass+cargo+capture.propellantAfter,burnCursor:0,status:'running',detail:''};
  else if(t<d.entryStarts.payload||t===d.entryStarts.payload&&before)s=flightSample(deorbit,t,before);
  else s=entrySample(payloadEntry,d.entryStarts.payload,t,before,d.payload.propellant,d.payload.dryMass);
  s.fuelUsed=d.payload.propellant-s.propellant;s.logistics=logistics(before?t-1e-10:t,cargo,s.fuelUsed,t>arrival&&t<departure||t===arrival&&!before||t===departure&&before?depot.id:undefined);return s;
 };
 const event=(t:number,kind:ViewerEvent['kind'],id:string,sample:(t:number,before?:boolean)=>ViewSample,extra:Partial<ViewerEvent>={}):ViewerEvent=>{
  const before=sample(t,true),after=sample(t);return {t,kind,id,deltaV:0,fuelUsed:before.propellant-after.propellant,propellantBefore:before.propellant,propellantAfter:after.propellant,...extra};
 };
 const arcEvents=(r:AtmosphericRun,sample:(t:number,before?:boolean)=>ViewSample)=>r.definition.arcs.flatMap(a=>{
  const before=atmosphericStateAt(r,a.start)[6],after=atmosphericStateAt(r,a.end)[6],nonfuel=r.definition.scenario.ship.dryMass+r.definition.scenario.ship.cargoMass;
  return [event(a.start,'thrust-start',a.id,sample),event(a.end,'thrust-end',a.id,sample,{fuelUsed:before-after,deltaV:r.definition.scenario.ship.exhaustVelocity*Math.log((nonfuel+before)/(nonfuel+after)),propellantBefore:before,propellantAfter:after})];
 });
 const entryEvents=(r:EntryResult,offset:number)=>r.view.vessels[0].ledger.map(e=>({...e,t:e.t+offset,...(e.kind==='splashdown'?{id:'ocean-recovery'}:{})}));
 const parentEvents=[event(0,'dock','on-pad',parentSample,{portId:pad.id}),event(launch,'launch','lift-off',parentSample,{portId:pad.id}),...arcEvents(stack,parentSample),event(split,'separation',d.separation.id,parentSample,{detail:d.booster.name+' + '+d.payload.name})];
 const lowerEvents=[...arcEvents(boostback,lowerSample),...entryEvents(boosterEntry,d.entryStarts.booster)];
 const upperEvents=[...arcEvents(insertion,upperSample),event(arrival,'dock','delivery-arrival',upperSample,{portId:depot.id,positionError:capture.positionError,deltaV:capture.deltaV,fuelUsed:capture.fuelUsed}),event(arrival,'transfer-start','unload',upperSample,{portId:depot.id}),event(unloaded,'transfer','unload',upperSample,{portId:depot.id,cargoBefore:d.payload.cargoMass,cargoAfter:0}),event(departure,'undock','return-departure',upperSample,{portId:depot.id}),...arcEvents(deorbit,upperSample),...entryEvents(payloadEntry,d.entryStarts.payload)];
 const make=(h:AtmosphericMission['stack'],ship:Scenario['ship'],range:[number,number],free:[number,number][],sample:(t:number,before?:boolean)=>ViewSample,events:ViewerEvent[],arcs:ThrustArc[]):VesselView=>{
  const times=new Set([range[0],range[1],...events.map(e=>e.t),...arcs.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset))]);
  for(let t=range[0];t<range[1];t+=1/16)times.add(t);
  for(const [a,b] of free){const n=Math.ceil((b-a)*2048);for(let i=0;i<=n;i++)times.add(a+(b-a)*i/n);}
  const ordered=[...times].sort((a,b)=>a-b),boundaries=[...new Set(events.map(e=>e.t))].map(t=>({t,before:sample(t,true),after:sample(t)}));
  return {...h,ship,ports,cargo:'Freight',cargoCapacity:ship.cargoMass,glyph:'rocket',continuousFuel:true,portSamples:{},arcs,samples:ordered.map(t=>{const s=sample(t);delete s.aero;return s;}),ledger:events,boundaries,lifetime:{start:range[0],end:range[1],...(h.id===d.stack.id?{retired:true}:{parentId:d.stack.id})},aerodynamics:{scenario:{...w,ship},atmosphere:d.atmosphere,aero:d.ascentAero}};
 };
 const parent=make(d.stack,parentShip,[0,split],[[launch,split]],parentSample,parentEvents,[boost]);parent.glyph='stack';parent.initialAxis=boost.direction;
 const lower=make(d.booster,hardware(d.booster,separated,0),[split,end],[[split,d.entryStarts.booster+boosterEntry.contact.t]],lowerSample,lowerEvents,d.programs.booster.thrustArcs!);lower.entry=metadata(boosterEntry,d.entryStarts.booster);lower.inheritedFuelUsed=d.booster.propellant-separated[6];
 const upper=make(d.payload,hardware(d.payload,upperInitial,d.payload.cargoMass),[split,end],[[split,arrival],[departure,d.entryStarts.payload+payloadEntry.contact.t]],upperSample,upperEvents,d.programs.payload.thrustArcs!);upper.entry=metadata(payloadEntry,d.entryStarts.payload);
 const beforeMass=parentShip.dryMass+parentShip.cargoMass+separated[6],afterMass=d.booster.dryMass+separated[6]+d.payload.dryMass+d.payload.cargoMass+d.payload.propellant;
 ok(Math.abs(beforeMass-afterMass)<1e-12,'separation mass mismatch');
 const momentum=separated.slice(3,6).map(v=>v*beforeMass);
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:d.stations,rotating:d.rotating,vessels:[parent,lower,upper],portSamples:{},world:{bodies:w.bodies,ports,units:w.units},window:{start:0,end},atmosphere:d.atmosphere,
  recoveries:{[lower.id]:record(boosterEntry,d.entryStarts.booster),[upper.id]:record(payloadEntry,d.entryStarts.payload)},
  staging:{initialFuel:d.booster.propellant+d.payload.propellant,separation:{t:split,parentId:parent.id,children:[lower.id,upper.id],state:separated.slice(0,6) as State,beforeMass,afterMass,momentumBefore:momentum,momentumAfter:separated.slice(3,6).map(v=>v*afterMass),reservedPayloadFuel:d.payload.propellant,boosterFuel:separated[6]}}};
 for(const t of new Set(setEvents(view).map(e=>e.t)))for(const stock of stockAt(view,t)){const p=ports.find(p=>p.id===stock.id)!;ok(stock.cargo>=-1e-12&&stock.cargo<=p.cargoCapacity&&stock.propellant>=0&&stock.propellant<=p.tankCapacity&&stock.occupied>=0&&stock.occupied<=1,'shared inventory/berth exceeded');}
 const legs=[stack,boostback,insertion,deorbit],entries=[boosterEntry,payloadEntry],work={nodes:legs.reduce((n,r)=>n+r.nodes.length,0)+entries.reduce((n,r)=>n+r.nodes.length,0),trials:legs.reduce((n,r)=>n+r.work.trials,0)+entries.reduce((n,r)=>n+r.work.trials,0),evaluations:legs.reduce((n,r)=>n+r.work.evaluations,0)+entries.reduce((n,r)=>n+r.work.evaluations,0),roots:entries.reduce((n,r)=>n+r.work.roots,0),displaySamples:view.vessels.reduce((n,v)=>n+v.samples.length,0),bytes:new TextEncoder().encode(JSON.stringify(view)).byteLength};
 ok(work.nodes<=65536&&work.trials<=524288&&work.evaluations<=2097152&&work.displaySamples<=40000&&work.bytes<=12000000,'aggregate storage/work budget exceeded: '+JSON.stringify(work));
 for(const r of [...legs,...entries])ok(r.maxima.pressure<=d.limits.dynamicPressure&&r.maxima.acceleration<=d.limits.acceleration&&r.maxima.heat<=d.limits.heatProxy,'atmospheric load limit exceeded');
 return {definition:d,stack,boostback,insertion,deorbit,boosterEntry,payloadEntry,capture,view,work};
}
