import {Runner,type Sample,type EventBoundary} from '../sim/runner';
import type {State,ThrustArc} from '../sim/schema';
import {admitBinary,equilibria,rotatingState,type BinarySet} from './model';
import type {ViewSample,ViewerEvent,SceneView} from '../model-set/model';
export interface SurveyReference {schemaVersion:1;mu:number;separation:number;rate:number;xL:number;frequencies:number[];terms:{axis:number;k:number;l:number;coefficient:number}[];maxCollocationResidual:number;growth:number;unstableLeft:number[];unstableRight:number[];stableLeft:number[];stableRight:number[]}
export interface SurveyDefinition {schemaVersion:1;modelVersion:'libration-survey-v1';id:string;name:string;description:string;provenance:string;source:BinarySet;reference:SurveyReference}
export const isSurvey=(d:unknown):d is SurveyDefinition=>(d as SurveyDefinition)?.modelVersion==='libration-survey-v1';
export const SURVEY_STEP=4,SURVEY_LEAD=32,SURVEY_RETENTION=1024,SURVEY_MAX=1_000_000;
const dot=(a:number[],b:number[])=>a.reduce((v,x,i)=>v+x*b[i],0);
export function surveyReference(r:SurveyReference,phases:number[]):State {
 const out:State=[r.xL,0,0,0,0,0];for(const term of r.terms){const p=term.k*phases[0]+term.l*phases[1],f=term.k*r.frequencies[0]+term.l*r.frequencies[1],s=Math.sin(p),c=Math.cos(p);out[term.axis]+=term.coefficient*(term.axis===1?s:c);out[term.axis+3]+=term.coefficient*f*(term.axis===1?c:-s);}return out;
}
export function surveyWorld(d:SurveyDefinition,phases:number[],epoch:number):State {
 const r=d.reference,[x,y,z,vx,vy,vz]=surveyReference(r,phases),a=r.separation,n=r.rate,angle=d.source.binary.phase+n*epoch,c=Math.cos(angle),s=Math.sin(angle);
 return [a*(c*x-s*y),a*(s*x+c*y),a*z,a*n*(c*(vx-y)-s*(vy+x)),a*n*(s*(vx-y)+c*(vy+x)),a*n*vz];
}
const normalized=(d:SurveyDefinition,y:State,t:number)=>rotatingState(d.source.binary,y,t).map((v,i)=>v/(d.reference.separation*(i<3?1:d.reference.rate)));
const center=(r:SurveyReference,v:number[])=>{const p=dot(r.unstableLeft,v),m=dot(r.stableLeft,v);return v.map((x,i)=>x-p*r.unstableRight[i]-m*r.stableRight[i]);};
function phasesAt(d:SurveyDefinition,state:State,t:number,expected:number[]):number[]{
 const r=d.reference,actual=normalized(d,state,t),phase=[...expected];
 for(let k=0;k<4;k++){
  const ref=surveyReference(r,phase),error=center(r,actual.map((x,i)=>x-ref[i])),h=1e-5;
  const jac=[0,1].map(i=>{const p=[...phase],m=[...phase];p[i]+=h;m[i]-=h;return center(r,surveyReference(r,p).map((x,k)=>(x-surveyReference(r,m)[k])/(2*h)));});
  const aa=dot(jac[0],jac[0])+1e-10,bb=dot(jac[0],jac[1]),cc=dot(jac[1],jac[1])+1e-10,det=aa*cc-bb*bb,e=dot(jac[0],error),f=dot(jac[1],error);
  if(det<1e-14)break;const delta=[(cc*e-bb*f)/det,(aa*f-bb*e)/det];for(let i=0;i<2;i++)phase[i]=Math.max(expected[i]-.15,Math.min(expected[i]+.15,phase[i]+delta[i]));
 }
 return phase;
}
export interface SurveyChunk {start:number;end:number;samples:ViewSample[];arcs:ThrustArc[];ledger:ViewerEvent[];boundaries:EventBoundary[];phases:number[];acceleration:number;miss:number;work:number}
export function surveyEpisode(d:SurveyDefinition,t:number,state:State,fuel:number,expected:number[]):SurveyChunk {
 const r=d.reference,phase=phasesAt(d,state,t,expected),end=t+SURVEY_STEP;
 const future=phase.map((v,i)=>v+r.frequencies[i]*r.rate*SURVEY_STEP),ref=surveyReference(r,future),initialFuel=d.source.vessels[0].bundle.scenario.ship.propellant;
 let work=0;const candidate=(acceleration:number)=>{
  if(++work>7)throw Error('Survey solve work exceeded');const bundle=structuredClone(d.source.vessels[0].bundle);bundle.scenario.epoch=t;bundle.scenario.duration=SURVEY_STEP;bundle.scenario.ship.state=[...state];bundle.scenario.ship.propellant=fuel;bundle.scenario.policy={step:1/1024,maxNodes:8192,maxSubdivision:20};
  bundle.program={schemaVersion:4,id:'survey-'+t,burns:[],thrustArcs:[]};
  if(Math.abs(acceleration)>1e-9){const mass=bundle.scenario.ship.dryMass+fuel,heading=acceleration<0?Math.PI:0;const keys=[0,.25,.5].map(offset=>({offset,direction:[Math.cos(d.source.binary.phase+r.rate*(t+offset)+heading),Math.sin(d.source.binary.phase+r.rate*(t+offset)+heading),0] as [number,number,number]}));bundle.program.thrustArcs=[{id:'correction-'+t,start:t,end:t+.5,direction:keys[0].direction,throttle:Math.abs(acceleration)*mass/bundle.scenario.ship.engine!.maxThrust,steering:{kind:'spherical-smoothstep-v1',keys}}];}
  const runner=new Runner(bundle),last=runner.advanceTo(end);if(last.status!=='horizon')throw Error('Survey flight: '+last.status);const actual=normalized(d,last.y,end),error=actual.map((x,i)=>x-ref[i]);return {runner,last,arcs:bundle.program.thrustArcs!,miss:dot(r.unstableLeft,error)};
 };
 let acceleration=0,p=candidate(0);let gain=r.unstableLeft[3]*Math.exp(r.growth*r.rate*SURVEY_STEP)*(1-Math.exp(-r.growth*r.rate*.5))/(r.growth*r.rate*r.separation*r.rate);
 if(Math.abs(p.miss)>1e-7){
  const measured=(candidate(5e-6).miss-p.miss)/5e-6;if(!Number.isFinite(measured)||measured*gain<=0||Math.abs(measured)<Math.abs(gain)*.2)throw Error('Survey actuator conditioning');gain=measured;
  for(let k=0;k<5;k++){acceleration=Math.max(-.0015,Math.min(.0015,acceleration-p.miss/gain));p=candidate(acceleration);if(Math.abs(p.miss)<1e-7)break;}
 }
 if(Math.abs(p.miss)>2e-6||p.last.propellant<.04)throw Error(p.last.propellant<.04?'Survey fuel reserve':'Survey correction refused');
 const epochs=[...new Set([t,end,...Array.from({length:33},(_,i)=>t+i/8),...p.arcs.flatMap(a=>[a.start,a.start+.25,a.end])])].sort((a,b)=>a-b);
 const samples=epochs.map(epoch=>{const s=p.runner.sample(epoch),y=normalized(d,s.y,epoch),c=center(r,y.map((v,i)=>v-(i===0?r.xL:0))),horizontal=Math.hypot(c[0],c[3]/r.frequencies[0]),vertical=Math.hypot(y[2],y[5]/r.frequencies[1]),refState=surveyReference(r,phase.map((v,i)=>v+r.frequencies[i]*r.rate*(epoch-t))),neutralError=Math.hypot(...center(r,y.map((v,i)=>v-refState[i])));if(horizontal<.002||horizontal>.03||vertical<.01||vertical>.055||neutralError>.025)throw Error('Survey center motion envelope lost');if(Math.hypot(y[0]-r.xL,y[1],y[2])>.12)throw Error('Survey envelope lost');return {...s,mass:1+s.propellant,fuelUsed:initialFuel-s.propellant} as ViewSample;});
 return {start:t,end,samples,arcs:p.arcs,ledger:p.runner.ledger,boundaries:p.runner.eventBoundaries.map(b=>({...b,before:{...b.before,mass:1+b.before.propellant,fuelUsed:initialFuel-b.before.propellant},after:{...b.after,mass:1+b.after.propellant,fuelUsed:initialFuel-b.after.propellant}})),phases:future,acceleration,miss:p.miss,work};
}
export function validateSurvey(d:SurveyDefinition){
 if(!isSurvey(d)||d.schemaVersion!==1)throw Error('Survey version');admitBinary(d.source);const r=d.reference,b=d.source.binary;
 if(r.schemaVersion!==1||r.mu!==b.mu||r.separation!==b.separation||r.rate!==b.rate||r.terms.length>100||(!Number.isFinite(r.maxCollocationResidual)||r.maxCollocationResidual<0||r.maxCollocationResidual>.001)||r.frequencies.length!==2||r.frequencies.some(x=>!Number.isFinite(x)||x<1||x>3)||!Number.isFinite(r.xL)||!Number.isFinite(r.growth))throw Error('Survey reference admission');
 for(const v of [r.unstableLeft,r.unstableRight,r.stableLeft,r.stableRight])if(v.length!==6||v.some(x=>!Number.isFinite(x)))throw Error('Survey mode projection');for(const term of r.terms)if(![0,1,2].includes(term.axis)||!Number.isInteger(term.k)||!Number.isInteger(term.l)||Math.abs(term.k)>4||Math.abs(term.l)>4||!Number.isFinite(term.coefficient))throw Error('Survey Fourier term');
 if(Math.abs(equilibria(b).find(p=>p.id==='L2')!.x/b.separation-r.xL)>1e-10||Math.abs(dot(r.unstableLeft,r.unstableRight)-1)>1e-10||Math.abs(dot(r.stableLeft,r.stableRight)-1)>1e-10||Math.abs(dot(r.unstableLeft,r.stableRight))>1e-10||r.growth<=0)throw Error('Survey reference modes');
 const h=d.source.vessels[0].bundle.scenario.ship;if(Math.max(...h.state.map((v,i)=>Math.abs(v-surveyWorld(d,[0,0],0)[i])))>1e-12)throw Error('Survey frozen seed mismatch');if(h.dryMass!==1||h.cargoMass!==0||h.propellant!==.4||h.exhaustVelocity!==50||h.engine?.maxThrust!==.003||h.engine.maxAcceleration!==.002)throw Error('Survey hardware');
 return structuredClone(d);
}
