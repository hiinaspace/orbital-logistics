// Independent feasibility adapter, not a fleet runtime. Retained as authoring evidence.
import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {validateBundle,type Vec3} from '../../../src/sim/schema';
import {portState} from '../../../src/sim/logistics';
const set=JSON.parse(fs.readFileSync('fixtures/model-sets/selene-return.json','utf8')),base=validateBundle(set.vessels[0].bundle);
const departure=base.program.operations!.find(o=>o.kind==='undock')!.t,arrival=base.program.operations!.find(o=>o.kind==='land')!.t;
const returnFuel=new Runner(base).sample(departure).propellant;
const legs=[{id:'ascent',source:'Cairn',destination:'Lantern',reference:.3,arrival:1.7207514043249135,cargo:.1,fuel:1.4,arcs:base.program.thrustArcs!.slice(0,8)},
 {id:'descent',source:'Lantern',destination:'Cairn',reference:departure,arrival,cargo:.05,fuel:returnFuel,arcs:base.program.thrustArcs!.slice(8)}];
const rows=legs.flatMap(leg=>[0,1,64,10000,100000].map(index=>{
 const b=structuredClone(base),s=b.scenario,ports=s.logistics!.ports,source=ports.find(p=>p.id===leg.source)!,target=ports.find(p=>p.id===leg.destination)!;
 if(source.rail.kind==='ballistic'||target.rail.kind==='ballistic')throw Error();
 const period=2*Math.PI/Math.abs(source.rail.rate-target.rail.rate),global=leg.reference+index*period,T=leg.arrival-leg.reference,angle=source.rail.rate*(global-leg.reference),c=Math.cos(angle),sn=Math.sin(angle);
 s.epoch=source.rail.kind==='surface'?-s.policy.step:0;s.duration=Math.ceil((T-s.epoch)/s.policy.step)*s.policy.step;
 for(const port of ports){if(port.rail.kind!=='ballistic')port.rail.phase=((port.rail.phase+port.rail.rate*global)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);}
 s.ship.state=portState(source,s.epoch);s.ship.cargoMass=leg.cargo;s.ship.propellant=leg.fuel;
 const arcs=leg.arcs.map((a,i)=>({...a,id:`arc${i}`,start:a.start-leg.reference,end:a.end-leg.reference,direction:[c*a.direction[0]-sn*a.direction[1],sn*a.direction[0]+c*a.direction[1],a.direction[2]] as Vec3}));
 b.program={schemaVersion:3,id:'probe',burns:[],thrustArcs:arcs,operations:[...(source.rail.kind==='surface'?[{id:'support',kind:'dock' as const,t:s.epoch,portId:leg.source},{id:'launch',kind:'launch' as const,t:0,portId:leg.source,thrustArcId:arcs[0].id}]:[]),{id:'capture',t:T,kind:target.rail.kind==='surface'?'land':'dock',portId:leg.destination}]};
 const r=new Runner(b),terminal=r.advanceTo(s.epoch+s.duration),capture=r.ledger.find(e=>e.id==='capture');
 if(terminal.status!=='horizon'||!capture||capture.positionError!+1e-8>=1e-7||capture.deltaV+1e-8>=1e-7)throw Error(`${leg.id}:${index} ${terminal.detail}`);
 return {leg:leg.id,index,departure:global,epoch:s.epoch,duration:T,capture,terminalFuel:terminal.propellant,initialEvents:r.ledger.filter(e=>e.t<=0),nodes:r.retainedNodes};
}));
fs.writeFileSync('docs/design/surface-service/episode-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(rows.map(r=>({leg:r.leg,index:r.index,position:r.capture?.positionError,speed:r.capture?.deltaV,fuel:r.terminalFuel})));
