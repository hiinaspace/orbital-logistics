import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {bodyState} from '../src/sim/dynamics';
import {admitBinary,jacobi,rotatingState,prepareBinary,type BinarySet} from '../src/binary/model';
import type {Bundle} from '../src/sim/schema';
const oracle=JSON.parse(readFileSync('docs/evidence/libration-orbit-oracle.json','utf8'));
const result:Record<string,unknown>={};
for(const name of ['halo','lissajous','observatory-insertion']){
 const set=JSON.parse(readFileSync(`fixtures/model-sets/sol-earth-${name}.json`,'utf8')) as BinarySet,binary=admitBinary(set),frozen=set.vessels[0].bundle;
 const rows=[];for(const step of [1/64,1/128,1/256,1/1024]){
  let state=[...frozen.scenario.ship.state],fuel=frozen.scenario.ship.propellant;
  let error=0,drift=0,stages=0,minClearance=Infinity,maxAcceleration=0;const reference=oracle[name];const C=jacobi(frozen.scenario,binary,0,frozen.scenario.ship.state);
  for(let epoch=0;epoch<60;epoch+=8){
   const bundle=structuredClone(frozen) as Bundle;bundle.scenario.epoch=epoch;bundle.scenario.duration=Math.min(8,60-epoch);bundle.scenario.policy.step=step;bundle.scenario.ship.state=state as any;bundle.scenario.ship.propellant=fuel;
   bundle.program.burns=bundle.program.burns.filter(b=>b.t>=epoch&&b.t<=epoch+bundle.scenario.duration);
   if(bundle.program.thrustArcs)bundle.program.thrustArcs=bundle.program.thrustArcs.filter(a=>a.start>=epoch&&a.end<=epoch+bundle.scenario.duration);
   const r=new Runner(bundle),end=epoch+bundle.scenario.duration,terminal=r.advanceTo(end);if(terminal.status!=='horizon')throw Error(name+': '+terminal.status);
   for(let t=epoch;t<=end;t+=.25){const s=r.sample(t),i=Math.round(t*4);
    if(reference)error=Math.max(error,...s.y.map((v,k)=>Math.abs(v-reference.states[i][k])));
    maxAcceleration=Math.max(maxAcceleration,s.thrust?s.thrust.force/(frozen.scenario.ship.dryMass+s.propellant):0);
    if(name!=='observatory-insertion')drift=Math.max(drift,Math.abs(jacobi(frozen.scenario,binary,t,s.y)-C));
    for(const b of bundle.scenario.bodies){const p=bodyState(b,t);minClearance=Math.min(minClearance,Math.hypot(...s.y.slice(0,3).map((v,k)=>v-p[k]))-b.radius);}
   }
   state=[...terminal.y];fuel=terminal.propellant;stages+=bundle.scenario.duration/step;
  }
  rows.push({step,error,drift,minClearance,maxAcceleration,fuel,gridIntervals:stages,terminal:state});
 }
 let sensitivity:unknown;
 if(name!=='observatory-insertion'){
  const epsilon=1e-9,plus=structuredClone(frozen),minus=structuredClone(frozen);plus.scenario.ship.state[0]+=epsilon;minus.scenario.ship.state[0]-=epsilon;
  const a=new Runner(plus),b=new Runner(minus);if(a.advanceTo(60).status!=='horizon'||b.advanceTo(60).status!=='horizon')throw Error('Sensitivity witness lost envelope');
  sensitivity={perturbation:epsilon,axis:'inertial x',rows:[binary.period,Math.min(2*binary.period,60),60].map(t=>{const p=a.sample(t).y,q=b.sample(t).y;return {t,scaledAmplification:Math.hypot(...p.map((v,i)=>(v-q[i])/(i<3?binary.separation:binary.separation*binary.rate)))/(2*epsilon/binary.separation)};})};
 }
 const start=performance.now(),view=prepareBinary(structuredClone(set));
 const vessel=view.vessels[0],positions=vessel.samples.map(s=>rotatingState(binary,s.y,s.t));
 result[name]={rows,sensitivity,prepareMs:performance.now()-start,samples:vessel.samples.length,range:[0,1,2].map(i=>[Math.min(...positions.map(p=>p[i])),Math.max(...positions.map(p=>p[i]))]),packetBytes:Buffer.byteLength(JSON.stringify(view)),fuelUsed:frozen.scenario.ship.propellant-vessel.samples.at(-1)!.propellant};
}
writeFileSync('docs/evidence/libration-orbit-native.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
