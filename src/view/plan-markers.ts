import {isPresent,sampleVessel,type VesselView} from '../model-set/model';
import type {State} from '../sim/schema';
// Nested absolute epoch grids. Clipping, eviction and reverse playback never
// rephase the grid. Zoom changes density; playback has no say in that choice.
export function markerStep(scale:number,state:State):number {
 const speed=Math.max(.05,Math.hypot(...state.slice(3)));
 return 2**Math.max(-7,Math.min(-2,Math.round(Math.log2(7/Math.max(1,scale*speed)))));
}
const caches=new WeakMap<VesselView,{step:number;points:Map<number,State|undefined>}>();
export function planMarkers(v:VesselView,start:number,end:number,step:number):{t:number;y:State}[]{
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||!Number.isFinite(step)||step<1/128||end-start>32+1e-9)throw Error('Plan marker display budget');
 let cache=caches.get(v);if(!cache||cache.step!==step){cache={step,points:new Map()};caches.set(v,cache);}
 const result:{t:number;y:State}[]=[];
 for(let index=Math.floor(start/step)+1;index*step<=end;index++){
  const t=index*step;if(!cache.points.has(index)){
   let y:State|undefined;
   if(isPresent(v,t)){const q=sampleVessel(v,t);if(q.opacity!==0&&q.activity?.kind!=='fault'&&q.activity?.kind!=='unavailable')y=q.y;}
   cache.points.set(index,y);
  }
  const y=cache.points.get(index);if(y)result.push({t,y});
 }
 // One selected vessel's moving forecast; old entries have no display owner.
 for(const i of cache.points.keys())if(i*step<=start||i*step>end)cache.points.delete(i);
 return result;
}
