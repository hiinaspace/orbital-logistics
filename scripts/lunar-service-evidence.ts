import {readFileSync,writeFileSync} from 'node:fs';
import {LunarEngine} from '../src/lunar/engine';
import {LunarViewStore} from '../src/lunar/view';
import {Runner} from '../src/sim/runner';
import {sampleVessel,stockAt,displayPortState} from '../src/model-set/model';
import {resourcesAt} from '../src/traffic/resources';
import type {LunarDefinition} from '../src/lunar/world';
const definition=JSON.parse(readFileSync('fixtures/traffic/selene-ground-service.json','utf8')) as LunarDefinition;
const engine=new LunarEngine(definition),store=new LunarViewStore(definition),start=performance.now(),seen=new Set<number>(),cases:any[]=[],rollout:any[]=[];
let peakPhysical=0,peakView=0,peakPacket=0,peakSamples=0,minimumFuel=Infinity,pixelError=0,targetPixels=0;
for(let t=0;t<=64;t+=1/64){
 let calls=0;do{engine.advanceTo(t,128);if(++calls>20000)throw Error('Lunar job did not finish');}while((!engine.initialized||engine.frontier<t)&&!engine.halt);
 const packet=engine.delta();store.ingest(packet);peakPacket=Math.max(peakPacket,Buffer.byteLength(JSON.stringify(packet)));peakPhysical=Math.max(peakPhysical,packet.stats.physicalBytes,packet.stats.peakPhysicalBytes);peakView=Math.max(peakView,store.stats.viewBytes);
 peakSamples=Math.max(peakSamples,engine.missions.reduce((n,m)=>n+m.samples.length,0));
 const view=store.view(t),at=sampleVessel(view.vessels[0],t),stocks=stockAt(view,t),anchor=[...engine.resources].reverse().find(a=>a.t<=t)!,flows=resourcesAt(anchor,definition.stations,t);
 if(Math.abs(stocks.reduce((n,s)=>n+s.propellant,0)+at.propellant+at.fuelUsed!-(20+flows.fuelImported-flows.fuelExported))>1e-8)throw Error('Fuel conservation at '+t);
 if(Math.abs(stocks.reduce((n,s)=>n+s.cargo,0)+at.logistics!.cargoMass-(.2+flows.cargoImported-flows.cargoExported))>1e-8)throw Error('Cargo conservation at '+t);
 for(const m of packet.missions){
  minimumFuel=Math.min(minimumFuel,m.samples.at(-1)!.propellant);
  for(const e of m.ledger.filter(e=>e.kind==='dock'||e.kind==='land'))if(e.positionError!>1e-7||e.deltaV>1e-7)throw Error('Capture residual');
  if(!seen.has(m.id)&&(cases.length===0||cases.length===1&&m.bundle.program.thrustArcs![0].start>.6||cases.length===2&&m.start>2||cases.length===3&&m.start>6)){
   seen.add(m.id);const runner=new Runner(m.bundle);runner.advanceTo(m.end);
   const grids=[{step:m.bundle.scenario.policy.step,bundle:m.bundle,terminal:runner.sample(m.end),ledger:runner.ledger,
    flights:m.bundle.program.thrustArcs!.map(arc=>({arc,samples:Array.from({length:65},(_,i)=>{const t=arc.start+(arc.end-arc.start)*i/64;return i===64?runner.eventBoundaries.find(b=>b.t===arc.end)!.before:runner.sample(t);})})),
    targetSamples:Array.from({length:65},(_,i)=>{const t=m.start+(m.end-m.start)*i/64;return {t,y:runner.portState('Crescent',t)};})}];
   const v=store.view(Math.max(m.knownAt,store.oldest)).vessels[0];
   for(const arc of m.bundle.program.thrustArcs!)for(let i=0;i<128;i++){
    const t=arc.start+(arc.end-arc.start)*(i+.371)/128,a=sampleVessel(v,t).y,b=runner.sample(t).y;
    pixelError=Math.max(pixelError,Math.hypot(...a.slice(0,3).map((x,j)=>x-b[j]))*1e6);
    const p=displayPortState(m.bundle.scenario.logistics!.ports[1],v.portSamples,t),q=runner.portState('Crescent',t);
    targetPixels=Math.max(targetPixels,Math.hypot(...p.slice(0,3).map((x,j)=>x-q[j]))*1e6);
   }
   const original=definition.source.vessels[0].bundle.scenario.logistics!.ports[1].rail;if(original.kind!=='ballistic')throw Error('target');
   cases.push({id:m.id,grids,originalDepotState:original.state,view:{maxShipPixelsAtMaxZoom:pixelError,maxDepotPixelsAtMaxZoom:targetPixels}});
  }
 }
 if(t%1===0){console.log(JSON.stringify({progress:t,voyages:packet.stats.voyages,failures:packet.stats.planningFailures,ms:performance.now()-start}));rollout.push({t,...packet.stats,currentFuel:at.propellant,cumulativeFuelUsed:at.fuelUsed,depotState:engine.world.state(t),elapsedMs:performance.now()-start});}
}
if(pixelError>.5||targetPixels>.5||cases.length!==4)throw Error('Lunar drawing witness failed '+JSON.stringify({pixelError,targetPixels,cases:cases.length}));
const report={calendar:64,rollout,peakPhysical,peakView,peakPacket,peakSamples,minimumFuel,pixelError,targetPixels,elapsedMs:performance.now()-start,halt:engine.halt};
writeFileSync('docs/evidence/lunar-service-input.json',JSON.stringify({cases}));
writeFileSync('docs/evidence/lunar-service-rollout.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
