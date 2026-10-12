import {at} from '../compact/physics';
import {phaseAt,rotate} from '../compact/query';
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
function own(p:PassThroughTemplate,actor:number,t:number,left=false):ViewSample {
  const h=p.hardware[actor],phase=phaseAt(p.phases[actor],t,left) as FinitePhase;
  const raw=phase.kind==='flight'?at(phase.rows!,t,phase.control):undefined;
  const propellant=raw?(h.dryMass+phase.cargo+phase.fuel)*Math.exp(-raw[6]/p.exhaustVelocity)-h.dryMass-phase.cargo:phase.fuel;
  const y=raw?raw.slice(0,6) as State:phase.kind==='support'?surfaceState(p,phase.port!,t):own(p,0,t,left).y;
  const fuelUsed=phase.used+phase.fuel-propellant,mass=h.dryMass+phase.cargo+propellant;
  const q:ViewSample={t,y,propellant,fuelUsed,mass,burnCursor:0,status:'running',detail:'',
    logistics:{operationCursor:0,cargoMass:phase.cargo,fuelUsed,ports:[],...(phase.kind==='support'?{dockedPortId:phase.port}:phase.kind==='ride'?{dockedPortId:p.hardware[0].id}:{})},
    activity:{kind:phase.kind==='support'?'waiting':phase.kind==='ride'?'service':'flying',reason:phase.kind==='ride'?'Aboard Wayfarer':phase.kind==='support'?'Turnaround':phase.label}};
  if(phase.kind==='ride')q.opacity=0;
  if(phase.kind==='support')q.axis=rotate([1,0,0],p.rate*t+p.padPhases[phase.port!]);
  if(phase.control){
    const a=evaluateCubic(phase.control,Math.min(t,phase.end-Number.EPSILON*Math.max(1,t))),n=Math.hypot(...a);
    if(n>1e-9){q.thrust={id:phase.control.id,direction:a.map(x=>x/n) as Vec3,force:n*mass,acceleration:n};q.axis=q.thrust.direction;}
  }
  return q;
}
/** Finite absolute history: no period modulo, rotation reuse, or fuel restoration. */
export function samplePassThrough(v:PassThroughPlayback,t:number,left=false):ViewSample {
  const p=v.template;
  if(!Number.isFinite(t)||t<0||t>p.duration)throw Error('Pass-through query outside admitted history');
  const q=own(p,v.actor,t,left);
  if(v.actor===0&&phaseAt(p.phases[1],t,left).kind==='ride')q.mass!+=own(p,1,t,left).mass!;
  return q;
}
