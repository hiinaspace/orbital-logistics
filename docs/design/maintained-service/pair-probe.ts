import {readFileSync,writeFileSync} from 'node:fs';
import {MaintainedWorld,validateMaintained} from '../../../src/maintained/world';
import {planPair} from '../../../src/maintained/planner';
const d=validateMaintained(JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8'))),w=new MaintainedWorld(d);w.ensure(64,0);
const at=performance.now(),p=planPair(d,w,30,24,.9,0);writeFileSync('docs/design/maintained-service/first-pair.json',JSON.stringify({bundle:p.bundle,evaluations:p.evaluations,capturePosition:p.capturePosition,captureVelocity:p.captureVelocity,ms:performance.now()-at},null,2)+'\n');console.log({ms:performance.now()-at,evaluations:p.evaluations,status:p.runner.current.status});
