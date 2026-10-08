import {writeFileSync} from 'node:fs';
import {fixture} from '../../../tests/sim/helpers';
import {Runner} from '../../../src/sim/runner';
const cases=[];
for(const height of [0,1e-6,2e-6])for(const force of [1,5]){
 const b=fixture([1+height,0,0,0,.003*(1+height),0],1/8192);
 b.scenario.duration=.5;b.scenario.bodies=[{id:'primary',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}}];
 b.scenario.ship={...b.scenario.ship,dryMass:1,cargoMass:.1,propellant:1.4,tankCapacity:1.4,exhaustVelocity:3,engine:{maxThrust:force,maxAcceleration:3}};
 b.program={schemaVersion:3,id:'near-surface-probe',burns:[],thrustArcs:[{id:'vertical',start:0,end:.5,direction:[1,0,0],throttle:1}]};
 const r=new Runner(b),terminal=r.advanceTo(.5);cases.push({height,force,status:terminal.status,t:terminal.t,altitude:Math.hypot(...terminal.y.slice(0,3))-1,fuelUsed:terminal.fuelUsed,nodes:r.retainedNodes});
}
writeFileSync('docs/design/surface-ascent/boundary-probe.json',JSON.stringify(cases,null,2)+'\n');console.log(cases);
