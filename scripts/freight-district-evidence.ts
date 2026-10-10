import {writeFileSync} from 'node:fs';
import fixture from '../fixtures/traffic/orison-freight-district.json';
import northern from '../fixtures/model-sets/orison-latitude-shuttle.json';
import {admitEpisode,nextWindow,flightCacheLimits,CALENDAR_LIMIT,type TrafficDefinition} from '../src/traffic/planner';
import {WholeFlightCache} from '../src/traffic/prepared';
import {TrafficEngine} from '../src/traffic/engine';
import {TrafficViewStore} from '../src/traffic/view';
import {Runner} from '../src/sim/runner';
const d=fixture as TrafficDefinition,cache=new WholeFlightCache(flightCacheLimits(d)),legs=[];
const cold=performance.now();
for(const t of d.templates)admitEpisode(d,t,'warmup',0,0,{index:0,departure:t.referenceDeparture},t.cargo,t.propellant,cache);
const coldMs=performance.now()-cold,warmAdmissionMs:number[]=[];
for(const t of d.templates)for(const after of [.2,512,CALENDAR_LIMIT-40]){
 const w=nextWindow(d,t,after),start=performance.now(),e=admitEpisode(d,t,'evidence',0,0,w,t.cargo,t.propellant,cache);warmAdmissionMs.push(performance.now()-start);
 const at=e.runner.sample(t.duration),capture=e.runner.ledger.find(l=>l.id===e.arrivalOperationId)!;
 legs.push({id:t.id,sourceId:t.source,departure:w.departure,bundle:e.bundle,begin:0,end:t.duration,capture:{...capture,y:at.y},samples:Array.from({length:65},(_,i)=>e.runner.sample(t.duration*i/64))});
}
const r=new Runner(northern.vessels[0].bundle);r.advanceTo(17);
for(const arc of r.bundle.program.thrustArcs!){
 const initial=r.sample(arc.start),b=structuredClone(r.bundle),end=r.eventBoundaries.find(e=>e.t===arc.end)!;
 b.scenario.ship.cargoMass=initial.logistics!.cargoMass;b.scenario.ship.propellant=initial.propellant;
 legs.push({id:'Northern-'+arc.id,sourceId:arc.id==='ascent'?'Northport':'Crown',departure:arc.start,bundle:b,begin:arc.start,end:arc.end,capture:{y:end.after.y},samples:Array.from({length:65},(_,i)=>r.sample(arc.start+(arc.end-arc.start)*i/64))});
}
const e=new TrafficEngine(d),store=new TrafficViewStore(e.definition);store.ingest(e.delta());
let maxDense=0,maxViewBytes=0,maxDeltaBytes=0,maxAdvanceMs=0,maxFuelBalance=0,maxCargoBalance=0,resourceWaits=0;
const start=performance.now();
for(let t=8;t<=1024;t+=8){
 const after=e.frontier,a=performance.now();while(e.frontier<t)e.advanceTo(t);maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-a);
 const p=e.delta(after);store.ingest(p);maxDense=Math.max(maxDense,p.stats.denseSamples);
 maxViewBytes=Math.max(maxViewBytes,new TextEncoder().encode(JSON.stringify(store.view(t))).byteLength);
 maxDeltaBytes=Math.max(maxDeltaBytes,new TextEncoder().encode(JSON.stringify(p)).byteLength);
 resourceWaits+=p.events.filter(e=>e.kind==='planning-failed').length;
 if(p.events.some(e=>['fault','unavailable'].includes(e.kind)||e.kind==='planning-failed'&&e.detail?.includes('Transfer planning failed')))throw Error('Unexpected flight failure');
 const state=e.snapshot(),s=state.resources;
 const fuel=s.stocks.reduce((n,s)=>n+s.propellant,0)+state.current.ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+s.fuelExported-s.fuelImported;
 const cargo=s.stocks.reduce((n,s)=>n+s.cargo,0)+state.current.ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+s.cargoExported-s.cargoImported;
 maxFuelBalance=Math.max(maxFuelBalance,Math.abs(fuel-d.stations.reduce((n,s)=>n+s.propellant,0)-d.vessels.reduce((n,s)=>n+s.propellant,0)));
 maxCargoBalance=Math.max(maxCargoBalance,Math.abs(cargo-d.stations.reduce((n,s)=>n+s.cargo,0)));
}
const result={coldMs,warmAdmissionMs,soakMs:performance.now()-start,maxAdvance8UnitsMs:maxAdvanceMs,maxDense,maxViewBytes,maxDelta8UnitsBytes:maxDeltaBytes,maxFuelBalance,maxCargoBalance,resourceWaits,...e.delta().stats,ships:e.snapshot().ships.map(s=>({id:s.id,voyages:s.voyage,stage:s.stage})),unloaded:e.snapshot().unloaded};
if(maxViewBytes>8_000_000||maxDense>65536||maxFuelBalance>1e-10||maxCargoBalance>1e-10)throw Error('Runtime budget failed');
writeFileSync('docs/evidence/freight-district-input.json',JSON.stringify({definition:d,legs}));
writeFileSync('docs/evidence/freight-district-runtime.json',JSON.stringify(result,null,2)+'\n');console.log(result);
