// Display-only compact field. No propagation, softening or interpolated sources.
import {RATE} from '../compact/physics';
export interface Bounds {x:number;y:number;span:number}
export interface FieldRequest {id:number;bounds:Bounds;size:number}
export interface FieldGrid extends FieldRequest {pixels:Uint8ClampedArray;segments:Float32Array}
export const FIELD_LIMIT=16*1024*1024,SEGMENT_LIMIT=20000;
export const CONTOURS=[-.1,-.13,-.17,-.22,-.29,-.38,-.5,-.66,-.87,-1.15];
export const SOURCES=[{x:0,y:0,mu:1,radius:1},{x:5,y:0,mu:.03,radius:.2}];
export function potential(x:number,y:number,sources=SOURCES):number {
 return -sources.reduce((v,s)=>v+s.mu/Math.hypot(x-s.x,y-s.y),0);
}
export function basisPoint(x:number,y:number,t:number):[number,number,number,number,number,number] {
 const a=RATE*t,c=Math.cos(a),s=Math.sin(a);return [c*x-s*y,s*x+c*y,0,0,0,0];
}
export function intersectsBody(x:number,y:number,dx:number,dy:number):boolean {
 return SOURCES.some(s=>Math.hypot(Math.max(x-s.x,0,s.x-x-dx),Math.max(y-s.y,0,s.y-y-dy))<=s.radius);
}
export function sampleField(request:FieldRequest):FieldGrid {
 const {bounds:b,size:n}=request;
 if(!Number.isInteger(n)||n<16||n>512||![b.x,b.y,b.span].every(Number.isFinite)||b.span<=0||b.span>64)throw Error('Field sampling bounds');
 const step=b.span/n,values=new Float64Array((n+1)**2),pixels=new Uint8ClampedArray(n*n*4),segments:number[]=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)values[j*(n+1)+i]=SOURCES.some(s=>Math.hypot(b.x+i*step-s.x,b.y+j*step-s.y)<=s.radius)?NaN:potential(b.x+i*step,b.y+j*step);
 const stops=[BACKGROUND,[17,29,36],[24,43,42],[54,63,45],[104,90,62]];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=b.x+i*step,y=b.y+j*step,masked=intersectsBody(x,y,step,step);
  const v=[values[j*(n+1)+i],values[j*(n+1)+i+1],values[(j+1)*(n+1)+i+1],values[(j+1)*(n+1)+i]];
  const exterior=v.filter(Number.isFinite);if(!exterior.length)continue;
  const cx=x+step/2,cy=y+step/2;
  // Boundary-cell tint is extended from exterior values, then exactly clipped
  // by the renderer. Interior scalar samples never become field values.
  const colorValue=SOURCES.some(s=>Math.hypot(cx-s.x,cy-s.y)<=s.radius)?exterior.reduce((a,b)=>a+b,0)/exterior.length:potential(cx,cy);
  const tone=fieldTone(colorValue)*4;
  const k=Math.min(3,Math.floor(tone)),u=tone-k,offset=4*(j*n+i);
  for(let c=0;c<3;c++)pixels[offset+c]=Math.round(stops[k][c]*(1-u)+stops[k+1][c]*u);pixels[offset+3]=185;
  if(masked)continue;
  const points=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
  for(const level of CONTOURS){if(level<Math.min(...v)||level>Math.max(...v))continue;
   // Triangulate ambiguous saddle cells deterministically. Bounded field geometry.
   for(const triangle of [[0,1,2],[0,2,3]]){
    const crosses:number[][]=[];
    for(let e=0;e<3;e++){const a=triangle[e],c=triangle[(e+1)%3];if((v[a]<level)===(v[c]<level))continue;
     const f=(level-v[a])/(v[c]-v[a]);crosses.push(points[a].map((z,d)=>z+f*(points[c][d]-z)));
    }
    if(crosses.length===2){if(segments.length/4>=SEGMENT_LIMIT)throw Error('Field contour budget');segments.push(...crosses[0],...crosses[1]);}
   }
  }
 }
 return {...request,pixels,segments:new Float32Array(segments)};
}

// Fixed display transfer: reach the background before the overview boundary.
export const BACKGROUND=[12,20,29],FADE=.095,CEILING=1.4;
export function fieldTone(phi:number):number {return Math.max(0,Math.min(1,Math.log(Math.max(FADE,-phi)/FADE)/Math.log(CEILING/FADE)));}
export function reliefHeight(x:number,y:number):number {
 // Interior clamping is only for schematic body centers; the mesh masks them.
 const phi=-SOURCES.reduce((sum,s)=>sum+s.mu/Math.max(s.radius,Math.hypot(x-s.x,y-s.y)),0);
 return -2.4*fieldTone(phi);
}
export function equilibriumForce(x:number,y:number):[number,number] {
 const r=Math.hypot(x,y),m=Math.hypot(x-5,y);
 return [-x/r**3-.03*(x-5)/m**3+RATE**2*x,-y/r**3-.03*y/m**3+RATE**2*y];
}
export const EQUILIBRIA=[[-8,-1.001],[1.001,4.799],[5.201,9]].map(([left,right],i)=>{
 let a=left,b=right;for(let j=0;j<80;j++){const mid=(a+b)/2;if(equilibriumForce(a,0)[0]*equilibriumForce(mid,0)[0]<=0)b=mid;else a=mid;}
 return {id:['L3','L1','L2'][i],x:(a+b)/2,y:0};
});

// Conservative inverse-projection footprint of the entire allowed height slab.
export function reliefFootprint(width:number,height:number,o:readonly number[],a:number,b:number,c:number,d:number,z:readonly number[],gain:number,originHeight:number):number[][] {
 const det=a*d-b*c,out:number[][]=[];
 for(const [sx,sy] of [[0,0],[width,0],[width,height],[0,height]])for(const h of [-2.4,0]){
  const dx=sx-o[0]-z[0]*gain*(h-originHeight),dy=sy-o[1]-z[1]*gain*(h-originHeight);
  out.push([(d*dx-c*dy)/det,(-b*dx+a*dy)/det]);
 }
 return out;
}
