/** Native finite research admission; no drawing samples become physics targets. */
import {readFileSync,writeFileSync} from 'node:fs';
import {integrate,at,RATE,STEP} from '../../../../src/compact/physics';
import type {State} from '../../../../src/sim/schema';
const path='docs/design/compact-cycler/pass-through/';
const inputs=JSON.parse(readFileSync(path+'crossings.json','utf8')).candidates;
const c=inputs.find((q:any)=>q.asterMin<2&&q.asterMax>5&&q.seleneMin<1.3);
if(!c)throw Error('No morphology candidate');
const [x,y,vx,vy]=c.initial;
const initial:State=[x,y,0,vx-RATE*y,vy+RATE*x,0];
const expected=(t:number):State=>{const a=RATE*t,C=Math.cos(a),S=Math.sin(a);return [C*x-S*y,S*x+C*y,0,C*initial[3]-S*initial[4],S*initial[3]+C*initial[4],0];};
const oracle=JSON.parse(readFileSync(path+'oracle.json','utf8')).rows;
const result:any={candidate:c,native:[]};
for(const step of [STEP,STEP/2,STEP/4]){
 let q:State=[...initial],nodes=0,checks=0,minAster=Infinity,minSelene=Infinity,oraclePosition=0,oracleVelocity=0;
 const ends=[];
 for(let i=0;i<12;i++){
  const a=c.period*i/4,b=c.period*(i+1)/4;
  const trace=integrate(a,b,q,undefined,step);
  for(const row of oracle.filter((r:number[])=>r[0]>=a&&r[0]<=b)){const v=at(trace.rows,row[0]);oraclePosition=Math.max(oraclePosition,Math.hypot(...v.slice(0,3).map((x,j)=>x-row[j+1])));oracleVelocity=Math.max(oracleVelocity,Math.hypot(...v.slice(3,6).map((x,j)=>x-row[j+4])));}
  q=trace.rows.at(-1)!.slice(1,7) as State;nodes+=trace.nodes;checks+=trace.work;
  for(const row of trace.rows){const t=row[0],p=row.slice(1,4);minAster=Math.min(minAster,Math.hypot(...p));minSelene=Math.min(minSelene,Math.hypot(p[0]-5*Math.cos(RATE*t),p[1]-5*Math.sin(RATE*t),p[2]));}
  if((i+1)%4===0){const target=expected(b);ends.push({cycle:(i+1)/4,positionError:Math.hypot(...q.slice(0,3).map((v,j)=>v-target[j])),velocityError:Math.hypot(...q.slice(3).map((v,j)=>v-target[j+3]))});}
 }
 if(oraclePosition>1e-8||oracleVelocity>1e-8||minAster<1.2||minSelene<.25||nodes>800000||checks>800000)throw Error('Finite research envelope failed');
 if(step===STEP&&(nodes>240000||checks>400000))throw Error('Baseline aggregate work failed');
 result.native.push({step,nodes,checks,minAster,minSelene,oraclePosition,oracleVelocity,ends});
}
writeFileSync(path+'native.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
