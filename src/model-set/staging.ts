import {Runner,type Sample} from '../sim/runner';
import {portState} from '../sim/logistics';
import {validateBundle,type Scenario,type Program,type Bundle} from '../sim/schema';
import {setEvents,stockAt,type SceneView,type VesselView,type ViewerEvent} from './model';

interface Hardware extends Omit<Scenario['ship'],'state'|'cargoMass'> {name:string;color:string}
export interface StagedFlight {
 schemaVersion:1;modelVersion:'staged-flight-v1';id:string;name:string;extent:number;description:string;provenance:string;
 stations:SceneView['stations'];rotating:SceneView['rotating'];world:Omit<Scenario,'ship'>;
 separation:{id:string;t:number};booster:Hardware;payload:Hardware&{cargoMass:number};
 stack:{id:string;name:string;color:string};programs:{stack:Program;booster:Program;payload:Program};
}
export const isStaged=(value:unknown):value is StagedFlight=>!!value&&typeof value==='object'&&(value as StagedFlight).modelVersion==='staged-flight-v1';
const clone=<T>(v:T):T=>structuredClone(v);
const ok=(condition:unknown,message:string):void=>{if(!condition)throw new Error(`Staged flight: ${message}`);};
const viable=(s:Sample)=>s.status==='running'||s.status==='horizon';
const mass=(b:Bundle,s:Sample)=>b.scenario.ship.dryMass+(s.logistics?.cargoMass??b.scenario.ship.cargoMass)+s.propellant;

