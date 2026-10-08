import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {validateBundle,type Vec3} from '../../../src/sim/schema';
import {portState} from '../../../src/sim/logistics';
const original=validateBundle(JSON.parse(readFileSync('fixtures/model-sets/orison-powered.json','utf8')).vessels[0].bundle);
const r=new Runner(original);r.advanceTo(16);
const rows=[];
for(let leg=0;leg<2;leg++) {
 const reference=original.program.thrustArcs![leg*2].start,arrival=original.program.thrustArcs![leg*2+1].end,T=arrival-reference;
 const source=original.scenario.logistics!.ports.find(p=>p.id===(leg===0?'Anchor':'Kiln'))!,dest=original.scenario.logistics!.ports.find(p=>p.id===(leg===0?'Kiln':'Anchor'))!;
 if(source.rail.kind!=='circular' || dest.rail.kind!=='circular')throw new Error('Expected analytical ports');
 const period=2*Math.PI/Math.abs(dest.rail.rate-source.rail.rate),start=r.sample(reference);
 for(const k of [0,1,3,10,1000,100000]) {
  const departure=reference+k*period,b=structuredClone(original);
  b.scenario.epoch=0;b.scenario.duration=Math.ceil(T/b.scenario.policy.step)*b.scenario.policy.step;b.scenario.ship.cargoMass=start.logistics!.cargoMass;b.scenario.ship.propellant=start.propellant;
  b.scenario.logistics!.ports.forEach(p=>{if(p.rail.kind==='circular')p.rail.phase=(p.rail.phase+p.rail.rate*departure)%(2*Math.PI);});
  b.scenario.ship.state=portState(b.scenario.logistics!.ports.find(p=>p.id===source.id)!,0);
  const angle=source.rail.rate*(departure-reference),c=Math.cos(angle),s=Math.sin(angle);
  b.program.burns=[];b.program.thrustArcs=original.program.thrustArcs!.slice(leg*2,leg*2+2).map(a=>({...a,start:a.start-reference,end:a.end-reference,direction:[c*a.direction[0]-s*a.direction[1],s*a.direction[0]+c*a.direction[1],0] as Vec3}));
  b.program.operations=[{id:'capture',kind:'dock',portId:dest.id,t:T}];
  const flight=new Runner(b),terminal=flight.advanceTo(b.scenario.duration),dock=flight.ledger.at(-1)!;
  if(terminal.status!=='horizon' || dock.kind!=='dock' || dock.positionError!+1e-8>=1e-7 || dock.deltaV+1e-8>=1e-7)throw new Error(JSON.stringify({leg,k,terminal,dock}));
  rows.push({leg,k,departure,status:terminal.status,position:dock.positionError,velocity:dock.deltaV,fuel:terminal.propellant});
 }
}
writeFileSync('docs/design/continuous-traffic/template-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
