import {evaluateCubic} from '../sim/cubic';
import {at} from './physics';
import type {State,Vec3} from '../sim/schema';
import type {ViewSample} from '../model-set/model';
import type {CompactTemplate,CompactPlayback,Phase} from './types';
export const rotate=(v:readonly number[],a:number):Vec3=>{const c=Math.cos(a),s=Math.sin(a);return [c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];};
export const rotateState=(y:readonly number[],a:number):State=>[...rotate(y.slice(0,3),a),...rotate(y.slice(3,6),a)];
export function localPort(p:CompactTemplate,id:string,t:number):State {
 const r=id==='Beacon'?p.beaconRadius:id==='Cairn'?1.00001:id==='Haven'?5.20001:NaN;if(!Number.isFinite(r))throw Error('Unknown compact port');
 const a=p.rate*t,c=Math.cos(a),s=Math.sin(a);return [r*c,r*s,0,-r*p.rate*s,r*p.rate*c,0];
}
export function phaseAt(phases:Phase[],t:number,left=false):Phase {
 const p=[...phases].reverse().find(p=>left&&t>0?t>p.start&&t<=p.end:t>=p.start&&t<p.end)??(t===phases.at(-1)!.end?phases.at(-1):undefined);
 if(!p)throw Error('Compact phase outside cycle');return p;
}
export function ownSample(p:CompactTemplate,actor:number,t:number,left=false):ViewSample {
 const hardware=p.hardware[actor],phase=phaseAt(p.phases[actor],t,left);
 const raw=phase.kind==='flight'?at(phase.rows!,t,phase.control):undefined,propellant=raw?(hardware.dryMass+phase.cargo+phase.fuel)*Math.exp(-raw[6]/p.exhaustVelocity)-hardware.dryMass-phase.cargo:phase.fuel;
 const y=raw?raw.slice(0,6) as State:phase.kind==='support'?localPort(p,phase.port!,t):ownSample(p,0,t,left).y;
 const fuelUsed=phase.used+phase.fuel-propellant,mass=hardware.dryMass+phase.cargo+propellant;
 const q:ViewSample={t,y,propellant,fuelUsed,mass,burnCursor:0,status:'running',detail:'',logistics:{operationCursor:0,cargoMass:phase.cargo,fuelUsed,ports:[],...(phase.kind==='support'?{dockedPortId:phase.port}:phase.kind==='ride'?{dockedPortId:p.hardware[0].id}:{})},activity:{kind:phase.kind==='support'?'waiting':phase.kind==='ride'?'service':'flying',reason:phase.kind==='ride'?'Aboard '+p.hardware[0].id:phase.kind==='support'?'Turnaround':phase.control?.id??'Ballistic coast'}};
 if(phase.kind==='ride')q.opacity=0;
 if(phase.kind==='support'&&phase.port!=='Beacon')q.axis=rotate([1,0,0],p.rate*t);
 if(phase.control){const a=evaluateCubic(phase.control,Math.min(t,phase.end-Number.EPSILON*Math.max(1,t))),n=Math.hypot(...a);if(n>1e-9){q.thrust={id:phase.control.id,direction:a.map(x=>x/n) as Vec3,force:n*mass,acceleration:n};q.axis=q.thrust.direction;}}
 return q;
}
export function occurrence(p:CompactTemplate,t:number,left=false){
 if(!Number.isFinite(t)||t<0||t>1_000_000)throw Error('Compact calendar budget');
 let index=Math.floor(t/p.period),offset=index*p.period;if(left&&index>0&&t===offset){index--;offset=index*p.period;}
 let local=t-offset;
 for(const phase of p.phases.flat())if(t===offset+phase.start)local=phase.start;else if(t===offset+phase.end)local=phase.end;
 return {index,offset,local,angle:p.rate*offset%(2*Math.PI)};
}
export function sampleCompact(p:CompactPlayback,t:number,left=false):ViewSample {
 if(t<p.oldest||t>p.end||t>p.maxEpoch)throw Error('Compact query outside retained interval');
 const o=occurrence(p.template,t,left),q=ownSample(p.template,p.actor,o.local,left);
 q.t=t;q.y=rotateState(q.y,o.angle);q.fuelUsed=o.index*p.template.cost[p.actor]+q.fuelUsed!;q.logistics!.fuelUsed=q.fuelUsed;
 if(!p.actor&&phaseAt(p.template.phases[1],o.local,left).kind==='ride')q.mass!+=ownSample(p.template,1,o.local,left).mass!;
 if(q.axis)q.axis=rotate(q.axis,o.angle);
 if(q.thrust){q.thrust.direction=rotate(q.thrust.direction,o.angle);q.thrust.id=o.index+':'+q.thrust.id;}
 return q;
}
