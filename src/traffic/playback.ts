// Presentation lead only. The engine's canonical frontier, events and admission
// calendar never depend on this buffer or on wall-clock playback speed.
export const adaptivePlaybackLead=32;
// Viewer policy, not a physics/work deadline. Prepared sets keep their range.
export const maximumPlaybackRate=(setId:string)=>(setId==='orison-relay-network'||setId==='orison-surface-flexible'||setId==='orison-shuttle-service')?2:setId==='orison-flexible-service'?4:16;
export const bufferedEdge=(frontier:number,oldest:number,lead:number)=>Math.max(oldest,frontier-lead);
