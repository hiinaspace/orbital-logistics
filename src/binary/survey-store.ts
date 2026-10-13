import {validateBundle} from '../sim/schema';
import {validateSurvey,SURVEY_STEP,SURVEY_LEAD,SURVEY_RETENTION,SURVEY_MAX,type SurveyDefinition,type SurveyChunk} from './survey';
import {SURVEY_ROWS,SURVEY_BYTES,SURVEY_CHUNKS,encoded,type SurveyDelta,type SurveyAnchor} from './survey-engine';
import type {SceneView,ViewSample} from '../model-set/model';
const valid=(s:ViewSample)=>Number.isFinite(s.t)&&s.y.length===6&&s.y.every(Number.isFinite)&&Number.isFinite(s.propellant)&&s.propellant>=0&&Number.isFinite(s.fuelUsed)&&s.fuelUsed!>=0&&Number.isFinite(s.mass);
export class SurveyStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};#chunks=new Map<number,SurveyChunk>();#anchor?:SurveyAnchor;
 readonly definition:SurveyDefinition;
 constructor(d:SurveyDefinition){this.definition=validateSurvey(d);}
 ingest(p:SurveyDelta,held=false){
  if(p.domain!=='libration-survey-v1'||p.frontier<this.frontier||p.frontier>SURVEY_MAX||p.frontier%SURVEY_STEP!==0||p.oldest!==Math.max(0,p.frontier-SURVEY_RETENTION+SURVEY_LEAD)||p.oldest<this.watermark||p.frontier-this.frontier>(this.#anchor?SURVEY_STEP:SURVEY_LEAD)||encoded(p)>1_000_000||p.chunks.length>8)throw Error('Survey packet domain/clock');
  if(p.source){validateSurvey(p.source);if(this.#anchor||JSON.stringify(p.source)!==JSON.stringify(this.definition))throw Error('Survey source identity');}else if(!this.#anchor)throw Error('Survey source missing');
  const a=p.anchor;if(!a||a.t!==p.frontier||a.y.length!==6||a.y.some(x=>!Number.isFinite(x))||!Number.isFinite(a.fuel)||a.fuel<0||a.fuel>.4||Math.abs(a.fuelUsed-(.4-a.fuel))>1e-12||a.phases.length!==2||a.phases.some(x=>!Number.isFinite(x)))throw Error('Survey physical/controller anchor');
  if(!this.#anchor&&p.frontier>0){const first=p.chunks.find(c=>c.start===0)?.samples[0],seed=this.definition.source.vessels[0].bundle.scenario.ship;if(!first||first.y.some((x,i)=>Math.abs(x-seed.state[i])>1e-12)||Math.abs(first.propellant-seed.propellant)>1e-12)throw Error('Survey initial seed');}
  const oldest=held?this.oldest:p.oldest,next=new Map([...this.#chunks].filter(([_,c])=>c.end>=oldest));
  for(const c of p.chunks){
   if(next.has(c.start)||c.start%SURVEY_STEP!==0||c.end!==c.start+SURVEY_STEP||c.start<oldest-SURVEY_STEP||c.end>p.frontier||c.samples.length>48||c.samples.length<2||c.samples[0].t!==c.start||c.samples.at(-1)!.t!==c.end||c.samples.some((s,i)=>!valid(s)||i>0&&s.t<=c.samples[i-1].t)||c.phases.length!==2||c.phases.some(x=>!Number.isFinite(x))||c.work>7||c.arcs.length>1||c.ledger.length>4||c.boundaries.length>4||encoded(c)>50000)throw Error('Survey drawing chunk');if(!Number.isFinite(c.acceleration)||Math.abs(c.acceleration)>.0015||!Number.isFinite(c.miss)||Math.abs(c.miss)>2e-6||!Number.isInteger(c.work)||c.work<1||c.samples.some(q=>Math.abs(q.fuelUsed!-(.4-q.propellant))>1e-12||Math.abs(q.mass!-(1+q.propellant))>1e-12))throw Error('Survey control/accounting');const scenario=structuredClone(this.definition.source.vessels[0].bundle.scenario);scenario.epoch=c.start;scenario.duration=4;scenario.ship.state=c.samples[0].y;scenario.ship.propellant=c.samples[0].propellant;scenario.policy={step:1/1024,maxNodes:8192,maxSubdivision:20};validateBundle({scenario,program:{schemaVersion:4,id:'drawing-controls',burns:[],thrustArcs:c.arcs}});if(c.boundaries.some(b=>b.t<c.start||b.t>c.end||[b.before,b.after].some(q=>!valid(q as ViewSample)||q.t!==b.t||Math.abs(q.fuelUsed!-(.4-q.propellant))>1e-12||Math.abs((q as ViewSample).mass!-(1+q.propellant))>1e-12)))throw Error('Survey event accounting');const previous=next.get(c.start-4);if(previous&&(JSON.stringify(previous.samples.at(-1)!.y)!==JSON.stringify(c.samples[0].y)||previous.samples.at(-1)!.propellant!==c.samples[0].propellant))throw Error('Survey chunk seam');next.set(c.start,structuredClone(c));
  }
  if(next.size>SURVEY_CHUNKS+1||[...next.values()].reduce((n,c)=>n+c.samples.length,0)>SURVEY_ROWS+48||encoded([...next.values()])>SURVEY_BYTES+50000||p.frontier-oldest>SURVEY_RETENTION+SURVEY_STEP)throw Error('Survey held history budget');
  for(let t=Math.floor(oldest/SURVEY_STEP)*SURVEY_STEP;t<p.frontier;t+=SURVEY_STEP)if(!next.has(t))throw Error('Missing survey coverage');
  if(p.frontier>0){const last=next.get(p.frontier-SURVEY_STEP)!;if(JSON.stringify(last.samples.at(-1)!.y)!==JSON.stringify(a.y)||last.samples.at(-1)!.propellant!==a.fuel||JSON.stringify(last.phases)!==JSON.stringify(a.phases))throw Error('Survey endpoint mismatch');}
  // Stage all validation before publishing to the visible clock.
  this.#chunks=next;this.#anchor=structuredClone(a);this.frontier=p.frontier;this.watermark=p.oldest;if(!held)this.oldest=p.oldest;this.halt=p.halt;this.stats={...p.stats};
 }
 release(){this.oldest=this.watermark;this.#chunks=new Map([...this.#chunks].filter(([_,c])=>c.end>=this.oldest));}
 view(cursor:number):SceneView {
  if(!this.#anchor||cursor<this.oldest||cursor>this.frontier)throw Error('Survey cursor outside history');
  const d=this.definition,s=d.source.vessels[0],chunks=[...this.#chunks.values()].sort((a,b)=>a.start-b.start),rows=new Map<number,ViewSample>();for(const c of chunks)for(const q of c.samples)if(q.t>=this.oldest||q.t===c.start)rows.set(q.t,q);
  if(!rows.size)rows.set(0,{t:0,y:this.#anchor.y,propellant:this.#anchor.fuel,fuelUsed:0,burnCursor:0,status:'running',detail:''});
  const samples=[...rows.values()].sort((a,b)=>a.t-b.t),v={id:s.bundle.scenario.ship.id,name:s.name,color:s.color,cargo:s.cargo,glyph:'observatory' as const,maintenance:true,interpolation:'hermite' as const,ship:s.bundle.scenario.ship,ports:[],cargoCapacity:0,continuousFuel:true,portSamples:{},samples,arcs:chunks.flatMap(c=>c.arcs),ledger:chunks.flatMap(c=>c.ledger),boundaries:chunks.flatMap(c=>c.boundaries)};
  return {schemaVersion:1,id:d.id,name:d.name,description:d.description,provenance:d.provenance,extent:5,stations:[],rotating:d.source.rotating,binary:d.source.binary,frameExtents:{libration:.3,[s.bundle.scenario.bodies[1].id]:.5},vessels:[v],portSamples:{},world:{bodies:s.bundle.scenario.bodies,ports:[],units:s.bundle.scenario.units},window:{start:this.oldest,end:this.frontier},playback:{rateScale:1,trailSpan:512,forecastSpan:32,maxZoom:4000},traffic:{frontier:this.frontier,oldest:this.oldest,depots:[],resources:[{t:this.oldest,stocks:[],cargoImported:0,cargoExported:0,fuelImported:0,fuelExported:0}],stats:this.stats,halt:this.halt}};
 }
}
