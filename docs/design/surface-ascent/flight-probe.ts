import {readFileSync,writeFileSync} from 'node:fs';
import {fixture,error} from '../../../tests/sim/helpers';
import {Runner} from '../../../src/sim/runner';
import type {State} from '../../../src/sim/schema';
const candidate=JSON.parse(readFileSync('docs/design/surface-ascent/ascent-study.json','utf8'))[0];
const spin=.003,height=1e-6,angle=spin*candidate.departure,T=candidate.arrival-candidate.departure;
const rows=[4,2,1].map(factor=>{
 const h=factor/8192,b=fixture([(1+height)*Math.cos(angle),(1+height)*Math.sin(angle),0,-spin*(1+height)*Math.sin(angle),spin*(1+height)*Math.cos(angle),0],h);
 b.scenario.duration=Math.ceil(T/h)*h;b.scenario.bodies=[{id:'primary',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}}];
 b.scenario.ship={...b.scenario.ship,dryMass:1,cargoMass:.1,propellant:1.4,tankCapacity:1.4,exhaustVelocity:3,engine:{maxThrust:5,maxAcceleration:3}};
 b.program={schemaVersion:3,id:'ascent-flight-probe',burns:[],thrustArcs:candidate.arcs.map(([start,end,heading]:number[],i:number)=>({id:`arc${i}`,start,end,direction:[Math.cos(heading),Math.sin(heading),0],throttle:1}))};
 const r=new Runner(b),s=r.advanceTo(T),y=[candidate.state[0],candidate.state[1],0,candidate.state[2],candidate.state[3],0] as State;
 if(s.status!=='running')throw new Error('Flight did not reach target epoch');
 return {step:h,status:s.status,state:s.y,fuel:s.propellant,fuelUsed:s.fuelUsed,positionError:error(s.y.slice(0,3),y.slice(0,3)),velocityError:error(s.y.slice(3),y.slice(3)),nodes:r.retainedNodes};
});
writeFileSync('docs/design/surface-ascent/flight-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
