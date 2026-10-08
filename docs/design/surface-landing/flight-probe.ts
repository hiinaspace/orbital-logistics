import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {validateBundle,type State} from '../../../src/sim/schema';
const set=JSON.parse(fs.readFileSync('fixtures/model-sets/selene-ascent.json','utf8')),b=validateBundle(set.vessels[0].bundle);
const c=JSON.parse(fs.readFileSync('docs/design/surface-landing/landing-study.json','utf8')).at(-1);
const pad=b.scenario.logistics!.ports[0].rail,depot=b.scenario.logistics!.ports[1].rail;if(pad.kind!=='surface'||depot.kind!=='circular')throw new Error('Unexpected rails');
let departure=(pad.phase+pad.rate*c.duration+Math.atan2(c.reverseState[1],c.reverseState[0])-depot.phase)/(depot.rate-pad.rate);
const period=2*Math.PI/(depot.rate-pad.rate);while(departure<2.3207514043249133)departure+=period;
const arrival=departure+c.duration,rotation=pad.phase+pad.rate*arrival;
const rotate=(y:number[]):State=>[y[0]*Math.cos(rotation)-y[1]*Math.sin(rotation),y[0]*Math.sin(rotation)+y[1]*Math.cos(rotation),0,-y[2]*Math.cos(rotation)+y[3]*Math.sin(rotation),-y[2]*Math.sin(rotation)-y[3]*Math.cos(rotation),0];
const arcs=[...c.reverseArcs].reverse().map(([a,end,h]:number[],i:number)=>({id:`descent-${i+1}`,start:c.duration-end,end:c.duration-a,throttle:1,direction:[Math.cos(h+rotation),Math.sin(h+rotation),0]}));
const rows=[1/512,1/1024,1/2048].map(step=>{
 const s=structuredClone(b.scenario);delete s.logistics;s.epoch=0;s.duration=Math.ceil(c.duration/step)*step;s.policy.step=step;s.ship.state=rotate(c.reverseState);s.ship.cargoMass=.05;s.ship.propellant=c.initialFuel;
 const r=new Runner({scenario:s,program:{schemaVersion:3,id:'descent-probe',burns:[],thrustArcs:arcs}}),out=r.advanceTo(c.duration),target:[number,number,number,number,number,number]=[(1+pad.centerHeight)*Math.cos(rotation),(1+pad.centerHeight)*Math.sin(rotation),0,-pad.rate*(1+pad.centerHeight)*Math.sin(rotation),pad.rate*(1+pad.centerHeight)*Math.cos(rotation),0];
 return {step,status:out.status,t:out.t,nodes:r.retainedNodes,positionError:Math.hypot(...out.y.slice(0,3).map((v,i)=>v-target[i])),velocityError:Math.hypot(...out.y.slice(3).map((v,i)=>v-target[3+i])),propellant:out.propellant,state:out.y};
});
fs.writeFileSync('docs/design/surface-landing/flight-probe.json',JSON.stringify({departure,arrival,rotation,period,rows},null,2)+'\n');console.log({departure,arrival,rows});
const legacy=[];for(const t of [.2,.3,1.7207514043249135,6]){const r=new Runner(b);r.advanceTo(t);legacy.push({bundle:b,snapshot:r.snapshot()});}fs.writeFileSync('docs/design/surface-landing/legacy-snapshots.json',JSON.stringify(legacy)+'\n');
