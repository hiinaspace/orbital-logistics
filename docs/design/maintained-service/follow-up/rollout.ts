import {readFileSync,writeFileSync} from 'node:fs';
import {MaintainedEngine} from '../../../../src/maintained/engine';
import {MaintainedViewStore} from '../../../../src/maintained/view';
const d=JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8')),e=new MaintainedEngine(d),v=new MaintainedViewStore(d),visits=new Map(),failures=new Map(),rows:any[]=[];let after=-1,error:string|undefined;const begin=performance.now();
while(!e.initialized)e.advanceTo(0,24);
for(let t=0;t<=1536;t++){
 try{while(e.advanceTo(t,24).yielded){}const p=e.delta(after);v.ingest(p);for(const visit of p.visits)if(!visits.has(visit.id)){
  const y=visit.samples,angle=(s:any)=>Math.atan2(s.y[1],s.y[0]);let winding=0;for(let i=1;i<y.length;i++){let delta=angle(y[i])-angle(y[i-1]);winding+=Math.atan2(Math.sin(delta),Math.cos(delta));}
  visits.set(visit.id,{departure:visit.departure,arrival:visit.arrival,fuel:y[0].propellant-y.at(-1).propellant,dv:3*Math.log((1.05+y[0].propellant)/(1.05+y.at(-1).propellant)),minRadius:Math.min(...y.map((s:any)=>Math.hypot(...s.y.slice(0,3)))),maxRadius:Math.max(...y.map((s:any)=>Math.hypot(...s.y.slice(0,3)))),turns:winding/(2*Math.PI),evaluations:visit.evaluations});
 }
 for(const f of p.events.filter(f=>f.kind==='planning-failed'))failures.set(f.id,{t:f.t,detail:f.detail});
 if(t%32===0){const relay=e.world.sample('Meridian',e.frontier),origin=e.world.sample('Equator',e.frontier),phase=Math.atan2(relay.y[1],relay.y[0])-d.reference.phase-d.reference.rate*e.frontier;rows.push({t:e.frontier,completed:p.stats.completed,phaseError:Math.atan2(Math.sin(phase),Math.cos(phase)),relativePhase:Math.atan2(Math.sin(Math.atan2(relay.y[1],relay.y[0])-Math.atan2(origin.y[1],origin.y[0])),Math.cos(Math.atan2(relay.y[1],relay.y[0])-Math.atan2(origin.y[1],origin.y[0]))),stationFuel:p.stats.stationFuel,controllerFailed:p.stats.controllerFailed,viewBytes:v.stats.viewBytes,nodes:p.stats.runnerNodes});}
 after=e.frontier;if(e.halt)break;
 }catch(f){error=(f as Error).message;break;}
}
const result={elapsedMs:performance.now()-begin,safeHead:e.frontier,error,halt:e.halt,summary:e.snapshot(),visits:[...visits.values()],failures:[...failures.values()],rows};writeFileSync(process.env.ROLLOUT_OUTPUT??'docs/design/maintained-service/follow-up/rollout-current.json',JSON.stringify(result,null,2)+'\n');console.log({elapsedMs:result.elapsedMs,head:e.frontier,error,visits:visits.size});
