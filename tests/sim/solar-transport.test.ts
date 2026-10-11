import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareSolar,solarStockAt,type SolarArtifact} from '../../src/solar/view';
import {solarBodyAcceleration,solarBodyState,solarGravity,solarStates,AU_KM,YEAR_SECONDS} from '../../src/solar/ephemeris';
import {sampleVessel,stateAt,stockAt,isPresent} from '../../src/model-set/model';
import {transform} from '../../src/model-set/frames';
import {solarStateAt} from '../../src/solar/query';
const artifact=JSON.parse(readFileSync('fixtures/model-sets/solar-cycler.json','utf8')) as SolarArtifact;
test('compiler origin accelerations agree with the independent spatial provider',()=>{
 for(const row of (artifact.proof as any).origins){const a=solarBodyAcceleration(artifact,row.index,row.t);for(let i=0;i<3;i++)assert.ok(Math.abs(a[i]-row.acceleration[i])<1e-9);}
});
test('nested solar ephemerides have consistent position, velocity and acceleration',()=>{
 for(const t of [0,.42,2.9,6.2])for(const [i,name] of ['Sun','Earth','Moon','Mars','Jupiter'].entries()){
  const h=1e-6,y=solarBodyState(artifact,name,t),before=solarBodyState(artifact,name,t-h),after=solarBodyState(artifact,name,t+h),acc=solarBodyAcceleration(artifact,i,t);
  for(let j=0;j<3;j++){assert.ok(Math.abs((after[j]-before[j])/(2*h)-y[j+3])<2e-6);assert.ok(Math.abs((after[j+3]-before[j+3])/(2*h)-acc[j])<3e-5);}
 }
});
test('finite three-cycle exhibit preserves fuel, cargo and nested-frame epochs',()=>{
 const view=prepareSolar(artifact),end=artifact.duration,stocks=stockAt(view,end),carrier=view.vessels[0];
 assert.equal(stocks[0].cargo,0);assert.equal(stocks[1].cargo,3);assert.equal(stocks[1].occupied,3);
 const fuelUsed=artifact.vessels.reduce((s,v)=>s+v.initialFuel-v.rows.at(-1)![7],0);
 assert.ok(Math.abs(stocks[0].propellant+stocks[1].propellant+sampleVessel(carrier,end).propellant+fuelUsed-117)<1e-10);
 for(const t of [0,.01,.38,2.18,4.66,end]){
  const stock=solarStockAt(view.solar!,t);assert.ok(stock.every(s=>s.cargo>=0&&s.propellant>=0&&s.occupied<=3));
  const actors=view.vessels.map(v=>({present:isPresent(v,t),sample:sampleVessel(v,t)}));
  const inventories=stock.reduce((s,p)=>s+p.propellant,0)+actors.filter(v=>v.present).reduce((s,v)=>s+v.sample.propellant,0);
  const consumed=actors.reduce((s,v)=>s+v.sample.fuelUsed!,0);
  assert.ok(Math.abs(inventories+consumed-117)<1e-10);
  assert.equal(stock.reduce((s,p)=>s+p.cargo,0)+actors.filter(v=>v.present).reduce((s,v)=>s+v.sample.logistics!.cargoMass,0),3);
  const moon=solarBodyState(view.solar!,'Moon',t),earth=solarBodyState(view.solar!,'Earth',t),local=transform(view,moon,t,'Earth');
  for(let i=0;i<6;i++)assert.equal(local[i],moon[i]-earth[i]);
  assert.deepEqual(stateAt(carrier,t),sampleVessel(carrier,t).y);
 }
 for(const taxi of artifact.vessels.slice(1))assert.ok(taxi.rows.at(-1)![7]>=taxi.initialFuel*.1);
 assert.ok(artifact.vessels[0].rows.at(-1)![7]>=6);
 assert.throws(()=>stateAt(carrier,end+1));
});
test('version, row order, exhausted tank and oversized controls reject before display',()=>{
 const wrong={...artifact,modelVersion:'solar-transport-v2'} as unknown as SolarArtifact;assert.throws(()=>prepareSolar(wrong));
 const bad=structuredClone(artifact);bad.vessels[0].rows[1][0]=0;assert.throws(()=>prepareSolar(bad));
 bad.vessels[0].rows[1][0]=artifact.vessels[0].rows[1][0];bad.vessels[0].rows[1][7]=-1;assert.throws(()=>prepareSolar(bad));
 for(const mutate of [
  (v:SolarArtifact)=>{v.vessels[0].arcs[0].localInitial=[];},
  (v:SolarArtifact)=>{v.vessels[0].arcs[0].localInitial[0]+=.001;},
  (v:SolarArtifact)=>{v.vessels[0].arcs[0].coefficients[0][3][0]=2*v.maxAcceleration;},
  (v:SolarArtifact)=>{v.vessels[1].captures![0].positionErrorMeters=10000;},
  (v:SolarArtifact)=>{v.vessels[1].captures![0].afterFuel+=.01;},
  (v:SolarArtifact)=>{v.vessels[1].events[1].t=v.vessels[0].arcs[0].end;},
 ])assert.throws(()=>prepareSolar(mutateClone(mutate)));
});
function mutateClone(mutate:(v:SolarArtifact)=>void){const v=structuredClone(artifact);mutate(v);return v;}
test('capture preserves approach left limit and records the paid atomic debit',()=>{
 const view=prepareSolar(artifact);
 for(const [index,taxi] of artifact.vessels.slice(1).entries())for(const c of taxi.captures!){
  const vessel=view.vessels[index+1],boundary=vessel.boundaries.find(b=>b.t===c.t)!;
  assert.deepEqual(boundary.before.y,c.before);assert.equal(boundary.before.propellant,c.beforeFuel);
  const ledger=vessel.ledger.find(e=>e.t===c.t&&e.kind==='dock')!;
  assert.equal(ledger.propellantAfter,c.afterFuel);assert.equal(ledger.fuelUsed,c.beforeFuel-c.afterFuel);assert.equal(ledger.deltaV,c.paidDeltaV);
  assert.ok(ledger.fuelUsed>0);
  const justBefore=solarStateAt(taxi.rows,c.t-1e-12,taxi.captures);
  assert.ok(Math.hypot(...justBefore.slice(0,3).map((x,i)=>x-c.before[i]))<1e-10);
  assert.deepEqual(stateAt(vessel,c.t),solarStateAt(taxi.rows,c.t));
 }
 // Known-bad capture large enough to expose event-right leakage into a segment.
 const rows=[[0,0,0,0,1,0,0,10,0],[1,100,0,0,5,0,0,9,0]],capture={t:1,before:[1,0,0,1,0,0],beforeFuel:10,afterFuel:9,positionErrorMeters:0,velocityErrorMetersS:0,paidDeltaV:0};
 assert.equal(solarStateAt(rows,.5,[capture])[0],.5);assert.notEqual(solarStateAt(rows,.5)[0],.5);
});
test('far-field heliocentric acceleration includes all indirect sources and supports 3D',()=>{
 const y=[.8,.7,.04,0,0,0],a=solarGravity(artifact,.3,y);assert.ok(a.every(Number.isFinite));assert.ok(a[2]<0);
 const states=solarStates(artifact,.3);assert.notEqual(states[2][2],0);assert.notEqual(states[3][2],0);
 assert.ok(AU_KM/YEAR_SECONDS>4&&AU_KM/YEAR_SECONDS<5);
});
