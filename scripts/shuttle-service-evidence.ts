import {writeFileSync} from 'node:fs';
import fixture from '../fixtures/traffic/orison-shuttle-service.json';
import {admitEpisode,nextWindow,CALENDAR_LIMIT,type TrafficDefinition} from '../src/traffic/planner';
import {WholeFlightCache} from '../src/traffic/prepared';
import {TrafficEngine} from '../src/traffic/engine';
import {TrafficViewStore} from '../src/traffic/view';
import {sampleVessel} from '../src/model-set/model';
const d=fixture as TrafficDefinition,cache=new WholeFlightCache(),legs=[];
const cold=performance.now();
for(const t of d.templates){const w=nextWindow(d,t,.2);admitEpisode(d,t,'warmup',0,0,w,t.cargo,t.propellant,cache);}
const coldMs=performance.now()-cold,admissions:number[]=[];
for(const t of d.templates)for(const after of [.2,512,CALENDAR_LIMIT-20]){
 const w=nextWindow(d,t,after),start=performance.now(),e=admitEpisode(d,t,'evidence',0,0,w,t.cargo,t.propellant,cache);admissions.push(performance.now()-start);
 const at=e.runner.sample(t.duration),capture=e.runner.ledger.find(l=>l.id===e.arrivalOperationId)!;
 legs.push({departure:w.departure,bundle:e.bundle,end:t.duration,capture:{...capture,y:at.y},samples:Array.from({length:129},(_,i)=>e.runner.sample(t.duration*i/128))});
}
const engine=new TrafficEngine(d),store=new TrafficViewStore(engine.definition),begin=performance.now();store.ingest(engine.delta());
let maxDense=0,maxViewBytes=0,maxDeltaBytes=0,maxFuelBalance=0,maxCargoBalance=0,maxAdvanceMs=0;
for(let t=8;t<=1024;t+=8){
 const after=engine.frontier,start=performance.now();while(engine.frontier<t)engine.advanceTo(t);maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-start);
 const delta=engine.delta(after);store.ingest(delta);maxDense=Math.max(maxDense,delta.stats.denseSamples);
 maxDeltaBytes=Math.max(maxDeltaBytes,new TextEncoder().encode(JSON.stringify(delta)).byteLength);
 maxViewBytes=Math.max(maxViewBytes,new TextEncoder().encode(JSON.stringify(store.view(t))).byteLength);
 const a=engine.snapshot(),r=a.resources;
 const fuel=r.stocks.reduce((n,s)=>n+s.propellant,0)+a.current.ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 const cargo=r.stocks.reduce((n,s)=>n+s.cargo,0)+a.current.ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 maxFuelBalance=Math.max(maxFuelBalance,Math.abs(fuel-d.stations.reduce((n,s)=>n+s.propellant,0)-d.vessels.reduce((n,s)=>n+s.propellant,0)));
 maxCargoBalance=Math.max(maxCargoBalance,Math.abs(cargo-d.stations.reduce((n,s)=>n+s.cargo,0)));
 if(delta.events.some(e=>['fault','planning-failed','unavailable'].includes(e.kind)))throw Error('Unexpected service failure');
}
const soakMs=performance.now()-begin;
let drawingPosition=0,drawingVelocity=0,polylinePixels=0;
for(const record of store.episodes.filter(r=>r.source.arrival<1024).slice(-4)){
 const e=record.source,t=d.templates.find(t=>t.id===e.templateId)!,w={index:e.windowIndex,departure:e.departure},truth=admitEpisode(d,t,e.shipId,e.voyage,e.admittedAt,w,t.cargo,t.propellant,cache).runner;
 const at=e.departure+.7,view=store.view(at),v=view.vessels.find(v=>v.id===e.shipId)!;
 for(let i=0;i<record.samples.length-1;i++){
  const a=record.samples[i],b=record.samples[i+1],epoch=(a.t+b.t)/2,physical=truth.sample(epoch-e.departure),draw=sampleVessel(v,epoch);
  drawingPosition=Math.max(drawingPosition,Math.hypot(...draw.y.slice(0,3).map((x,j)=>x-physical.y[j])));
  drawingVelocity=Math.max(drawingVelocity,Math.hypot(...draw.y.slice(3).map((x,j)=>x-physical.y[j+3])));
  // Chords in inertial and surface-rotating frames at maximum viewer scale.
  for(const rate of [0,.1,1.4**-1.5]){
   const turn=(y:number[],t:number)=>{const c=Math.cos(rate*t),s=Math.sin(rate*t);return [c*y[0]+s*y[1],-s*y[0]+c*y[1],y[2]];};
   const p=turn(physical.y,epoch),pa=turn(a.y,a.t),pb=turn(b.y,b.t);
   polylinePixels=Math.max(polylinePixels,1e6*Math.hypot(...p.map((x,j)=>x-(pa[j]+pb[j])/2)));
  }
 }
}
const result={coldMs,warmAdmissionMs:admissions,soakMs,maxAdvance8UnitsMs:maxAdvanceMs,maxDense,maxViewBytes,maxDelta8UnitsBytes:maxDeltaBytes,maxFuelBalance,maxCargoBalance,drawingPosition,drawingVelocity,polylinePixels,...engine.delta().stats,ships:engine.snapshot().ships.map(s=>({id:s.id,voyages:s.voyage,stage:s.stage,fuel:s.fuel}))};
if(maxDense>65536||maxViewBytes>8_000_000||maxFuelBalance>1e-10||drawingPosition>1e-8||polylinePixels>.5)throw Error('Evidence budget/accuracy failed '+JSON.stringify(result));
writeFileSync('docs/evidence/shuttle-service-input.json',JSON.stringify({definition:d,legs}));
writeFileSync('docs/evidence/shuttle-service-runtime.json',JSON.stringify(result,null,2)+'\n');console.log(result);
