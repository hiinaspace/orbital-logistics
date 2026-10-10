import witness from '../../fixtures/traffic/orison-surface-contracts.json';
import type {State,Scenario,ThrustArc,Engine,Port} from '../sim/schema';
import {intervalStep,massLaw} from '../sim/propulsion';
import {directionAt} from '../sim/steering';
import type {ViewSample,ViewerEvent} from '../model-set/model';
export const surfaceHardware:Engine={maxThrust:32,maxAcceleration:3};
export const surfaceDuration=witness.ascent.duration;
export const surfaceDeltaV=3*witness.ascent.arcs.reduce((n,a)=>n+a.duration,0);
export interface SurfaceFlight {leg:'ascent'|'descent';start:number;rotation:number;fuel:number;used:number;id:string;hash?:string}
export const surfaceHash='fnv1a32-'+Array.from(JSON.stringify(witness)).reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261).toString(16);
export interface SurfaceSpec {version:'orison-airless-contracts-v1';spin:.1;phase:0;fuel:6;hash:string}
export const rotate=(y:State,a:number):State=>{const c=Math.cos(a),s=Math.sin(a);return [c*y[0]-s*y[1],s*y[0]+c*y[1],y[2],c*y[3]-s*y[4],s*y[3]+c*y[4],y[5]];};
const state=(v:number[]):State=>[v[0],v[1],0,v[2],v[3],0];
export const groundState=(t:number):State=>rotate(state(witness.ascent.initial),.1*t);
export const surfaceFuel=(fuel:number,deltaV=surfaceDeltaV)=> (1.05+fuel)*Math.exp(-deltaV/3)-1.05;
export const descentReserve=()=>1.1*Math.exp(surfaceDeltaV/3)-1.05;
export function surfaceInterface(t:number,leg:'ascent'|'descent'):State {
 return rotate(state(leg==='ascent'?witness.ascent.terminal:witness.descent.initial),.1*(leg==='ascent'?t-surfaceDuration:t+surfaceDuration));
}
export function groundPort(id:string):Port{
 return {id,cargo:0,cargoCapacity:0,propellant:0,tankCapacity:0,serviceDuration:2,rail:{kind:'surface',bodyId:'Orison',center:[0,0,0],radius:1.000001,centerHeight:1e-6,u:[1,0,0],v:[0,1,0],rate:.1,phase:0}} as Port;
}
export function surfaceArcs(f:SurfaceFlight):ThrustArc[]{
 return witness[f.leg].arcs.map((a,i)=>{const keys=a.keys.map((angle,j)=>({offset:a.duration*j/(a.keys.length-1),direction:rotate([Math.cos(angle),Math.sin(angle),0,0,0,0],f.rotation).slice(0,3) as [number,number,number]}));return {id:`${f.id}:${f.leg}:${i}`,start:f.start+a.start,end:f.start+a.start+a.duration,throttle:1,direction:keys[0].direction,steering:{kind:'spherical-smoothstep-v1',keys}} as ThrustArc;});
}
interface Node {t:number;y:State;dv:number}
const caches=new Map<string,Float64Array>();
// Shared once per worker/view realm. Primary-only geometry; mass-law resources
// are always derived from the instance, never taken from this nominal cache.
function geometry(leg:SurfaceFlight['leg']):Float64Array{
 const old=caches.get(leg);if(old)return old;
 const w=witness[leg],f:SurfaceFlight={leg,start:0,rotation:0,fuel:6,used:0,id:'canonical'},arcs=surfaceArcs(f);
 const s={bodies:[{id:'Orison',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}}]} as Scenario;
 let t=0,y=state(w.initial),dv=0;const rows:Node[]=[{t,y,dv}];
 const cuts=[...new Set([0,w.duration,...arcs.flatMap(a=>[a.start,a.end,...a.steering!.keys.map(k=>a.start+k.offset)])])].sort((a,b)=>a-b);
 for(let i=1;i<cuts.length;i++){
  const end=cuts[i],arc=arcs.find(a=>a.start<=t+1e-12&&a.end>=end-1e-12);
  const fuel=surfaceFuel(6,3*w.arcs.filter(a=>a.start< (arc?.start??0)).reduce((n,a)=>n+a.duration,0)),law=arc?massLaw(surfaceHardware,arc,1.05,fuel,3):undefined;
  if(law&&(law.capEpoch!==arc!.start||law.depletionEpoch!<=arc!.end))throw Error('Surface cache propulsion envelope failed');
  const n=Math.ceil((end-t)*2048),h=(end-t)/n;
  for(let j=0;j<n;j++){y=intervalStep(s,t,y,h,law);t=j===n-1?end:t+h;if(arc)dv+=3*h;rows.push({t,y:[...y],dv});}
 }
 const expected=state(w.terminal);if(Math.hypot(...y.map((x,i)=>x-expected[i]))>2e-9)throw Error('Surface cache endpoint mismatch');
 if(rows.some(n=>Math.hypot(...n.y.slice(0,3))<1.00000099))throw Error('Surface cache crossed support height');
 const packed=new Float64Array(rows.flatMap(n=>[n.t,...n.y,n.dv]));caches.set(leg,packed);return packed;
}
export function admitSurfaceFlight(f:SurfaceFlight,engine=surfaceHardware){
 if(engine.maxAcceleration!==3||(1.05+f.fuel)*3>engine.maxThrust)throw Error('Surface force ceiling cannot preserve cached acceleration');
 if(!Number.isFinite(f.fuel)||f.fuel>6||surfaceFuel(f.fuel)<.05)throw Error('Surface reserve envelope failed');
 if(f.leg==='ascent'&&3-1/1.000001**2+.1**2*1.000001<=0)throw Error('Launch outward acceleration failed');
}
export function surfaceSample(f:SurfaceFlight,t:number,before=false):ViewSample{
 const local=t-f.start,w=witness[f.leg];if(local< -1e-10||local>w.duration+1e-10)throw Error('Outside surface contract');
 if(f.hash!==undefined&&f.hash!==surfaceHash)throw Error('Wrong surface flight geometry hash');
 const packed=geometry(f.leg),count=packed.length/8;let lo=0,hi=count-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(packed[m*8]<=local)lo=m;else hi=m-1;}
 const node=(i:number):Node=>({t:packed[i*8],y:Array.from(packed.subarray(i*8+1,i*8+7)) as State,dv:packed[i*8+7]});
 const a=node(lo),b=node(Math.min(lo+1,count-1)),h=b.t-a.t,u=h===0?0:(local-a.t)/h;
 // Cubic Hermite position and its derivative, only a drawing lookup. Physical
 // interfaces use the independently checked canonical endpoint, never this interpolation.
 let y=[...a.y] as State;if(h>0)for(let i=0;i<3;i++){y[i]=(2*u**3-3*u*u+1)*a.y[i]+(u**3-2*u*u+u)*h*a.y[i+3]+(-2*u**3+3*u*u)*b.y[i]+(u**3-u*u)*h*b.y[i+3];y[i+3]=(6*u*u-6*u)/h*a.y[i]+(3*u*u-4*u+1)*a.y[i+3]+(-6*u*u+6*u)/h*b.y[i]+(3*u*u-2*u)*b.y[i+3];}
 y=rotate(y,f.rotation);
 const dv=3*w.arcs.reduce((n,a)=>n+Math.max(0,Math.min(a.duration,local-a.start)),0),fuel=surfaceFuel(f.fuel,dv),used=f.used+f.fuel-fuel;
 if(f.fuel>6||fuel<.05-1e-10||(1.05+f.fuel)*3>surfaceHardware.maxThrust)throw Error('Surface instance propulsion/reserve envelope failed');
 const arcs=surfaceArcs(f),arc=arcs.find(a=>(before?t>a.start&&t<=a.end:t>=a.start&&t<a.end));
 const direction=arc?directionAt(arc,t-arc.start):undefined;
 return {t,y,propellant:fuel,fuelUsed:used,mass:1.05+fuel,burnCursor:0,status:'running',detail:'',activity:{kind:'flying'},logistics:{operationCursor:0,cargoMass:.05,fuelUsed:used,ports:[]},...(arc?{axis:direction,thrust:{id:arc.id,force:3*(1.05+fuel),acceleration:3,direction:direction!}}:{})};
}
export function surfaceEvents(f:SurfaceFlight):ViewerEvent[]{
 return surfaceArcs(f).flatMap(a=>[a.start,a.end].map((t,i)=>{const at=surfaceSample(f,t);return {t,kind:i?'thrust-end':'thrust-start',id:a.id+(i?':end':':start'),deltaV:i?3*(a.end-a.start):0,fuelUsed:i?surfaceSample(f,a.start).propellant-at.propellant:0,propellantBefore:surfaceSample(f,a.start).propellant,propellantAfter:at.propellant};})) as ViewerEvent[];
}
export function surfaceCacheStats(){return {surfaceCacheNodes:[...caches.values()].reduce((n,a)=>n+a.length/8,0),surfaceCacheBytes:[...caches.values()].reduce((n,a)=>n+a.byteLength,0)};}
export function validateSurfaceSpec(v:unknown):SurfaceSpec{
 const x=v as SurfaceSpec;if(!x||Object.keys(x).length!==5||x.version!=='orison-airless-contracts-v1'||x.spin!==.1||x.phase!==0||x.fuel!==6||x.hash!==surfaceHash)throw Error('Unsupported surface contract');geometry('ascent');geometry('descent');return structuredClone(v) as SurfaceSpec;
}
