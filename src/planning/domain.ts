import type {Bundle} from '../sim/schema';
// Legacy aiming and geometric matching remain explicitly XY/CCW. Do not project
// spatial inputs into this solver. The engine and apsis diagnostics are spatial.
export function planarUnavailable(bundle: Bundle): string | undefined {
  const s=bundle.scenario, planar=(y: number[])=>y[2]===0 && y[5]===0;
  if(bundle.program.thrustArcs?.length)return 'Legacy targeting does not support powered programs';
  const rails=[...s.bodies.map(b=>b.rail),...(s.logistics?.ports.map(p=>p.rail)??[])];
  if(!planar(s.ship.state) || (s.rendezvous && !planar(s.rendezvous.target.state)) ||
    rails.some(r=>r.kind==='ballistic' ? true : r.kind==='fixed' ? r.position[2]!==0 : r.center[2]!==0 || r.u[2]!==0 || r.v[2]!==0) ||
    bundle.program.burns.some(b=>b.basis!=='radial-transverse-normal-v2' || b.normal!==0 ||
      b.orientationAxis[0]!==0 || b.orientationAxis[1]!==0 || b.orientationAxis[2]!==1)) return 'Planar targeting requires XY sources, states, ports and +Z reference burns';
}
