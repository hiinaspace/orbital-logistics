import {directionAt} from '../sim/steering';
import type {Vec3} from '../sim/schema';
import type {VesselView,ViewSample} from '../model-set/model';

// Deterministic spherical attitude interpolation, including an exact reversal.
// The fallback turns in the orbital plane for planar directions.
function turn(from:Vec3,to:Vec3,fraction:number):Vec3 {
 const unit=(v:Vec3)=>{const n=Math.hypot(...v);return v.map(x=>x/n) as Vec3;},p=unit(from),q=unit(to);
 const dot=Math.max(-1,Math.min(1,p.reduce((n,x,i)=>n+x*q[i],0))),u=fraction*fraction*(3-2*fraction);
 if(dot>1-1e-10)return unit(p.map((x,i)=>(1-u)*x+u*q[i]) as Vec3);
 let tangent=q.map((x,i)=>x-dot*p[i]) as Vec3;
 if(Math.hypot(...tangent)<1e-8)tangent=Math.hypot(p[0],p[1])>1e-8?[-p[1],p[0],0]:[1,0,0];
 tangent=unit(tangent);const angle=Math.acos(dot)*u;
 return unit(p.map((x,i)=>x*Math.cos(angle)+tangent[i]*Math.sin(angle)) as Vec3);
}

// A presentation axis, not a rigid-body attitude or a new propagation state.
// Queries depend only on mission time, so scrubbing never leaves a stale heading.
export function rocketAxis(v:VesselView,sample:ViewSample,t:number):Vec3 {
 if(sample.axis)return [...sample.axis];
 const port=v.ports.find(p=>p.id===sample.logistics?.dockedPortId);
 if(port?.rail.kind==='surface') {
  const r=port.rail,theta=r.phase+r.rate*t;
  return r.u.map((x,i)=>x*Math.cos(theta)+r.v[i]*Math.sin(theta)) as Vec3;
 }
 if(sample.thrust)return [...sample.thrust.direction];
 const previous=[...v.arcs].reverse().find(a=>a.start<=t),next=v.arcs.find(a=>a.start>t);
 const held=previous?directionAt(previous,Math.min(t,previous.end)-previous.start):[...(v.initialAxis??next?.direction??[1,0,0])] as Vec3;
 if(next){
  const available=next.start-Math.max(previous?.end??v.samples[0].t,v.lifetime?.start??-Infinity),duration=Math.min(.6,available);
  if(duration>0&&t>next.start-duration)return turn(held,directionAt(next,0),(t-(next.start-duration))/duration);
 }
 return held;
}

export function drawRocket(ctx:CanvasRenderingContext2D,glyph:'rocket'|'stack',color:string,axis:number[]):void {
 const projected=Math.hypot(axis[0],axis[1]);
 ctx.fillStyle=color;ctx.strokeStyle='#d6e3e8';ctx.lineWidth=.8;
 if(projected<.08) {
  // Nose/engine viewed end-on: no arbitrary screen direction at the pole.
  ctx.beginPath();ctx.arc(0,0,glyph==='stack'?4:3,0,2*Math.PI);ctx.fill();
  ctx.beginPath();ctx.arc(0,0,1.4,0,2*Math.PI);if(axis[2]>=0)ctx.stroke();else{ctx.fillStyle='#0c141d';ctx.fill();}return;
 }
 ctx.rotate(Math.atan2(-axis[1],axis[0]));
 ctx.scale(projected,1);
 const nose=glyph==='stack'?10:8,tail=glyph==='stack'?-9:-6;
 ctx.beginPath();ctx.moveTo(nose,0);ctx.lineTo(nose-4,-2.5);ctx.lineTo(tail+2,-2.5);
 ctx.lineTo(tail-1,-4.5);ctx.lineTo(tail-1,-2);ctx.lineTo(tail,-2);
 ctx.lineTo(tail,2);ctx.lineTo(tail-1,2);ctx.lineTo(tail-1,4.5);
 ctx.lineTo(tail+2,2.5);ctx.lineTo(nose-4,2.5);ctx.closePath();ctx.fill();
 // Engine nozzle and assembly join distinguish a rocket from a velocity arrow.
 ctx.beginPath();ctx.moveTo(tail-1,-1.5);ctx.lineTo(tail-1,1.5);ctx.stroke();
 if(glyph==='stack'){ctx.beginPath();ctx.moveTo(0,-2.5);ctx.lineTo(0,2.5);ctx.stroke();}
}
