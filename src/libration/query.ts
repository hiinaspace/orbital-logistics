import {sampleVessel,type VesselView,type ViewSample} from '../model-set/model';
import {rotate,rotateState} from '../expedition/query';
export interface LibrationSchedule {period:number;rate:number;spent:number;parcel:number;maxEpoch:number;boundaries:number[]}
export interface LibrationPlayback extends LibrationSchedule {template:VesselView}
export function courierLastCycle(p:LibrationSchedule,end:number){return Math.min(Math.floor(end/p.period),Math.ceil(p.maxEpoch/p.period)-1);}
export function courierOccurrence(p:LibrationSchedule,t:number,before=false){
 if(!Number.isFinite(t)||t<0||t>p.maxEpoch)throw Error('Libration epoch outside calendar');
 let index=Math.floor(t/p.period),offset=index*p.period;
 if(offset>t)index--;else if((index+1)*p.period<=t)index++;
 offset=index*p.period;let local=t-offset;
 if(before&&local===0&&index>0){index--;offset=index*p.period;local=p.period;}
 for(const x of p.boundaries)if(t===offset+x)local=x;
 return {index,offset,local,angle:(p.rate*offset)%(2*Math.PI)};
}
export function courierSample(p:LibrationSchedule,template:VesselView,t:number,provider:(local:number,left:boolean)=>ViewSample,before=false):ViewSample{
 const o=courierOccurrence(p,t,before),raw=provider(o.local,before),q:ViewSample={...raw,t,y:rotateState(raw.y,o.angle),fuelUsed:o.index*p.spent+raw.fuelUsed!};
 if(raw.axis)q.axis=rotate(raw.axis,o.angle);
 if(raw.thrust)q.thrust={...raw.thrust,id:template.id+':'+o.index+':'+raw.thrust.id,direction:rotate(raw.thrust.direction,o.angle)};
 if(raw.logistics)q.logistics={...raw.logistics,fuelUsed:q.fuelUsed!};
 return q;
}
export function sampleLibration(v:VesselView,t:number):ViewSample{
 if(t<v.samples[0].t||t>v.samples.at(-1)!.t)throw Error('Libration drawing epoch outside window');
 const p=v.libration!;
 return courierSample(p,p.template,t,(local,left)=>left?p.template.boundaries.find(b=>b.t===local)?.before??sampleVessel(p.template,local):sampleVessel(p.template,local));
}
