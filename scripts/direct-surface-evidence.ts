import {readFileSync,writeFileSync} from 'node:fs';
import {prepareDirectSurface} from '../src/model-set/direct-surface';
const d=JSON.parse(readFileSync('fixtures/model-sets/orison-direct-surface.json','utf8')),start=performance.now(),r=prepareDirectSurface(d),duration=performance.now()-start;
const legs=[r.outbound,r.inbound].map(shot=>{const runner=shot.runner,b=runner.bundle,t=b.scenario.epoch,end=t+shot.shape.duration;return {bundle:b,end,capture:shot.capture,evaluations:shot.evaluations,shape:shot.shape,samples:Array.from({length:129},(_,i)=>runner.sample(t+(end-t)*i/128))};});
const ownership=[{t:d.arrival,kind:'capture',fuel:r.outbound.capture.propellantAfter},{t:d.arrival+.5,kind:'transfer',amount:r.delivery},{t:d.release,kind:'release'}];
const report={definition:d,legs,ownership,station:r.world.chunks.map(c=>c.data),runtime:{preparationMs:duration,evaluations:legs.map(l=>l.evaluations),remaining:r.inbound.capture.propellantAfter,stationFailed:r.world.failed,physicalNodes:r.world.nodes+r.outbound.runner.retainedNodes+r.inbound.runner.retainedNodes,viewBytes:new TextEncoder().encode(JSON.stringify(r.view)).byteLength,delivery:r.delivery}};
writeFileSync('docs/evidence/direct-surface-input.json',JSON.stringify(report));
writeFileSync('docs/evidence/direct-surface-runtime.json',JSON.stringify(report.runtime,null,2)+'\n');
console.log(report.runtime);
