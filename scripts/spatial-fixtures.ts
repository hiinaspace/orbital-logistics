import {readFileSync} from 'node:fs';
import {validateBundle,type Bundle,type Vec3,type State} from '../src/sim/schema';
import {cross} from '../src/sim/vectors';
export const u:Vec3=[1/Math.sqrt(14),2/Math.sqrt(14),3/Math.sqrt(14)],v:Vec3=[-2/Math.sqrt(5),1/Math.sqrt(5),0],w=cross(u,v);
export const rotate=(a:Vec3):Vec3=>a.map((_,i)=>a[0]*u[i]+a[1]*v[i]+a[2]*w[i]) as Vec3;
export function rotated(input:Bundle, translation:Vec3=[.2,-.1,.3]):Bundle {
  const b=structuredClone(input),point=(a:Vec3)=>rotate(a).map((x,i)=>x+translation[i]) as Vec3;
  const state=(a:State):State=>[...point(a.slice(0,3) as Vec3),...rotate(a.slice(3) as Vec3)];
  b.scenario.ship.state=state(b.scenario.ship.state);
  if(b.scenario.rendezvous)b.scenario.rendezvous.target.state=state(b.scenario.rendezvous.target.state);
  for(const r of [...b.scenario.bodies.map(b=>b.rail),...(b.scenario.logistics?.ports.map(p=>p.rail)??[])]) {
    if(r.kind==='ballistic'){r.state=state(r.state);continue;}
    if(r.kind==='fixed')r.position=point(r.position);else {r.center=point(r.center);r.u=rotate(r.u);r.v=rotate(r.v);}
  }
  for(const burn of b.program.burns)if(burn.basis==='inertial-cartesian-v2')burn.deltaVelocity=rotate(burn.deltaVelocity);else burn.orientationAxis=rotate(burn.orientationAxis);
  return validateBundle(b);
}
const load=(file:string)=>validateBundle(JSON.parse(readFileSync(`fixtures/${file}.json`,'utf8')));
export function spatialCases() {
  const inclined=rotated(load('m0-circular'));inclined.scenario.duration=6;
  const binary=load('m0-binary');binary.scenario.ship.state[2]=.13;binary.scenario.ship.state[5]=.04;
  const moving=rotated(binary);
  const normal=structuredClone(moving);normal.program.burns=[{id:'normal',t:.719,referenceBodyId:'primary',basis:'radial-transverse-normal-v2',orientationAxis:rotate([0,0,1]),radial:.01,transverse:-.02,normal:.03}];
  const cartesian=structuredClone(moving);cartesian.program.burns=[{id:'cartesian',t:1.137,referenceBodyId:'moon',basis:'inertial-cartesian-v2',deltaVelocity:[.013,-.027,.041]}];
  return [{label:'inclined-analytic',bundle:inclined},{label:'noncoplanar-moving-sources',bundle:moving},{label:'spatial-reference-burn',bundle:normal},{label:'cartesian-burn',bundle:cartesian}];
}
export const spatialLogistics=()=>rotated(load('m3-round-trip'));
