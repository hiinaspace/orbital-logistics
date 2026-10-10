import {directionAt} from '../sim/steering';
import type {Vec3} from '../sim/schema';
import type {VesselView,ViewSample} from '../model-set/model';

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
 const previous=[...v.arcs].reverse().find(a=>a.start<=t);
 return previous?directionAt(previous,Math.min(t,previous.end)-previous.start):[...v.initialAxis!];
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
