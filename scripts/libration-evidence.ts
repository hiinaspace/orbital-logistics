import fs from 'node:fs';
import fixture from '../fixtures/model-sets/aster-selene-beacon.json';
import {LibrationEngine,type LibrationDefinition} from '../src/libration/engine';
import {LibrationViewStore} from '../src/libration/view';
import {sampleVessel,stockAt} from '../src/model-set/model';
const started=performance.now(),e=new LibrationEngine(fixture as LibrationDefinition),preparationMs=performance.now()-started,store=new LibrationViewStore(e.definition);
e.advanceTo(0);store.ingest(e.delta());
let maxAdvanceMs=0,maxFrontendViewMs=0,maxFuelBalance=0,maxCargoBalance=0;
const peaks:Record<string,number>={};
for(let t=1;t<=640;t++){
 let begin=performance.now();e.advanceTo(t);const packet=e.delta();maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-begin);store.ingest(packet);
 for(const [key,value] of Object.entries(packet.stats))peaks[key]=Math.max(peaks[key]??0,value);
 const r=packet.resources.at(-1)!,q=e.sample(t),ships=[...e.base.schedules.map((_,i)=>e.base.sample(i,t)),q];
 maxFuelBalance=Math.max(maxFuelBalance,Math.abs(18+r.fuelImported-ships.reduce((n,q)=>n+q.propellant+q.fuelUsed!,0)));
 maxCargoBalance=Math.max(maxCargoBalance,Math.abs(.15+r.cargoImported-r.cargoExported-q.logistics!.cargoMass));
 if(t%16===0){begin=performance.now();const scene=store.view(t);stockAt(scene,t);scene.vessels.forEach(v=>sampleVessel(v,t));maxFrontendViewMs=Math.max(maxFrontendViewMs,performance.now()-begin);}
}
const d=e.definition.courier,epochs=[...new Set([0,1,11,12,14,24,30,32,...d.arcs.flatMap(a=>[a.start,a.end,...a.steering!.keys.map(k=>a.start+k.offset)]),...Array.from({length:129},(_,i)=>i/4)])].sort((a,b)=>a-b);
const witnesses=[0,17,9000].map(cycle=>({cycle,samples:epochs.map(t=>e.sample(cycle*d.period+t)),left:[d.arrival,d.landing].map(t=>e.sample(cycle*d.period+t,true))}));
const report={definition:e.definition,preparationMs,totalMs:performance.now()-started,maxAdvanceMs,maxFrontendViewMs,peaks,maxFuelBalance,maxCargoBalance,work:e.courier.work,capture:e.courier.capture,landing:e.courier.landing,spent:e.courier.schedule.spent,equilibriumResidual:e.courier.equilibriumResidual,witnesses,stats:e.delta().stats};
fs.writeFileSync('docs/evidence/libration.json',JSON.stringify(report,null,2)+'\n');console.log({...report,definition:undefined,witnesses:undefined});
