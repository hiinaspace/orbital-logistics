import {sampleVessel,type VesselView,type ViewSample} from '../model-set/model';
import {portState,surfaceNormal} from '../sim/logistics';
import {recoveredState} from '../sim/entry';
import type {Port,State,Vec3} from '../sim/schema';

export interface ExpeditionSchedule {
 period:number;angle:number;recovery:number;spent:number;fuel:number;dryMass:number;launch:number;
 pad:Port;transport:number;refuelLead:number;maxEpoch:number;
}
export interface ExpeditionPlayback extends ExpeditionSchedule {template:VesselView}
export const rotate=(v:Vec3,a:number):Vec3=>{const c=Math.cos(a),s=Math.sin(a);return [c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];};
export const rotateState=(y:State,a:number):State=>[...rotate(y.slice(0,3) as Vec3,a),...rotate(y.slice(3) as Vec3,a)];
export function occurrence(p:ExpeditionSchedule,t:number,before=false){
 if(!Number.isFinite(t)||t<0||t>p.maxEpoch)throw Error('Expedition epoch outside admitted range');
 let index=Math.floor(t/p.period);
 // Division may round up at a representable indexed boundary; compare the
 // actual indexed epoch rather than snapping with a tolerance.
 if(index*p.period>t)index--;
 else if((index+1)*p.period<=t)index++;
 let local=t-index*p.period;
 if(before&&local===0&&index>0){index--;local=p.period;}
 return {index,local,offset:index*p.period,angle:(index*p.angle)%(2*Math.PI)};
}
export function flightSample(p:ExpeditionSchedule,source:ViewSample,index:number,t:number):ViewSample {
 const o={index,angle:(index*p.angle)%(2*Math.PI)},l=source.t;
 let q:ViewSample;q={...source,...(source.logistics?{logistics:{...source.logistics}}:{}),...(source.thrust?{thrust:{...source.thrust}}:{}),...(source.aero?{aero:{...source.aero}}:{})};q.t=t;q.y=rotateState(q.y,o.angle);
  if(q.axis)q.axis=rotate(q.axis,o.angle);
  if(q.thrust){q.thrust.direction=rotate(q.thrust.direction,o.angle);q.thrust.id=o.index+':'+q.thrust.id;}
  if(q.aero)for(const key of ['airVelocity','relativeVelocity','drag','lift'] as const)q.aero[key]=rotate(q.aero[key],o.angle);
  q.fuelUsed=o.index*p.spent+(p.fuel-q.propellant);
  if(l>=p.recovery+1){q.opacity=Math.max(0,p.recovery+2-l);delete q.entryPhase;q.activity={kind:'service',reason:'Ocean recovery'};}
  else q.activity={kind:q.logistics?.dockedPortId?'waiting':'flying'};
 if(q.logistics)q.logistics.fuelUsed=q.fuelUsed!;
 return q;
}
// Same schedule adapter for canonical physics and disposable drawing. The callback
// determines which provider is queried; drawing is never a physical restart.
export function scheduledSample(p:ExpeditionSchedule,template:VesselView,t:number,provider:(t:number,before:boolean)=>ViewSample,before=false):ViewSample {
 const o=occurrence(p,t,before),residual=p.fuel-p.spent;
 let l=o.local;
 for(const b of template.boundaries)if(t===o.offset+b.t)l=b.t;
 for(const a of template.arcs){if(t===o.offset+a.start)l=a.start;else if(t===o.offset+a.end)l=a.end;}
 let q:ViewSample;
 if(l<p.recovery+2){
  q=flightSample(p,provider(l,before),o.index,t);
 }else{
  const transportEpoch=o.offset+(p.recovery+p.transport),onPad=t>transportEpoch||t===transportEpoch&&!before,refuelEpoch=(o.index+1)*p.period-p.refuelLead,refuelled=t>refuelEpoch||t===refuelEpoch&&!before;
  const fuel=refuelled?p.fuel:residual;
  q={t,y:onPad?portState(p.pad,t):rotateState(recoveredState(template.entry!.recovery,l),o.angle),
   propellant:fuel,fuelUsed:(o.index+1)*p.spent,mass:p.dryMass+fuel,burnCursor:0,status:'running',detail:'',
   opacity:onPad?Math.max(0,Math.min(1,l-(p.period-3))):0,
   axis:onPad?surfaceNormal(p.pad,t):rotate(template.samples.at(-1)!.axis??[1,0,0],o.angle),
   activity:{kind:onPad?'waiting':'service',reason:onPad?undefined:'Ground recovery transport',nextDeparture:(o.index+1)*p.period+p.launch}};
  const held=rotateState(recoveredState(template.entry!.recovery,p.recovery+2),o.angle),weight=q.opacity??0;
  q.frameOrigin=held.map((x,i)=>x+(q.y[i]-x)*weight) as State;
  if(weight===1)delete q.frameOrigin;
  if(onPad)q.logistics={operationCursor:0,cargoMass:0,fuelUsed:q.fuelUsed!,ports:[],dockedPortId:p.pad.id};
 }
 if(q.logistics)q.logistics.fuelUsed=q.fuelUsed!;
 return q;
}
export function sampleExpedition(v:VesselView,t:number):ViewSample {
 if(t<v.samples[0].t||t>v.samples.at(-1)!.t)throw Error('Expedition drawing epoch outside window');
 const p=v.expedition!;
 return scheduledSample(p,p.template,t,(local,left)=>left?p.template.boundaries.find(b=>b.t===local)?.before??sampleVessel(p.template,local):sampleVessel(p.template,local));
}
