import fs from 'node:fs';
import {prepareStagedApollo} from '../../../src/model-set/staged-apollo';
const d=JSON.parse(fs.readFileSync('docs/design/staged-refinement/combined-candidate.json','utf8'));
const p=prepareStagedApollo(d);fs.writeFileSync('docs/design/staged-refinement/combined-admission.json',JSON.stringify({capture:p.capture,dock:p.dock,recoveries:p.recoveries,spent:p.spent,work:p.work},null,2)+'\n');
console.log({capture:p.capture,dock:p.dock,recoveries:p.recoveries,spent:p.spent,work:p.work});
