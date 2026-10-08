// Retain free-flight micro-interval fixtures for testing the later attachment gate.
import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {rk4} from '../../../src/sim/dynamics';
import {portState} from '../../../src/sim/logistics';
import {validateBundle,type State} from '../../../src/sim/schema';
const base=validateBundle(JSON.parse(fs.readFileSync('fixtures/model-sets/selene-ascent.json','utf8')).vessels[0].bundle),t=1e-5,pad=base.scenario.logistics!.ports[0],target=portState(pad,t);
const rows=[['inside',.99e-7,0,1],['outside',1.01e-7,0,1],['fast radial',0,1.01e-7,1],['fast lateral',0,1.01e-7,1],['underfuel',0,.5e-7,0]].map(([label,miss,speed,fuel])=>{
 const desired=[...target] as State,angle=pad.rail.kind==='surface'?pad.rail.phase+pad.rail.rate*t:0;
 desired[0]+=Number(miss)*Math.cos(angle);desired[1]+=Number(miss)*Math.sin(angle);
 desired[3]+=Number(speed)*(label==='fast lateral'?-Math.sin(angle):Math.cos(angle));desired[4]+=Number(speed)*(label==='fast lateral'?Math.cos(angle):Math.sin(angle));
 const b=structuredClone(base);delete b.scenario.logistics;b.scenario.duration=1/1024;b.scenario.ship.state=rk4(b.scenario,t,desired,-t);b.scenario.ship.propellant=Number(fuel);b.program.operations=undefined;b.program.thrustArcs=[];
 const r=new Runner(b),s=r.sample(t);return {label,initialState:b.scenario.ship.state,fuel,positionError:Math.hypot(...s.y.slice(0,3).map((v,i)=>v-target[i])),velocityError:Math.hypot(...s.y.slice(3).map((v,i)=>v-target[3+i])),status:s.status};
});fs.writeFileSync('docs/design/surface-landing/capture-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
