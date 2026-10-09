import {readFileSync,writeFileSync} from 'node:fs';
import {MaintainedWorld} from '../../../../src/maintained/world';
import {planPair} from './probe-planner';
const d=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8')),w=new MaintainedWorld(d),rows:any[]=[];
for(let departure=6;departure<=158;departure+=8){w.ensure(departure+56,departure-6);w.evict(departure);try{const p=planPair(d,w,departure,departure-6,.9,departure),r=p.runner,ss=Array.from({length:1793},(_,i)=>r.sample(departure+i/32)),fuel=.9-ss.at(-1)!.propellant;rows.push({departure,fuel,dv:3*Math.log(1.95/(1.95-fuel)),minRadius:Math.min(...ss.map(s=>Math.hypot(...s.y.slice(0,3)))),maxRadius:Math.max(...ss.map(s=>Math.hypot(...s.y.slice(0,3)))),evaluations:p.evaluations});}catch(e){rows.push({departure,error:(e as Error).message});}}
writeFileSync('docs/design/maintained-service/follow-up/probe.json',JSON.stringify(rows,null,2));console.log(rows);
