import fs from 'node:fs';
import fixture from '../fixtures/model-sets/aster-selene-expedition.json';
import {prepareApollo} from '../src/model-set/apollo';
const started=performance.now(),r=prepareApollo(fixture),d=r.definition;
const times=[...new Set([0,d.launch,d.ascentEnd,d.landing-1e-4,d.landing,d.liftoff,d.entryStart,r.entry.contact.t,...d.milestones.map(m=>m.t),...d.arcs.flatMap(a=>[a.start,a.end]),...Array.from({length:129},(_,i)=>r.view.window.end*i/128)])].sort((a,b)=>a-b);
const report={definition:d,work:r.work,preparationMs:performance.now()-started,capture:r.capture,recovery:{t:r.entry.contact.t,state:r.entry.contact.before,relativeSpeed:r.entry.contact.relativeSpeed,maxima:r.entry.maxima},samples:times.map(t=>r.sample(t))};
fs.writeFileSync('docs/evidence/apollo.json',JSON.stringify(report,null,2)+'\n');
console.log(r.work,report.preparationMs,report.recovery.t,report.recovery.state[6]);
