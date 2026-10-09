import {readFileSync,writeFileSync} from 'node:fs';
import {MaintainedEngine} from '../src/maintained/engine';
import {MaintainedViewStore} from '../src/maintained/view';
import {Runner} from '../src/sim/runner';
import {orbitError} from '../src/model-set/model';
import type {WorldChunk} from '../src/maintained/world';
import type {VisitRecord} from '../src/maintained/engine';
const definition=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8')),engine=new MaintainedEngine(definition),store=new MaintainedViewStore(definition),chunks=new Map<number,WorldChunk>(),visits=new Map<string,VisitRecord>();
const peak:Record<string,number>={};let after=-1,maxRequestMs=0;const begin=performance.now();
while(!engine.initialized)engine.advanceTo(0,24);
for(let t=0;t<=512;t+=1){while(true){const start=performance.now(),p=engine.advanceTo(t,24);maxRequestMs=Math.max(maxRequestMs,performance.now()-start);if(!p.yielded)break;}
 const packet=engine.delta(after);for(const c of packet.chunks)chunks.set(c.id,c);for(const v of packet.visits)visits.set(v.id,v);store.ingest(packet);
 for(const key of ['runnerNodes','frames','chunks','physicalChunks','visits','packetBytes','viewBytes'])peak[key]=Math.max(peak[key]??0,store.stats[key]??0);after=t;
}
const ordered=[...chunks.values()].sort((a,b)=>a.start-b.start),pairs=[...visits.values()].sort((a,b)=>a.departure-b.departure),selected=[pairs[0],pairs.at(-1)!];
const replay=selected.map(pair=>({departure:pair.departure,bundle:pair.bundle,evaluations:pair.evaluations,checks:[1/128,1/256,1/512].map(step=>{
 const b=structuredClone(pair.bundle);b.scenario.policy.step=step;for(const port of b.scenario.logistics!.ports)if('policy' in port.rail)port.rail.policy.step=step;
 const r=new Runner(b),s=b.scenario;r.advanceTo(s.epoch+s.duration);if(r.current.status!=='horizon')throw Error(`Late pair failed at h=${step}: ${r.current.detail}`);
 const times=[...new Set([...Array.from({length:65},(_,i)=>s.epoch+i/2),...r.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
 return {step,bundle:r.bundle,samples:times.map(t=>r.sample(t)),station:times.map(t=>r.portSample(definition.relay.id,t)),ledger:r.ledger};
})}));
const initial=definition.relay.ship,allSamples=ordered.flatMap(c=>c.station.filter(s=>s.t<=512&&[c.start,c.start+4,c.end].includes(s.t))),end=ordered.at(-1)!.end;
const stream={epoch:0,validUntil:end,state:initial.state,minClearance:.2,propulsion:{...initial,engine:initial.engine},minPropellant:0,program:{schemaVersion:3,id:'online-station-stream',burns:[],thrustArcs:ordered.flatMap(c=>c.arcs)}};
let maxPositionError=0,maxVelocityError=0;for(const c of ordered)for(const s of c.station)if(s.t<=512){const e=orbitError(s.y,definition.reference);maxPositionError=Math.max(maxPositionError,e.position);maxVelocityError=Math.max(maxVelocityError,e.velocity);}
const snapshot=engine.snapshot(),stock=snapshot.resources.stocks.reduce((n,p)=>n+p.propellant,0),conservation=4+.9+snapshot.resources.fuelImported-stock-snapshot.current.ships[0].propellant-snapshot.stats.shipFuelUsed;
const result={definition,stream,stationSamples:allSamples,controller:ordered.map(c=>({knownAt:c.knownAt,...c.check})),replay,summary:{elapsedMs:performance.now()-begin,maxRequestMs,peak,snapshot,maxPositionError,maxVelocityError,fuelConservationError:conservation,admitted:pairs.map(p=>({departure:p.departure,arrival:p.arrival,evaluations:p.evaluations,leaseChunks:p.leaseChunks}))}};
writeFileSync('docs/evidence/maintained-service-input.json',JSON.stringify(result)+'\n');writeFileSync('docs/evidence/maintained-service-runtime.json',JSON.stringify(result.summary,null,2)+'\n');console.log(result.summary);
