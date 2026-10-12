import {evaluateCubic,type CubicControl} from '../sim/cubic';
import type {State} from '../sim/schema';
export const RATE=Math.sqrt(1.03/125),STEP=1/512,MARGIN=1e-8;
export interface Trace {rows:number[][];work:number;nodes:number;initial:State;start:number;end:number;control?:CubicControl}
export function moon(t:number):State {const a=RATE*t,c=Math.cos(a),s=Math.sin(a);return [5*c,5*s,0,-5*RATE*s,5*RATE*c,0];}
export function gravity(t:number,p:readonly number[]):number[]{
 const b=moon(t),d=p.slice(0,3).map((x,i)=>b[i]-x),r=Math.hypot(...p.slice(0,3)),m=Math.hypot(...d);
 if(r<=1||m<=.2)throw Error('Compact derivative inside a body');
 return d.map((x,i)=>-p[i]/r**3+.03*x/m**3);
}
function enclosed(t:number,y:number[],h:number,cap:number):boolean {
 const b=moon(t),separations=[y.slice(0,3),y.slice(0,3).map((x,i)=>x-b[i])],r=separations.map(d=>Math.hypot(...d)),clear=r.map((x,i)=>x-[1,.2][i]-MARGIN);
 if(clear.some(x=>x<=0))throw Error('Compact surface exclusion');
 const acceleration=1/(1+clear[0]/2)**2+.03/(.2+clear[1]/2)**2+cap;
 return separations.every((d,i)=>{
  const v=y.slice(3,6).map((x,j)=>x-(i?b[j+3]:0)),vv=v.reduce((s,x)=>s+x*x,0),closest=vv?Math.max(0,Math.min(h,-d.reduce((s,x,j)=>s+x*v[j],0)/vv)):0;
  const linear=Math.hypot(...d.map((x,j)=>x+closest*v[j]));
  return linear-(acceleration+(i?5*RATE**2:0))*h*h/2>[1,.2][i]+MARGIN+clear[i]/2;
 });
}
export function integrate(start:number,end:number,initial:State,control?:CubicControl,step=STEP,cap=0):Trace {
 if(initial.length!==6||!initial.every(Number.isFinite)||!Number.isFinite(cap)||cap<0||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>80||![STEP,STEP/2,STEP/4].includes(step))throw Error('Compact integration interval/policy');
 let y=[...initial,0],nodes=0,work=0;const rows:number[][]=[[start,...y]];
 const rhs=(t:number,q:number[])=>{const a=control?evaluateCubic(control,Math.min(t,control.end-Number.EPSILON*Math.max(1,control.end))):[0,0,0],g=gravity(t,q);return [...q.slice(3,6),...g.map((x,i)=>x+a[i]),Math.hypot(...a)];};
 const advance=(left:number,right:number,depth=0)=>{
  const h=right-left;if(++work>240000||depth>24)throw Error('Compact enclosure work budget');
  if(!enclosed(left,y,h,cap)){const mid=(left+right)/2;advance(left,mid,depth+1);advance(mid,right,depth+1);return;}
  const a=rhs(left,y),b=rhs(left+h/2,y.map((x,i)=>x+h*a[i]/2)),c=rhs(left+h/2,y.map((x,i)=>x+h*b[i]/2)),d=rhs(right,y.map((x,i)=>x+h*c[i]));
  y=y.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);if(y.some(x=>!Number.isFinite(x))||++nodes>180000)throw Error('Compact physical node budget');
  rows.push([right,...y]);
 };
 const cuts=[...new Set([start,end,...(control?.keys.map(k=>k[0])??[])])].sort((a,b)=>a-b);
 for(let k=0;k<cuts.length-1;k++){const a=cuts[k],b=cuts[k+1];for(let t=a;t<b;){const next=Math.min(b,Math.max(t+step,Math.floor(t/step+1)*step));advance(t,next);t=next;}}
 return {rows,nodes,work,initial:[...initial],start,end,control};
}
export function at(rows:number[][],t:number,control?:CubicControl):number[]{
 if(!Number.isFinite(t)||t<rows[0][0]||t>rows.at(-1)![0])throw Error('Compact trace query outside interval');
 let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid][0]<=t)lo=mid;else hi=mid-1;}
 const a=rows[lo],b=rows[Math.min(lo+1,rows.length-1)];if(a[0]===t||a===b)return a.slice(1);
 const h=b[0]-a[0],u=(t-a[0])/h,q=[0,0,0,0,0,0,a[7]+u*(b[7]-a[7])];
 for(let j=0;j<3;j++){q[j]=(2*u**3-3*u*u+1)*a[j+1]+(u**3-2*u*u+u)*h*a[j+4]+(-2*u**3+3*u*u)*b[j+1]+(u**3-u*u)*h*b[j+4];q[j+3]=(6*u*u-6*u)/h*a[j+1]+(3*u*u-4*u+1)*a[j+4]+(-6*u*u+6*u)/h*b[j+1]+(3*u*u-2*u)*b[j+4];}
 if(control){const rate=(t:number)=>Math.hypot(...evaluateCubic(control,Math.min(t,control.end-Number.EPSILON*Math.max(1,control.end))));q[6]=(2*u**3-3*u*u+1)*a[7]+(u**3-2*u*u+u)*h*rate(a[0])+(-2*u**3+3*u*u)*b[7]+(u**3-u*u)*h*rate(b[0]);}
 return q;
}
