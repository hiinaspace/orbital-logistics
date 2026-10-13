import {test} from 'node:test';
import assert from 'node:assert/strict';
import survey from '../../fixtures/model-sets/libration-survey.json';
import mission from '../../fixtures/model-sets/observatory-mission.json';
import {SurveyEngine} from '../../src/binary/survey-engine';
import {SurveyStore} from '../../src/binary/survey-store';
import {surveyEpisode,validateSurvey,type SurveyDefinition} from '../../src/binary/survey';
import {prepareObservatoryMission,validateObservatoryMission,type ObservatoryMission} from '../../src/binary/mission';
import {bodyState} from '../../src/sim/dynamics';
import {sampleVessel,stateAt} from '../../src/model-set/model';
import {rotatingState} from '../../src/binary/model';
const d=survey as SurveyDefinition;
test('survey canonical controls survive request partition and phase-anchor continuation',()=>{
 const a=new SurveyEngine(d),b=new SurveyEngine(d);a.advanceTo(32);for(let t=4;t<=32;t+=4)b.advanceTo(t);assert.deepEqual(a.anchor(),b.anchor());assert.deepEqual(a.delta().chunks,b.delta().chunks);
 const anchor=a.anchor(),c=surveyEpisode(d,anchor.t,anchor.y,anchor.fuel,anchor.phases);a.advanceTo(36);assert.deepEqual(a.delta().chunks,[c]);
 const store=new SurveyStore(d);const initial=new SurveyEngine(d);initial.advanceTo(32);const packet=initial.delta();const displaced=structuredClone(packet);for(const c of displaced.chunks)for(const q of c.samples)q.y[0]+=.01;displaced.anchor.y[0]+=.01;assert.throws(()=>store.ingest(displaced),/initial seed/);assert.equal(store.frontier,0);store.ingest(packet);const held=store.view(16);initial.advanceTo(36);const next=initial.delta(),bad=structuredClone(next);bad.chunks[0].samples[0].y[0]+=.01;assert.throws(()=>store.ingest(bad));assert.equal(store.frontier,32);assert.deepEqual(store.view(16),held);store.ingest(next,true);assert.deepEqual(store.view(16).vessels[0].samples.filter(s=>s.t<32),held.vessels[0].samples.filter(s=>s.t<32));store.release();initial.advanceTo(40);store.ingest(initial.delta());const sv=store.view(36.49999).vessels[0],sample=sampleVessel(sv,36.49999);assert.ok(Number.isFinite(sample.mass)&&Number.isFinite(sample.thrust!.force)&&Number.isFinite(sample.thrust!.acceleration));assert.ok(Math.abs(sample.fuelUsed!-(.4-sample.propellant))<1e-12);
 const exhausted=structuredClone(d);exhausted.source.vessels[0].bundle.scenario.ship.engine!.maxThrust=.01;assert.throws(()=>validateSurvey(exhausted));assert.throws(()=>surveyEpisode(d,36,c.samples.at(-1)!.y,.039,c.phases));
});
test('staged observatory keeps payload fuel, pays flight and coasts through an entire halo circuit',()=>{
 const m=mission as ObservatoryMission,r=prepareObservatoryMission(m);assert.equal(r.separation.beforeMass,r.separation.afterMass);assert.deepEqual(r.separation.momentumBefore,r.separation.momentumAfter);assert.equal(r.separation.reservedPayloadFuel,.4);assert.deepEqual(r.lower.sample(m.split).y,r.upper.sample(m.split).y);assert.equal(r.lower.sample(m.land).logistics!.dockedPortId,m.pad.id);assert.ok(r.lower.sample(m.land).propellant>.9);
 for(let i=1;i<r.upperSegments.length;i++){const t=r.upperSegments[i].bundle.scenario.epoch;assert.deepEqual(r.upperSegments[i-1].sample(t).y,r.upperSegments[i].sample(t).y);assert.equal(r.upperSegments[i-1].sample(t).propellant,r.upperSegments[i].sample(t).propellant);}
 let turns=0,angle:number|undefined;for(let t=m.parking;t<m.departure;t+=.05){const y=r.upper.sample(t).y,p=bodyState(r.upper.bundle.scenario.bodies[1],t),q=Math.atan2(y[1]-p[1],y[0]-p[0]);if(angle!==undefined)turns+=Math.atan2(Math.sin(q-angle),Math.cos(q-angle));angle=q;}assert.ok(turns>4*Math.PI,`Parking ${turns/(2*Math.PI)} turns`);
 const get=(t:number)=>r.upperSegments.find(s=>t>=s.bundle.scenario.epoch&&t<=s.bundle.scenario.epoch+s.bundle.scenario.duration)!.sample(t);const start=rotatingState(m.source.binary,get(m.arrival).y,m.arrival),end=rotatingState(m.source.binary,get(m.arrival+m.source.binary.period).y,m.arrival+m.source.binary.period);assert.ok(Math.max(...start.map((v,i)=>Math.abs(v-end[i])))<1e-7);assert.ok(get(m.end).propellant>.35);assert.ok(r.parent.retainedNodes+r.lower.retainedNodes+r.upperSegments.reduce((n,v)=>n+v.retainedNodes,0)<220000);
 let pixels=0;for(const runner of [r.parent,r.lower,...r.upperSegments]){const v=r.view.vessels.find(v=>v.id===runner.bundle.scenario.ship.id)!;for(let t=runner.bundle.scenario.epoch+.003;t<runner.bundle.scenario.epoch+runner.bundle.scenario.duration;t+=.137){const native=runner.sample(t).y,draw=stateAt(v,t);pixels=Math.max(pixels,Math.hypot(...draw.slice(0,3).map((x,i)=>x-native[i]))*(t<3?60000:4000));}}assert.ok(pixels<.25,`Hermite error ${pixels} pixels`);
 const displayed=r.view.vessels.find(v=>v.id===m.upper.id)!;for(const arc of displayed.arcs){const q=sampleVessel(displayed,arc.end-1e-6);assert.ok(Number.isFinite(q.mass));assert.ok(Math.abs(q.fuelUsed!-(.4-q.propellant))<1e-12);}
 const override=structuredClone(m);Object.assign(override.stack,{dryMass:10});assert.throws(()=>prepareObservatoryMission(override));
 const bad=structuredClone(m);bad.end=60;assert.throws(()=>validateObservatoryMission(bad));bad.end=80;bad.programs.upper.burns.push({id:'free',t:3,deltaV:[0,0,0]});assert.throws(()=>validateObservatoryMission(bad));
});
