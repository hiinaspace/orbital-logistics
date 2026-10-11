import fs from 'node:fs';
import {prepareStagedApollo} from '../../../src/model-set/staged-apollo';
const d=JSON.parse(fs.readFileSync('docs/design/staged-refinement/arrival-baseline.json','utf8')).fixture;
const candidates=JSON.parse(fs.readFileSync('docs/design/staged-refinement/arrival-coherent-candidates.json','utf8'));
for(const [index,a] of candidates.entries()){
 const q=structuredClone(d);q.programs.orbiterOutbound[q.programs.orbiterOutbound.length-1]=a.arc;
 try{const p=prepareStagedApollo(q);fs.writeFileSync(`docs/design/staged-refinement/arrival-admitted-${index}.json`,JSON.stringify(q,null,2)+'\n');console.log(JSON.stringify({index,capture:p.capture,dock:p.dock,recoveries:p.recoveries,spent:p.spent,work:p.work}));}
 catch(e){console.log(JSON.stringify({index,error:(e as Error).message}));}
}
