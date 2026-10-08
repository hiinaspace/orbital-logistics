import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {prepareSet,displayPortState,sampleVessel,orbitError,type ModelSet} from '../src/model-set/model';
import {thrustBound} from '../src/sim/propulsion';
import {certifiedCoast} from '../src/sim/dynamics';
import type {Bundle,PoweredRail} from '../src/sim/schema';
const set=JSON.parse(readFileSync('fixtures/model-sets/orison-maintained.json','utf8')) as ModelSet,bundle=set.vessels[0].bundle;
const steps=[1/32,1/64,1/128,1/256,1/512].map(step=>{
 const b=structuredClone(bundle);b.scenario.policy.step=step;for(const port of b.scenario.logistics!.ports)if(port.rail.kind==='powered'||port.rail.kind==='ballistic')port.rail.policy.step=step;
 const r=new Runner(b),terminal=r.advanceTo(64),rail=b.scenario.logistics!.ports[1].rail as PoweredRail;
 const target:Bundle={scenario:{...b.scenario,logistics:undefined,ship:{...rail.propulsion,id:'Meridian',cargoMass:0,state:rail.state},bodies:b.scenario.bodies.map(b=>({...b,radius:b.radius+.2}))},program:rail.program};
 const provider=new Runner(target);if(terminal.status!=='horizon'||provider.advanceTo(64).status!=='horizon')throw Error('Failed finite relay');
 const segments=provider.coastSegments(64);if(!segments.every(s=>certifiedCoast(target.scenario,s.t0,s.y0,s.t1-s.t0,thrustBound(s.massLaw))))throw Error('Uncertified station motion');
 const epochs=[...new Set([...Array.from({length:129},(_,i)=>i/2),...r.ledger.map(e=>e.t),...provider.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
 for(const t of epochs){const a=r.portSample('Meridian',t),c=provider.sample(t);if(Math.hypot(...a.y.map((x,i)=>x-c.y[i]))>1e-13)throw Error('Provider identity differs');}
 return {step,terminal,ledger:r.ledger,boundaries:r.eventBoundaries,samples:epochs.map(t=>r.sample(t)),station:epochs.map(t=>r.portSample('Meridian',t)),stationLedger:provider.ledger,stationNodes:provider.retainedNodes,visitorNodes:r.retainedNodes,certifiedIntervals:segments.length};
});
writeFileSync('docs/evidence/stationkeeping-oracle-input.json',JSON.stringify({bundle,steps})+'\n');
const run=prepareSet(set),r=new Runner(bundle),v=run.vessels[0],station=run.maintained!.Meridian;let stationError=0,visitorError=0,maxEnvelope=0;
for(let i=0;i<station.samples.length-1;i++)for(const u of [.25,.5,.75]){const t=station.samples[i].t+(station.samples[i+1].t-station.samples[i].t)*u,a=displayPortState(run.world.ports[1],run.portSamples,t),b=r.portState('Meridian',t);stationError=Math.max(stationError,Math.hypot(...a.slice(0,3).map((x,j)=>x-b[j])));maxEnvelope=Math.max(maxEnvelope,orbitError(b,set.stations[1].maintenance!.reference).position);}
for(let i=0;i<v.samples.length-1;i++)for(const u of [.25,.5,.75]){const t=v.samples[i].t+(v.samples[i+1].t-v.samples[i].t)*u,a=sampleVessel(v,t),b=r.sample(t);visitorError=Math.max(visitorError,Math.hypot(...a.y.slice(0,3).map((x,j)=>x-b.y[j])));}
if(Math.max(stationError,visitorError)*500>.02||maxEnvelope>.02)throw Error('Display/maintenance envelope failed');
writeFileSync('docs/evidence/stationkeeping-display.json',JSON.stringify({stationError,visitorError,maxEnvelope,stationSamples:station.samples.length,visitorSamples:v.samples.length,packetBytes:new TextEncoder().encode(JSON.stringify(run)).byteLength,limitBytes:8_000_000},null,2)+'\n');
