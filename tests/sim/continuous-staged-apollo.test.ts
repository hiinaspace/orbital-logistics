import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/model-sets/aster-selene-staged-service.json';
import {StagedServiceEngine,type StagedServiceDefinition} from '../../src/staged-service/engine';
import {StagedServiceViewStore} from '../../src/staged-service/view';
import {STAGED_PARTS,STAGED_ACTORS,stagedDrawingSample,stagedPresent,stagedOccurrence,stagedStateAt,stagedDisplayOrigin,type StagedVessel} from '../../src/staged-service/query';
import {rotateState} from '../../src/expedition/query';

test('canonical staged mission repeats with three real tanks, bounded prepared views and supported imports',()=>{
 const e=new StagedServiceEngine(fixture as StagedServiceDefinition),p=e.schedule,store=new StagedServiceViewStore(e.definition,true),d=e.prepared.definition;
 const max=(a:number[],b:number[])=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
 const initial=STAGED_PARTS.reduce((n,key)=>n+p.parts[key].fuel,0);
 for(const local of [0,d.launch,d.boosterSeparation,d.ascentEnd,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,d.entryStart,p.parts.booster.recovery,p.parts.orbiter.recovery])for(const before of [true,false]){
  const a=e.accounts(local,before);assert.ok(Math.abs(initial-a.remainingFuel-a.consumedFuel)<1e-10);assert.equal(Object.keys(a.parts).length,3);
  for(const key of STAGED_PARTS){assert.ok(a.parts[key].propellant>0);assert.ok(a.parts[key].propellant<=p.parts[key].tankCapacity);}
 }
 for(const local of [0,d.boosterSeparation,d.lunarSeparation,d.lunarDock,p.parts.orbiter.recovery+1.5,p.parts.orbiter.recovery+3,p.period-3])for(const id of STAGED_ACTORS)if(!stagedPresent(p,id,local))assert.equal(e.sample(id,local).opacity,0,`${id}@${local}`);
 const comparison:{actor:string;local:number;positionError:number;fuelError:number;massError:number}[]=[];
 for(const local of [0,.5,.512345,2,2.234567,8,8.008991,28,28.123456,d.lunarSeparation,d.landing,d.liftoff,d.lunarDock,55,55.057971,d.entryStart,p.parts.orbiter.recovery+.5])for(const id of STAGED_ACTORS){
  const q=stagedDrawingSample(p,e.templates,id,local),actual=e.sample(id,local),positionError=max(q.y.slice(0,3),actual.y.slice(0,3)),fuelError=Math.abs(q.propellant-actual.propellant),massError=Math.abs(q.mass!-actual.mass!);
  comparison.push({actor:id,local,positionError,fuelError,massError});
  const stub={...e.templates[id],stagedService:{schedule:p,templates:e.templates,id},samples:[{...e.templates[id].samples[0],t:0},{...e.templates[id].samples.at(-1)!,t:p.maxEpoch}]} as StagedVessel;
  assert.deepEqual(stagedStateAt(stub,local),q.y);assert.deepEqual(stagedDisplayOrigin(stub,local),q.frameOrigin??q.y);
  assert.ok(positionError<3e-6,JSON.stringify(comparison.at(-1)));assert.ok(fuelError<3e-6,JSON.stringify(comparison.at(-1)));assert.ok(massError<6e-6,JSON.stringify(comparison.at(-1)));
 }
 e.advanceTo(32);const first=e.delta();store.ingest(first);const heldCursor=5,held=store.view(heldCursor),heldSamples=held.vessels.map(v=>stagedDrawingSample(p,e.templates,STAGED_ACTORS[held.vessels.indexOf(v)],heldCursor));
 e.advanceTo(33);store.ingest(e.delta(),true);const after=store.view(heldCursor);assert.deepEqual(after.traffic!.resources,held.traffic!.resources);
 assert.deepEqual(after.vessels.map((_,i)=>stagedDrawingSample(p,e.templates,STAGED_ACTORS[i],heldCursor)),heldSamples);
 store.release();
 const cold=new StagedServiceEngine(e.definition,()=>e.prepared);cold.advanceTo(12*p.period+d.entryStart);const coldPacket=cold.delta();
 assert.ok(coldPacket.stats.packetBytes<64_000_000);assert.ok(coldPacket.preparedCycles.length===3);
 const coldStore=new StagedServiceViewStore(e.definition,true);coldStore.ingest(coldPacket);coldStore.view(cold.frontier);
 const records:{epoch:number;physicsBytes:number;physicalNodes:number;packetBytes:number;drawingBytes:number;drawingSamples:number;viewCycles:number;fuelBalanceError:number}[]=[];
 for(const t of [p.period-2,p.period+.5,2*p.period+d.lunarDock,5*p.period+40,12*p.period+d.entryStart]){
  e.advanceTo(t);const packet=e.delta();store.ingest(packet);const view=store.view(t),a=e.accounts(t),balance=Math.abs(initial+packet.resources.at(-1)!.fuelImported-a.remainingFuel-a.consumedFuel);
  assert.ok(balance<1e-10);assert.equal(packet.stats.cacheCompilations,1);assert.equal(packet.stats.physicalNodes,e.prepared.work.nodes);
  assert.ok(view.traffic!.stats.viewCycles<=4);assert.ok(packet.stats.packetBytes<48_000_000);assert.ok(view.traffic!.stats.retainedDrawingBytes<=84_000_000);assert.ok(view.traffic!.stats.retainedDrawingSamples<=240000);
  records.push({epoch:t,physicsBytes:packet.stats.physicsBytes,physicalNodes:packet.stats.physicalNodes,packetBytes:packet.stats.packetBytes,drawingBytes:view.traffic!.stats.retainedDrawingBytes,drawingSamples:view.traffic!.stats.retainedDrawingSamples,viewCycles:view.traffic!.stats.viewCycles,fuelBalanceError:balance});
 }
 const refuel=9000*p.period-2;
 for(const key of STAGED_PARTS){assert.equal(e.sample(key,refuel).propellant,p.parts[key].fuel);assert.ok(Math.abs(e.sample(key,refuel,true).propellant-(p.parts[key].fuel-p.parts[key].spent))<1e-12);}
 for(const index of [0,2,9000])for(const local of [d.boosterSeparation,d.lunarDock,.512345,p.parts.orbiter.recovery+3,p.period-2.5,p.period-2])for(const id of STAGED_ACTORS){
  const t=index*p.period+local,q=stagedDrawingSample(p,e.templates,id,t);
  const stub={...e.templates[id],stagedService:{schedule:p,templates:e.templates,id},samples:[{...e.templates[id].samples[0],t:0},{...e.templates[id].samples.at(-1)!,t:p.maxEpoch}]} as StagedVessel;
  assert.deepEqual(stagedStateAt(stub,t),q.y);assert.deepEqual(stagedDisplayOrigin(stub,t),q.frameOrigin??q.y);
 }
 const split=9000*p.period+d.boosterSeparation;assert.equal(stagedOccurrence(p,split).local,d.boosterSeparation);assert.equal(stagedPresent(p,'stack',split),false);
 assert.ok(max(e.sample('orbiter',split).y,rotateState(e.prepared.sample(d.hardware.orbiter.id,d.boosterSeparation).y,(9000*p.angle)%(2*Math.PI)))<1e-12);
 for(let t=e.frontier+4096;t<p.maxEpoch;t+=4096)e.advanceTo(t);
 e.advanceTo(p.maxEpoch);const final=e.delta();store.ingest(final);const view=store.view(p.maxEpoch);
 assert.equal(view.window.end,p.maxEpoch);assert.equal(view.traffic!.halt,'Exhibit calendar ended');assert.ok(view.vessels.every(v=>v.samples.every(q=>q.t<=p.maxEpoch)&&v.boundaries.every(b=>b.t<=p.maxEpoch)&&v.arcs.every(a=>a.end<=p.maxEpoch)));
 const a=e.accounts(p.maxEpoch);assert.ok(Math.abs(initial+final.resources.at(-1)!.fuelImported-a.remainingFuel-a.consumedFuel)<1e-8);
 // Evidence is emitted only by this canonical integration, never synthetic tests.
 if(process.env.STAGED_SERVICE_EVIDENCE==='1'){
  const report={period:p.period,angle:p.angle,recoveries:e.prepared.recoveries,spent:e.prepared.spent,initialFuel:initial,work:e.prepared.work,firstPacketBytes:first.stats.packetBytes,coldPacketBytes:coldPacket.stats.packetBytes,comparison,records,terminal:{epoch:p.maxEpoch,halt:view.traffic!.halt,refills:final.stats.refills,packetBytes:final.stats.packetBytes,fuelBalanceError:Math.abs(initial+final.resources.at(-1)!.fuelImported-a.remainingFuel-a.consumedFuel),drawingBytes:view.traffic!.stats.retainedDrawingBytes,drawingSamples:view.traffic!.stats.retainedDrawingSamples}};
  requireWrite(report);
 }
});
import {writeFileSync} from 'node:fs';
function requireWrite(value:unknown){writeFileSync('docs/evidence/continuous-staged-apollo.json',JSON.stringify(value,null,2)+'\n');}
