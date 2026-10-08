import {readFileSync,writeFileSync} from 'node:fs';
import {fixture} from '../../../tests/sim/helpers';
import {Runner} from '../../../src/sim/runner';
const c=JSON.parse(readFileSync('docs/design/surface-ascent/ascent-study.json','utf8'))[0],spin=.003,angle=spin*c.departure,T=c.arrival-c.departure;
const rows=[.5e-6,1e-6,2e-6].map(height=>{
 const b=fixture([(1+height)*Math.cos(angle),(1+height)*Math.sin(angle),0,-spin*(1+height)*Math.sin(angle),spin*(1+height)*Math.cos(angle),0],1/4096);
 b.scenario.duration=Math.ceil(T*4096)/4096;b.scenario.bodies=[{id:'primary',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}}];
 b.scenario.ship={...b.scenario.ship,dryMass:1,cargoMass:.1,propellant:1.4,tankCapacity:1.4,exhaustVelocity:3,engine:{maxThrust:5,maxAcceleration:3}};
 b.program={schemaVersion:3,id:'height-sensitivity',burns:[],thrustArcs:c.arcs.map(([start,end,h]:number[],i:number)=>({id:`arc${i}`,start,end,direction:[Math.cos(h),Math.sin(h),0],throttle:1}))};
 const r=new Runner(b),s=r.advanceTo(T);if(s.status!=='running')throw new Error('Height sensitivity flight failed');
 return {height,status:s.status,propellant:s.propellant,position:[...s.y.slice(0,3)],velocity:[...s.y.slice(3)],nodes:r.retainedNodes};
});
writeFileSync('docs/design/surface-ascent/height-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
