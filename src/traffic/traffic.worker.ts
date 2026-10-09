import {TrafficEngine} from './engine';
import {NetworkEngine} from '../network/engine';
import {isNetwork,type NetworkDefinition} from '../network/model';
import type {TrafficDefinition} from './planner';
import {MaintainedEngine} from '../maintained/engine';
import {isMaintained,type MaintainedDefinition} from '../maintained/world';
import {AdaptiveEngine} from '../adaptive/engine';
import {isAdaptive,type AdaptiveDefinition} from '../adaptive/world';
import {adaptivePlaybackLead} from './playback';
let engine:TrafficEngine|MaintainedEngine|AdaptiveEngine|NetworkEngine|undefined,generation=0;
self.onmessage=async(event:MessageEvent<{generation:number;sequence:number;definition?:TrafficDefinition|MaintainedDefinition|AdaptiveDefinition|NetworkDefinition;target?:number;after?:number}>)=>{
 const m=event.data;
 try {
  if(m.definition){generation=m.generation;engine=isNetwork(m.definition)?new NetworkEngine(m.definition):isAdaptive(m.definition)?new AdaptiveEngine(m.definition):isMaintained(m.definition)?new MaintainedEngine(m.definition):new TrafficEngine(m.definition);}
  if(m.generation!==generation || !engine)return;
  if(engine instanceof MaintainedEngine||engine instanceof AdaptiveEngine||engine instanceof NetworkEngine) {
   // Initial forecasts may take several bounded turns; no partial ready packet.
   while(!engine.initialized&&!engine.halt){engine.advanceTo(0,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(!engine.initialized)throw Error(engine.halt??'Initial epoch failed');
   if(m.definition && (engine instanceof AdaptiveEngine||engine instanceof NetworkEngine))while(engine.frontier<adaptivePlaybackLead&&!engine.halt){engine.advanceTo(adaptivePlaybackLead,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(m.target!==undefined)engine.advanceTo(m.target,24);
  }else if(m.target!==undefined)engine.advanceTo(m.target,128);
  self.postMessage({generation,sequence:m.sequence,delta:engine.delta(m.after)});
 }catch(error){self.postMessage({generation:m.generation,sequence:m.sequence,error:(error as Error).message});}
};