// Separate domain: a legacy Bundle cannot silently discard separation intent.
export function validateStaged(value:unknown):StagedFlight {
 ok(isStaged(value)&&(value as StagedFlight).schemaVersion===1,'unsupported version');
 const d=clone(value as StagedFlight);
 ok(d.world&&d.separation&&d.stack&&d.booster&&d.payload&&d.programs,'missing assembly');
 ok(typeof d.id==='string'&&!!d.id&&typeof d.name==='string'&&!!d.name&&Number.isFinite(d.extent)&&d.extent>0,'invalid presentation');
 ok(typeof d.description==='string'&&typeof d.provenance==='string'&&Number.isFinite(d.rotating?.rate)&&Number.isFinite(d.rotating?.phase),'invalid metadata');
 ok(!('ship' in d.world)&&!d.world.rendezvous,'world must not own a second vehicle');
 const ports=d.world.logistics?.ports??[],pad=ports.find(p=>p.rail.kind==='surface');
 ok(ports.length===2&&pad&&ports.every(p=>p.rail.kind==='surface'||p.rail.kind==='circular'),'one analytical pad/depot required');
 ok(d.world.bodies.length===1&&d.world.bodies[0].rail.kind==='fixed','one fixed primary required');
 ok(d.world.epoch===0&&d.world.duration<=8,'finite mission must start at zero and fit eight time units');
 const split=d.separation.t,end=d.world.epoch+d.world.duration;
 ok(typeof d.separation.id==='string'&&!!d.separation.id&&Number.isFinite(split)&&split>0&&split<end,'invalid separation epoch');
 ok(Object.keys(d.separation).sort().join(',')==='id,t','separation kicks/unknown fields unsupported');
 for(const h of [d.booster,d.payload])ok(!('state' in h),'child states must derive from separation');
 ok(!('cargoMass' in d.booster),'booster cannot own duplicate freight');
 const ids=[d.stack.id,d.booster.id,d.payload.id];
 ok(new Set(ids).size===3&&ids.every(id=>typeof id==='string'&&!!id&&!ports.some(p=>p.id===id)&&!d.world.bodies.some(b=>b.id===id)),'invalid vehicle identities');
 for(const h of [d.stack,d.booster,d.payload])ok(typeof h.name==='string'&&!!h.name&&/^#[0-9a-f]{6}$/i.test(h.color),'invalid vehicle presentation');
 ok(Array.isArray(d.stations)&&d.stations.length===ports.length&&new Set(d.stations.map(s=>s.id)).size===ports.length&&d.stations.every(s=>ports.some(p=>p.id===s.id)&&s.berths===1),'invalid berths');
 ok(d.world.policy.step>=1/4096,'physical storage budget exceeded');
 for(const p of Object.values(d.programs))ok(p?.schemaVersion===4&&Array.isArray(p.burns)&&p.burns.length===0&&Array.isArray(p.thrustArcs)&&Array.isArray(p.operations),'finite steered programs required');
 ok(Object.keys(d.programs).sort().join(',')==='booster,payload,stack','exactly three programs required');
 ok(d.programs.stack.thrustArcs!.every(a=>a.end<=split)&&d.programs.stack.thrustArcs!.some(a=>a.end===split)&&d.programs.stack.operations!.every(o=>o.t<split&&o.kind!=='transfer'),'stack cannot burn/service across separation');
 ok(d.programs.stack.operations!.filter(o=>o.kind==='dock').length===1&&d.programs.stack.operations!.some(o=>o.kind==='dock'&&o.t===0&&o.portId===pad!.id)&&d.programs.stack.operations!.filter(o=>o.kind==='launch').length===1,'supported stack departure required');
 for(const p of [d.programs.booster,d.programs.payload])ok(p.thrustArcs!.every(a=>a.start>=split)&&p.operations!.every(o=>o.t>=split),'child program before birth');
 ok(d.programs.booster.operations!.every(o=>o.kind==='land'&&o.portId===pad!.id)&&d.programs.booster.operations!.length===1,'one booster recovery required');
 const depot=ports.find(p=>p.id!==pad!.id)!;
 ok(d.programs.payload.operations!.length===2&&d.programs.payload.operations![0].kind==='dock'&&d.programs.payload.operations![0].portId===depot.id&&d.programs.payload.operations![1].kind==='transfer'&&d.programs.payload.operations![1].portId===depot.id&&d.programs.payload.operations![1].cargo===-d.payload.cargoMass&&d.programs.payload.operations![1].propellant===0,'one freight delivery required');
 // Hardware is checked separately: reserved upper-stage fuel is not available
 // to the lower engine, and cannot evade its own tank validation as ballast.
 for(const h of [d.booster,d.payload])validateBundle({scenario:{...d.world,ship:{...h,state:portState(pad!,0),cargoMass:h===d.payload?d.payload.cargoMass:0}},program:{schemaVersion:4,id:'hardware-validation',burns:[],thrustArcs:[],operations:[]}});
 validateBundle(stackBundle(d));
 return d;
}
export function stackBundle(d:StagedFlight):Bundle {
 const pad=d.world.logistics!.ports.find(p=>p.rail.kind==='surface')!;
 return validateBundle({scenario:{...d.world,ship:{...d.booster,id:d.stack.id,state:portState(pad,0),dryMass:d.booster.dryMass+d.payload.dryMass+d.payload.propellant,cargoMass:d.payload.cargoMass}},program:d.programs.stack});
}
export interface SeparationRecord {
 t:number;parentId:string;children:string[];state:Sample['y'];beforeMass:number;afterMass:number;
 momentumBefore:number[];momentumAfter:number[];reservedPayloadFuel:number;boosterFuel:number;
}
export interface StagedRun {definition:StagedFlight;stack:Runner;booster:Runner;payload:Runner;separation:SeparationRecord;view:SceneView}

function segmentView(h:{id:string;name:string;color:string},runner:Runner,end:number):VesselView {
 const bundle=runner.bundle,s=bundle.scenario,start=s.epoch,terminal=runner.advanceTo(end);
 ok(viable(terminal)&&terminal.t===end,`${h.name}: ${terminal.status} ${terminal.detail}`);
 // Dense sampling applies to every free-flight segment, including a newborn
 // child's initial coast. No dependence on a departure event in its own ledger.
 const count=Math.ceil((end-start)*2048),ledger=runner.ledger;
 const times=[...new Set([start,end,...Array.from({length:count+1},(_,i)=>start+(end-start)*i/count),...ledger.map(e=>e.t),...(bundle.program.thrustArcs??[]).flatMap(a=>a.steering?.keys.map(k=>a.start+k.offset)??[])])].sort((a,b)=>a-b);
 ok(times.length<=20000,'display storage budget exceeded');
 return {...h,ship:s.ship,cargo:'Freight',ports:s.logistics!.ports,cargoCapacity:s.logistics!.cargoCapacity,continuousFuel:true,portSamples:{},arcs:bundle.program.thrustArcs!,samples:times.map(t=>runner.sample(t)),ledger,boundaries:runner.eventBoundaries};
}

export function prepareStaged(value:unknown):StagedRun {
 const d=validateStaged(value),parentBundle=stackBundle(d),stack=new Runner(parentBundle),split=d.separation.t,end=d.world.epoch+d.world.duration;
 const before=stack.advanceTo(split);
 ok(stack.snapshot().anchor.t===split&&stack.ledger.some(e=>e.t===split&&e.kind==='thrust-end'),'separation must be a retained thrust-end checkpoint');
 ok(viable(before)&&before.t===split&&!before.thrust&&!before.logistics?.service&&!before.logistics?.dockedPortId,'separation requires valid free flight and ended thrust');
 const child=(h:Hardware,cargoMass:number,program:Program):Runner=>{
  const world=clone(d.world);world.epoch=split;
  // A non-grid split gets its own grid origin and a rounded *coverage* horizon.
  // Only [split,end] is executed. Never change the canonical separation epoch.
  world.duration=Math.ceil((end-split)/world.policy.step)*world.policy.step;
  world.logistics!.ports.forEach(p=>{const stock=before.logistics!.ports.find(s=>s.id===p.id)!;p.cargo=stock.cargo;p.propellant=stock.propellant;});
  return new Runner({scenario:{...world,ship:{...h,state:[...before.y],cargoMass,propellant:h.id===d.booster.id?before.propellant:h.propellant}},program});
 };
 const booster=child(d.booster,0,d.programs.booster),payload=child(d.payload,before.logistics!.cargoMass,d.programs.payload);
 // Query the child's pre-event input, not current: it may begin thrust exactly
 // at birth. No child impulse/capture may pay a separation kick at this boundary.
 for(const r of [booster,payload])ok(r.ledger.every(e=>e.t!==split||e.kind==='thrust-start'),'separation must be zero-kick');
 const boosterMass=booster.bundle.scenario.ship.dryMass+before.propellant,payloadMass=d.payload.dryMass+before.logistics!.cargoMass+d.payload.propellant;
 const totalBefore=mass(parentBundle,before),totalAfter=boosterMass+payloadMass;
 const momentumBefore=before.y.slice(3).map(v=>v*totalBefore),momentumAfter=before.y.slice(3).map(v=>v*boosterMass+v*payloadMass);
 ok(Math.abs(totalBefore-totalAfter)<1e-12&&momentumBefore.every((v,i)=>Math.abs(v-momentumAfter[i])<1e-12),'separation mass/momentum mismatch');
 const separation:SeparationRecord={t:split,parentId:d.stack.id,children:[d.booster.id,d.payload.id],state:[...before.y],beforeMass:totalBefore,afterMass:totalAfter,momentumBefore,momentumAfter,reservedPayloadFuel:d.payload.propellant,boosterFuel:before.propellant};
 const assembly=segmentView(d.stack,stack,split),lower=segmentView(d.booster,booster,end),upper=segmentView(d.payload,payload,end);
 lower.inheritedFuelUsed=before.fuelUsed??0;lower.cargoCapacity=0;
 assembly.lifetime={start:0,end:split,retired:true};lower.lifetime={start:split,end,parentId:d.stack.id};upper.lifetime={start:split,end,parentId:d.stack.id};
 const event:ViewerEvent={t:split,kind:'separation',id:d.separation.id,deltaV:0,fuelUsed:0,propellantBefore:before.propellant,propellantAfter:before.propellant,detail:`${d.booster.name} + ${d.payload.name}`};
 assembly.ledger.push(event);
 const view:SceneView={staging:{separation,initialFuel:d.booster.propellant+d.payload.propellant},schemaVersion:1,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,stations:d.stations,rotating:d.rotating,vessels:[assembly,lower,upper],portSamples:{},world:{bodies:d.world.bodies,ports:d.world.logistics!.ports,units:d.world.units},window:{start:0,end}};
 for(const t of new Set([0,...setEvents(view).map(e=>e.t)]))for(const stock of stockAt(view,t)){
  const port=view.world.ports.find(p=>p.id===stock.id)!;
  ok(stock.cargo>=-1e-12&&stock.cargo<=port.cargoCapacity+1e-12&&stock.propellant>=-1e-12&&stock.propellant<=port.tankCapacity+1e-12&&stock.occupied>=0&&stock.occupied<=1,'global resources/berths exceeded');
 }
 ok(stack.retainedNodes+booster.retainedNodes+payload.retainedNodes<=40000&&view.vessels.reduce((n,v)=>n+v.samples.length,0)<=40000&&new TextEncoder().encode(JSON.stringify(view)).byteLength<=12_000_000,'aggregate storage budget exceeded');
 ok(upper.samples.at(-1)!.logistics?.dockedPortId===d.world.logistics!.ports.find(p=>p.rail.kind==='circular')!.id&&!upper.samples.at(-1)!.logistics?.service&&upper.ledger.some(e=>e.kind==='transfer'&&e.cargoBefore===d.payload.cargoMass&&e.cargoAfter===0),'courier delivery incomplete');
 ok(lower.samples.at(-1)!.logistics?.dockedPortId===d.world.logistics!.ports.find(p=>p.rail.kind==='surface')!.id&&upper.samples.at(-1)!.logistics?.cargoMass===0,'mission incomplete');
 return {definition:d,stack,booster,payload,separation,view};
}

// Physical mission accounts: local port copies are never summed, and retired
// assembly history never becomes a third inventory owner after separation.
export function stagedAccounts(run:StagedRun,t:number) {
 const d=run.definition,end=d.world.epoch+d.world.duration;ok(Number.isFinite(t)&&t>=0&&t<=end,'account epoch outside mission');
 const split=d.separation.t,parent=run.stack.sample(Math.min(t,split));
 const owners=t<split?[{bundle:run.stack.bundle,sample:parent}]:[{bundle:run.booster.bundle,sample:run.booster.sample(t)},{bundle:run.payload.bundle,sample:run.payload.sample(t)}];
 const stocks=stockAt(run.view,t);
 const reserved=t<split?d.payload.propellant:0;
 const remainingFuel=owners.reduce((n,o)=>n+o.sample.propellant,0)+reserved;
 const consumedFuel=t<split?(parent.fuelUsed??0):(parent.fuelUsed??0)+owners.reduce((n,o)=>n+(o.sample.fuelUsed??0),0);
 const freight=stocks.reduce((n,s)=>n+s.cargo,0)+owners.reduce((n,o)=>n+(o.sample.logistics?.cargoMass??o.bundle.scenario.ship.cargoMass),0);
 return {remainingFuel,consumedFuel,freight,portPropellant:stocks.reduce((n,s)=>n+s.propellant,0),activeMass:owners.reduce((n,o)=>n+mass(o.bundle,o.sample),0)};
}
