import {test} from 'node:test';
import assert from 'node:assert/strict';
import finite from '../../fixtures/model-sets/aster-selene-staged-expedition.json';
import type {StagedApolloMission,MissionAccounts,prepareStagedApollo} from '../../src/model-set/staged-apollo';
import {StagedServiceEngine,type StagedServiceDefinition} from '../../src/staged-service/engine';
import {StagedServiceViewStore} from '../../src/staged-service/view';
import {STAGED_PARTS,STAGED_ACTORS,stagedOccurrence,stagedPresent,stagedDrawingSample,stagedServicePresenceLabel,scheduledStagedSample,stagedStateAt,stagedDisplayOrigin,type StagedActor,type StagedVessel} from '../../src/staged-service/query';
import {rotate,rotateState} from '../../src/expedition/query';
import {portState} from '../../src/sim/logistics';
import type {SceneView,VesselView,ViewSample} from '../../src/model-set/model';

// This context tests the recurrence adapter, not the uncompiled mission's flight.
// The production constructor's default compiler remains prepareStagedApollo.
function synthetic(){
 const d=structuredClone(finite) as StagedApolloMission;
 const wrapper:StagedServiceDefinition={modelVersion:'staged-continuous-v1',schemaVersion:1,id:'test-staged-service',name:'Synthetic recurrence',description:'Accounting fixture',provenance:'Synthetic prepared context, no flight admission',source:d,maxImport:10};
 const recoveries={booster:8,orbiter:70},spent=Object.fromEntries(STAGED_PARTS.map(key=>[key,d.hardware[key].propellant*.5])) as Record<typeof STAGED_PARTS[number],number>;
 const role=(id:string):StagedActor=>id===d.stack.id?'stack':STAGED_PARTS.find(key=>d.hardware[key].id===id)!;
 const sample=(id:string,t:number,before=false):ViewSample=>{
  const key=role(id),part=key==='stack'?'booster':key,h=d.hardware[part],finish=part==='lander'?d.lunarDock:recoveries[part],begin=part==='booster'?0:part==='orbiter'?d.boosterSeparation:d.lunarSeparation;
  const used=spent[part]*Math.max(0,Math.min(1,(t-begin)/(finish-begin))),fuel=h.propellant-used;
  const attached=key==='stack'?d.hardware.orbiter.dryMass+d.hardware.orbiter.propellant+d.hardware.lander.dryMass+d.hardware.lander.propellant:key==='orbiter'&&(t<d.lunarSeparation||t>=d.lunarDock)?d.hardware.lander.dryMass+(t<d.lunarSeparation?d.hardware.lander.propellant:d.hardware.lander.propellant-spent.lander):0;
  const q:ViewSample={t,y:portState(d.ports[0],t),propellant:fuel,mass:h.dryMass+fuel+attached,fuelUsed:used,burnCursor:0,status:'running',detail:'',axis:[1,0,0]};
  if(key==='stack'&&t<d.launch)q.logistics={operationCursor:0,cargoMass:0,fuelUsed:used,ports:[],dockedPortId:d.ports[0].id};
  return q;
 };
 const accounts=(t:number,before=false):MissionAccounts=>{
  const parts=Object.fromEntries(STAGED_PARTS.map(key=>{const q=sample(d.hardware[key].id,t,before);return [key,{id:d.hardware[key].id,propellant:q.propellant,consumedFuel:q.fuelUsed!,ownerId:t<d.boosterSeparation||t===d.boosterSeparation&&before?d.stack.id:key==='lander'&&(t<d.lunarSeparation||t===d.lunarSeparation&&before||t>d.lunarDock||t===d.lunarDock&&!before)?d.hardware.orbiter.id:d.hardware[key].id,y:q.y}];})) as MissionAccounts['parts'];
  const remainingFuel=STAGED_PARTS.reduce((n,key)=>n+parts[key].propellant,0),consumedFuel=STAGED_PARTS.reduce((n,key)=>n+parts[key].consumedFuel,0),dryMass=STAGED_PARTS.reduce((n,key)=>n+d.hardware[key].dryMass,0);
  return {t,parts,remainingFuel,consumedFuel,dryMass,activeMass:dryMass+remainingFuel};
 };
 const seams=[0,d.launch,d.boosterSeparation,d.lunarSeparation,d.lunarDock,...Object.values(recoveries),d.world.duration];
 const vessels=STAGED_ACTORS.map(key=>{
  const part=key==='stack'?'booster':key,h=d.hardware[part],id=key==='stack'?d.stack.id:h.id,recovery=part==='lander'?recoveries.orbiter:recoveries[part];
  const lifetime=key==='stack'?{start:0,end:d.boosterSeparation,retired:true}:key==='lander'?{start:d.lunarSeparation,end:d.lunarDock,retired:true,parentId:d.hardware.orbiter.id}:{start:d.boosterSeparation,end:d.world.duration,parentId:d.stack.id};
  const metadata=key==='stack'?d.stack:h;
  const base:VesselView={...metadata,ship:{...h,state:portState(d.ports[0],0),cargoMass:0},cargo:'',cargoCapacity:0,ports:d.ports,arcs:[],continuousFuel:true,portSamples:{},lifetime,ledger:[],boundaries:seams.map(t=>({t,before:sample(id,t,true),after:sample(id,t)})),samples:[...new Set([...seams,...Array.from({length:349},(_,i)=>i*.25)])].sort((a,b)=>a-b).map(t=>sample(id,t))};
  if(key==='booster'||key==='orbiter')base.entry={activeFrom:recovery,entryEpoch:recovery,brakingEpoch:recovery,heatScale:1,recovery:{t:recovery,y:portState(d.ports[0],recovery),spin:[0,0,.03],center:[0,0,0]},physics:{scenario:{...d.world,ship:base.ship},atmosphere:d.entry.atmosphere,aero:d.entry.aero,guidance:d.entry.guidance,recovery:d.entry.recovery}};
  return base;
 });
 const view:SceneView={schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:d.extent,stations:d.ports.map(p=>({id:p.id,role:'Ground',berths:1})),rotating:{name:'Rotating',rate:.09,phase:0},vessels,portSamples:{},world:{bodies:d.world.bodies,ports:d.ports,units:d.world.units},window:{start:0,end:d.world.duration}};
 let compilations=0;const compile=((_:StagedApolloMission)=>{compilations++;return {definition:d,view,work:{physicsBytes:1,nodes:1,bytes:1},sample,accounts,recoveries,spent};}) as typeof prepareStagedApollo;
 return {wrapper,compile,compilations:()=>compilations,sample,accounts};
}
const close=(a:number,b:number,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('three tank recurrence preserves unique ownership, protected fuel, exact seams and paid supported refill',()=>{
 const s=synthetic(),e=new StagedServiceEngine(s.wrapper,s.compile),p=e.schedule;
 for(const t of [0,s.wrapper.source.launch,s.wrapper.source.boosterSeparation,s.wrapper.source.lunarSeparation,s.wrapper.source.lunarDock,p.parts.booster.recovery+4,p.parts.orbiter.recovery+4,p.period-3,p.period-2,p.period])for(const before of [true,false]){
  const a=e.accounts(t,before);assert.equal(a.dryMass,1.2);assert.equal(Object.keys(a.parts).length,3);
  const o=stagedOccurrence(p,t,before),refilled=t>(o.index+1)*p.period-2||t===(o.index+1)*p.period-2&&!before;
  const imports=(o.index+(refilled?1:0))*STAGED_PARTS.reduce((n,key)=>n+p.parts[key].spent,0);
  close(STAGED_PARTS.reduce((n,key)=>n+p.parts[key].fuel,0)+imports,a.remainingFuel+a.consumedFuel);
 }
 const split=s.wrapper.source.boosterSeparation,dock=s.wrapper.source.lunarDock;
 assert.equal(e.accounts(split,true).parts.booster.ownerId,s.wrapper.source.stack.id);
 assert.equal(e.accounts(split).parts.booster.ownerId,p.parts.booster.id);
 assert.equal(e.accounts(dock,true).parts.lander.ownerId,p.parts.lander.id);
 assert.equal(e.accounts(dock).parts.lander.ownerId,p.parts.orbiter.id);
 assert.equal(stagedPresent(p,'stack',split,true),true);assert.equal(stagedPresent(p,'stack',split),false);
 assert.equal(stagedPresent(p,'lander',dock,true),true);assert.equal(stagedPresent(p,'lander',dock),false);
 assert.equal(stagedPresent(p,'stack',p.period-3),true);
 assert.equal(e.accounts(p.period-3).parts.lander.ownerId,s.wrapper.source.stack.id);
 const refuel=p.period-2,a=e.accounts(refuel,true),b=e.accounts(refuel);
 for(const key of STAGED_PARTS){close(b.parts[key].propellant-a.parts[key].propellant,p.parts[key].spent);close(a.parts[key].consumedFuel,b.parts[key].consumedFuel);}
 e.advanceTo(refuel);const packet=e.delta();assert.equal(packet.events.length,3);assert.equal(packet.resources.length,2);
 close(packet.resources.at(-1)!.fuelImported,b.remainingFuel-a.remainingFuel);
 assert.deepEqual(e.sample('booster',p.parts.booster.recovery+4).y,portState(p.pad,p.parts.booster.recovery+4));
 assert.equal(e.sample('booster',p.parts.booster.recovery+3).activity?.reason,'Ground recovery transport');
 assert.equal(e.sample('lander',p.parts.orbiter.recovery+3).opacity,0);
 for(const id of STAGED_PARTS){
  assert.deepEqual(e.sample(id,p.parts[id].recovery+3).frameOrigin,e.sample(id,p.parts[id].recovery+5).frameOrigin);
  assert.deepEqual(e.sample(id,p.parts[id].recovery+5).y,portState(p.pad,p.parts[id].recovery+5));
 }
 const faded=e.sample('stack',p.period-2.5),held=e.sample('booster',p.parts.booster.recovery+3).frameOrigin!;
 assert.deepEqual(faded.frameOrigin,held.map((x,i)=>x+(faded.y[i]-x)*.5));
 assert.equal(e.sample('stack',p.period-2).frameOrigin,undefined);
 for(let t=0;t<p.period;t+=.25)for(const id of STAGED_ACTORS)if(!stagedPresent(p,id,t))assert.equal(e.sample(id,t).opacity,0,`${id}@${t}`);
 assert.equal(e.sample('lander',p.parts.orbiter.recovery+1.5).opacity,0);
 assert.equal(s.compilations(),1);
});

test('indexed late boundaries rotate canonical state, attitude and aerodynamic vectors together',()=>{
 const s=synthetic(),e=new StagedServiceEngine(s.wrapper,s.compile),p=e.schedule,index=9000,local=s.wrapper.source.boosterSeparation,t=index*p.period+local;
 for(const before of [true,false]){
  const q=e.sample('booster',t,before),expected=s.sample(p.parts.booster.id,local,before);
  assert.deepEqual(q.y,rotateState(expected.y,(index*p.angle)%(2*Math.PI)));close(q.fuelUsed!,index*p.parts.booster.spent+expected.fuelUsed!);
  assert.equal(stagedOccurrence(p,t,before).local,local);
 }
 const source={...s.sample(p.parts.orbiter.id,10),axis:[1,0,0],aero:{airVelocity:[1,2,3],relativeVelocity:[2,3,4],drag:[3,4,5],lift:[4,5,6]}} as ViewSample;
 const q=scheduledStagedSample(p,e.templates,'orbiter',index*p.period+10,()=>source);
 assert.deepEqual(q.axis,rotate(source.axis!,index*p.angle%(2*Math.PI)));
 for(const key of ['airVelocity','relativeVelocity','drag','lift'] as const)assert.deepEqual(q.aero![key],rotate(source.aero![key],index*p.angle%(2*Math.PI)));
 const left=e.accounts(index*p.period,true),right=e.accounts(index*p.period);
 for(const key of STAGED_PARTS){close(left.parts[key].propellant,right.parts[key].propellant);close(left.parts[key].consumedFuel,right.parts[key].consumedFuel);}
 assert.throws(()=>e.sample('orbiter',p.maxEpoch+1),/outside admitted/);
});

test('worker rows preserve a held cursor and resource anchor, bound retention, and stop at the final calendar',()=>{
 const s=synthetic(),e=new StagedServiceEngine(s.wrapper,s.compile),p=e.schedule,store=new StagedServiceViewStore(e.definition,true);
 e.advanceTo(130);const first=e.delta();store.ingest(first);assert.ok(first.template);assert.ok(first.preparedCycles.length>0);
 const forged={...e.delta(),preparedCycles:[{...first.preparedCycles[0],templateId:'wrong-template'}]};assert.throws(()=>store.ingest(forged),/Invalid worker-prepared/);assert.equal(store.frontier,130);
 const cursor=store.oldest,old=store.view(cursor),held=STAGED_ACTORS.map(id=>stagedDrawingSample(p,e.templates,id,cursor)),anchor=old.traffic!.resources[0];
 e.advanceTo(131);store.ingest(e.delta(),true);assert.equal(store.oldest,cursor);
 const retained=store.view(cursor);assert.deepEqual(retained.traffic!.resources[0],anchor);
 for(const [i,id] of STAGED_ACTORS.entries())assert.deepEqual(stagedDrawingSample(p,(retained.vessels[i] as StagedVessel).stagedService.templates,id,cursor),held[i]);
 store.release();assert.equal(store.oldest,3);assert.throws(()=>store.view(cursor),/Cursor outside/);
 for(let t=e.frontier+1024;t<20000;t+=1024){e.advanceTo(t);const packet=e.delta();assert.equal(packet.template,undefined);store.ingest(packet);const v=store.view(t);
  assert.ok(v.traffic!.stats.viewCycles<=4);assert.ok(v.traffic!.stats.retainedDrawingSamples<=240000);assert.ok(packet.resources.length<=3);assert.ok(packet.events.length<=6);
  const a=e.accounts(t),fuel=STAGED_PARTS.reduce((n,key)=>n+p.parts[key].fuel,0);close(fuel+packet.resources.at(-1)!.fuelImported,a.remainingFuel+a.consumedFuel,1e-8);
 }
 const resources=e.delta().resources;assert.throws(()=>e.advanceTo(e.frontier+5000),/budget/);assert.deepEqual(e.delta().resources,resources);
 for(let t=e.frontier+4096;t<p.maxEpoch;t+=4096)e.advanceTo(t);
 e.advanceTo(p.maxEpoch);const terminal=e.delta();store.ingest(terminal);const v=store.view(p.maxEpoch);
 assert.equal(v.window.end,p.maxEpoch);assert.equal(v.traffic!.halt,'Exhibit calendar ended');
 for(const actor of v.vessels){assert.ok(actor.samples.every(q=>q.t<=p.maxEpoch));assert.ok(actor.boundaries.every(b=>b.t<=p.maxEpoch));assert.ok(actor.arcs.every(a=>a.end<=p.maxEpoch));}
 for(const [i,actor] of v.vessels.entries()){
  const q=stagedDrawingSample(p,e.templates,STAGED_ACTORS[i],p.maxEpoch);
  assert.deepEqual(stagedStateAt(actor as StagedVessel,p.maxEpoch),q.y);assert.deepEqual(stagedDisplayOrigin(actor as StagedVessel,p.maxEpoch),q.frameOrigin??q.y);
 }
 assert.equal(s.compilations(),1);
 assert.equal(stagedServicePresenceLabel(v.vessels[3] as StagedVessel,s.wrapper.source.lunarDock),'Attached to orbiter');
});

test('unsupported symmetry, undersupplied tanks and unexpected wrapper fields refuse before publication',()=>{
 const s=synthetic(),d=structuredClone(s.wrapper);d.maxImport=.01;assert.throws(()=>new StagedServiceEngine(d,s.compile),/supply budget/);
 const tilted=synthetic();tilted.wrapper.source.entry.atmosphere.spin[0]=.01;
 // Compiler admission controls definition; injected prepared context uses same source object.
 assert.throws(()=>new StagedServiceEngine(tilted.wrapper,tilted.compile),/symmetry/);
 assert.throws(()=>new StagedServiceEngine({...s.wrapper,extra:1} as StagedServiceDefinition,s.compile),/Invalid continuous/);
});
