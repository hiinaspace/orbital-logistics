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
 const stops=[[20,35,44],[27,53,61],[44,77,73],[99,102,71],[151,133,97]];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=b.x+i*step,y=b.y+j*step,masked=intersectsBody(x,y,step,step);
  const v=[values[j*(n+1)+i],values[j*(n+1)+i+1],values[(j+1)*(n+1)+i+1],values[(j+1)*(n+1)+i]];
  const exterior=v.filter(Number.isFinite);if(!exterior.length)continue;
  const cx=x+step/2,cy=y+step/2;
  // Boundary-cell tint is extended from exterior values, then exactly clipped
  // by the renderer. Interior scalar samples never become field values.
  const colorValue=SOURCES.some(s=>Math.hypot(cx-s.x,cy-s.y)<=s.radius)?exterior.reduce((a,b)=>a+b,0)/exterior.length:potential(cx,cy);
  const tone=Math.max(0,Math.min(1,Math.log(-colorValue/.075)/Math.log(1.4/.075)))*4;
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
