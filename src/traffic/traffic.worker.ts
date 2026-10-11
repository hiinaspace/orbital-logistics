import {AsterSystemEngine,isAsterSystem,type AsterSystemDefinition} from '../aster-system/engine';
import {StagedServiceEngine,isStagedService,type StagedServiceDefinition} from '../staged-service/engine';
import {LibrationEngine,isLibration,type LibrationDefinition} from '../libration/engine';
import {ExpeditionFleetEngine,isExpeditionFleet,type ExpeditionFleetDefinition} from '../expedition/fleet';
import {ExpeditionEngine,isExpedition,EXPEDITION_LEAD,type ExpeditionDefinition} from '../expedition/engine';
import {LunarEngine} from '../lunar/engine';
import {isLunar,LUNAR_LEAD,type LunarDefinition} from '../lunar/world';
import {TrafficEngine} from './engine';
import {NetworkEngine} from '../network/engine';
import {isNetwork,type NetworkDefinition} from '../network/model';
import type {TrafficDefinition} from './planner';
import {MaintainedEngine} from '../maintained/engine';
import {isMaintained,type MaintainedDefinition} from '../maintained/world';
import {AdaptiveEngine} from '../adaptive/engine';
import {isAdaptive,type AdaptiveDefinition} from '../adaptive/world';
import {adaptivePlaybackLead} from './playback';
let engine:TrafficEngine|MaintainedEngine|AdaptiveEngine|NetworkEngine|LunarEngine|ExpeditionEngine|ExpeditionFleetEngine|LibrationEngine|StagedServiceEngine|AsterSystemEngine|undefined,generation=0;
self.onmessage=async(event:MessageEvent<{generation:number;sequence:number;definition?:TrafficDefinition|MaintainedDefinition|AdaptiveDefinition|NetworkDefinition|LunarDefinition|ExpeditionDefinition|ExpeditionFleetDefinition|LibrationDefinition|StagedServiceDefinition|AsterSystemDefinition;target?:number;after?:number}>)=>{
 const m=event.data;
 try {
  if(m.definition){generation=m.generation;engine=isAsterSystem(m.definition)?new AsterSystemEngine(m.definition):isStagedService(m.definition)?new StagedServiceEngine(m.definition):isLibration(m.definition)?new LibrationEngine(m.definition):isExpeditionFleet(m.definition)?new ExpeditionFleetEngine(m.definition):isExpedition(m.definition)?new ExpeditionEngine(m.definition):isLunar(m.definition)?new LunarEngine(m.definition):isNetwork(m.definition)?new NetworkEngine(m.definition):isAdaptive(m.definition)?new AdaptiveEngine(m.definition):isMaintained(m.definition)?new MaintainedEngine(m.definition):new TrafficEngine(m.definition);}
  if(m.generation!==generation || !engine)return;
  if(engine instanceof AsterSystemEngine||engine instanceof StagedServiceEngine||engine instanceof LibrationEngine||engine instanceof ExpeditionEngine||engine instanceof ExpeditionFleetEngine){engine.advanceTo(m.target??EXPEDITION_LEAD);}
  else if(engine instanceof LunarEngine||engine instanceof MaintainedEngine||engine instanceof AdaptiveEngine||engine instanceof NetworkEngine) {
   // Initial forecasts may take several bounded turns; no partial ready packet.
   while(!engine.initialized&&!engine.halt){engine.advanceTo(0,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(!engine.initialized)throw Error(engine.halt??'Initial epoch failed');
   if(m.definition && (engine instanceof AdaptiveEngine||engine instanceof NetworkEngine))while(engine.frontier<adaptivePlaybackLead&&!engine.halt){engine.advanceTo(adaptivePlaybackLead,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(m.definition&&engine instanceof LunarEngine)while(engine.frontier<LUNAR_LEAD&&!engine.halt){engine.advanceTo(LUNAR_LEAD,24);await new Promise(resolve=>setTimeout(resolve,0));}
   if(m.target!==undefined)engine.advanceTo(m.target,24);
  }else if(m.target!==undefined)engine.advanceTo(m.target,128);
  self.postMessage({generation,sequence:m.sequence,delta:engine instanceof AsterSystemEngine||engine instanceof StagedServiceEngine||engine instanceof LibrationEngine||engine instanceof ExpeditionEngine||engine instanceof ExpeditionFleetEngine?engine.delta():engine instanceof LunarEngine?engine.delta():engine.delta(m.after)});
 }catch(error){self.postMessage({generation:m.generation,sequence:m.sequence,error:(error as Error).message});}
};
