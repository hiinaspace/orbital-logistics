import { bodyState } from './dynamics';
import type { Logistics, Port, State,Vec3 } from './schema';

export interface LogisticsState {
  operationCursor: number; cargoMass: number; ports: {id: string; cargo: number; propellant: number}[];
  dockedPortId?: string;
  service?: {id: string; portId: string; end: number; cargo: number; propellant: number};
  fuelUsed: number; completedAt?: number;
}
export function copyLogistics(state: LogisticsState): LogisticsState {
  return {...state, ports: state.ports.map(p => ({...p})), ...(state.service ? {service: {...state.service}} : {})};
}
export function surfaceBodyState(port:Port,t:number):State{
 if(port.rail.kind!=='surface')throw Error('Surface center requires support');
 const r=port.rail;
 return r.bodyRail?bodyState({id:r.bodyId,mu:0,radius:0,rail:r.bodyRail},t):[...r.center,0,0,0];
}
export function portState(port: Port, t: number): State {
  if((port.rail.kind==='ballistic'||port.rail.kind==='powered'))throw new Error('Ballistic port requires a canonical ephemeris');
  if(port.rail.kind==='surface' && (port.rail.latitude!==undefined||port.rail.bodyRail)){
    const r=port.rail,a=r.phase+r.rate*t,xy=r.radius*Math.cos(r.latitude??0),z=r.radius*Math.sin(r.latitude??0),b=surfaceBodyState(port,t);
    return [b[0]+xy*Math.cos(a),b[1]+xy*Math.sin(a),b[2]+z,b[3]-xy*r.rate*Math.sin(a),b[4]+xy*r.rate*Math.cos(a),b[5]];
  }
  return bodyState({id: port.id, mu: 0, radius: 0, rail: {...port.rail,kind:'circular'}}, t);
}
export function logisticsResult(spec: Logistics, state: LogisticsState, propellant: number, t = state.completedAt ?? Infinity) {
  const goal = spec.objective, destination = state.ports.find(p => p.id === goal.destinationId)!;
  const delivered = destination.cargo - spec.ports.find(p => p.id === goal.destinationId)!.cargo;
  const quotaMet = delivered >= goal.quota * (1 - 1e-12), home = state.dockedPortId === goal.returnPortId;
  const empty = state.cargoMass <= 1e-12, fueled = propellant >= goal.minPropellant;
  const onTime = (state.completedAt ?? t) <= (goal.deadline ?? Infinity);
  const complete = onTime && quotaMet && home && empty && fueled && !state.service;
  const reason = !quotaMet ? `Deliver ${(goal.quota - delivered).toFixed(3)} more cargo` : !home ? `Return to ${goal.returnPortId}` :
    !empty ? 'Unload remaining cargo' : !fueled ? `Return fuel below ${goal.minPropellant.toFixed(3)}` : state.service ? 'Service in progress' : !onTime ? `Return after deadline ${goal.deadline!.toFixed(3)}` : 'Delivery complete';
  return {delivered, onTime, quota: goal.quota, home, empty, fueled, complete, reason,
    completedAt: complete ? state.completedAt : undefined, propellantUsed: state.fuelUsed, hardwareCost: goal.hardwareCost};
}

export function surfaceNormal(port:Port,t:number):[number,number,number]{
 if(port.rail.kind!=='surface')throw Error('Surface normal requires a surface port');
 const r=port.rail,a=r.phase+r.rate*t,latitude=r.latitude??0;return [Math.cos(latitude)*Math.cos(a),Math.cos(latitude)*Math.sin(a),Math.sin(latitude)] as Vec3;
}
