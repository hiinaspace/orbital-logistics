import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {paidCapture} from '../../../src/sim/capture';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-expedition.json','utf8')),p=JSON.parse(fs.readFileSync('docs/design/staged-apollo/prefix-probe.json','utf8')),a=JSON.parse(fs.readFileSync('docs/design/staged-apollo/ascent-witness.json','utf8'));
for(const step of [1/1024,1/2048]){
 const s=structuredClone(d.scenario);s.epoch=d.liftoff;s.duration=Math.ceil((a.lunarDock-s.epoch)/step)*step;s.policy.step=step;s.ship={...s.ship,id:'Eagle',state:p.liftoff.y,dryMass:.15,propellant:.15*p.landing.propellant,tankCapacity:.6,engine:{maxThrust:3.6,maxAcceleration:3}};s.bodies[0].radius+=.2;
 const r=new Runner({scenario:s,program:{schemaVersion:4,id:'lander-rendezvous',burns:[],thrustArcs:a.arcs}});const last=r.advanceTo(a.lunarDock);
 const so=structuredClone(s);so.epoch=p.lunarSplit.t;so.duration=Math.ceil((a.lunarDock-so.epoch)/step)*step;so.ship={...so.ship,state:p.lunarSplit.y};
 const o=new Runner({scenario:so,program:{schemaVersion:4,id:'orbiter',burns:[],thrustArcs:[]}});const target=o.advanceTo(a.lunarDock);
 const cap=paidCapture(last.y,target.y,{...s.ship,propellant:last.propellant},{position:2e-6,velocity:2e-6},'Odyssey');
 console.log(JSON.stringify({step,last,target,capture:cap}));
}
