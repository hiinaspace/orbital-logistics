import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {prepareSet,sampleVessel,displayPortState,type ModelSet} from '../src/model-set/model';
const fixture=JSON.parse(readFileSync('fixtures/model-sets/selene-ground.json','utf8')) as ModelSet;
const grids=[];
for(const step of [1/8192,1/16384,1/32768]){
 const bundle=structuredClone(fixture.vessels[0].bundle);bundle.scenario.policy.step=step;bundle.scenario.policy.maxNodes=65536;
 for(const p of bundle.scenario.logistics!.ports)if(p.rail.kind==='ballistic'){p.rail.policy.step=step;p.rail.policy.maxNodes=65536;}
 const begin=performance.now(),r=new Runner(bundle),terminal=r.advanceTo(bundle.scenario.duration);
 if(terminal.status!=='horizon')throw Error(terminal.status+' '+terminal.detail);
 const boundaries=r.eventBoundaries;
 const flights=bundle.program.thrustArcs!.map(arc=>({arc,samples:Array.from({length:65},(_,i)=>{
  const t=arc.start+(arc.end-arc.start)*i/64;return i===64?boundaries.find(b=>b.t===arc.end)!.before:r.sample(t);
 })}));
 grids.push({step,bundle,terminal,ledger:r.ledger,flights,targetSamples:Array.from({length:129},(_,i)=>({t:i*bundle.scenario.duration/128,y:r.portState('Crescent',i*bundle.scenario.duration/128)})),nodes:r.retainedTreeNodes,bytes:r.treeStorageBytes(),elapsedMs:performance.now()-begin});
}
const begin=performance.now(),view=prepareSet(fixture),r=new Runner(fixture.vessels[0].bundle);r.advanceTo(view.window.end);
let shipPixels=0,depotPixels=0;
for(let i=0;i<2048;i++){
 const t=(i+.371)*view.window.end/2048;
 const a=sampleVessel(view.vessels[0],t).y,b=r.sample(t).y,c=displayPortState(view.world.ports.find(p=>p.id==='Crescent')!,view.portSamples,t),d=r.portState('Crescent',t);
 shipPixels=Math.max(shipPixels,Math.hypot(...a.slice(0,3).map((v,j)=>v-b[j]))*1e6);
 depotPixels=Math.max(depotPixels,Math.hypot(...c.slice(0,3).map((v,j)=>v-d[j]))*1e6);
}
const report={grids,view:{elapsedMs:performance.now()-begin,samples:view.vessels[0].samples.length,bytes:Buffer.byteLength(JSON.stringify(view)),maxShipPixelsAtMaxZoom:shipPixels,maxDepotPixelsAtMaxZoom:depotPixels},authoring:JSON.parse(readFileSync('docs/design/moving-selene/authoring.json','utf8'))};
if(shipPixels>.5||depotPixels>.5)throw Error('Moving surface display accuracy budget exceeded '+JSON.stringify(report.view));
writeFileSync('docs/evidence/moving-selene-input.json',JSON.stringify(report));
console.log(JSON.stringify({grids:grids.map(({step,nodes,bytes,elapsedMs,ledger,terminal})=>({step,nodes,bytes,elapsedMs,captures:ledger.filter(e=>e.kind==='dock'||e.kind==='land'),fuel:terminal.propellant})),view:report.view},null,2));
