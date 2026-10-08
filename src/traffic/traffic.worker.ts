import {TrafficEngine} from './engine';
import type {TrafficDefinition} from './planner';
let engine:TrafficEngine|undefined,generation=0;
self.onmessage=(event:MessageEvent<{generation:number;sequence:number;definition?:TrafficDefinition;target?:number;after?:number}>)=>{
 const m=event.data;
 try {
  if(m.definition){generation=m.generation;engine=new TrafficEngine(m.definition);}
  if(m.generation!==generation || !engine)return;
  if(m.target!==undefined)engine.advanceTo(m.target,128);
  self.postMessage({generation,sequence:m.sequence,delta:engine.delta(m.after)});
 }catch(error){self.postMessage({generation:m.generation,sequence:m.sequence,error:(error as Error).message});}
};
