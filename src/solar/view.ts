import type {Body,Port,State} from '../sim/schema';
import type {SceneView,VesselView,ViewSample,ViewerEvent,Stock} from '../model-set/model';
import {AU_KM,YEAR_SECONDS,solarGMs,solarNames,solarRadii,solarStates,type SolarWorld} from './ephemeris';
import {sampleSolar,solarStateAt,type SolarArc,type SolarPlayback,type SolarCapture} from './query';
export interface SolarDefinition {schemaVersion:1;modelVersion:'solar-transport-v1';id:string;name:string;artifactUrl?:string}
interface ArtifactVessel {captures?:SolarCapture[];coasts?:{start:number;end:number;initial:number[];endpoint:number[]}[];id:string;name:string;color:string;dryMass:number;initialFuel:number;cargo:number;start?:number;end?:number;rows:number[][];arcs:SolarArc[];events:{t:number;kind:ViewerEvent['kind'];label:string}[]}
export interface SolarArtifact extends SolarWorld,SolarDefinition {duration:number;extent:number;synodic:number;exhaustVelocity:number;maxAcceleration:number;maxForce:number;description:string;provenance:string;vessels:ArtifactVessel[];ports:{id:string;body:number;rows:number[][]}[];proof:unknown}
export interface SolarScene extends SolarWorld {ports:SolarArtifact['ports'];duration:number;proof:unknown;consignments:{start:number;end:number;fuel:number;remaining:number}[]}
export const isSolar=(value:unknown):value is SolarDefinition=>(value as SolarDefinition)?.modelVersion==='solar-transport-v1';
export function solarPortState(scene:SolarScene,id:string,t:number):State {const p=scene.ports.find(p=>p.id===id);if(!p)throw Error('Unknown solar gateway');return solarStateAt(p.rows,t);}
export function solarStockAt(scene:SolarScene,t:number):Stock[] {
 const launched=scene.consignments.filter(c=>c.start<=t),landed=scene.consignments.filter(c=>c.end<=t);
 return [{id:'Earth gateway',cargo:3-launched.length,propellant:57-launched.reduce((s,c)=>s+c.fuel,0),occupied:scene.consignments.filter(c=>c.start>t).length},
  {id:'Mars gateway',cargo:landed.length,propellant:landed.reduce((s,c)=>s+c.remaining,0),occupied:landed.length}];
}
function drawingSamples(p:SolarPlayback):ViewSample[]{
 const indices=new Set([0,p.rows.length-1]),stride=Math.max(1,Math.ceil(p.rows.length/1800));
 for(let i=0;i<p.rows.length;i+=stride)indices.add(i);
 for(const t of p.arcs.flatMap(a=>[a.start,a.end])){const i=p.rows.findIndex(r=>r[0]>=t);if(i>=0)indices.add(i);}
 return [...indices].sort((a,b)=>a-b).map(i=>{const s=sampleSolar(p,p.rows[i][0]);return {t:s.t,y:s.y,propellant:s.propellant,fuelUsed:s.fuelUsed,burnCursor:0,status:'running' as const,detail:'',...(s.opacity===0?{opacity:0}:{}),...(p.cargo?{logistics:s.logistics}:{})};});
}
const vector=(x:unknown):x is number[]=>Array.isArray(x)&&x.length===6&&x.every(Number.isFinite);
function verifyRows(rows:number[][],fuel:boolean,duration:number):void {
 if(rows.length<2||rows.length>100000)throw Error('Solar physical row budget');
 let previous=-Infinity;for(const r of rows){if(r.length!==(fuel?9:7)||r.some(x=>!Number.isFinite(x))||r[0]<=previous||r[0]<0||r[0]>duration+1e-12||(fuel&&r[7]<0))throw Error('Invalid solar physical rows');previous=r[0];}
}
function verifyArc(value:SolarArtifact,arc:SolarArc):void {
 if(arc.start<0||arc.end>value.duration||arc.end<=arc.start||arc.keys.length!==257||arc.coefficients.length!==256||arc.coefficients.some(c=>c.length!==4||c.some(a=>a.length!==3||a.some(x=>!Number.isFinite(x)))))throw Error('Invalid frozen solar control');
 if(![0,1,3].includes(arc.referenceBody)||!vector(arc.localInitial)||!vector(arc.initial)||!vector(arc.endpoint))throw Error('Missing canonical solar origin');
 const origin=solarStates(value,arc.start)[arc.referenceBody];
 if(arc.initial.some((x,i)=>Math.abs(x-arc.localInitial[i]-origin[i])>1e-13))throw Error('Inconsistent canonical solar state');
 if(arc.keys[0][0]!==arc.start||arc.keys.at(-1)![0]!==arc.end)throw Error('Invalid solar control interval');
 for(let i=0;i<arc.keys.length;i++)if(arc.keys[i].length!==4||arc.keys[i].some(x=>!Number.isFinite(x))||i>0&&arc.keys[i][0]<=arc.keys[i-1][0])throw Error('Invalid solar control epochs');
 for(let i=0;i<arc.coefficients.length;i++){
  const c=arc.coefficients[i],h=arc.keys[i+1][0]-arc.keys[i][0];
  const hull=[c[3],c[3].map((x,j)=>x+c[2][j]*h/3),c[3].map((x,j)=>x+2*c[2][j]*h/3+c[1][j]*h*h/3),c[3].map((x,j)=>x+c[2][j]*h+c[1][j]*h*h+c[0][j]*h**3)];
  if(hull.some(p=>Math.hypot(...p)>value.maxAcceleration*(1+1e-12)))throw Error('Frozen solar acceleration cap');
 }
}
function verifyCaptures(value:SolarArtifact,v:ArtifactVessel):void {
 if(!v.captures||v.captures.length!==2)throw Error('Missing solar capture sides');
 for(const [i,c] of v.captures.entries()){
  if(c.t!==v.arcs[i].end||!vector(c.before)||![c.beforeFuel,c.afterFuel,c.positionErrorMeters,c.velocityErrorMetersS,c.paidDeltaV].every(Number.isFinite)||c.beforeFuel<c.afterFuel||c.afterFuel<0||c.positionErrorMeters<0||c.positionErrorMeters>100||c.velocityErrorMetersS<0||c.velocityErrorMetersS>.01)throw Error('Invalid solar capture');
  const after=solarStateAt(v.rows,c.t),position=Math.hypot(...c.before.slice(0,3).map((x,j)=>x-after[j]))*AU_KM*1000,speed=Math.hypot(...c.before.slice(3).map((x,j)=>x-after[j+3]))*AU_KM*1000/YEAR_SECONDS;
  if(Math.abs(position-c.positionErrorMeters)>.001||Math.abs(speed-c.velocityErrorMetersS)>1e-8||c.before.some((x,j)=>Math.abs(x-v.arcs[i].endpoint[j])>1e-13))throw Error('Inconsistent solar capture sides');
  const paid=(speed+.0001)/(AU_KM*1000/YEAR_SECONDS),mass=v.dryMass+v.cargo;
  if(Math.abs(c.paidDeltaV-paid)>1e-12||Math.abs(c.afterFuel-((mass+c.beforeFuel)*Math.exp(-paid/value.exhaustVelocity)-mass))>1e-10)throw Error('Unpaid solar capture');
  const row=v.rows.find(r=>r[0]===c.t);if(!row||Math.abs(row[7]-c.afterFuel)>1e-10)throw Error('Missing solar capture epoch');
 }
}
export function prepareSolar(value:SolarArtifact):SceneView {
 if(!isSolar(value)||value.schemaVersion!==1||value.id!=='solar-cycler'||value.vessels.length!==4||value.ports.length!==2||![value.duration,value.exhaustVelocity,value.mu,value.marsPhase,value.maxAcceleration,value.maxForce].every(Number.isFinite)||value.duration<=0||value.duration>8||!(value.exhaustVelocity>0)||!(value.mu>0)||!(value.maxAcceleration>0)||!(value.maxForce>0))throw Error('Invalid solar artifact');
 for(const p of value.ports)verifyRows(p.rows,false,value.duration);
 for(const [i,v] of value.vessels.entries()){
  verifyRows(v.rows,true,value.duration);v.arcs.forEach(a=>verifyArc(value,a));
  if(![v.dryMass,v.initialFuel,v.cargo].every(Number.isFinite)||!(v.dryMass>0)||!(v.initialFuel>0)||v.cargo<0||v.rows.some(r=>r[7]>v.initialFuel+1e-9)||v.rows.at(-1)![7]<v.initialFuel*.1)throw Error('Solar tank/reserve limit');
  const fixedMass=v.dryMass+v.cargo;
  for(let j=0;j<v.rows.length;j++){
   const r=v.rows[j],expected=(fixedMass+v.initialFuel)*Math.exp(-r[8]/value.exhaustVelocity)-fixedMass;
   if(r[8]<0||j>0&&r[8]<v.rows[j-1][8]-1e-12||Math.abs(expected-r[7])>1e-9)throw Error('Solar fuel integral mismatch');
  }
  if(i)verifyCaptures(value,v);
 }
 if(value.vessels.reduce((s,v)=>s+v.rows.length,0)+value.ports.reduce((s,p)=>s+p.rows.length,0)>120000)throw Error('Aggregate solar physical row budget');
 const scene:SolarScene={mu:value.mu,marsPhase:value.marsPhase,duration:value.duration,ports:value.ports,proof:value.proof,consignments:value.vessels.slice(1).map(v=>({start:v.start!,end:v.end!,fuel:v.initialFuel,remaining:v.rows.at(-1)![7]}))};
 const agrees=(a:number[],b:number[])=>a.length===6&&a.every((x,i)=>Math.abs(x-b[i])<1e-13);
 for(const v of value.vessels.slice(1)){
  if(v.start!==v.rows[0][0]||v.end!==v.rows.at(-1)![0]||!agrees(v.rows[0].slice(1,7),solarPortState(scene,'Earth gateway',v.start!))||!agrees(v.rows.at(-1)!.slice(1,7),solarPortState(scene,'Mars gateway',v.end!)))throw Error('Solar gateway event mismatch');
  if(!agrees(solarStateAt(v.rows,v.events[0].t),solarStateAt(value.vessels[0].rows,v.events[0].t))||!agrees(v.arcs[1].initial,solarStateAt(value.vessels[0].rows,v.events[1].t)))throw Error('Solar carrier attachment mismatch');
 }
 const gm=solarGMs(value.mu),initial=solarStates(value,0),bodies:Body[]=solarNames.map((id,i)=>({id,mu:gm[i],radius:solarRadii[i],rail:{kind:'fixed',position:initial[i].slice(0,3) as [number,number,number]}}));
 const ports:Port[]=value.ports.map(p=>({id:p.id,rail:{kind:'ballistic',epoch:0,validUntil:value.duration,state:solarPortState(scene,p.id,0),policy:{step:1/65536,maxNodes:65536,maxSubdivision:12},minClearance:0,provenance:'Offline full-field physical gateway provider; drawing interpolation never targets a flight'},cargo:p.body===1?3:0,cargoCapacity:3,propellant:p.body===1?57:0,tankCapacity:57,serviceDuration:0}));
 const rides=value.vessels.slice(1).map(v=>({id:v.id,start:v.events[0].t,end:v.events[1].t,mass:v.dryMass+v.cargo+v.captures![0].afterFuel}));
 for(const r of rides){if(r.end<=r.start||value.vessels[0].arcs.some(a=>r.start<a.end&&r.end>a.start))throw Error('Solar carrier burn overlaps attachment');}
 if(value.vessels[0].dryMass+value.vessels[0].initialFuel+Math.max(...rides.map(r=>r.mass))>125||value.maxForce<125*value.maxAcceleration)throw Error('Solar composite force budget');
 const vessels:VesselView[]=value.vessels.map((v,index)=>{
  const ride=index?{start:v.events[0].t,end:v.events[1].t}:undefined;
  const playback:SolarPlayback={rows:v.rows,arcs:v.arcs,captures:v.captures,dryMass:v.dryMass,initialFuel:v.initialFuel,cargo:v.cargo,exhaustVelocity:value.exhaustVelocity,start:v.start??0,end:v.end??value.duration,...(ride?{ride,ports:{origin:'Earth gateway',destination:'Mars gateway'}}:{rides})};
  const ship={id:v.id,state:v.rows[0].slice(1,7) as State,dryMass:v.dryMass,cargoMass:v.cargo,propellant:v.initialFuel,tankCapacity:v.initialFuel,exhaustVelocity:value.exhaustVelocity,engine:{maxThrust:value.maxForce,maxAcceleration:value.maxAcceleration}};
  const ledger:ViewerEvent[]=v.arcs.flatMap(a=>[{t:a.start,kind:'thrust-start' as const,id:a.id,deltaV:0,fuelUsed:0,propellantBefore:sampleSolar(playback,a.start).propellant,propellantAfter:sampleSolar(playback,a.start).propellant},{t:a.end,kind:'thrust-end' as const,id:a.id,deltaV:0,fuelUsed:0,propellantBefore:sampleSolar(playback,a.end).propellant,propellantAfter:sampleSolar(playback,a.end).propellant}]);
  ledger.push(...v.events.map((e,i)=>{
   const c=v.captures?.find(c=>c.t===e.t&&e.kind==='dock'),fuel=sampleSolar(playback,e.t).propellant;
   return {t:e.t,kind:e.kind,id:`${v.id}-${i}`,label:e.label,deltaV:c?.paidDeltaV??0,fuelUsed:c?c.beforeFuel-c.afterFuel:0,propellantBefore:c?.beforeFuel??fuel,propellantAfter:c?.afterFuel??fuel,...(i>=2?{portId:'Mars gateway'}:{}),...(c?{positionError:c.positionErrorMeters/(AU_KM*1000)}:{})};
  }));
  if(!index)ledger.push(...value.vessels.slice(1).flatMap(c=>c.events.slice(0,2).map((e,i)=>({t:e.t,kind:'handoff' as const,id:`${c.id}-${i}`,label:i?`${c.name} departs for Mars`:`${c.name} aboard`,deltaV:0,fuelUsed:0,propellantBefore:sampleSolar(playback,e.t).propellant,propellantAfter:sampleSolar(playback,e.t).propellant}))));
  ledger.sort((a,b)=>a.t-b.t);
  const boundaries=(v.captures??[]).map(c=>{const after=sampleSolar(playback,c.t),before={...after,y:c.before as State,propellant:c.beforeFuel,fuelUsed:v.initialFuel-c.beforeFuel,opacity:1,logistics:{operationCursor:0,cargoMass:v.cargo,fuelUsed:v.initialFuel-c.beforeFuel,ports:[]}};return {t:c.t,before,after};});
  return {solar:playback,id:v.id,name:v.name,color:v.color,cargo:index?'Consignment':'Carried vehicles',cargoCapacity:index?1:0,ship,ports:[],arcs:v.arcs.map(a=>({id:a.id,start:a.start,end:a.end,direction:[1,0,0],throttle:1})),continuousFuel:true,portSamples:{},samples:drawingSamples(playback),ledger,boundaries,glyph:'rocket',...(index?{lifetime:{start:v.start!,end:v.end!,retired:true}}:{})};
 });
 const view:SceneView={solar:scene,playback:{rateScale:1/365.25,trailSpan:1.25,forecastSpan:2.2,maxZoom:1e7},schemaVersion:1,id:value.id,name:value.name,description:value.description,provenance:value.provenance,extent:value.extent,frameExtents:{Sun:5.6,Earth:.015,Moon:.00012,Mars:.03,Jupiter:.002,'Earth gateway':.001,'Mars gateway':.0006},rotating:{name:'Earth–Sun rotating',rate:Math.sqrt(value.mu),phase:0},world:{bodies,ports,units:{length:'AU',time:'year',mass:'tonne'}},window:{start:0,end:value.duration},stations:ports.map(p=>({id:p.id,role:'Orbital freight gateway',berths:3})),vessels,portSamples:{}};
 if(new TextEncoder().encode(JSON.stringify(view)).byteLength>16*1024*1024)throw Error('Solar display packet budget');
 return view;
}
