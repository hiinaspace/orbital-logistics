import fs from 'node:fs';
import fixture from '../fixtures/model-sets/aster-selene-service.json';
import {ExpeditionEngine,type ExpeditionDefinition} from '../src/expedition/engine';
import {ExpeditionViewStore} from '../src/expedition/view';
const started=performance.now(),engine=new ExpeditionEngine(fixture as ExpeditionDefinition),store=new ExpeditionViewStore(engine.definition);
const preparationMs=performance.now()-started;
let peakPacket=0,peakRows=0,peakCycles=0,peakRetainedBytes=0,peakRetainedSamples=0,maxBalance=0,maxAdvanceMs=0,maxViewMs=0;
for(let t=0;t<=engine.schedule.period*25;t+=1){
 const advanceStarted=performance.now();engine.advanceTo(t);maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-advanceStarted);const delta=engine.delta();store.ingest(delta);peakPacket=Math.max(peakPacket,delta.stats.packetBytes);
 const actual=delta.current,imported=delta.resources.at(-1)!.fuelImported;
 maxBalance=Math.max(maxBalance,Math.abs(engine.schedule.fuel+imported-actual.propellant-actual.fuelUsed!));
 if(t%16===0){const viewStarted=performance.now(),view=store.view(t);maxViewMs=Math.max(maxViewMs,performance.now()-viewStarted);peakRetainedBytes=Math.max(peakRetainedBytes,store.stats.retainedDrawingBytes);peakRetainedSamples=Math.max(peakRetainedSamples,store.stats.retainedDrawingSamples);peakRows=Math.max(peakRows,view.vessels[0].samples.length);peakCycles=Math.max(peakCycles,view.traffic!.stats.viewCycles);}
}
const result={period:engine.schedule.period,preparationMs,preparationAndRolloutMs:performance.now()-started,maxAdvanceMs,maxViewMs,peakRetainedBytes,peakRetainedSamples,frontier:engine.frontier,peakPacket,peakRows,peakCycles,maxBalance,stats:engine.delta().stats};
fs.writeFileSync('docs/evidence/continuous-apollo.json',JSON.stringify(result,null,2)+'\n');console.log(result);
