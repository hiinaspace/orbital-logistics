import fs from 'node:fs';
import {prepareStagedApollo} from '../../../src/model-set/staged-apollo';
import {bodyState} from '../../../src/sim/dynamics';
const d=JSON.parse(fs.readFileSync('docs/design/staged-refinement/lander/baseline-mission.json','utf8')),p=prepareStagedApollo(d);
const rows=[];for(let i=0;i<=480;i++){const t=28+i/240,q=p.sample('Odyssey',t),m=bodyState(d.world.bodies[1],t);rows.push({t,y:q.y,propellant:q.propellant,mass:q.mass,r:Math.hypot(q.y[0]-m[0],q.y[1]-m[1]),speed:Math.hypot(q.y[3],q.y[4]),relativeSpeed:Math.hypot(q.y[3]-m[3],q.y[4]-m[4]),thrust:q.thrust});}
const cutoffs=[28.5,29,29.25,29.5,29.6,29.7,29.81629322744725,29.923779528746707].map(t=>({t,...p.sample('Odyssey',t)}));
fs.writeFileSync('docs/design/staged-refinement/arrival-baseline.json',JSON.stringify({cutoffs,rows,landerStart:p.sample('Eagle',d.liftoff),world:d.world,fixture:d},null,2)+'\n');
console.log(JSON.stringify({cutoffs,minInertial:rows.reduce((a,b)=>a.speed<b.speed?a:b),work:p.work}));
