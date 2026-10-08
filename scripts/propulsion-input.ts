// Preserve independent authoring inputs before changing production dynamics.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle} from '../src/sim/schema';
import {resolveBurn} from '../src/sim/burns';
import {bodyState} from '../src/sim/dynamics';
const output=process.argv[process.argv.indexOf('--output')+1];
if(!process.argv.includes('--output') || !output || existsSync(output))throw new Error('Provide --output <new-path>; retained study inputs are immutable');
const cases=[];
for(const [path,name] of [['fixtures/model-sets/orison-freight.json','Kestrel'],['fixtures/model-sets/selene-freight.json','Wren'],['fixtures/model-sets/selene-freight.json','Ibis']]) {
 const set=JSON.parse(readFileSync(path,'utf8')),bundle=validateBundle(set.vessels.find((v:any)=>v.name===name).bundle),r=new Runner(bundle);
 r.advanceTo(bundle.scenario.duration);
 for(const [leg,i] of [['outbound',0],['return',2]] as const) {
  const first=bundle.program.burns[i],last=bundle.program.burns[i+1];
  const before=r.eventBoundaries.find(e=>e.t===first.t)!.before;
  const dock=bundle.program.operations!.find(o=>o.t===last.t && o.kind==='dock')!;
  const seed=[first,last].map((b,j)=>resolveBurn(b,r.eventBoundaries.find(e=>e.t===b.t)!.before.y,bodyState(bundle.scenario.bodies.find(body=>body.id===b.referenceBodyId)!,b.t)));
  cases.push({name:`${name}-${leg}`,bundle,departure:first.t,arrival:last.t,targetId:dock.portId,before,seed});
 }
}
writeFileSync(output,JSON.stringify({bounds:{maxEvaluations:180,thrusts:[8,4,2,1],durationFraction:.45,minClearance:.03,terminalTolerance:1e-8},cases})+'\n');
