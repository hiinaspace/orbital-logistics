import fs from 'node:fs';
import fixture from '../fixtures/model-sets/aster-selene-crossings.json';
import {ExpeditionFleetEngine,type ExpeditionFleetDefinition} from '../src/expedition/fleet';
import {ExpeditionFleetViewStore} from '../src/expedition/fleet-view';
const started=performance.now(),engine=new ExpeditionFleetEngine(fixture as ExpeditionFleetDefinition),store=new ExpeditionFleetViewStore(engine.definition);
const preparationMs=performance.now()-started,samples:{t:number;y:number[]}[]=[];
let maxAdvanceMs=0,maxViewMs=0,peakPacket=0,peakPhysicalNodes=0,peakPhysicalBytes=0,peakDrawingBytes=0,peakDrawingSamples=0,peakCycles=0,maxFuelError=0;
for(let t=0;t<=620;t++){
 const began=performance.now();engine.advanceTo(t);maxAdvanceMs=Math.max(maxAdvanceMs,performance.now()-began);
 const p=engine.delta();store.ingest(p);
 peakPacket=Math.max(peakPacket,p.stats.packetBytes);peakPhysicalNodes=Math.max(peakPhysicalNodes,p.stats.physicalNodes);peakPhysicalBytes=Math.max(peakPhysicalBytes,p.stats.physicsBytes);
 maxFuelError=Math.max(maxFuelError,Math.abs(2*engine.seed.schedule.fuel+p.resources.at(-1)!.fuelImported-p.current.reduce((n,q)=>n+q.propellant+q.fuelUsed!,0)));
 if(t<=320&&t%4===0)samples.push({t,y:engine.orbiter.sample(t).y});
 if(t%16===0){const began=performance.now(),view=store.view(t);maxViewMs=Math.max(maxViewMs,performance.now()-began);peakDrawingBytes=Math.max(peakDrawingBytes,view.traffic!.stats.retainedDrawingBytes);peakDrawingSamples=Math.max(peakDrawingSamples,view.traffic!.stats.retainedDrawingSamples);peakCycles=Math.max(peakCycles,view.traffic!.stats.viewCycles);}
}
const result={definition:engine.definition,preparationMs,totalMs:performance.now()-started,maxAdvanceMs,maxViewMs,peakPacket,peakPhysicalNodes,peakPhysicalBytes,peakDrawingBytes,peakDrawingSamples,peakCycles,maxFuelError,stats:engine.delta().stats,samples};
fs.writeFileSync('docs/evidence/crossings.json',JSON.stringify(result,null,2)+'\n');console.log({...result,definition:undefined,samples:undefined});
