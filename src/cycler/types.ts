import type {State} from '../sim/schema';
import type {Hardware,Phase,Flow,Segment} from '../compact/types';

export interface PassThroughDefinition {
  schemaVersion:1; modelVersion:'pass-through-set-v1'|'cycler-fleet-set-v1'; id:string; name:string;
  artifactUrl?:string;
}
export interface Mission {
  stages:{origin:string|null;destination:string|null;segments:Segment[]}[];
  moonUnload:number;moonRefill:number;asterUnload:number;asterRefill:number;
  funding:Record<'Cairn'|'Haven',{fuelCap:number;cargo:number}>;
}
export interface PassThroughProfile {
  schemaVersion:1;modelVersion:'pass-through-profile-v1';period:number;duration:number;
  rate:number;step:number;height:number;exhaustVelocity:number;padPhases:Record<string,number>;
  carrier:Hardware;shuttle:Hardware;carrierSegments:Segment[];missions:Mission[];
  encounters:{t:number;body:string;distance:number}[];proof:unknown;
}
export interface FinitePhase extends Phase {label:string;carrier?:number}
export interface PassThroughTemplate {
  recurrence?:{carrierDeltaV:number[]};fleet?:boolean;duration:number;period:number;rate:number;exhaustVelocity:number;padPhases:Record<string,number>;
  hardware:Hardware[];phases:FinitePhase[][];flows:Flow[];cost:number[];
  events:{t:number;actor:number;kind:'maintenance'|'dock'|'undock'|'land'|'launch'|'transfer'|'thrust-start'|'thrust-end'|'milestone';id:string;label:string;port?:string;deltaV:number;fuelUsed:number;beforeFuel:number;afterFuel:number;positionError?:number;velocityError?:number;cargoBefore?:number;cargoAfter?:number}[];
  work:{nodes:number;checks:number;oraclePosition:number;oracleVelocity:number;bytes:number};
}
export interface PassThroughPlayback {template:PassThroughTemplate;actor:number;continuous?:boolean;oldest?:number;end?:number}
export interface PassThroughRun {template:PassThroughTemplate;carrierFinal:State}
export const isPassThrough=(v:unknown):v is PassThroughDefinition=>(v as PassThroughDefinition)?.modelVersion==='pass-through-set-v1'||(v as PassThroughDefinition)?.modelVersion==='cycler-fleet-set-v1';

export interface FleetProfile {
  schemaVersion:1;modelVersion:'cycler-fleet-profile-v1';period:number;duration:number;
  rate:number;step:number;height:number;exhaustVelocity:number;padPhases:Record<string,number>;
  carriers:{hardware:Hardware;segments:Segment[]}[];
  riders:{hardware:Hardware;mission:Mission;outbound:string;inbound:string}[];
  proof:unknown;
}

export type RecurringFleetProfile=Omit<FleetProfile,'modelVersion'>&{modelVersion:'recurring-cycler-profile-v1'};
