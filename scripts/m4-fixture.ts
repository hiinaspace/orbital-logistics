// Offline puzzle authoring only. These explicit epochs were chosen by the author;
// the playable helper never searches for a window or a route.
import {readFileSync,writeFileSync} from 'node:fs';
import {validateBundle} from '../src/sim/schema';
import {solveRendezvous} from '../src/planning/rendezvous';
for (const [label,departure,arrival] of [['patient',15.497026245592098,19.626757036464838],['express',14,18]] as const) {
  const bundle = validateBundle(JSON.parse(readFileSync('fixtures/m4-return-ticket.json','utf8')));
  bundle.program.id = 'm4-'+label+'-solution-v1';
  bundle.program.burns.push({id:'return',t:departure,referenceBodyId:'primary',basis:'radial-transverse-ccw-v1',radial:0,transverse:-0.07});
  const result = solveRendezvous(bundle,'return',96,{portId:'Home',arrivalEpoch:arrival});
  if(result.status !== 'proposed') throw new Error(result.reason);
  bundle.program = result.proposal.program;
  writeFileSync('fixtures/m4-'+label+'-solution.json',JSON.stringify(bundle,null,2)+'\n');
}
