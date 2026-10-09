import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../../src/adaptive/engine';
const d=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8'));
const e=new AdaptiveEngine(d),started=performance.now(),stalls=[];
let at=0,previous=started;
while(!e.initialized||e.frontier<64){e.advanceTo(64,24);if(e.frontier!==at){const now=performance.now();if(now-previous>100)stalls.push({at,seconds:(now-previous)/1000});previous=now;at=e.frontier;}}
const result={seconds:(performance.now()-started)/1000,stalls,stats:e.snapshot().stats};
writeFileSync('docs/design/responsive-service/timing.json',JSON.stringify(result,null,2)+'\n');console.log(result);
