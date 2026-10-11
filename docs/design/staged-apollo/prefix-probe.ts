import fs from 'node:fs';
import {prepareApollo} from '../../../src/model-set/apollo';
import {Runner} from '../../../src/sim/runner';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-expedition.json','utf8'));
const p=prepareApollo(d),split=d.arcs.find((a:any)=>a.id==='lunar-descent').start;
const q=p.sample(split,true),s=structuredClone(d.scenario);s.epoch=split;s.duration=24;s.ship.state=q.y;s.ship.propellant=q.propellant;s.bodies[0].radius+=d.entry.atmosphere.topHeight;
const r=new Runner({scenario:s,program:{schemaVersion:4,id:'passive-orbiter',burns:[],thrustArcs:[]}});r.advanceTo(55);
const result={split:p.sample(.78),lunarSplit:q,landing:p.sample(d.landing),liftoff:p.sample(d.liftoff,true),orbiter:Object.fromEntries([41,42,43,44,45,46,47,48,49,50,51,52,53,54,55].map(t=>[t,r.sample(t)]))};
fs.writeFileSync('docs/design/staged-apollo/prefix-probe.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({split:result.split,lunarSplit:result.lunarSplit,landing:result.landing}));
