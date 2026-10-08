import {readFileSync,writeFileSync} from 'node:fs';
import {validateBundle} from '../src/sim/schema';
const set=JSON.parse(readFileSync('fixtures/model-sets/lunar-loop.json','utf8'));
const target=validateBundle(set.vessels[0].bundle);target.scenario.duration=12;target.scenario.policy.step=1/1024;
writeFileSync('docs/design/lunar-freight/input.json',JSON.stringify({target,departureEpoch:.5,phases:[0,Math.PI/2,Math.PI,3*Math.PI/2],durations:[2.5,3,4,5],maxEvaluations:64,minClearance:.03,departureDv:1.2,totalDv:1.6,minFuel:.05})+'\n');
