import type {Vec3} from '../sim/vectors';
export type CameraPreset='top'|'oblique'|'front'|'side';
export interface Camera {yaw:number;pitch:number;center:Vec3;scale:number;rig?:{right:Vec3;forward:Vec3;up:Vec3}}
export type ScreenPoint=[number,number,number]; // x/right, y/down, depth/toward viewer, in pixels
export interface Sphere {id:string;point:ScreenPoint;radius:number}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,x,i)=>sum+x*b[i],0);
export function axes(c:Camera):{right:Vec3;up:Vec3;toward:Vec3} {
 const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
 const map=(v:Vec3):Vec3=>c.rig?v.map((_,i)=>v[0]*c.rig!.right[i]+v[1]*c.rig!.forward[i]+v[2]*c.rig!.up[i]) as Vec3:v;
 return {right:map([cy,sy,0]),up:map([-sy*sp,cy*sp,cp]),toward:map([sy*cp,-cy*cp,sp])};
}
export function orient(c:Camera,preset:CameraPreset):void {
 delete c.rig;
 [c.yaw,c.pitch]=({top:[0,Math.PI/2],oblique:[-.65,.6],front:[0,0],side:[Math.PI/2,0]} as const)[preset];
}
export function cameraVector(c:Camera,v:readonly number[]):Vec3 {
 const a=axes(c);return [dot(v,a.right),dot(v,a.up),dot(v,a.toward)];
}
export function cameraPoint(c:Camera,p:readonly number[],width:number,height:number):ScreenPoint {
 const v=cameraVector(c,p.slice(0,3).map((x,i)=>x-c.center[i]));
 return [width/2+v[0]*c.scale,height/2-v[1]*c.scale,v[2]*c.scale];
}
export function pan(c:Camera,dx:number,dy:number):void {
 const a=axes(c);c.center=c.center.map((x,i)=>x-dx/c.scale*a.right[i]+dy/c.scale*a.up[i]) as Vec3;
}
export function zoom(c:Camera,factor:number,x:number,y:number):void {
 const before=c.scale;c.scale=Math.max(20,Math.min(1e6,c.scale*factor));
 const a=axes(c);c.center=c.center.map((p,i)=>p+x*(1/before-1/c.scale)*a.right[i]-y*(1/before-1/c.scale)*a.up[i]) as Vec3;
}
export function orbit(c:Camera,dx:number,dy:number):void {
 c.yaw=((c.yaw-dx*.006+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
 c.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,c.pitch+dy*.006));
}
export function occluder(p:ScreenPoint,spheres:Sphere[]):Sphere|undefined {
 if(!p.every(Number.isFinite))return undefined;
 return spheres.find(s=>{
  const dx=p[0]-s.point[0],dy=p[1]-s.point[1],r2=s.radius**2-dx*dx-dy*dy;
  return r2>1e-12*s.radius**2 && p[2]<s.point[2]+Math.sqrt(r2)-1e-7;
 });
}
function roots(a:number,b:number,c:number):number[] {
 // Tangent/zero-length intervals need no split; midpoint visibility suffices.
 if(a<1e-20)return Math.abs(b)>1e-20?[-c/b]:[];
 const d=b*b-4*a*c;if(d<0)return [];
 const q=-.5*(b+(b<0?-1:1)*Math.sqrt(d));
 return q===0?[-b/(2*a)]:[q/a,c/q];
}
// Clip an orthographic segment against sphere shadows, including silhouette
// crossings and the front hemisphere. No fixed-pixel marching or depth epsilon
// tied to camera distance; this is disposable drawing geometry, not collision.
export function visibleSegment(a:ScreenPoint,b:ScreenPoint,spheres:Sphere[]):[ScreenPoint,ScreenPoint][] {
 if(!a.every(Number.isFinite)||!b.every(Number.isFinite))return [];
 // Most projected segments miss every body. Avoid root solving and temporary
 // geometry for that common case; crossings still use the exact clipping below.
 const shadows=spheres.filter(s=>Math.max(a[0],b[0])>=s.point[0]-s.radius && Math.min(a[0],b[0])<=s.point[0]+s.radius && Math.max(a[1],b[1])>=s.point[1]-s.radius && Math.min(a[1],b[1])<=s.point[1]+s.radius);
 if(!shadows.length)return [[a,b]];
 const d=b.map((x,i)=>x-a[i]),cuts=[0,1];
 for(const sphere of shadows) {
  const q=a.map((x,i)=>x-sphere.point[i]);
  const projA=d[0]**2+d[1]**2,projB=2*(q[0]*d[0]+q[1]*d[1]),projC=q[0]**2+q[1]**2-sphere.radius**2;
  // Quickly reject shadows whose projected bounding box misses this segment.
  if(Math.max(a[0],b[0])<sphere.point[0]-sphere.radius || Math.min(a[0],b[0])>sphere.point[0]+sphere.radius || Math.max(a[1],b[1])<sphere.point[1]-sphere.radius || Math.min(a[1],b[1])>sphere.point[1]+sphere.radius)continue;
  cuts.push(...roots(projA,projB,projC),...roots(dot(d,d),2*dot(q,d),dot(q,q)-sphere.radius**2));
 }
 const sorted=[...new Set(cuts.filter(u=>u>=0&&u<=1))].sort((x,y)=>x-y),at=(u:number)=>a.map((x,i)=>x+u*d[i]) as ScreenPoint;
 const pieces:[ScreenPoint,ScreenPoint][]=[];
 for(let i=0;i<sorted.length-1;i++)if(sorted[i+1]-sorted[i]>1e-12 && !occluder(at((sorted[i]+sorted[i+1])/2),spheres)){
  const from=at(sorted[i]),to=at(sorted[i+1]),last=pieces.at(-1);
  if(last && Math.hypot(...from.map((x,j)=>x-last[1][j]))<1e-7)last[1]=to;else pieces.push([from,to]);
 }
 return pieces;
}

const cross=(a:readonly number[],b:readonly number[]):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec3):Vec3=>{const n=Math.hypot(...v);return v.map(x=>x/n) as Vec3;};
// Deterministic velocity-relative rig. No wall-clock lag, so scrubbing/rewind
// produces exactly the same pose. Degenerate radial/zero-speed states stay finite.
export function chaseRig(position:readonly number[],velocity:readonly number[]):NonNullable<Camera['rig']> {
 const forward:Vec3=Math.hypot(...velocity)>1e-10?unit([...velocity] as Vec3):[1,0,0];
 let normal=cross(position,forward);
 if(Math.hypot(...normal)<=1e-10*Math.max(1,Math.hypot(...position))) {
  const axis=forward.map(Math.abs).indexOf(Math.min(...forward.map(Math.abs))),fallback:Vec3=[0,0,0];fallback[axis]=1;normal=cross(forward,fallback);
 }
 const up=unit(normal),right=unit(cross(forward,up));
 return {right,forward,up};
}
export function orbitAround(c:Camera,pivot:Vec3|undefined,dx:number,dy:number):void {
 const before=pivot?cameraVector(c,pivot.map((x,i)=>x-c.center[i])):undefined;
 orbit(c,dx,dy);
 if(pivot && before){const a=axes(c);c.center=pivot.map((x,i)=>x-before[0]*a.right[i]-before[1]*a.up[i]-before[2]*a.toward[i]) as Vec3;}
}
