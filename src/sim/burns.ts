import type {Burn, State, Vec3} from './schema';
import {cross, dot, norm, position, scale, subtract} from './vectors';
export const BURN_POLE_THRESHOLD = 1e-10;
export function burnMagnitude(b: Burn): number {
  return b.basis === 'inertial-cartesian-v2' ? norm(b.deltaVelocity) : Math.hypot(b.radial,b.transverse,b.normal);
}
// Resolve from the inertial pre-event state, never a view frame or velocity sign.
export function resolveBurn(b: Burn, y: State, reference: State): Vec3 {
  if (b.basis === 'inertial-cartesian-v2') return [...b.deltaVelocity];
  if (burnMagnitude(b) === 0) return [0,0,0];
  const r = subtract(position(y),position(reference)), length = norm(r);
  if (!(length>0) || !Number.isFinite(length)) throw new Error('Degenerate burn radius');
  const R=scale(r,1/length), transverse=cross(b.orientationAxis,R), pole=norm(transverse);
  if (!(pole>BURN_POLE_THRESHOLD)) throw new Error('Degenerate burn orientation');
  const T=scale(transverse,1/pole), N=cross(R,T);
  const dv=R.map((v,i)=>b.radial*v+b.transverse*T[i]+b.normal*N[i]) as Vec3;
  if (!dv.every(Number.isFinite) || !Number.isFinite(dot(dv,dv))) throw new Error('Nonfinite burn');
  return dv;
}
