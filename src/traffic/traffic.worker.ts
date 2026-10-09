import {TrafficEngine} from './engine';
import type {TrafficDefinition} from './planner';
import {MaintainedEngine} from '../maintained/engine';
import {isMaintained,type MaintainedDefinition} from '../maintained/world';
import {AdaptiveEngine} from '../adaptive/engine';
import {isAdaptive,type AdaptiveDefinition} from '../adaptive/world';
let engine:TrafficEngine|MaintainedEngine|AdaptiveEngine|undefined,generation=0;
self.onmessage=async(event:MessageEvent<{generation:number;sequence:number;definition?:TrafficDefinition|MaintainedDefinition|AdaptiveDefinition;target?:number;after?:number}>)=>{
 const m=event.data;
 try {
  if(m.definition){generation=m.generation;engine=isAdaptive(m.definition)?new AdaptiveEngine(m.definition):isMaintained(m.definition)?new MaintainedEngine(m.definition):new TrafficEngine(m.definition);}
  if(m.generation!==generation || !engine)return;
  if(engine instanceof MaintainedEngine||engine instanceof AdaptiveEngine) {
   // Initial forecasts may take several bounded turns; no partial ready packet.
   while(!engine.initialized){engine.advanceTo(0,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(m.target!==undefined)engine.advanceTo(m.target,24);
  }else if(m.target!==undefined)engine.advanceTo(m.target,128);
  self.postMessage({generation,sequence:m.sequence,delta:engine.delta(m.after)});
 }catch(error){self.postMessage({generation:m.generation,sequence:m.sequence,error:(error as Error).message});}
};
