import type {CubicControl} from '../sim/cubic';
import type {State} from '../sim/schema';
export interface Hardware {id:string;name:string;color:string;dryMass:number;fuel:number;cargo:number;maxAcceleration:number;maxForce:number}
export interface Segment {id:string;start:number;end:number;initial:State;endpoint:State;control?:CubicControl;oracle:number[][]}
export interface CompactProfile {schemaVersion:1;modelVersion:'compact-cycler-profile-v1';period:number;rate:number;step:number;height:number;beaconRadius:number;exhaustVelocity:number;times:Record<string,number>;carrier:Hardware;shuttle:Hardware;segments:Segment[];proof:unknown}
export interface CompactDefinition {schemaVersion:1;modelVersion:'compact-cycler-v1';id:string;name:string;continuous:boolean;artifactUrl?:string}
export interface Phase {start:number;end:number;kind:'support'|'flight'|'ride';port?:string;rows?:number[][];control?:CubicControl;fuel:number;fuelEnd:number;used:number;cargo:number}
export interface Flow {t:number;actor:number;kind:'import'|'delivery';fuel:number;cargo:number;beforeFuel:number;afterFuel:number;beforeCargo:number;afterCargo:number;port:string}
export interface CompactTemplate {period:number;rate:number;beaconRadius:number;exhaustVelocity:number;hardware:Hardware[];phases:Phase[][];cost:number[];flows:Flow[];events:{t:number;actor:number;kind:'dock'|'undock'|'land'|'launch'|'transfer'|'thrust-start'|'thrust-end';id:string;label:string;port?:string;deltaV:number;fuelUsed:number;beforeFuel:number;afterFuel:number;positionError?:number}[];work:{nodes:number;checks:number;bytes:number;oraclePosition:number;oracleVelocity:number}}
export interface CompactPlayback {template:CompactTemplate;actor:number;oldest:number;end:number;maxEpoch:number}
export const isCompact=(v:unknown):v is CompactDefinition=>(v as CompactDefinition)?.modelVersion==='compact-cycler-v1';
