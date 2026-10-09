import {readFileSync,writeFileSync} from 'node:fs';
import {AdaptiveEngine} from '../../../src/adaptive/engine';
const rows=[];
for(const offset of [Math.PI,Math.PI/2]){
 const d=JSON.parse(readFileSync('fixtures/traffic/orison-flexible-service.json','utf8')),c=Math.cos(offset),sn=Math.sin(offset),y=d.relay.ship.state;
 d.relay.id=d.relay.ship.id='Solstice';d.stations[1].id='Solstice';d.vessels[0].id=d.vessels[0].name=d.world.scenario.ship.id='Ibis';
 d.reference.phase+=offset;d.relay.ship.state=[c*y[0]-sn*y[1],sn*y[0]+c*y[1],0,c*y[3]-sn*y[4],sn*y[3]+c*y[4],0];
 const e=new AdaptiveEngine(d),start=performance.now();while(!e.initialized||e.frontier<160){e.advanceTo(160,24);if(e.halt)throw Error(e.halt);}
 const report={offset,seconds:(performance.now()-start)/1000,snapshot:e.snapshot(),visits:e.delta().visits.map(v=>({schedule:v.plan.schedule,delivery:v.plan.delivery}))};rows.push(report);console.log(report);
 writeFileSync('docs/design/multiship-service/phase-probe.json',JSON.stringify(rows,null,2)+'\n');
}
