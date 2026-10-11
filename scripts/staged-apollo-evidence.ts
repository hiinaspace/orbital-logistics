import fs from 'node:fs';
import fixture from '../fixtures/model-sets/aster-selene-staged-expedition.json';
import {prepareStagedApollo} from '../src/model-set/staged-apollo';
const began=performance.now(),r=prepareStagedApollo(fixture),d=r.definition;
const times=[...new Set([0,d.launch,d.boosterSeparation,d.ascentEnd,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,d.entryStart,d.boosterEntryStart,...Object.values(r.recoveries),...Object.values(d.programs).flat().flatMap(a=>[a.start,a.end]),...Array.from({length:129},(_,i)=>d.world.duration*i/128)])].sort((a,b)=>a-b);
const report={definition:d,work:r.work,preparationMs:performance.now()-began,capture:r.capture,dock:r.dock,separations:r.separations,spent:r.spent,
 recovery:{booster:{t:r.boosterEntry.contact.t,state:r.boosterEntry.contact.before,relativeSpeed:r.boosterEntry.contact.relativeSpeed,maxima:r.boosterEntry.maxima},orbiter:{t:r.orbiterEntry.contact.t,state:r.orbiterEntry.contact.before,relativeSpeed:r.orbiterEntry.contact.relativeSpeed,maxima:r.orbiterEntry.maxima}},
 samples:Object.fromEntries([['stack',d.stack.id],...Object.entries(d.hardware).map(([p,h])=>[p,h.id])].map(([p,id])=>[p,times.map(t=>r.sample(id,t))])),
 accounts:times.flatMap(t=>[r.accounts(t,true),r.accounts(t)])};
fs.writeFileSync('docs/evidence/staged-apollo.json',JSON.stringify(report,null,2)+'\n');
console.log({work:r.work,ms:report.preparationMs,capture:r.capture,dock:r.dock,spent:r.spent,recoveries:r.recoveries});
