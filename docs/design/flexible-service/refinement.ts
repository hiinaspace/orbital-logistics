import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {paidCapture} from '../../../src/sim/capture';
import {AdaptiveWorld} from '../../../src/adaptive/world';
import {CoupledTrip} from '../../../src/adaptive/plan';
const witness=JSON.parse(readFileSync('docs/design/flexible-service/finite-witness.json','utf8')),rows=[];
for(const step of [1/128,1/256,1/512]){const d=structuredClone(witness.definition),p=structuredClone(witness.plan);d.world.scenario.policy.step=step;for(const b of [p.outbound,p.inbound]){b.scenario.policy.step=step;b.scenario.policy.maxNodes=Math.ceil(b.scenario.duration/step)+1024;}
 const pre=new AdaptiveWorld(d,p.base),before=pre.extend(Math.ceil((p.schedule.relayArrival+.5)/8)*8,0,[],p.controls);while(!before.next().done){}
 p.outbound.scenario.ship.state=pre.sample(d.origin.id,p.schedule.departure).y;const out=new Runner(p.outbound),outState=out.advanceTo(p.schedule.relayArrival),capture=paidCapture(outState.y,pre.sample(d.relay.id,p.schedule.relayArrival).y,{...d.world.scenario.ship,propellant:outState.propellant},{position:1e-7,velocity:1e-7},d.relay.id);
 p.delivery=.6-pre.sample(d.relay.id,p.schedule.relayArrival+.5).propellant;
 const loaded=new AdaptiveWorld(d,p.base),job=loaded.extend(Math.ceil(p.end/8)*8,0,[{t:p.schedule.relayArrival,kind:'capture',fuel:capture.propellantAfter,visitorId:p.visitorId},{t:p.schedule.relayArrival+.5,kind:'transfer',amount:p.delivery,visitorId:p.visitorId},{t:p.schedule.release,kind:'release',visitorId:p.visitorId}],p.controls);while(!job.next().done){}
 p.inbound.scenario.ship.state=loaded.sample(d.relay.id,p.schedule.release).y;p.inbound.scenario.ship.propellant=capture.propellantAfter-p.delivery;
 const trip=new CoupledTrip(d,p),errors={position:0,velocity:0,fuel:0,station:0};for(const s of witness.samples){const at=trip.sample(s.t);errors.position=Math.max(errors.position,Math.hypot(...s.y.slice(0,3).map((x:number,i:number)=>x-at.y[i])));errors.velocity=Math.max(errors.velocity,Math.hypot(...s.y.slice(3).map((x:number,i:number)=>x-at.y[i+3])));errors.fuel=Math.max(errors.fuel,Math.abs(at.propellant-s.propellant));}for(const s of witness.station){errors.station=Math.max(errors.station,Math.hypot(...s.y.map((x:number,i:number)=>x-trip.world.sample(d.relay.id,s.t).y[i])));}rows.push({step,errors,captures:[trip.capture,trip.home].map(({y,...c})=>c)});}
writeFileSync('docs/design/flexible-service/finite-refinement.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
