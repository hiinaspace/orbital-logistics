import {Runner} from '../sim/runner';
import {validateBundle,type Scenario,type Port,type ThrustArc,type State,type Vec3} from '../sim/schema';
import {bodyState,bodyAcceleration,derivative} from '../sim/dynamics';
import {portState,surfaceNormal} from '../sim/logistics';
import {paidCapture} from '../sim/capture';
import {dot} from '../sim/vectors';
import type {VesselView,ViewSample,ViewerEvent} from '../model-set/model';
import type {LibrationSchedule} from './query';
export interface CourierDefinition {id:string;name:string;color:string;pad:Port;ship:Scenario['ship'];period:number;launch:number;arrival:number;unload:number;departure:number;landing:number;refill:number;maxImport:number;arcs:ThrustArc[]}
const ok=(v:unknown,s:string)=>{if(!v)throw Error('Libration: '+s);};
export function prepareCourier(scenario:Scenario,stationValue:Port,value:CourierDefinition){
 const d=structuredClone(value),station=structuredClone(stationValue),s=structuredClone(scenario),moon=s.bodies[1],m=moon.rail,p=d.pad.rail,b=station.rail;
 ok(s.bodies.length===2&&s.bodies[0].rail.kind==='fixed'&&s.bodies[0].rail.position.every(x=>x===0)&&m.kind==='circular'&&m.center.every(x=>x===0)&&m.u.join(',')==='1,0,0'&&m.v.join(',')==='0,1,0','unsupported circular field');
 if(m.kind!=='circular'||p.kind!=='surface'||b.kind!=='circular')throw Error('Libration: provider kinds');
 ok(b.center.every(x=>x===0)&&b.u.join(',')===m.u.join(',')&&b.v.join(',')===m.v.join(',')&&b.rate===m.rate&&b.phase===m.phase&&b.radius>m.radius+moon.radius,'station geometry');
 const x=b.radius,n=m.rate,force=n*n*x-s.bodies[0].mu/x**2-moon.mu/(x-m.radius)**2;
 ok(Math.abs(force)<1e-12&&x-m.radius-moon.radius>.1,'actual-field equilibrium certificate');
 ok(p.bodyId===moon.id&&JSON.stringify(p.bodyRail)===JSON.stringify(m)&&p.latitude===0&&p.centerHeight===1e-5&&p.radius===moon.radius+1e-5&&p.rate===m.rate&&p.phase===m.phase&&p.center.every(x=>x===0)&&p.u.join(',')===m.u.join(',')&&p.v.join(',')===m.v.join(','),'courier support');
 ok([d.period,d.launch,d.arrival,d.unload,d.departure,d.landing,d.refill,d.maxImport].every(Number.isFinite)&&0<d.launch&&d.launch<d.arrival&&d.arrival<d.unload&&d.unload<d.departure&&d.departure<d.landing&&d.landing<d.refill&&d.refill<d.period&&d.period===32,'timetable');
 ok(d.pad.cargo===0&&d.pad.propellant===0&&d.pad.cargoCapacity===1&&d.pad.tankCapacity===d.maxImport,'ground supply ownership');
 ok(d.id===d.ship.id&&d.id&&d.name&&/^#[0-9a-f]{6}$/i.test(d.color)&&d.ship.dryMass>0&&d.ship.cargoMass===.15&&d.ship.propellant===6&&d.ship.tankCapacity===6&&d.ship.exhaustVelocity===4&&d.ship.engine?.maxAcceleration===1.2&&d.ship.engine.maxThrust===16&&d.maxImport<=3&&d.maxImport>0,'hardware/loadout');
 ok(d.arcs.length===4&&d.arcs.every(a=>a.throttle===1&&a.steering?.keys.length===3)&&new Set(d.arcs.map(a=>a.id)).size===4&&d.arcs[0].start===d.launch&&d.arcs[1].end===d.arrival&&d.arcs[2].start===d.departure&&d.arcs[3].end===d.landing&&d.arcs[0].end<d.arcs[1].start&&d.arcs[2].end<d.arcs[3].start,'control family');
 const step=1/2048,ship={...structuredClone(d.ship),state:portState(d.pad,0)};
 ok(Math.max(...ship.state.map((v,i)=>Math.abs(v-d.ship.state[i])))<1e-12,'initial support');
 const make=(start:number,end:number,state:State,fuel:number,cargo:number,arcs:ThrustArc[])=>{
  const world=structuredClone(s);world.bodies[0].radius+=.2;delete world.logistics;delete world.rendezvous;
  const raw={...world,epoch:start,duration:Math.ceil((end-start)/step)*step,policy:{step,maxNodes:32768,maxSubdivision:20},ship:{...ship,state,propellant:fuel,cargoMass:cargo}};
  const bundle=validateBundle({scenario:raw,program:{schemaVersion:4,id:d.id+':leg:'+start,burns:[],thrustArcs:arcs}});
  const r=new Runner(bundle,{maxNodeStorageBytes:12_000_000}),last=r.advanceTo(end);
  ok(last.status==='horizon'||last.status==='running','flight '+last.status+' '+last.detail);
  return r;
 };
 const release=d.arcs[0],initial=portState(d.pad,d.launch),normal=surfaceNormal(d.pad,d.launch),g=derivative(s,d.launch,initial).slice(3),ca=bodyAcceleration(moon,d.launch);
 ok(dot(g.map((x,i)=>x-ca[i]+1.2*release.direction[i]) as Vec3,normal)>0,'outward release');
 const outbound=make(d.launch,d.arrival,initial,ship.propellant,ship.cargoMass,d.arcs.slice(0,2)),before=outbound.sample(d.arrival);
 const capture=paidCapture(before.y,portState(station,d.arrival),{...ship,propellant:before.propellant},{position:2e-6,velocity:2e-6},station.id);
 ok(capture.positionError+5e-7<2e-6&&capture.deltaV+5e-7<2e-6,'station capture margin');
 const returning=make(d.departure,d.landing,portState(station,d.departure),capture.propellantAfter,0,d.arcs.slice(2)),incoming=returning.sample(d.landing);
 const landing=paidCapture(incoming.y,portState(d.pad,d.landing),{...ship,cargoMass:0,propellant:incoming.propellant},{position:2e-6,velocity:2e-6},d.pad.id);
 ok(landing.positionError+5e-7<2e-6&&landing.deltaV+5e-7<2e-6,'surface capture margin');
 const spent=ship.propellant-landing.propellantAfter;
 ok(spent>0&&spent<=d.maxImport&&landing.propellantAfter>.5,'funded turnaround');
 const support=(t:number,port:Port,fuel:number,cargo:number):ViewSample=>({t,y:portState(port,t),propellant:fuel,fuelUsed:ship.propellant-fuel,mass:ship.dryMass+cargo+fuel,burnCursor:0,status:'running',detail:'',...(port.rail.kind==='surface'?{axis:surfaceNormal(port,t)}:{}),logistics:{operationCursor:0,cargoMass:cargo,fuelUsed:ship.propellant-fuel,ports:[],dockedPortId:port.id},activity:{kind:'waiting'}});
 const sample=(t:number,left=false):ViewSample=>{
  ok(Number.isFinite(t)&&t>=0&&t<=d.period,'canonical query interval');
  let q:ViewSample;
  if(t<d.launch||left&&t===d.launch)q=support(t,d.pad,ship.propellant,ship.cargoMass);
  else if(t<d.arrival||left&&t===d.arrival)q=outbound.sample(t);
  else if(t<d.departure||left&&t===d.departure)q=support(t,station,capture.propellantAfter,t<d.unload||left&&t===d.unload?ship.cargoMass:0);
  else if(t<d.landing||left&&t===d.landing)q=returning.sample(t);
  else q=support(t,d.pad,t<d.refill||left&&t===d.refill?landing.propellantAfter:ship.propellant,t<d.refill||left&&t===d.refill?0:ship.cargoMass);
  q.fuelUsed=t>d.refill||t===d.refill&&!left?spent:ship.propellant-q.propellant;
  if(!q.logistics){const cargo=t<d.departure?ship.cargoMass:0;q.logistics={operationCursor:0,cargoMass:cargo,fuelUsed:q.fuelUsed,ports:[]};q.activity={kind:'flying'};q.mass=ship.dryMass+cargo+q.propellant;}
  q.logistics.fuelUsed=q.fuelUsed;
  return q;
 };
 const event=(t:number,kind:ViewerEvent['kind'],id:string,extra:Partial<ViewerEvent>={}):ViewerEvent=>{
  const before=sample(t,true),after=sample(t);return {t,kind,id,deltaV:0,fuelUsed:Math.max(0,before.propellant-after.propellant),propellantBefore:before.propellant,propellantAfter:after.propellant,...extra};
 };
 const ledger:ViewerEvent[]=[...outbound.ledger,...returning.ledger,event(0,'dock','supported',{portId:d.pad.id}),event(d.launch,'launch','launch',{portId:d.pad.id}),event(d.arrival,'dock','station-capture',{portId:station.id,positionError:capture.positionError,deltaV:capture.deltaV}),event(d.unload,'transfer','relay-parcels',{portId:station.id,detail:'Relay consumed '+ship.cargoMass+' delivered parcels'}),event(d.departure,'undock','departure',{portId:station.id}),event(d.landing,'land','surface-capture',{portId:d.pad.id,positionError:landing.positionError,deltaV:landing.deltaV}),event(d.refill,'transfer','ground-supply',{portId:d.pad.id,detail:'Ground imported '+spent.toFixed(6)+' propellant and '+ship.cargoMass+' parcels'})].sort((a,b)=>a.t-b.t);
 const cuts=[...new Set([0,d.period,...ledger.map(e=>e.t),...d.arcs.flatMap(a=>a.steering!.keys.map(k=>a.start+k.offset))])].sort((a,b)=>a-b);
 const times=new Set(cuts);for(let t=0;t<d.period;t+=1/32)times.add(t);
 for(const [start,end] of [[d.launch,d.arcs[0].end],[d.arcs[1].start,d.arrival],[d.departure,d.arcs[2].end],[d.arcs[3].start,d.landing]])for(let i=0,count=Math.ceil((end-start)*512);i<=count;i++)times.add(start+(end-start)*i/count);
 const samples=[...times].sort((a,b)=>a-b).map(t=>sample(t)),boundaries=[0,d.launch,d.arrival,d.unload,d.departure,d.landing,d.refill,d.period].map(t=>({t,before:sample(t,true),after:sample(t)}));
 const template:VesselView={id:d.id,name:d.name,color:d.color,cargo:'Relay parcels',cargoCapacity:ship.cargoMass,ship,ports:[d.pad,station],portSamples:{},arcs:d.arcs,glyph:'rocket',continuousFuel:true,interpolation:'hermite',samples,ledger,boundaries};
 const schedule:LibrationSchedule={period:d.period,rate:m.rate,spent,parcel:ship.cargoMass,maxEpoch:1_000_000,boundaries:cuts};
 const work={nodes:outbound.retainedTreeNodes+returning.retainedTreeNodes,physicsBytes:outbound.treeStorageBytes()+returning.treeStorageBytes(),drawingBytes:new TextEncoder().encode(JSON.stringify(template)).byteLength};
 ok(work.nodes<50000&&work.physicsBytes<20_000_000&&work.drawingBytes<2_000_000,'courier cache budget '+JSON.stringify(work));
 return {definition:structuredClone(d),template,schedule,sample,outbound,returning,capture,landing,work,equilibriumResidual:force};
}
