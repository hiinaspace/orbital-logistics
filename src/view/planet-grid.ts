import type {SceneView} from '../model-set/model';
import type {Body,Vec3} from '../sim/schema';
import {visibleSegment,type ScreenPoint} from '../model-set/camera';

type Circle={center:Vec3;a:Vec3;b:Vec3;prime?:boolean};
const tau=2*Math.PI;
const scale=(v:Vec3,s:number)=>v.map(x=>x*s) as Vec3;
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Use the physical air/support rotation only. An orbital rail's rate is not
// the body's spin, and a viewer's rotating frame does not define one either.
export function bodySpin(run:SceneView,body:Body):Vec3 {
 if(run.solar){const day=365.25*2*Math.PI;if(body.id==='Earth')return [0,day*Math.sin(23.44*Math.PI/180),day*Math.cos(23.44*Math.PI/180)];if(body.id==='Mars')return [0,0,day/1.0275];if(body.id==='Moon')return [0,0,2*Math.PI/.0748];if(body.id==='Jupiter')return [0,0,day/.41354];}
 if(run.atmosphere?.bodyId===body.id)return run.atmosphere.spin;
 const pad=run.world.ports.find(p=>p.rail.kind==='surface'&&p.rail.bodyId===body.id);
 return pad?.rail.kind==='surface'?[0,0,pad.rail.rate]:[0,0,0];
}
function grid(spin:Vec3,t:number):{circles:Circle[];axis:Vec3} {
 const rate=Math.hypot(...spin),axis:Vec3=rate?scale(spin,1/rate):[0,0,1];
 const base:Vec3=Math.abs(axis[0])<.9?[1,0,0]:[0,1,0];
 const dot=base.reduce((s,x,i)=>s+x*axis[i],0),v=base.map((x,i)=>x-dot*axis[i]) as Vec3;
 const u=scale(v,1/Math.hypot(...v)),w=cross(axis,u),angle=rate*t;
 const east=u.map((x,i)=>x*Math.cos(angle)+w[i]*Math.sin(angle)) as Vec3;
 const north=w.map((x,i)=>x*Math.cos(angle)-u[i]*Math.sin(angle)) as Vec3;
 const circles:Circle[]=[];
 for(const latitude of [-60,-30,0,30,60].map(d=>d*Math.PI/180))
  circles.push({center:scale(axis,Math.sin(latitude)),a:scale(east,Math.cos(latitude)),b:scale(north,Math.cos(latitude))});
 for(let i=0;i<6;i++)circles.push({center:[0,0,0],a:east.map((x,j)=>x*Math.cos(i*Math.PI/6)+north[j]*Math.sin(i*Math.PI/6)) as Vec3,b:axis,prime:i===0});
 return {circles,axis};
}
// A projected sphere circle has depth c+a*cos(theta)+b*sin(theta).
// Split exactly at the limb, rather than hiding sampled polygon chords.
export function hemisphereIntervals(c:number,a:number,b:number,near:boolean):[number,number][] {
 const amplitude=Math.hypot(a,b),cuts=[0,tau];
 if(amplitude>1e-14&&Math.abs(c)<amplitude){
  const phase=Math.atan2(b,a),root=Math.acos(-c/amplitude);
  for(const x of [phase-root,phase+root])cuts.push((x%tau+tau)%tau);
 }
 cuts.sort((x,y)=>x-y);
 return cuts.slice(1).flatMap((end,i)=>{
  const start=cuts[i],middle=(start+end)/2,visible=c+a*Math.cos(middle)+b*Math.sin(middle)>=0;
  return end-start>1e-12&&visible===near?[[start,end] as [number,number]]:[];
 });
}
export function drawPlanetGrid(ctx:CanvasRenderingContext2D,center:ScreenPoint,radius:number,spin:Vec3,t:number,
 projectDirection:(v:Vec3)=>Vec3,wireframe:boolean):void {
 if(radius<12)return;
 const {circles,axis}=grid(spin,t),map=(v:Vec3)=>scale(projectDirection(v),radius);
 ctx.save();ctx.strokeStyle='#7893a4';ctx.lineWidth=.65;
 // Transform unit circle paths, then restore before stroking: stroke widths
 // remain pixels at every zoom, and the ellipses need no per-frame tessellation.
 for(const near of wireframe?[false,true]:[true])for(const circle of circles){
  const c=map(circle.center),a=map(circle.a),b=map(circle.b);
  ctx.globalAlpha=(near?.22:.075)*(circle.prime?1.65:1);
  ctx.setLineDash(near?[]:[2,4]);ctx.beginPath();
  for(const [start,end] of hemisphereIntervals(c[2],a[2],b[2],near)){
   ctx.save();ctx.transform(a[0],-a[1],b[0],-b[1],center[0]+c[0],center[1]-c[1]);
   ctx.moveTo(Math.cos(start),Math.sin(start));ctx.arc(0,0,1,start,end);ctx.restore();
  }
  ctx.stroke();
 }
 const pole=map(axis);ctx.globalAlpha=.35;ctx.setLineDash([2,3]);ctx.beginPath();
 for(const sign of [-1,1]){
  const from:ScreenPoint=[center[0]+sign*pole[0],center[1]-sign*pole[1],center[2]+sign*pole[2]];
  const to:ScreenPoint=[center[0]+sign*pole[0]*1.15,center[1]-sign*pole[1]*1.15,center[2]+sign*pole[2]*1.15];
  for(const [a,b] of wireframe?[[from,to]]:visibleSegment(from,to,[{id:'grid-body',point:center,radius}])){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
 }
 ctx.stroke();ctx.restore();
}
