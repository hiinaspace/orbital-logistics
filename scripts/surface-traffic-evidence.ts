import {readFileSync,writeFileSync} from 'node:fs';
import {TrafficEngine,DENSE_SAMPLE_BUDGET,type EpisodeRecord,type TrafficDelta} from '../src/traffic/engine';
import {TrafficViewStore} from '../src/traffic/view';
import {Runner} from '../src/sim/runner';
import {certifiedCoast} from '../src/sim/dynamics';
import {thrustBound} from '../src/sim/propulsion';
import {sampleVessel,stockAt} from '../src/model-set/model';
import {transform} from '../src/model-set/frames';
import {admitEpisode,nextWindow,localAt,CALENDAR_LIMIT,type TrafficDefinition} from '../src/traffic/planner';
const d=JSON.parse(readFileSync('fixtures/traffic/selene-service.json','utf8')) as TrafficDefinition;
const cases=d.templates.flatMap(template=>{
 const period=2*Math.PI/Math.abs(.7155417527999327-.003),last=Math.floor((CALENDAR_LIMIT-template.duration-template.referenceDeparture)/period);
 return [1,64,last].map(index=>{
  const w=nextWindow(d,template,0,index),e=admitEpisode(d,template,'swift',index,Math.max(0,w.departure-.3),w,template.cargo,template.propellant),bundle=e.bundle,end=bundle.scenario.epoch+bundle.scenario.duration;
  const steps=[1/512,1/1024,1/2048].map(step=>{
   const b=structuredClone(bundle);b.scenario.policy.step=step;b.scenario.duration=Math.ceil((template.duration-b.scenario.epoch)/step)*step;b.scenario.policy.maxNodes=65536;
   const r=new Runner(b),terminal=r.advanceTo(b.scenario.epoch+b.scenario.duration),segments=r.coastSegments(r.current.t);
   if(terminal.status!=='horizon')throw Error(terminal.detail);
   let clearanceLowerBound=Infinity;
   for(const seg of segments){if(!certifiedCoast(b.scenario,seg.t0,seg.y0,seg.t1-seg.t0,thrustBound(seg.massLaw)))throw Error('Uncertified flight');clearanceLowerBound=Math.min(clearanceLowerBound,(Math.hypot(...seg.y0.slice(0,3))-1)/2);}
   const times=[...new Set([b.scenario.epoch,template.duration,b.scenario.epoch+b.scenario.duration,template.duration-1e-7,...Array.from({length:121},(_,i)=>template.duration*i/120),...r.ledger.map(e=>e.t),...e.localEpochs])].sort((a,b)=>a-b);
   return {step,terminal,samples:times.map(t=>r.sample(t)),ledger:r.ledger,boundaries:r.eventBoundaries,nodes:r.retainedNodes,certifiedIntervals:segments.length,clearanceLowerBound};
  });
  // Late-calendar display fixture: actual committed flight plus its still-known
  // forecast, through the same main-thread store used by live service. Resource
  // admission is tested separately by the real soak below.
  const times=[...new Set([0,template.duration,...Array.from({length:Math.ceil(template.duration*2048)},(_,i)=>i/2048),...e.localEpochs])].sort((a,b)=>a-b);
  const global=(t:number)=>({...e.runner.sample(t),t:e.departure+t,activity:{kind:e.runner.sample(t).logistics?.dockedPortId?'waiting' as const:'flying' as const}});
  const {runner,execution,facts,nextFact,...source}=e;
  const record:EpisodeRecord={source,samples:times.map(global),boundaries:e.runner.eventBoundaries.filter(b=>b.t>=0).map(b=>({t:e.departure+b.t,before:{...b.before,t:e.departure+b.t},after:{...b.after,t:e.departure+b.t}})),events:[],updatedAt:e.admittedAt};
  const frontier=e.arrival,resources={t:Math.max(0,e.departure-64),stocks:d.stations.map(s=>({id:s.id,cargo:s.cargo,propellant:s.propellant})),cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0};
  const packet:TrafficDelta={frontier,oldest:resources.t,frames:[{t:e.departure,ships:[global(0)]},{t:frontier,ships:[global(template.duration)]}],current:{t:frontier,ships:[global(template.duration)]},boundaries:record.boundaries.map(b=>({t:b.t,before:{t:b.t,ships:[b.before]},after:{t:b.t,ships:[b.after]}})),resources:[resources],episodes:[record],events:[],stats:{}};
  const store=new TrafficViewStore(d);store.ingest(packet);const view=store.view(e.arrival-1e-7),v=view.vessels[0];let positionError=0,pathError=0,checks=0;
  for(let i=0;i<record.samples.length-1;i++)for(const u of [.25,.5,.75]) {
   const a=record.samples[i],b=record.samples[i+1],t=a.t+(b.t-a.t)*u,physical=e.runner.sample(localAt(e,t)).y,drawing=sampleVessel(v,t).y;
   positionError=Math.max(positionError,Math.hypot(...physical.slice(0,3).map((x,j)=>x-drawing[j])));checks++;
   const left=record.boundaries.find(edge=>edge.t===b.t)?.before??b;
   for(const frame of ['inertial','Selene','Cairn','Lantern','rotating','swift']) {
    const start=transform(view,a.y,a.t,frame),stop=transform(view,left.y,b.t,frame),p=transform(view,physical,t,frame);
    if(frame==='swift')p[0]=p[1]=p[2]=0;
    pathError=Math.max(pathError,Math.hypot(...start.slice(0,3).map((x,j)=>x+u*(stop[j]-x)-p[j])));
   }
  }
  if(Math.max(positionError,pathError)*1e6>=.25)throw Error('Close-view gate failed');
  return {label:`${template.id}:${index}`,departure:e.departure,arrival:e.arrival,arrivalOperationId:e.arrivalOperationId,bundle,steps,display:{positionError,pathError,maxPixelError:Math.max(positionError,pathError)*1e6,checks},terminalEpoch:end};
 });
});
writeFileSync('docs/evidence/surface-traffic-oracle-input.json',JSON.stringify({cases})+'\n');
const engine=new TrafficEngine(d),store=new TrafficViewStore(d),start=performance.now();store.ingest(engine.delta());
const max:Record<string,number>={},rows=[],services=new Map<string,ReturnType<TrafficEngine['delta']>['events'][number]>();let cargoError=0,fuelError=0,maxPacketBytes=0,maxCacheBytes=0,maxViewMs=0,maxHeldSamples=0;
const initialCargo=d.stations.reduce((n,s)=>n+s.cargo,0),initialFuel=d.stations.reduce((n,s)=>n+s.propellant,0)+d.vessels.reduce((n,s)=>n+s.propellant,0);
for(let target=4;target<=1024;target+=4) {
 const after=engine.frontier;while(engine.frontier<target)engine.advanceTo(target);const packet=engine.delta(after);
 maxPacketBytes=Math.max(maxPacketBytes,Buffer.byteLength(JSON.stringify(packet)));store.ingest(packet);for(const event of packet.events)if(event.kind==='transfer')services.set(event.id,event);
 const now=performance.now(),view=store.view(target);maxViewMs=Math.max(maxViewMs,performance.now()-now);max.renderSamples=Math.max(max.renderSamples??0,view.vessels[0].samples.length);
 const a=engine.snapshot(),r=a.resources,ships=a.current.ships;
 cargoError=Math.max(cargoError,Math.abs(r.stocks.reduce((n,s)=>n+s.cargo,0)+ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported-initialCargo));
 fuelError=Math.max(fuelError,Math.abs(r.stocks.reduce((n,s)=>n+s.propellant,0)+ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported-initialFuel));
 for(const [key,value] of Object.entries({...packet.stats,viewFrames:store.frames.length,viewEpisodes:store.episodes.length,viewDenseSamples:store.episodes.reduce((n,r)=>n+r.samples.length+(r.executionSamples?.length??0),0)}))max[key]=Math.max(max[key]??0,value);
 if(target%128===0){maxCacheBytes=Math.max(maxCacheBytes,Buffer.byteLength(JSON.stringify(store)));rows.push({t:target,ships:a.ships,stats:packet.stats,resources:r,current:a.current,stocks:stockAt(view,target)});}
}
// A paused cursor retains its old watermark during one bounded pending reply.
const held=store.oldest,after=engine.frontier;while(engine.frontier<after+1)engine.advanceTo(after+1);store.ingest(engine.delta(after),true);store.view(held);maxHeldSamples=store.episodes.reduce((n,r)=>n+r.samples.length,0);store.release();
if(cargoError>1e-10 || fuelError>1e-10 || max.denseSamples>DENSE_SAMPLE_BUDGET || max.viewDenseSamples>DENSE_SAMPLE_BUDGET || maxHeldSamples>DENSE_SAMPLE_BUDGET+16384 || maxPacketBytes>4e6 || maxCacheBytes>32e6 || max.renderSamples>16384 || engine.snapshot().ships.some(s=>s.voyage<100 || ['fault','unavailable'].includes(s.stage)))throw Error('Surface soak budget/conservation gate failed');
const report={duration:1024,historyDuration:128,wallSeconds:(performance.now()-start)/1000,cargoError,fuelError,max,maxPacketBytes,maxCacheBytes,maxViewMs,maxHeldSamples,pendingPacketLimit:16384,denseCacheLimit:DENSE_SAMPLE_BUDGET,byteAccounting:'UTF-8 JSON wire-equivalent bytes; JS objects/structured-clone transient heap measured separately in browser, not equated with these bytes.',rows,services:[...services.values()],final:engine.snapshot(),display:cases.map(c=>({case:c.label,...c.display}))};
writeFileSync('docs/evidence/surface-traffic-soak.json',JSON.stringify(report,null,2)+'\n');console.log({cargoError,fuelError,max,maxPacketBytes,maxCacheBytes,maxViewMs,wallSeconds:report.wallSeconds});
