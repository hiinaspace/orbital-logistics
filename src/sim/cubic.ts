import type {Vec3} from './schema';
export interface CubicControl {id:string;start:number;end:number;keys:number[][];coefficients:number[][][]}
export function evaluateCubic(a:CubicControl,t:number):Vec3 {
 if(t<a.start||t>=a.end)return [0,0,0];
 let lo=0,hi=a.keys.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(a.keys[mid][0]<=t)lo=mid;else hi=mid-1;}
 const i=Math.min(lo,a.coefficients.length-1),d=t-a.keys[i][0],c=a.coefficients[i];
 return c[0].map((x,j)=>((x*d+c[1][j])*d+c[2][j])*d+c[3][j]) as Vec3;
}
export function cubicBound(a:CubicControl):number {
 let bound=0;
 for(let i=0;i<a.coefficients.length;i++){
  const c=a.coefficients[i],h=a.keys[i+1][0]-a.keys[i][0];
  const hull=[c[3],c[3].map((x,j)=>x+c[2][j]*h/3),c[3].map((x,j)=>x+2*c[2][j]*h/3+c[1][j]*h*h/3),c[3].map((x,j)=>x+c[2][j]*h+c[1][j]*h*h+c[0][j]*h**3)];
  bound=Math.max(bound,...hull.map(v=>Math.hypot(...v)));
 }
 return bound;
}
