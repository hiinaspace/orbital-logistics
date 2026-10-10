import {readFileSync,writeFileSync} from 'node:fs';
import {prepareSurfaceShuttle} from '../src/model-set/surface-shuttle';
import {sampleVessel} from '../src/model-set/model';
const d=JSON.parse(readFileSync('fixtures/model-sets/orison-low-orbit-shuttle.json','utf8')),begin=performance.now(),r=prepareSurfaceShuttle(d),v=r.view.vessels[0];
let drawingPosition=0;
const legs=[r.outbound,r.inbound].map(shot=>{const b=shot.runner.bundle,start=b.scenario.epoch,end=shot.end;const samples=Array.from({length:129},(_,i)=>shot.runner.sample(start+(end-start)*i/128));
 for(let i=1;i<1000;i++){const t=start+(end-start)*i/1000,truth=shot.runner.sample(t),draw=sampleVessel(v,t);drawingPosition=Math.max(drawingPosition,Math.hypot(...truth.y.slice(0,3).map((x,i)=>x-draw.y[i])));}
 return {bundle:b,end,capture:shot.capture,samples};});
const runtime={preparationMs:performance.now()-begin,evaluations:[r.outbound.evaluations,r.inbound.evaluations],remainingFuel:r.inbound.capture.propellantAfter,retainedNodes:r.outbound.runner.retainedNodes+r.inbound.runner.retainedNodes,viewBytes:new TextEncoder().encode(JSON.stringify(r.view)).byteLength,drawingPosition,drawingPixelsAtMaxZoom:drawingPosition*1e6};
writeFileSync('docs/evidence/surface-shuttle-input.json',JSON.stringify({definition:d,legs,runtime}));
writeFileSync('docs/evidence/surface-shuttle-runtime.json',JSON.stringify(runtime,null,2)+'\n');console.log(runtime);
