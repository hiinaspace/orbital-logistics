import {integrate,at,RATE,STEP,MARGIN,type Trace} from '../compact/physics';
import {validateControl} from '../compact/prepare';
import {cubicBound} from '../sim/cubic';
import type {State} from '../sim/schema';
import type {Segment} from '../compact/types';
import type {FleetProfile,RecurringFleetProfile,PassThroughTemplate} from './types';
import {rotateState} from '../compact/query';
import {surfaceState} from './query';

const assert=(v:unknown,message:string)=>{if(!v)throw Error('Pass-through: '+message);};
const keys=['schemaVersion','modelVersion','period','duration','rate','step','height','exhaustVelocity','padPhases','carriers','riders','proof'];
export function prepareFleet(value:FleetProfile,step=STEP){return prepareProfile(value,step,false);}
export function prepareRecurringFleet(value:RecurringFleetProfile,step=STEP){return prepareProfile(value,step,true);}
function prepareProfile(value:FleetProfile|RecurringFleetProfile,step:number,recurring:boolean):PassThroughTemplate {
  assert(new TextEncoder().encode(JSON.stringify(value)).byteLength<=2_500_000,'source bytes');
  const v=structuredClone(value);
  assert(Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(v,k)),'profile fields');
  assert(v.schemaVersion===1&&v.modelVersion===(recurring?'recurring-cycler-profile-v1':'cycler-fleet-profile-v1')&&v.period===120.50467632722804&&(recurring?v.duration===2*v.period:v.duration>v.period&&v.duration<2*v.period)&&v.step===STEP&&Math.abs(v.rate-RATE)<1e-14&&v.height===1e-5&&v.exhaustVelocity===4,'fixed field/model contract');
  assert([STEP,STEP/2,STEP/4].includes(step),'canonical resolution');
  assert(Object.keys(v.padPhases).length===2&&['Cairn','Haven'].every(id=>Number.isFinite(v.padPhases[id])&&Math.abs(v.padPhases[id])<=Math.PI),'surface phases');
  assert(v.carriers.length===2&&v.riders.length===2,'finite fleet counts');
  const hardware=[...v.carriers.map(c=>c.hardware),...v.riders.map(r=>r.hardware)];
  assert(new Set(hardware.map(h=>h.id)).size===4,'unique actors');
  assert(hardware.every((h,i)=>h.name===h.id&&/^[A-Za-z]{1,20}$/.test(h.id)&&/^#[0-9a-f]{6}$/i.test(h.color)&&h.dryMass===(i<2?4:1)&&h.fuel===(i<2?6:3)&&h.cargo===(i<2?0:.15)&&h.maxAcceleration===(i<2?(recurring?1e-5:0):4)&&h.maxForce===(i<2?(recurring?1e-4:0):16.6)),'hardware');
  const p:PassThroughTemplate={fleet:true,duration:v.duration,period:v.period,rate:v.rate,exhaustVelocity:v.exhaustVelocity,padPhases:v.padPhases,hardware,phases:hardware.map(()=>[]),flows:[],events:[],cost:hardware.map(()=>0),work:{nodes:0,checks:0,oraclePosition:0,oracleVelocity:0,bytes:0}};
  if(recurring)p.recurrence={carrierDeltaV:[0,0]};
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
    const remainingNodes=360000*(STEP/step)-p.work.nodes,remainingChecks=600000*(STEP/step)-p.work.checks;
    assert(remainingNodes>0&&remainingChecks>0,'aggregate physical work');
    const trace=integrate(q.start,q.end,initial,q.control,step,bound,{nodes:Math.min(180000,remainingNodes),checks:Math.min(240000,remainingChecks)});
    p.work.nodes+=trace.nodes;p.work.checks+=trace.work;
    // Calibration is a separate bounded run; production admits only the baseline.
    assert(p.work.nodes<=360000*(STEP/step)&&p.work.checks<=600000*(STEP/step),'aggregate physical work');
    for(const r of q.oracle){const y=at(trace.rows,r[0],q.control),pe=Math.hypot(...y.slice(0,3).map((x,i)=>x-r[i+1])),ve=Math.hypot(...y.slice(3,6).map((x,i)=>x-r[i+4]));p.work.oraclePosition=Math.max(p.work.oraclePosition,pe);p.work.oracleVelocity=Math.max(p.work.oracleVelocity,ve);assert(pe<1e-8&&ve<1e-8&&Math.abs(y[6]-r[7])<1e-8,'independent oracle '+q.id);}
    return trace;
  };
  const publishFlight=(segment:Segment,trace:Trace)=>{
    const initialFuel=fuel,h=p.hardware[actor],final=at(trace.rows,segment.end);
    fuel=(h.dryMass+cargo+fuel)*Math.exp(-final[6]/p.exhaustVelocity)-h.dryMass-cargo;
    assert(fuel>=0,'fuel depletion');
    const times=new Set([segment.start,segment.end,...(segment.control?.keys.map(k=>k[0])??[])]);
    const drawStep=segment.control?1/64:1/8;
    for(let t=segment.start;t<segment.end;t+=drawStep)times.add(t);
    // Subdivide disposable Hermite drawing intervals until all quarter probes
    // agree with native history. These samples never feed physical targeting.
    const native=(t:number)=>at(trace.rows,t,segment.control);
    const refine=(a:number,b:number,depth:number)=>{
      const rows=[[a,...native(a)],[b,...native(b)]];
      let error=false;
      for(const f of [.25,.5,.75]){
        const t=a+(b-a)*f,y=native(t),draw=at(rows,t,segment.control);
        if(Math.hypot(...y.slice(0,3).map((x,i)=>x-draw[i]))>1e-6||Math.hypot(...y.slice(3,6).map((x,i)=>x-draw[i+3]))>1e-5)error=true;
      }
      if(error){assert(depth<12,'drawing refinement');const mid=(a+b)/2;times.add(mid);refine(a,mid,depth+1);refine(mid,b,depth+1);}
    };
    const seeds=[...times].sort((a,b)=>a-b);for(let i=1;i<seeds.length;i++)refine(seeds[i-1],seeds[i],0);
    p.phases[actor].push({start:segment.start,end:segment.end,kind:'flight',label:segment.id,rows:[...times].sort((a,b)=>a-b).map(t=>[t,...at(trace.rows,t,segment.control)]),control:segment.control,fuel:initialFuel,fuelEnd:fuel,used,cargo});
    used+=initialFuel-fuel;
    if(segment.control){event(segment.start,'thrust-start',segment.id+':start',segment.id,undefined,{beforeFuel:initialFuel,afterFuel:initialFuel});event(segment.end,'thrust-end',segment.id+':end',segment.id,undefined,{deltaV:final[6],fuelUsed:initialFuel-fuel,beforeFuel:initialFuel,afterFuel:fuel});}
    return final.slice(0,6) as State;
  };
  const event=(t:number,kind:PassThroughTemplate['events'][0]['kind'],id:string,label:string,port?:string,extra:Partial<PassThroughTemplate['events'][0]>={})=>p.events.push({t,actor,kind,id,label,port,deltaV:0,fuelUsed:0,beforeFuel:fuel,afterFuel:fuel,...extra});
  const carrierTraces:Trace[][]=[];
  let actual:State=[0,0,0,0,0,0];
  for(actor=0;actor<2;actor++){
    fuel=6;used=0;cargo=0;
    const segments=v.carriers[actor].segments,traces:Trace[]=[];
    assert(segments.length>=4&&segments.length<=20&&segments[0].start===0&&segments.at(-1)!.end===p.duration,'carrier coverage');
    actual=[...segments[0].initial] as State;
    for(let i=0;i<segments.length;i++){
      const seg=segments[i];assert((!seg.control||recurring&&seg.start>=p.duration-4)&&(i===0||seg.start===segments[i-1].end),'uninterrupted ballistic carrier');
      const trace=physical(seg,actual);traces.push(trace);actual=publishFlight(seg,trace);
    }
    if(recurring){
      const target=rotateState(segments[0].initial,p.rate*p.duration),position=Math.hypot(...actual.slice(0,3).map((x,i)=>x-target[i])),speed=Math.hypot(...actual.slice(3).map((x,i)=>x-target[i+3]));
      assert(position+MARGIN<1e-7&&speed+MARGIN<1e-7,'maintenance projection corridor');
      const commanded=p.events.filter(e=>e.actor===actor&&e.kind==='thrust-end').reduce((n,e)=>n+e.deltaV,0),paid=speed+MARGIN,total=commanded+paid;
      assert(total<=1e-5,'total maintenance ceiling');
      const old=fuel;fuel=(4+fuel)*Math.exp(-paid/p.exhaustVelocity)-4;used+=old-fuel;
      event(p.duration,'maintenance','phase-maintenance','Phase maintenance',undefined,{deltaV:paid,fuelUsed:old-fuel,beforeFuel:old,afterFuel:fuel,positionError:position,velocityError:speed});
      p.recurrence!.carrierDeltaV[actor]=total;p.cost[actor]=used;
      assert(10*Math.exp(-(Math.ceil(1_000_000/p.duration)+1)*total/p.exhaustVelocity)-4>=.6,'calendar maintenance reserve');
    }
    carrierTraces.push(traces);
  }
  const carrierAt=(parent:number,t:number):State=>{
    assert(parent===0||parent===1,'carrier ownership');
    const trace=carrierTraces[parent].find(q=>t>=q.start&&t<=q.end);
    const row=trace?.rows.find(r=>r[0]===t);
    assert(row,'carrier handoff requires exact native node');return row!.slice(1,7) as State;
  };
  const support=(start:number,end:number,port:string)=>{assert(end>start,'support interval');p.phases[actor].push({start,end,kind:'support',label:'Turnaround',port,fuel,fuelEnd:fuel,used,cargo});};
  const capture=(t:number,before:State,target:State,port:string,kind:'dock'|'land')=>{
    const position=Math.hypot(...before.slice(0,3).map((x,i)=>x-target[i])),speed=Math.hypot(...before.slice(3).map((x,i)=>x-target[i+3]));
    assert(position+MARGIN<1e-7&&speed+MARGIN<1e-7,'paid capture margin '+port);
    const old=fuel,dv=speed+MARGIN;fuel=(p.hardware[actor].dryMass+cargo+fuel)*Math.exp(-dv/p.exhaustVelocity)-p.hardware[actor].dryMass-cargo;used+=old-fuel;
    event(t,kind,kind+':'+port,kind==='land'?'Land at '+port:'Join '+port,port,{deltaV:dv,fuelUsed:old-fuel,beforeFuel:old,afterFuel:fuel,positionError:position,velocityError:speed});
  };
  const deliver=(t:number,port:string)=>{
    assert(cargo===.15,'delivery cargo');p.flows.push({t,actor,port,kind:'delivery',fuel:0,cargo,beforeFuel:fuel,afterFuel:fuel,beforeCargo:cargo,afterCargo:0});cargo=0;event(t,'transfer','delivery:'+port,'Deliver at '+port,port,{cargoBefore:.15,cargoAfter:0});
  };
  const refill=(t:number,port:'Cairn'|'Haven',funding:{fuelCap:number;cargo:number})=>{
    assert(Number.isFinite(funding.fuelCap)&&funding.fuelCap>=0&&funding.fuelCap<=2.8&&funding.cargo===.15&&cargo===0,'funded reload');
    const old=fuel,imported=3-old;assert(imported>=0&&imported<=funding.fuelCap,'fuel supply unavailable');fuel=3;cargo=.15;
    p.flows.push({t,actor,port,kind:'import',fuel:imported,cargo,beforeFuel:old,afterFuel:fuel,beforeCargo:0,afterCargo:cargo});event(t,'transfer','refill:'+port,'Refuel and load at '+port,port,{beforeFuel:old,afterFuel:fuel,cargoBefore:0,cargoAfter:cargo});
  };
  for(let rider=0;rider<2;rider++){
    actor=2+rider;fuel=3;used=0;cargo=.15;let previous=0;
    const r=v.riders[rider],mission=r.mission,stages=mission.stages;
    const outbound=hardware.findIndex(h=>h.id===r.outbound),inbound=hardware.findIndex(h=>h.id===r.inbound);
    assert(outbound>=0&&outbound<2&&inbound>=0&&inbound<2&&outbound!==inbound,'different later carrier');
    assert(stages.length===4&&stages.every(g=>g.segments.length>=3&&g.segments.length<=8),'mission route counts');
    assert(stages[2].segments[0].start-stages[1].segments.at(-1)!.end>=20,'lunar dwell');
    assert(mission.moonUnload===stages[1].segments.at(-1)!.end+.25&&mission.moonRefill===mission.moonUnload+.25&&mission.asterUnload===stages[3].segments.at(-1)!.end+.25&&mission.asterRefill===mission.asterUnload+.25,'operation calendar');
    for(let route=0;route<4;route++){
      const g=stages[route],origin=route===0?'Cairn':route===2?'Haven':null,destination=route===1?'Haven':route===3?'Cairn':null,parent=route<2?outbound:inbound;
      assert(g.origin===origin&&g.destination===destination,'route ownership');
      const a=g.segments[0].start,b=g.segments.at(-1)!.end;
      if(origin){support(previous,a,origin);event(a,'launch','launch:'+origin,'Launch from '+origin,origin);actual=surfaceState(p,origin,a);}
      else{assert(a>previous,'ride interval');p.phases[actor].push({start:previous,end:a,kind:'ride',carrier:parent,label:'Aboard '+hardware[parent].id,fuel,fuelEnd:fuel,used,cargo});event(a,'undock','release','Leave '+hardware[parent].id,hardware[parent].id);actual=carrierAt(parent,a);}
      for(let i=0;i<g.segments.length;i++){const segment=g.segments[i];assert(i===0||segment.start===g.segments[i-1].end,'route continuity');const trace=physical(segment,actual);actual=publishFlight(segment,trace);}
      capture(b,actual,destination?surfaceState(p,destination,b):carrierAt(parent,b),destination??hardware[parent].id,destination?'land':'dock');
      previous=b;
      if(destination){
        assert(fuel>=.3,'landing reserve');
        const unload=destination==='Haven'?mission.moonUnload:mission.asterUnload,refuel=destination==='Haven'?mission.moonRefill:mission.asterRefill;
        support(previous,unload,destination);deliver(unload,destination);support(unload,refuel,destination);refill(refuel,destination,mission.funding[destination]);previous=refuel;
      }
    }
    support(previous,p.duration,'Cairn');p.cost[actor]=used;
  }
  // Ground terminals explicitly have Cairn two schematic berths, Haven one berth; carrier capacity is one.
  const boundaries=[...new Set(p.phases.flat().flatMap(q=>[q.start,q.end]))].sort((a,b)=>a-b);
  for(const t of boundaries.slice(0,-1)){
    const occupants=p.phases.slice(2).map(phases=>phases.find(q=>q.start<=t&&q.end>t)!);
    for(const parent of [0,1]){assert(occupants.filter(q=>q.kind==='ride'&&q.carrier===parent).length<=1,'carrier berth conflict');if(recurring&&p.phases[parent].some(q=>q.control&&q.start<=t&&q.end>t))assert(!occupants.some(q=>q.kind==='ride'&&q.carrier===parent),'loaded maintenance');}
    for(const port of ['Cairn','Haven'])assert(occupants.filter(q=>q.kind==='support'&&q.port===port).length<=(port==='Cairn'?2:1),'terminal berth conflict');
  }
  for(const phases of p.phases){assert(phases[0].start===0&&phases.at(-1)!.end===p.duration,'absolute horizon coverage');for(let i=1;i<phases.length;i++)assert(phases[i].start===phases[i-1].end,'phase coverage');}
  p.events.sort((a,b)=>a.t-b.t||a.actor-b.actor);
  p.work.bytes=new TextEncoder().encode(JSON.stringify(p)).byteLength;assert(p.work.bytes<=6_000_000,'finite template bytes');
  assert(p.phases.flat().reduce((n,q)=>n+(q.rows?.length??0),0)<=32000,'drawing sample budget');
  return p;
}
