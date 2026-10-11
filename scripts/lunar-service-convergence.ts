import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import type {Bundle} from '../src/sim/schema';
// Independent parent-step witnesses; the depot provider keeps its canonical grid.
const input=JSON.parse(readFileSync('docs/evidence/lunar-service-input.json','utf8')),second=input.cases[1];
const base:Bundle=second.grids[0].bundle;
second.grids=[1/4096,1/8192,1/16384].map(step=>{
 const bundle=structuredClone(base);bundle.scenario.policy.step=step;bundle.scenario.policy.maxNodes=65536;
 bundle.scenario.duration=Math.ceil(bundle.scenario.duration/step)*step;const end=bundle.scenario.epoch+bundle.scenario.duration;const rail=bundle.scenario.logistics!.ports[1].rail;if(rail.kind!=='ballistic')throw Error('target');rail.validUntil=end;
 const runner=new Runner(bundle),terminal=runner.advanceTo(end);
 if(terminal.status!=='horizon')throw Error('Parent convergence capture failed: '+terminal.status);
 return {step,bundle,terminal,ledger:runner.ledger,
  flights:bundle.program.thrustArcs!.map(arc=>({arc,samples:Array.from({length:65},(_,i)=>{const t=arc.start+(arc.end-arc.start)*i/64;return i===64?runner.eventBoundaries.find(b=>b.t===arc.end)!.before:runner.sample(t);})})),
  targetSamples:Array.from({length:65},(_,i)=>{const t=bundle.scenario.epoch+bundle.scenario.duration*i/64;return {t,y:runner.portState('Crescent',t)};})};
});
writeFileSync('docs/evidence/lunar-service-input.json',JSON.stringify(input));
console.log(JSON.stringify(second.grids.map((g:any)=>({step:g.step,fuel:g.terminal.propellant,captures:g.ledger.filter((e:any)=>e.kind==='dock'||e.kind==='land')})),null,2));
