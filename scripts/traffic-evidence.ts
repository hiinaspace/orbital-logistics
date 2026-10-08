import {readFileSync,writeFileSync} from 'node:fs';
import {TrafficEngine} from '../src/traffic/engine';
import {TrafficViewStore} from '../src/traffic/view';
import {Runner} from '../src/sim/runner';
import {admitEpisode,nextWindow,type TrafficDefinition} from '../src/traffic/planner';
const d=JSON.parse(readFileSync('fixtures/traffic/orison-service.json','utf8')) as TrafficDefinition;
const cases=d.templates.flatMap(t=>[1,64,10000].map(index=>{
 const w=nextWindow(d,t,t.referenceDeparture,index),e=admitEpisode(d,t,'witness',index,0,w,t.cargo,t.propellant),bundle=e.bundle;
 const steps=[4,2,1].map(factor=>{
  const b=structuredClone(bundle);b.scenario.policy.step*=factor;b.scenario.duration=Math.ceil(t.duration/b.scenario.policy.step)*b.scenario.policy.step;
  const r=new Runner(b),terminal=r.advanceTo(b.scenario.duration);
  const safe=structuredClone(b);safe.scenario.bodies[0].radius+=.03;const clearance=new Runner(safe).advanceTo(safe.scenario.duration).status==='horizon';
  if(terminal.status!=='horizon' || !clearance)throw new Error('Trip gate failed');
  const times=[...new Set([0,t.duration,...Array.from({length:81},(_,i)=>t.duration*i/80),...r.ledger.map(e=>e.t)])].sort((a,b)=>a-b);
  return {step:b.scenario.policy.step,clearance,samples:times.map(t=>r.sample(t)),ledger:r.ledger};
 });return {label:`${t.id}:${index}`,departure:w.departure,bundle,steps};
}));
writeFileSync('docs/evidence/traffic-oracle-input.json',JSON.stringify({cases})+'\n');
const engine=new TrafficEngine(d),store=new TrafficViewStore(d),start=performance.now();store.ingest(engine.delta());
let cargoError=0,fuelError=0;const maxima:Record<string,number>={},rows=[],services=new Map<string,ReturnType<TrafficEngine['delta']>['events'][number]>();
const initialCargo=d.stations.reduce((n,p)=>n+p.cargo,0),initialFuel=d.stations.reduce((n,p)=>n+p.propellant,0)+d.vessels.reduce((n,v)=>n+v.propellant,0);
for(let target=8;target<=2048;target+=8) {
 const after=engine.frontier;while(engine.frontier<target)engine.advanceTo(target);const packet=engine.delta(after);store.ingest(packet);for(const event of packet.events)if(event.kind==='transfer')services.set(event.id,event);
 const a=engine.snapshot(),r=a.resources,ships=a.current.ships;
 cargoError=Math.max(cargoError,Math.abs(r.stocks.reduce((n,p)=>n+p.cargo,0)+ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported-initialCargo));
 fuelError=Math.max(fuelError,Math.abs(r.stocks.reduce((n,p)=>n+p.propellant,0)+ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported-initialFuel));
 for(const [key,value] of Object.entries({...engine.delta(target).stats,viewFrames:store.frames.length,viewEpisodes:store.episodes.length}))maxima[key]=Math.max(maxima[key]??0,value);
 if(target%128===0)rows.push({t:target,ships:a.ships.map(s=>({id:s.id,voyage:s.voyage,stage:s.stage,delivered:s.delivered})),stats:engine.delta(target).stats,resources:r,current:a.current});
}
if(cargoError>1e-10 || fuelError>1e-10 || maxima.frames>2300 || maxima.viewFrames>2300 || maxima.episodes>32 || maxima.viewEpisodes>32 || engine.snapshot().ships.some(s=>s.voyage<180 || s.stage==='fault' || s.stage==='unavailable'))throw new Error('Soak failed');
const report={duration:2048,historyDuration:d.historyDuration,wallSeconds:(performance.now()-start)/1000,cargoError,fuelError,maxima,rows,services:[...services.values()],final:engine.snapshot()};
writeFileSync('docs/evidence/traffic-soak.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({wallSeconds:report.wallSeconds,cargoError,fuelError,maxima}));
