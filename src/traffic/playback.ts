// Presentation lead only. The engine's canonical frontier, events and admission
// calendar never depend on this buffer or on wall-clock playback speed.
export const adaptivePlaybackLead=16;
export const bufferedEdge=(frontier:number,oldest:number,lead:number)=>Math.max(oldest,frontier-lead);
