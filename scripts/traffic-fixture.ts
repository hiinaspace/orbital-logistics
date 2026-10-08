// Retain the narrow fixed-primary transfer catalogue and explicit station feeds.
import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
const set=JSON.parse(readFileSync('fixtures/model-sets/orison-powered.json','utf8'));
const b=validateBundle(set.vessels[0].bundle),runner=new Runner(b);runner.advanceTo(16);
const templates=[0,1].map(leg=>{
 const arcs=b.program.thrustArcs!.slice(leg*2,leg*2+2),departure=arcs[0].start,arrival=arcs[1].end,s=runner.sample(departure);
 const source=leg===0?'Anchor':'Kiln',destination=leg===0?'Kiln':'Anchor';
 return {id:`${source}-${destination}`,source,destination,referenceDeparture:departure,duration:arrival-departure,
  cargo:s.logistics!.cargoMass,propellant:s.propellant,arcs:arcs.map(a=>({...a,start:a.start-departure,end:a.end-departure})),
  provenance:'Paid Kestrel finite-thrust witness from fa9b935. Fixed-primary rotational/synodic symmetry; exact cargo/fuel/engine domain. No authored impulses.'};
});
const world=structuredClone(b);world.scenario.logistics!.ports=world.scenario.logistics!.ports.filter(p=>['Anchor','Kiln'].includes(p.id));
world.program={schemaVersion:3,id:'traffic-world-metadata',burns:[]};
const config={schemaVersion:1,id:'orison-service',name:'Orison · continuous service',extent:1.9,
 description:'Two freighters cycle between an orbital supply terminal and an industrial ring.',
 provenance:'Fictional normalized fixed-primary system. Finite powered transfers, analytical stations, finite buffers with explicit external supply/consumption. Memory-only rolling history; restart creates a fresh run.',
 rotating:set.rotating,world,historyDuration:128,sampleStep:1/16,forecastDuration:12,
 stations:[{id:'Anchor',role:'Supply terminal',berths:2,cargo:1.6,cargoCapacity:4,propellant:4,tankCapacity:8,cargoRate:.02,propellantRate:.02},
 {id:'Kiln',role:'Industrial ring',berths:2,cargo:0,cargoCapacity:4,propellant:4,tankCapacity:8,cargoRate:-.02,propellantRate:.02}],
 templates,vessels:[{id:'Kestrel',name:'Kestrel',color:'#efb878',cargo:'Supplies',portId:'Anchor',propellant:.65,route:['Anchor-Kiln','Kiln-Anchor']},
 {id:'Finch',name:'Finch',color:'#78c9c0',cargo:'Supplies',portId:'Kiln',propellant:templates[1].propellant,route:['Kiln-Anchor','Anchor-Kiln']}]};
writeFileSync('fixtures/traffic/orison-service.json',JSON.stringify(config,null,2)+'\n');
