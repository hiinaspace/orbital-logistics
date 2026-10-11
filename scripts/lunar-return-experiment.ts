import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {portState} from '../src/sim/logistics';
import {bodyState} from '../src/sim/dynamics';
import type {Bundle,ThrustArc} from '../src/sim/schema';
import {shootLunar,type SteeringSeed} from '../spikes/lunar-return/shoot';
const input=JSON.parse(readFileSync('spikes/lunar-return/baseline-input.json','utf8'));
const rows:any[]=[];
for(const item of input.cases){
 const original:Bundle=item.grids[0].bundle,old=original.program.thrustArcs![1],seed:SteeringSeed={start:old.start,duration:old.end-old.start,keys:old.steering!.keys.map(k=>k.direction)};
 const lease=structuredClone(original);lease.scenario.duration+=.5;const rail=lease.scenario.logistics!.ports[1].rail;if(rail.kind!=='ballistic')throw Error('rail');rail.validUntil=lease.scenario.epoch+lease.scenario.duration;
 const provider=new Runner(lease);provider.advanceTo(lease.scenario.epoch+lease.scenario.duration);
 for(const coast of [0,.012,.024])for(const offset of [-.024,-.012,0,.012,.024]){
  const back=old.start+offset;if(back<original.program.thrustArcs![0].end+.012)continue;
  const started=performance.now();let count=0,row:any={id:item.id,coast,offset,back};
  try{
   const shot=shootLunar(original.scenario,back,provider.portState('Crescent',back),t=>portState(original.scenario.logistics!.ports[0],t),seed,true,coast);
   let step=shot.next();while(!step.done){step=shot.next();count++;}const result=step.value;
   const bundle=structuredClone(original),arcs=result.arcs.map((a,i)=>({...a,id:'return-'+i})),end=Math.ceil((arcs.at(-1)!.end+.02)*8192)/8192;
   bundle.scenario.duration=end-bundle.scenario.epoch;const target=bundle.scenario.logistics!.ports[1].rail;if(target.kind!=='ballistic')throw Error('rail');target.validUntil=end;
   bundle.program.thrustArcs=[bundle.program.thrustArcs![0],...arcs];for(const op of bundle.program.operations!){if(op.id==='depart')op.t=back;if(op.id==='land')op.t=arcs.at(-1)!.end;}
   const runner=new Runner(bundle),last=runner.advanceTo(end);
   const keys=arcs.flatMap(a=>a.steering!.keys.map(k=>k.direction)),turn=keys.slice(1).reduce((n,d,i)=>n+Math.acos(Math.max(-1,Math.min(1,d.reduce((sum,x,j)=>sum+x*keys[i][j],0)))),0);
   let minR=Infinity,maxR=0;for(let t=back;t<arcs.at(-1)!.end;t+=1/4096){const p=runner.sample(t).y,c=bodyState(bundle.scenario.bodies[1],t),r=Math.hypot(...p.slice(0,3).map((x,i)=>x-c[i]));minR=Math.min(minR,r);maxR=Math.max(maxR,r);}
   row={...row,accepted:last.status==='horizon'&&last.propellant>.1,status:last.status,detail:last.detail,dv:arcs.reduce((n,a)=>n+(a.end-a.start)*38.4,0),duration:arcs.at(-1)!.end-back,turn,minR,maxR,fuel:last.propellant,evaluations:result.evaluations,stages:result.stages,bundle};
  }catch(e){row={...row,accepted:false,error:(e as Error).message};}
  row.ms=performance.now()-started;rows.push(row);const {bundle,...brief}=row;console.log(JSON.stringify(brief));
  writeFileSync('spikes/lunar-return/comparison.json',JSON.stringify(rows));
 }
}
