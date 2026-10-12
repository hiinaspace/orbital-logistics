import {integrate,at,RATE,STEP,MARGIN,type Trace} from '../compact/physics';
import {validateControl} from '../compact/prepare';
import {cubicBound} from '../sim/cubic';
import type {State} from '../sim/schema';
import type {Segment} from '../compact/types';
import type {PassThroughProfile,PassThroughTemplate,PassThroughRun} from './types';
import {surfaceState} from './query';

const assert=(v:unknown,message:string)=>{if(!v)throw Error('Pass-through: '+message);};
const keys=['schemaVersion','modelVersion','period','duration','rate','step','height','exhaustVelocity','padPhases','carrier','shuttle','carrierSegments','missions','encounters','proof'];
export function preparePassThrough(value:PassThroughProfile,step=STEP):PassThroughRun {
  assert(new TextEncoder().encode(JSON.stringify(value)).byteLength<=2_000_000,'source bytes');
  const v=structuredClone(value);
  assert(Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(v,k)),'profile fields');
  assert(v.schemaVersion===1&&v.modelVersion==='pass-through-profile-v1'&&v.period===120.50467632722804&&v.duration===2*v.period&&v.step===STEP&&Math.abs(v.rate-RATE)<1e-14&&v.height===1e-5&&v.exhaustVelocity===4,'fixed field/model contract');
  assert([STEP,STEP/2,STEP/4].includes(step),'canonical resolution');
  assert(Object.keys(v.padPhases).length===2&&['Cairn','Haven'].every(id=>Number.isFinite(v.padPhases[id])&&Math.abs(v.padPhases[id])<=Math.PI),'surface phases');
  const c=v.carrier,s=v.shuttle;
  assert(c.id==='Wayfarer'&&c.dryMass===4&&c.fuel===6&&c.cargo===0&&c.maxAcceleration===0&&c.maxForce===0&&s.id==='Pipit'&&s.dryMass===1&&s.fuel===3&&s.cargo===.15&&s.maxAcceleration===4&&s.maxForce===16.6,'hardware');
  assert([c,s].every(h=>h.name===h.id&&/^#[0-9a-f]{6}$/i.test(h.color)),'hardware presentation');
  assert(v.missions.length===2&&v.carrierSegments.length>=4&&v.carrierSegments.length<=16&&v.encounters.length===8,'finite counts');
  const p:PassThroughTemplate={duration:v.duration,period:v.period,rate:v.rate,exhaustVelocity:v.exhaustVelocity,padPhases:v.padPhases,hardware:[c,s],phases:[[],[]],flows:[],events:[],cost:[0,0],work:{nodes:0,checks:0,oraclePosition:0,oracleVelocity:0,bytes:0}};
  let actor=0,fuel=6,used=0,cargo=0;
  const physical=(segment:Segment,initial:State)=>{
    const h=p.hardware[actor],q=segment;
    assert(typeof q.id==='string'&&q.id.length>0&&q.id.length<=80,'segment identity');
    assert(Number.isFinite(q.start)&&Number.isFinite(q.end)&&q.start>=0&&q.end<=p.duration&&q.end>q.start&&q.end-q.start<=64,'segment interval');
    assert(q.initial.length===6&&q.endpoint.length===6&&[...q.initial,...q.endpoint].every(Number.isFinite),'segment state');
    assert(Math.hypot(...initial.map((x,i)=>x-q.initial[i]))<1e-7,'actual initial oracle seam');
    assert(q.oracle.length>=65&&q.oracle.length<=2048&&q.oracle.every((r,i)=>r.length===8&&r.every(Number.isFinite)&&r[0]>=q.start&&r[0]<=q.end&&(i===0||r[0]>q.oracle[i-1][0]))&&q.oracle[0][0]===q.start&&q.oracle.at(-1)![0]===q.end,'oracle contract');
    if(q.control){assert(typeof q.control.id==='string'&&q.control.id.length>0&&q.control.id.length<=80,'control identity');assert(Object.keys(q.control).every(k=>['id','start','end','keys','coefficients'].includes(k)),'control fields');validateControl(q.control,q.start,q.end,h.maxAcceleration);}
    const bound=q.control?cubicBound(q.control):0;
    assert(bound*(h.dryMass+cargo+fuel)<=h.maxForce*(1+1e-12),'force cap');
    const remainingNodes=240000*(STEP/step)-p.work.nodes,remainingChecks=400000*(STEP/step)-p.work.checks;
    assert(remainingNodes>0&&remainingChecks>0,'aggregate physical work');
    const trace=integrate(q.start,q.end,initial,q.control,step,bound,{nodes:Math.min(180000,remainingNodes),checks:Math.min(240000,remainingChecks)});
    p.work.nodes+=trace.nodes;p.work.checks+=trace.work;
    // Calibration is a separate bounded run; production admits only the baseline.
    assert(p.work.nodes<=240000*(STEP/step)&&p.work.checks<=400000*(STEP/step),'aggregate physical work');
    for(const r of q.oracle){const y=at(trace.rows,r[0],q.control),pe=Math.hypot(...y.slice(0,3).map((x,i)=>x-r[i+1])),ve=Math.hypot(...y.slice(3,6).map((x,i)=>x-r[i+4]));p.work.oraclePosition=Math.max(p.work.oraclePosition,pe);p.work.oracleVelocity=Math.max(p.work.oracleVelocity,ve);assert(pe<1e-8&&ve<1e-8&&Math.abs(y[6]-r[7])<1e-8,'independent oracle '+q.id);}
    return trace;
  };
  const publishFlight=(segment:Segment,trace:Trace)=>{
    const initialFuel=fuel,h=p.hardware[actor],final=at(trace.rows,segment.end);
    fuel=(h.dryMass+cargo+fuel)*Math.exp(-final[6]/p.exhaustVelocity)-h.dryMass-cargo;
    assert(fuel>=0,'fuel depletion');
    const times=new Set([segment.start,segment.end,...(segment.control?.keys.map(k=>k[0])??[])]);
    const drawStep=segment.control?1/128:1/32;
    for(let t=segment.start;t<segment.end;t+=drawStep)times.add(t);
    p.phases[actor].push({start:segment.start,end:segment.end,kind:'flight',label:segment.id,rows:[...times].sort((a,b)=>a-b).map(t=>[t,...at(trace.rows,t,segment.control)]),control:segment.control,fuel:initialFuel,fuelEnd:fuel,used,cargo});
    used+=initialFuel-fuel;
    if(segment.control){event(segment.start,'thrust-start',segment.id+':start',segment.id,undefined,{beforeFuel:initialFuel,afterFuel:initialFuel});event(segment.end,'thrust-end',segment.id+':end',segment.id,undefined,{deltaV:final[6],fuelUsed:initialFuel-fuel,beforeFuel:initialFuel,afterFuel:fuel});}
    return final.slice(0,6) as State;
  };
  const event=(t:number,kind:PassThroughTemplate['events'][0]['kind'],id:string,label:string,port?:string,extra:Partial<PassThroughTemplate['events'][0]>={})=>p.events.push({t,actor,kind,id,label,port,deltaV:0,fuelUsed:0,beforeFuel:fuel,afterFuel:fuel,...extra});
  const carrierTraces:Trace[]=[];
  let actual=[...v.carrierSegments[0].initial] as State;
  assert(v.carrierSegments[0].start===0&&v.carrierSegments.at(-1)!.end===p.duration,'carrier coverage');
  for(let i=0;i<v.carrierSegments.length;i++){
    const seg=v.carrierSegments[i];assert(!seg.control&&(i===0||seg.start===v.carrierSegments[i-1].end),'uninterrupted ballistic carrier');
    const trace=physical(seg,actual);carrierTraces.push(trace);actual=publishFlight(seg,trace);
  }
  const carrierFinal=[...actual] as State;
  for(const [i,e] of v.encounters.entries()){assert(Number.isFinite(e.t)&&e.t>0&&e.t<p.duration&&['Aster','Selene'].includes(e.body)&&Number.isFinite(e.distance)&&e.distance>(e.body==='Aster'?1:.2),'encounter annotation');event(e.t,'milestone','encounter:'+i,e.body+' flyby');}
  const carrierAt=(t:number):State=>{
    const trace=carrierTraces.find(q=>t>=q.start&&t<=q.end);
    const row=trace?.rows.find(r=>r[0]===t);
    assert(row,'carrier handoff requires exact native node');return row!.slice(1,7) as State;
  };
  actor=1;fuel=3;used=0;cargo=.15;
  const support=(start:number,end:number,port:string)=>{assert(end>start,'support interval');p.phases[1].push({start,end,kind:'support',label:'Turnaround',port,fuel,fuelEnd:fuel,used,cargo});};
  const capture=(t:number,before:State,target:State,port:string,kind:'dock'|'land')=>{
    const position=Math.hypot(...before.slice(0,3).map((x,i)=>x-target[i])),speed=Math.hypot(...before.slice(3).map((x,i)=>x-target[i+3]));
    assert(position+MARGIN<1e-7&&speed+MARGIN<1e-7,'paid capture margin '+port);
    const old=fuel,dv=speed+MARGIN;fuel=(s.dryMass+cargo+fuel)*Math.exp(-dv/p.exhaustVelocity)-s.dryMass-cargo;used+=old-fuel;
    event(t,kind,kind+':'+port,kind==='land'?'Land at '+port:'Join '+port,port,{deltaV:dv,fuelUsed:old-fuel,beforeFuel:old,afterFuel:fuel,positionError:position,velocityError:speed});
  };
  const deliver=(t:number,port:string)=>{
    assert(cargo===.15,'delivery cargo');p.flows.push({t,actor:1,port,kind:'delivery',fuel:0,cargo,beforeFuel:fuel,afterFuel:fuel,beforeCargo:cargo,afterCargo:0});cargo=0;event(t,'transfer','delivery:'+port,'Deliver at '+port,port,{cargoBefore:.15,cargoAfter:0});
  };
  const refill=(t:number,port:'Cairn'|'Haven',funding:{fuelCap:number;cargo:number})=>{
    assert(Number.isFinite(funding.fuelCap)&&funding.fuelCap>=0&&funding.fuelCap<=2.8&&funding.cargo===.15&&cargo===0,'funded reload');
    const old=fuel,imported=3-old;assert(imported>=0&&imported<=funding.fuelCap,'fuel supply unavailable');fuel=3;cargo=.15;
    p.flows.push({t,actor:1,port,kind:'import',fuel:imported,cargo,beforeFuel:old,afterFuel:fuel,beforeCargo:0,afterCargo:cargo});event(t,'transfer','refill:'+port,'Refuel and load at '+port,port,{beforeFuel:old,afterFuel:fuel,cargoBefore:0,cargoAfter:cargo});
  };
  let previous=0;
  for(let cycle=0;cycle<2;cycle++){
    const mission=v.missions[cycle],offset=cycle*p.period,stages=mission.stages;
    assert(stages.length===4&&stages.every(g=>g.segments.length>=3&&g.segments.length<=6),'mission route counts');
    const landing=stages[3].segments.at(-1)!.end;
    const intervals=[[offset+1,offset+56],[offset+66,offset+73.5],[offset+74.5,offset+79.5],[offset+83.5,landing]];
    assert(landing>offset+98&&landing<offset+110&&mission.moonUnload===offset+73.75&&mission.moonRefill===offset+74&&mission.asterUnload===landing+.25&&mission.asterRefill===landing+.5,'operation calendar');
    for(let route=0;route<4;route++){
      const g=stages[route],origin=route===0?'Cairn':route===2?'Haven':null,destination=route===1?'Haven':route===3?'Cairn':null;
      assert(g.origin===origin&&g.destination===destination&&g.segments[0].start===intervals[route][0]&&g.segments.at(-1)!.end===intervals[route][1],'route ownership/interval');
      const a=g.segments[0].start,b=g.segments.at(-1)!.end;
      if(origin){support(previous,a,origin);event(a,'launch','launch:'+origin,'Launch from '+origin,origin);actual=surfaceState(p,origin,a);}
      else{assert(a>previous,'ride interval');p.phases[1].push({start:previous,end:a,kind:'ride',label:'Aboard Wayfarer',fuel,fuelEnd:fuel,used,cargo});event(a,'undock','release','Leave Wayfarer','Wayfarer');actual=carrierAt(a);}
      for(let i=0;i<g.segments.length;i++){const segment=g.segments[i];assert(i===0||segment.start===g.segments[i-1].end,'route continuity');const trace=physical(segment,actual);actual=publishFlight(segment,trace);}
      capture(b,actual,destination?surfaceState(p,destination,b):carrierAt(b),destination??'Wayfarer',destination?'land':'dock');
      previous=b;
      if(destination){
        assert(fuel>=.3,'landing reserve');
        const unload=destination==='Haven'?mission.moonUnload:mission.asterUnload,refuel=destination==='Haven'?mission.moonRefill:mission.asterRefill;
        support(previous,unload,destination);deliver(unload,destination);support(unload,refuel,destination);refill(refuel,destination,mission.funding[destination]);previous=refuel;
      }
    }
  }
  support(previous,p.duration,'Cairn');p.cost[1]=used;
  for(const phases of p.phases){assert(phases[0].start===0&&phases.at(-1)!.end===p.duration,'absolute horizon coverage');for(let i=1;i<phases.length;i++)assert(phases[i].start===phases[i-1].end,'phase coverage');}
  p.events.sort((a,b)=>a.t-b.t||a.actor-b.actor);
  p.work.bytes=new TextEncoder().encode(JSON.stringify(p)).byteLength;assert(p.work.bytes<=6_000_000,'finite template bytes');
  assert(p.phases.flat().reduce((n,q)=>n+(q.rows?.length??0),0)<=32000,'drawing sample budget');
  return {template:p,carrierFinal};
}
