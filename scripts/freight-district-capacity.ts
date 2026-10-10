import {writeFileSync} from 'node:fs';
import fixture from '../fixtures/traffic/orison-freight-district.json';
import {TrafficEngine} from '../src/traffic/engine';
import type {TrafficDefinition} from '../src/traffic/planner';
const d=fixture as TrafficDefinition,e=new TrafficEngine(d),checkpoints=[];
let peakCrownCargo=0,resourceWaits=0,maxDense=0,maxFuelBalance=0,maxCargoBalance=0;
for(let t=8;t<=2048;t+=8){
 const previous=e.frontier;while(e.frontier<t)e.advanceTo(t);
 const p=e.delta(previous),a=e.snapshot(),r=a.resources;
 if(p.events.some(e=>['fault','unavailable'].includes(e.kind)||e.kind==='planning-failed'&&e.detail?.includes('Transfer planning failed')))throw Error('Unexpected flight failure');
 resourceWaits+=p.events.filter(e=>e.kind==='planning-failed').length;
 peakCrownCargo=Math.max(peakCrownCargo,r.stocks.find(s=>s.id==='Crown')!.cargo);maxDense=Math.max(maxDense,p.stats.denseSamples);
 const fuel=r.stocks.reduce((n,s)=>n+s.propellant,0)+a.current.ships.reduce((n,s)=>n+s.propellant+s.fuelUsed!,0)+r.fuelExported-r.fuelImported;
 const cargo=r.stocks.reduce((n,s)=>n+s.cargo,0)+a.current.ships.reduce((n,s)=>n+s.logistics!.cargoMass,0)+r.cargoExported-r.cargoImported;
 maxFuelBalance=Math.max(maxFuelBalance,Math.abs(fuel-d.stations.reduce((n,s)=>n+s.propellant,0)-d.vessels.reduce((n,s)=>n+s.propellant,0)));
 maxCargoBalance=Math.max(maxCargoBalance,Math.abs(cargo-d.stations.reduce((n,s)=>n+s.cargo,0)));
 if(t%512===0)checkpoints.push({t,ships:a.ships.map(s=>({id:s.id,voyage:s.voyage,stage:s.stage})),crownCargo:r.stocks.find(s=>s.id==='Crown')!.cargo});
}
const result={frontier:e.frontier,peakCrownCargo,resourceWaits,maxDense,maxFuelBalance,maxCargoBalance,checkpoints,ships:e.snapshot().ships,unloaded:e.snapshot().unloaded,stats:e.delta().stats};
if(peakCrownCargo!==1||maxFuelBalance>1e-10||maxCargoBalance>1e-10||maxDense>65536)throw Error('Capacity witness failed');
if(checkpoints.at(-1)!.ships.some((s,i)=>s.voyage<=checkpoints.at(-2)!.ships[i].voyage))throw Error('Service failed to resume after congestion');
writeFileSync('docs/evidence/freight-district-capacity.json',JSON.stringify(result,null,2)+'\n');console.log(result);
