import type {Body,Port} from '../sim/schema';
import type {SceneView,VesselView,ViewSample} from '../model-set/model';
import {FLEET_MAX_EPOCH,fleetEventCount} from './query';
import {samplePassThrough} from './query';
import type {PassThroughTemplate,PassThroughDefinition} from './types';

export function passThroughWorld(p:PassThroughTemplate){
  const bodies:Body[]=[{id:'Aster',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}},{id:'Selene',mu:.03,radius:.2,rail:{kind:'circular',center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:5,rate:p.rate,phase:0}}];
  const common={cargo:0,cargoCapacity:1,propellant:0,tankCapacity:10,serviceDuration:0};
  const ports:Port[]=['Cairn','Haven'].map((id,i)=>({...common,id,rail:{kind:'surface',bodyId:bodies[i].id,bodyRail:bodies[i].rail,center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:[1,.2][i]+1e-5,rate:p.rate,phase:p.padPhases[id],latitude:0,centerHeight:1e-5}}));
  return {bodies,ports,units:{length:'Aster radius',time:'√(R³/μ)',mass:'mass unit'}};
}
export function passThroughResources(p:PassThroughTemplate,t:number){
  if(!Number.isFinite(t)||t<0||t>(p.recurrence?FLEET_MAX_EPOCH:p.duration))throw Error('Pass-through resource epoch');
  let fuelImported=0,cargoImported=0,cargoExported=0;
  for(const f of p.flows){const count=p.recurrence?fleetEventCount(p,t,f.t):Number(f.t<=t);if(f.kind==='import'){fuelImported+=count*f.fuel;cargoImported+=count*f.cargo;}else cargoExported+=count*f.cargo;}
  return {t,fuelImported,cargoImported,cargoExported};
}
export function createPassThroughView(p:PassThroughTemplate,d:PassThroughDefinition):SceneView {
  if(d.schemaVersion!==1||!['pass-through-set-v1','cycler-fleet-set-v1'].includes(d.modelVersion)||!d.id||!d.name)throw Error('Pass-through definition');
  const world=passThroughWorld(p);
  const vessels:VesselView[]=p.hardware.map((h,actor)=>{
    const playback={template:p,actor},sample=(t:number,left=false):ViewSample=>samplePassThrough(playback,t,left);
    const q=sample(0),times=new Set([0,p.duration,...p.events.filter(e=>e.actor===actor).map(e=>e.t)]);
    for(const phase of p.phases[actor]){times.add(phase.start);times.add(phase.end);if(phase.rows)for(const r of phase.rows)times.add(r[0]);else for(let t=phase.start;t<phase.end;t+=(p.fleet?1/2:1/8))times.add(t);}
    const samples=[...times].sort((a,b)=>a-b).map(t=>sample(t));
    const arcs=p.phases[actor].filter(phase=>phase.control).map((phase,i)=>{const c=phase.control!,v=c.keys.find(k=>Math.hypot(...k.slice(1))>0)!.slice(1),n=Math.hypot(...v);return {id:i+':'+c.id,start:c.start,end:c.end,direction:v.map(x=>x/n) as [number,number,number],throttle:1};});
    const ledger=p.events.filter(e=>e.actor===actor).map((e,i)=>({t:e.t,kind:e.kind==='maintenance'?'milestone' as const:e.kind,id:i+':'+e.id,label:e.label,portId:e.port,deltaV:e.deltaV,fuelUsed:e.fuelUsed,propellantBefore:e.beforeFuel,propellantAfter:e.afterFuel,positionError:e.positionError,cargoBefore:e.cargoBefore,cargoAfter:e.cargoAfter}));
    const boundaries=[...new Set(p.events.filter(e=>e.actor===actor&&e.kind!=='milestone').map(e=>e.t))].map(t=>({t,before:sample(t,true),after:sample(t)}));
    return {passThrough:playback,id:h.id,name:h.name,color:h.color,cargo:h.cargo?'Parcels':'Carried vehicles',cargoCapacity:h.cargo,
      ship:{id:h.id,state:q.y,dryMass:h.dryMass,cargoMass:h.cargo,propellant:h.fuel,tankCapacity:h.fuel,exhaustVelocity:p.exhaustVelocity,...(h.maxAcceleration?{engine:{maxThrust:h.maxForce,maxAcceleration:h.maxAcceleration}}:{})},
      ports:world.ports,portSamples:{},samples,arcs,ledger,boundaries,interpolation:'hermite',continuousFuel:true,glyph:h.cargo?'rocket':undefined};
  });
  if(vessels.reduce((n,v)=>n+v.samples.length,0)>32000)throw Error('Pass-through display samples');
  const scene:SceneView={passThrough:p,schemaVersion:1,id:d.id,name:d.name,
    description:p.fleet?'Two ballistic carriers exchange riders after extended lunar visits.':'Wayfarer follows a ballistic loop while Pipit waits in parking orbits and exchanges parcels between Cairn and Haven.',
    provenance:p.fleet?'Fictional fixed-primary field; separately propagated time-phased carriers, paid finite-thrust rider routes, funded ground terminals and later-pass boarding. Finite Replay rewinds admitted physical history.':'Fictional fixed-primary airless Aster–Selene field. Two continuously propagated carrier circuits and two paid parcel round trips; explicit parking coasts, finite steering, paid captures and funded ground reloads. The carrier never stops or resets. Finite Replay rewinds the prepared history and resources.',
    extent:6.5,frameExtents:{Aster:3,Selene:1,Cairn:1.5,Haven:.65},world,rotating:{name:'Aster–Selene rotating',rate:p.rate,phase:0},window:{start:0,end:p.duration},
    stations:world.ports.map(port=>({id:port.id,role:'Surface parcels',berths:p.fleet&&port.id==='Cairn'?2:1})),portSamples:{},vessels,
    playback:{rateScale:1,trailSpan:p.period*2,forecastSpan:p.period,maxZoom:1e6}};
  if(new TextEncoder().encode(JSON.stringify(scene)).byteLength>16_000_000)throw Error('Pass-through worker reply bytes');
  return scene;
}
