import {validateSurvey,surveyWorld,surveyEpisode,SURVEY_STEP,SURVEY_LEAD,SURVEY_RETENTION,SURVEY_MAX,type SurveyDefinition,type SurveyChunk} from './survey';
import type {State} from '../sim/schema';
export interface SurveyAnchor {t:number;y:State;fuel:number;phases:number[];fuelUsed:number}
export interface SurveyDelta {domain:'libration-survey-v1';frontier:number;oldest:number;source?:SurveyDefinition;anchor:SurveyAnchor;chunks:SurveyChunk[];halt?:string;stats:Record<string,number>}
export const SURVEY_ROWS=10000,SURVEY_BYTES=8_000_000,SURVEY_CHUNKS=258;
export const encoded=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
export class SurveyEngine {
 readonly definition:SurveyDefinition;frontier=0;oldest=0;halt?:string;#state:State;#fuel=.4;#phases=[0,0];#chunks=new Map<number,SurveyChunk>();#sent=new Set<number>();#sourceSent=false;#work=0;
 constructor(d:SurveyDefinition){this.definition=validateSurvey(d);this.#state=surveyWorld(this.definition,[0,0],0);}
 anchor():SurveyAnchor{return {t:this.frontier,y:[...this.#state],fuel:this.#fuel,phases:[...this.#phases],fuelUsed:.4-this.#fuel};}
 advanceTo(target:number){
  if(!Number.isFinite(target)||target<0||target>SURVEY_MAX)throw Error('Survey epoch request');if(this.halt)return;
  const end=Math.min(SURVEY_MAX,this.frontier+(this.frontier===0?SURVEY_LEAD:SURVEY_STEP),Math.ceil(target/SURVEY_STEP)*SURVEY_STEP);
  while(this.frontier<end){
   try{const c=surveyEpisode(this.definition,this.frontier,this.#state,this.#fuel,this.#phases);if(c.samples.length>48||c.work>7||encoded(c)>50000)throw Error('Survey candidate storage budget');
    const oldest=Math.max(0,c.end-SURVEY_RETENTION+SURVEY_LEAD),next=new Map([...this.#chunks].filter(([t,c])=>c.end>=oldest));next.set(c.start,c);
    if(next.size>SURVEY_CHUNKS||[...next.values()].reduce((n,c)=>n+c.samples.length,0)>SURVEY_ROWS||encoded([...next.values()])>SURVEY_BYTES)throw Error('Survey retained budget');
    // One atomic epoch commit: rejected flights never change phase, fuel or head.
    this.#chunks=next;this.frontier=c.end;this.oldest=oldest;this.#state=[...c.samples.at(-1)!.y];this.#fuel=c.samples.at(-1)!.propellant;this.#phases=[...c.phases];this.#work+=c.work;
    for(const t of this.#sent)if(t<oldest-SURVEY_STEP)this.#sent.delete(t);
   }catch(error){this.halt=(error as Error).message;break;}
  }
 }
 delta():SurveyDelta {
  const chunks=[...this.#chunks.values()].filter(c=>!this.#sent.has(c.start));const p:SurveyDelta={domain:'libration-survey-v1',frontier:this.frontier,oldest:this.oldest,anchor:this.anchor(),chunks,...(!this.#sourceSent?{source:this.definition}:{}),...(this.halt?{halt:this.halt}:{}),stats:{chunks:this.#chunks.size,rows:[...this.#chunks.values()].reduce((n,c)=>n+c.samples.length,0),bytes:encoded([...this.#chunks.values()]),candidateWork:this.#work,retainedPhysicsNodes:0,maxCandidateNodes:8192,nominalCandidateStages:7*SURVEY_STEP*1024,fuelUsed:.4-this.#fuel}};
  if(encoded(p)>1_000_000)throw Error('Survey reply bytes');chunks.forEach(c=>this.#sent.add(c.start));this.#sourceSent=true;return structuredClone(p);
 }
}
