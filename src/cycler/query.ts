import {at} from '../compact/physics';
import {phaseAt,rotate,rotateState} from '../compact/query';
import {evaluateCubic} from '../sim/cubic';
import type {State,Vec3} from '../sim/schema';
import type {ViewSample} from '../model-set/model';
import type {PassThroughTemplate,PassThroughPlayback,FinitePhase} from './types';

export function surfaceState(p:PassThroughTemplate,id:string,t:number):State {
  if(!['Cairn','Haven'].includes(id)||!Number.isFinite(t)||t<0||t>p.duration)throw Error('Pass-through surface query');
  const local=rotate([id==='Cairn'?1.00001:.20001,0,0],p.rate*t+p.padPhases[id]);
  const body=id==='Haven'?rotate([5,0,0],p.rate*t):[0,0,0];
  const x=local[0]+body[0],y=local[1]+body[1];
  return [x,y,0,-p.rate*y,p.rate*x,0];
}
export function ownPassThrough(p:PassThroughTemplate,actor:number,t:number,left=false):ViewSample {
  const h=p.hardware[actor],phase=phaseAt(p.phases[actor],t,left) as FinitePhase;
  const raw=phase.kind==='flight'?at(phase.rows!,t,phase.control):undefined;
  const propellant=raw?Math.min(phase.fuel,(h.dryMass+phase.cargo+phase.fuel)*Math.exp(-raw[6]/p.exhaustVelocity)-h.dryMass-phase.cargo):phase.fuel;
  const y=raw?raw.slice(0,6) as State:phase.kind==='support'?surfaceState(p,phase.port!,t):ownPassThrough(p,phase.carrier??0,t,left).y;
  const fuelUsed=phase.used+phase.fuel-propellant,mass=h.dryMass+phase.cargo+propellant;
  const q:ViewSample={t,y,propellant,fuelUsed,mass,burnCursor:0,status:'running',detail:'',
    logistics:{operationCursor:0,cargoMass:phase.cargo,fuelUsed,ports:[],...(phase.kind==='support'?{dockedPortId:phase.port}:phase.kind==='ride'?{dockedPortId:p.hardware[phase.carrier??0].id}:{})},
    activity:{kind:phase.kind==='support'?'waiting':phase.kind==='ride'?'service':'flying',reason:phase.kind==='ride'?phase.label:phase.kind==='support'?'Turnaround':phase.label}};
  if(phase.kind==='ride')q.opacity=0;
  if(phase.kind==='support')q.axis=rotate([1,0,0],p.rate*t+p.padPhases[phase.port!]);
  if(phase.control){
    const a=evaluateCubic(phase.control,Math.min(t,phase.end-Number.EPSILON*Math.max(1,t))),n=Math.hypot(...a);
    if(n>1e-9){q.thrust={id:phase.control.id,direction:a.map(x=>x/n) as Vec3,force:n*mass,acceleration:n};q.axis=q.thrust.direction;}
  }
  return q;
}
export const FLEET_MAX_EPOCH=1_000_000;
export function fleetOccurrence(p:PassThroughTemplate,t:number,left=false){
  if(!Number.isFinite(t)||t<0||t>FLEET_MAX_EPOCH)throw Error('Fleet calendar budget');
  const nearest=Math.round(t/p.duration);
  // Calendar endpoints have two exact JS expressions: k*T and (k-1)*T+T.
  // Accept those aliases, rather than snapping arbitrary nearby display epochs.
  const boundary=nearest>0&&(t===nearest*p.duration||t===(nearest-1)*p.duration+p.duration);
  let index=boundary?nearest:Math.floor(t/p.duration);
  if(!boundary){if(t<index*p.duration)index--;else if(t>=(index+1)*p.duration)index++;}
  if(left&&boundary)index--;
  const offset=index*p.duration;
  let local=boundary?(left?p.duration:0):t-offset;
  for(const phase of boundary?[]:p.phases.flat())if(t===offset+phase.start)local=phase.start;else if(t===offset+phase.end)local=phase.end;
  return {index,offset,local,angle:p.rate*offset%(2*Math.PI)};
}
function recurringOwn(p:PassThroughTemplate,actor:number,t:number,left=false):ViewSample {
  const o=fleetOccurrence(p,t,left),q=ownPassThrough(p,actor,o.local,left),h=p.hardware[actor];
  if(actor<2){
    const localDV=p.exhaustVelocity*Math.log((h.dryMass+h.fuel)/(h.dryMass+q.propellant));
    q.propellant=(h.dryMass+h.fuel)*Math.exp(-(o.index*p.recurrence!.carrierDeltaV[actor]+localDV)/p.exhaustVelocity)-h.dryMass;
    if(q.propellant<.6)throw Error('Carrier maintenance reserve');
    q.fuelUsed=h.fuel-q.propellant;q.mass=h.dryMass+q.propellant;
    if(q.thrust)q.thrust.force=q.thrust.acceleration*q.mass;
  }else q.fuelUsed=o.index*p.cost[actor]+q.fuelUsed!;
  q.logistics!.fuelUsed=q.fuelUsed!;q.t=t;q.y=rotateState(q.y,o.angle);
  if(q.axis)q.axis=rotate(q.axis,o.angle);
  if(q.thrust){q.thrust.direction=rotate(q.thrust.direction,o.angle);q.thrust.id=o.index+':'+q.thrust.id;}
  return q;
}
/** Finite history remains absolute; recurrence requires the separately admitted maintenance contract. */
export function samplePassThrough(v:PassThroughPlayback,t:number,left=false):ViewSample {
  const p=v.template;
  if(v.continuous){
    if(!p.recurrence||t<(v.oldest??0)||t>(v.end??FLEET_MAX_EPOCH))throw Error('Fleet query outside retained history');
    const q=recurringOwn(p,v.actor,t,left),o=fleetOccurrence(p,t,left);
    for(let actor=2;actor<p.hardware.length;actor++){const phase=phaseAt(p.phases[actor],o.local,left) as FinitePhase;if(phase.kind==='ride'&&phase.carrier===v.actor)q.mass!+=recurringOwn(p,actor,t,left).mass!;}
    return q;
  }
  if(!Number.isFinite(t)||t<0||t>p.duration)throw Error('Pass-through query outside admitted history');
  const q=ownPassThrough(p,v.actor,t,left);
  for(let actor=0;actor<p.hardware.length;actor++){const phase=phaseAt(p.phases[actor],t,left) as FinitePhase;if(phase.kind==='ride'&&(phase.carrier??0)===v.actor)q.mass!+=ownPassThrough(p,actor,t,left).mass!;}
  return q;
}

/** Count completed fixed-calendar operations by their constructed event epochs. */
export function fleetEventCount(p:PassThroughTemplate,t:number,epoch:number):number {
  if(!Number.isFinite(t)||t<0||t>FLEET_MAX_EPOCH||!Number.isFinite(epoch)||epoch<=0||epoch>p.duration)throw Error('Fleet event calendar');
  let count=Math.max(0,Math.floor((t-epoch)/p.duration)+1);
  if(count>0&&(count-1)*p.duration+epoch>t)count--;
  if(count*p.duration+epoch<=t)count++;
  return count;
}
