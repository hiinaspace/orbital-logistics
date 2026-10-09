import {readFileSync,writeFileSync} from 'node:fs';
import {NetworkEngine} from '../../../src/network/engine';
const e=new NetworkEngine(JSON.parse(readFileSync('fixtures/traffic/orison-relay-network.json','utf8')),{failures:{Tern:'capture'}});while(e.advanceTo(128,4096).yielded){}if(e.halt)throw Error(e.halt);writeFileSync('docs/design/multiship-service/fault-display.json',JSON.stringify(e.delta())+'\n');console.log(e.snapshot());
