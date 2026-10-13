import {bodyState,bodyAcceleration} from '../sim/dynamics';
import {prepareSet,type ModelSet,type SceneView} from '../model-set/model';
import type {State,Scenario} from '../sim/schema';
export interface BinaryDescriptor {schemaVersion:1;mu:number;separation:number;rate:number;phase:number;period:number;kind:'halo'|'lissajous'|'insertion'}
export interface BinarySet extends ModelSet {modelVersion:'circular-binary-set-v1';binary:BinaryDescriptor}
export const isBinary=(set:unknown):set is BinarySet=>(set as BinarySet)?.modelVersion==='circular-binary-set-v1';
// Display-only reference position; never an admitted physical target provider.
export function binaryPoint(binary:BinaryDescriptor,x:number,y:number,t:number):State {
 const angle=binary.phase+binary.rate*t,c=Math.cos(angle),s=Math.sin(angle);return [c*x-s*y,s*x+c*y,0,0,0,0];
}
export function rotatingState(binary:BinaryDescriptor,state:State,t:number):State {
 const angle=binary.phase+binary.rate*t,c=Math.cos(angle),s=Math.sin(angle),[x,y,z,vx,vy,vz]=state;
 return [c*x+s*y,-s*x+c*y,z,c*vx+s*vy+binary.rate*(-s*x+c*y),-s*vx+c*vy-binary.rate*(c*x+s*y),vz];
}
const equilibriumCache=new Map<string,{id:string;x:number;y:number}[]>();
export function equilibria(b:BinaryDescriptor){
 const key=b.mu+','+b.separation,cached=equilibriumCache.get(key);if(cached)return cached;
 const a=b.separation,m=b.mu,p=-a*m,q=a*(1-m),f=(x:number)=>x-b.separation**3*((1-m)*(x-p)/Math.abs(x-p)**3+m*(x-q)/Math.abs(x-q)**3);
 const ranges=[[-2*a,p-a*1e-10],[p+a*1e-10,q-a*1e-10],[q+a*1e-10,2*a]];
 const collinear=ranges.map(([lo,hi],i)=>{for(let j=0;j<90;j++){const mid=(lo+hi)/2;if(f(lo)*f(mid)<=0)hi=mid;else lo=mid;}return {id:['L3','L1','L2'][i],x:(lo+hi)/2,y:0};});
 const points=[...collinear,...[1,-1].map((sign,i)=>({id:['L4','L5'][i],x:a*(.5-m),y:sign*a*Math.sqrt(3)/2}))];points.forEach(Object.freeze);if(equilibriumCache.size>=8)equilibriumCache.delete(equilibriumCache.keys().next().value!);equilibriumCache.set(key,points);return points;
}
export function jacobi(scenario:Scenario,b:BinaryDescriptor,t:number,state:State){
 const y=rotatingState(b,state,t);let potential=0;for(const source of scenario.bodies){const q=bodyState(source,t);potential+=source.mu/Math.hypot(state[0]-q[0],state[1]-q[1],state[2]-q[2]);}
 return 2*potential+b.rate**2*(y[0]**2+y[1]**2)-y.slice(3).reduce((sum,x)=>sum+x*x,0);
}
export function admitBinary(set:BinarySet):BinaryDescriptor {
 if(set.modelVersion!=='circular-binary-set-v1')throw Error('Unsupported binary exhibit version');
 if(set.vessels.length!==1||set.vessels.some(v=>v.bundle.scenario.logistics||v.bundle.program.operations?.length))throw Error('Binary witness does not admit logistics');
 const b=set.binary;if(!b||b.schemaVersion!==1||![b.mu,b.separation,b.rate,b.phase,b.period].every(Number.isFinite)||b.mu<=0||b.mu>=.04||b.separation<=0||b.rate<=0||b.period<=0||!['halo','lissajous','insertion'].includes(b.kind)||set.rotating.rate!==b.rate||set.rotating.phase!==b.phase)throw Error('Binary descriptor mismatch');
 for(const vessel of set.vessels){const s=vessel.bundle.scenario;if(s.bodies.length!==2)throw Error('Binary needs exactly two sources');const total=s.bodies.reduce((n,x)=>n+x.mu,0);if(Math.abs(b.rate**2*b.separation**3-total)>1e-12*total||Math.abs(s.bodies[1].mu/total-b.mu)>1e-14||s.bodies[0].radius+s.bodies[1].radius>=b.separation)throw Error('Binary mass/rate/surface mismatch');
  s.bodies.forEach((source,i)=>{const rail=source.rail, radius=b.separation*(i?1-b.mu:b.mu),phase=b.phase+(i?0:Math.PI);if(rail.kind!=='circular'||rail.radius!==radius||rail.rate!==b.rate||rail.phase!==phase||rail.center.some(x=>x!==0)||rail.u.join(',')!=='1,0,0'||rail.v.join(',')!=='0,1,0')throw Error('Binary rail mismatch');
   const y=bodyState(source,s.epoch),other=s.bodies[1-i],q=bodyState(other,s.epoch),distance=Math.hypot(...q.slice(0,3).map((v,k)=>v-y[k])),g=q.slice(0,3).map((v,k)=>other.mu*(v-y[k])/distance**3),actual=bodyAcceleration(source,s.epoch);if(Math.max(...actual.map((v,k)=>Math.abs(v-g[k])))>1e-12*total)throw Error('Binary acceleration mismatch');
  });
 }
 return b;
}
export function prepareBinary(set:BinarySet):SceneView {
 const binary=admitBinary(set);const {modelVersion:_domain,binary:_descriptor,...base}=set;const run=prepareSet(base);run.binary=binary;run.frameExtents={...run.frameExtents,libration:.4,[run.world.bodies[1].id]:.65,[run.vessels[0].id]:.45};
 run.playback={rateScale:1,trailSpan:2*binary.period,forecastSpan:binary.period,maxZoom:4000};return run;
}
