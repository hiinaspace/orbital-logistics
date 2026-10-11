// Presentation lead only. The engine's canonical frontier, events and admission
// calendar never depend on this buffer or on wall-clock playback speed.
export const adaptivePlaybackLead=32;
// Viewer policy, not a physics/work deadline. Prepared sets keep their range.
export const maximumPlaybackRate=(setId:string)=>setId==='selene-ground-service'?.02:(setId==='orison-relay-network'||setId==='orison-surface-flexible'||setId==='orison-shuttle-service'||setId==='orison-freight-district')?2:setId==='orison-flexible-service'?4:16;
export const bufferedEdge=(frontier:number,oldest:number,lead:number)=>Math.max(oldest,frontier-lead);

// Symmetric display control: zero pauses, with fine resolution at slow speeds.
// These conversions have no authority over the engine's forward-only clock.
const speedScale=.001;
export function speedPosition(rate:number,maximum:number):number {
 return Math.sign(rate)*Math.log1p(Math.min(Math.abs(rate),maximum)/speedScale)/Math.log1p(maximum/speedScale);
}
export function speedAtPosition(position:number,maximum:number):number {
 const p=Math.max(-1,Math.min(1,position));
 // A small center detent makes a pointer click on the pause mark reliable.
 if(Math.abs(p)<=.01)return 0;
 if(Math.abs(p)===1)return Math.sign(p)*maximum;
 const rate=speedScale*Math.expm1(Math.abs(p)*Math.log1p(maximum/speedScale));
 // Preserve familiar rates when the range input rounds to its .0001 step.
 const detent=[.001,.01,.1,.25,.5,1,2,4,8,16].find(r=>r<=maximum&&Math.abs(Math.abs(p)-speedPosition(r,maximum))<=.0000500001);
 return Math.sign(p)*(detent??rate);
}
