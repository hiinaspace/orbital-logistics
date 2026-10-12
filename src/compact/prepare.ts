import {cubicBound,type CubicControl} from '../sim/cubic';
import type {State,Port,Body} from '../sim/schema';
import {integrate,at,RATE,STEP,MARGIN,type Trace} from './physics';
import {localPort,ownSample} from './query';
import type {CompactProfile,CompactTemplate,Phase,Flow} from './types';
const assert=(v:unknown,message:string)=>{if(!v)throw Error('Compact: '+message);};
export function world(p:CompactTemplate){
 const bodies:Body[]=[{id:'Aster',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}},{id:'Selene',mu:.03,radius:.2,rail:{kind:'circular',center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:5,rate:p.rate,phase:0}}];
 const common={cargo:0,cargoCapacity:1,propellant:0,tankCapacity:10,serviceDuration:0};
 const ports:Port[]=[{...common,id:'Beacon',rail:{kind:'circular',center:[0,0,0],u:[1,0,0],v:[0,1,0],radius:p.beaconRadius,rate:p.rate,phase:0}},...(['Cairn','Haven']as const).map((id,i)=>({...common,id,rail:{kind:'surface' as const,bodyId:bodies[i].id,bodyRail:bodies[i].rail,center:[0,0,0]as [number,number,number],u:[1,0,0]as [number,number,number],v:[0,1,0]as [number,number,number],radius:[1,.2][i]+1e-5,rate:p.rate,phase:p.padPhases[id],latitude:0,centerHeight:1e-5}}))];
 return {bodies,ports,units:{length:'Aster radius',time:'√(R³/μ)',mass:'mass unit'}};
}
export function validateControl(c:CubicControl,start:number,end:number,cap:number){
 assert(c.start===start&&c.end===end&&c.keys.length===129&&c.coefficients.length===128,'control interval');
 assert(c.keys.every((k,i)=>k.length===4&&k.every(Number.isFinite)&&(i===0||k[0]>c.keys[i-1][0]))&&c.keys[0][0]===start&&c.keys.at(-1)![0]===end,'control keys');
 assert(c.coefficients.every(q=>q.length===4&&q.every(v=>v.length===3&&v.every(Number.isFinite))),'control coefficients');
 for(let i=0;i<c.coefficients.length;i++){
  const q=c.coefficients[i],h=c.keys[i+1][0]-c.keys[i][0];
  for(let j=0;j<3;j++){
   const end=((q[0][j]*h+q[1][j])*h+q[2][j])*h+q[3][j];
   assert(Math.abs(q[3][j]-c.keys[i][j+1])<1e-10&&Math.abs(end-c.keys[i+1][j+1])<1e-10,'cubic key consistency');
   if(i+1<c.coefficients.length)assert(Math.abs(3*q[0][j]*h*h+2*q[1][j]*h+q[2][j]-c.coefficients[i+1][2][j])<1e-9,'smooth cubic join');
  }
 }
 assert(cubicBound(c)<=cap*(1+1e-12),'control cap');
}
export function prepareCompact(value:CompactProfile,step=STEP){
 const v=structuredClone(value),T=v.times;
 const refined=v.modelVersion==='compact-cycler-profile-v2';
 const singles=Array.from({length:7},(_,i)=>[i]);
 if(!refined)assert(v.segments.length===7&&(!v.routes||JSON.stringify(v.routes)===JSON.stringify(singles))&&(!v.padPhases||v.padPhases.Cairn===0&&v.padPhases.Haven===0)&&v.segments.every((s,i)=>Boolean(s.control)===(i!==1)),'legacy profile extensions require v2');
 const groups=v.routes??Array.from({length:7},(_,i)=>[i]);
 assert(groups.length===7&&groups.every(g=>g.length>0&&g.length<=3)&&JSON.stringify(groups.flat())===JSON.stringify(v.segments.map((_,i)=>i)),'route groups');
 assert((refined||v.modelVersion==='compact-cycler-profile-v1')&&v.schemaVersion===1&&v.period===(refined?74:72)&&v.step===STEP&&Math.abs(v.rate-RATE)<1e-14&&v.height===1e-5&&(refined?[4,8].includes(v.exhaustVelocity):v.exhaustVelocity===8)&&v.segments.length<=15,'model contract');
 assert([v.beaconRadius,...Object.values(T)].every(Number.isFinite)&&v.beaconRadius>5.3&&v.beaconRadius<7&&Math.abs(v.rate*v.rate*v.beaconRadius-1/v.beaconRadius**2-.03/(v.beaconRadius-5)**2)<1e-12,'equilibrium');
 assert(v.carrier.id==='Wayfarer'&&v.shuttle.id==='Pipit'&&v.carrier.dryMass===4&&v.carrier.fuel===6&&v.carrier.cargo===0&&v.carrier.maxAcceleration===(refined?.6:.15)&&v.carrier.maxForce===(refined?6:1.5)&&v.shuttle.dryMass===1&&v.shuttle.fuel===3&&v.shuttle.cargo===.15&&v.shuttle.maxAcceleration===(refined?4:3)&&v.shuttle.maxForce===(refined?16.6:12.45),'hardware');
 const padPhases=v.padPhases??{Cairn:0,Haven:0};assert(['Cairn','Haven'].every(id=>Number.isFinite(padPhases[id])&&Math.abs(padPhases[id])<=Math.PI),'pad phases');
 const p:CompactTemplate={padPhases,period:v.period,rate:v.rate,beaconRadius:v.beaconRadius,exhaustVelocity:v.exhaustVelocity,hardware:[v.carrier,v.shuttle],phases:[[],[]],cost:[0,0],flows:[],events:[],work:{nodes:0,checks:0,bytes:0,oraclePosition:0,oracleVelocity:0}};
 const traces:Trace[]=[];let actor=0,fuel=6,used=0,cargo=0;
 const support=(start:number,end:number,port:string)=>{assert(end>start,'support duration');p.phases[actor].push({start,end,kind:'support',port,fuel,fuelEnd:fuel,used,cargo});};
 const event=(t:number,kind:CompactTemplate['events'][0]['kind'],id:string,label:string,port?:string,extra:Partial<CompactTemplate['events'][0]>={})=>p.events.push({t,actor,kind,id,label,port,deltaV:0,fuelUsed:0,beforeFuel:fuel,afterFuel:fuel,...extra});
 const flySegment=(index:number,initial:State)=>{
  const s=v.segments[index],h=p.hardware[actor];
  assert(s.start>=0&&s.end<=p.period&&s.initial.length===6&&s.endpoint.length===6&&[...s.initial,...s.endpoint].every(Number.isFinite),'segment contract');
  assert(s.oracle.length>=65&&s.oracle.length<=2048&&s.oracle.every((r,i)=>r.length===8&&r.every(Number.isFinite)&&r[0]>=s.start&&r[0]<=s.end&&(i===0||r[0]>s.oracle[i-1][0]))&&s.oracle[0][0]===s.start&&s.oracle.at(-1)![0]===s.end,'oracle contract');
  if(s.control)validateControl(s.control,s.start,s.end,h.maxAcceleration);
  const trace=integrate(s.start,s.end,initial,s.control,step,s.control?h.maxAcceleration:0);traces.push(trace);p.work.nodes+=trace.nodes;p.work.checks+=trace.work;
  assert(p.work.nodes<=240000&&p.work.checks<=400000,'aggregate physical budget');
  for(const row of s.oracle){const q=at(trace.rows,row[0],s.control),pe=Math.hypot(...q.slice(0,3).map((x,i)=>x-row[i+1])),ve=Math.hypot(...q.slice(3,6).map((x,i)=>x-row[i+4]));p.work.oraclePosition=Math.max(p.work.oraclePosition,pe);p.work.oracleVelocity=Math.max(p.work.oracleVelocity,ve);assert(pe<1e-8&&ve<1e-8&&Math.abs(q[6]-row[7])<1e-8,'independent oracle '+s.id);}
  const mass=h.dryMass+cargo+fuel,bound=s.control?cubicBound(s.control):0;assert(bound*mass<=h.maxForce*(1+1e-12),'force cap');
  const initialFuel=fuel,final=at(trace.rows,s.end);fuel=mass*Math.exp(-final[6]/p.exhaustVelocity)-h.dryMass-cargo;assert(fuel>=0,'fuel depletion');
  // Private canonical nodes own all targeting; only dyadic drawing rows leave preparation.
  const times=new Set([s.start,s.end,...(s.control?.keys.map(k=>k[0])??[])]);for(let t=s.start;t<s.end;t+=s.control?1/128:1/32)times.add(t);
  const rows=[...times].sort((a,b)=>a-b).map(t=>[t,...at(trace.rows,t,s.control)]);
  p.phases[actor].push({start:s.start,end:s.end,kind:'flight',rows,control:s.control,fuel:initialFuel,fuelEnd:fuel,used,cargo});used+=initialFuel-fuel;
  if(s.control){event(s.start,'thrust-start',s.id+':start',s.id,undefined,{beforeFuel:initialFuel,afterFuel:initialFuel});event(s.end,'thrust-end',s.id+':end',s.id,undefined,{beforeFuel:fuel,afterFuel:fuel});}
  return final.slice(0,6) as State;
 };
 const fly=(route:number,initial:State)=>{
  const ids=groups[route],intervals=[[T.carrierLaunch,T.coastStart],[T.coastStart,T.coastEnd],[T.coastEnd,T.carrierDock],[T.moonLaunch,T.boardIn],[T.releaseIn,T.asterLand],[T.asterLaunch,T.boardOut],[T.releaseOut,T.moonLand]];
  if(refined&&route>=3)assert(ids.length===3&&v.segments[ids[0]].control&&!v.segments[ids[1]].control&&v.segments[ids[2]].control&&v.segments[ids[1]].end-v.segments[ids[1]].start>=1,'local connection coast');
  if(route===1)assert(ids.every(i=>!v.segments[i].control),'carrier coast');
  assert(v.segments[ids[0]].start===intervals[route][0]&&v.segments[ids.at(-1)!].end===intervals[route][1],'route interval');
  let actual=initial;for(let j=0;j<ids.length;j++){if(j)assert(v.segments[ids[j]].start===v.segments[ids[j-1]].end,'route continuity');actual=flySegment(ids[j],actual);}return actual;
 };
 const capture=(t:number,before:State,target:State,id:string,port:string,kind:'dock'|'land')=>{
  const position=Math.hypot(...before.slice(0,3).map((x,i)=>x-target[i])),speed=Math.hypot(...before.slice(3).map((x,i)=>x-target[i+3]));assert(position+MARGIN<1e-7&&speed+MARGIN<1e-7,'capture margin '+id);
  const h=p.hardware[actor],old=fuel,dv=speed+MARGIN;fuel=(h.dryMass+cargo+fuel)*Math.exp(-dv/p.exhaustVelocity)-h.dryMass-cargo;used+=old-fuel;event(t,kind,id,kind==='land'?'Land at '+port:'Join '+port,port,{deltaV:dv,positionError:position,fuelUsed:old-fuel,beforeFuel:old,afterFuel:fuel});
 };
 const flow=(t:number,port:string,kind:Flow['kind'])=>{
  const old=fuel,oldCargo=cargo;let imported=0,parcel=0;if(kind==='import'){imported=p.hardware[actor].fuel-fuel;assert(imported>=0&&imported<=(actor?2.8:5.4),'funded import cap');fuel=p.hardware[actor].fuel;if(actor)cargo=.15;parcel=cargo-oldCargo;}else{assert(cargo===.15,'delivery load');parcel=cargo;cargo=0;}
  p.flows.push({t,actor,port,kind,fuel:imported,cargo:parcel,beforeFuel:old,afterFuel:fuel,beforeCargo:oldCargo,afterCargo:cargo});event(t,'transfer',kind+':'+port,kind==='import'?'Resupply at '+port:'Deliver at '+port,port,{beforeFuel:old,afterFuel:fuel});
 };
 support(0,T.carrierLaunch,'Beacon');event(T.carrierLaunch,'undock','carrier-release','Leave Beacon','Beacon');const depart=fly(0,localPort(p,'Beacon',T.carrierLaunch));const coastEnd=fly(1,depart);const final=fly(2,coastEnd);capture(T.carrierDock,final,localPort(p,'Beacon',T.carrierDock),'carrier-capture','Beacon','dock');assert(fuel>=.6,'carrier reserve');support(T.carrierDock,T.carrierRefill,'Beacon');flow(T.carrierRefill,'Beacon','import');support(T.carrierRefill,p.period,'Beacon');p.cost[0]=used;
 const carrierAt=(t:number)=>{const row=traces.find(q=>t>=q.start&&t<=q.end)!.rows.find(q=>q[0]===t);assert(row,'capture/release requires canonical carrier node');return row!.slice(1,7) as State;};
 actor=1;fuel=3;used=0;cargo=.15;support(0,T.moonLaunch,'Haven');event(T.moonLaunch,'launch','moon-launch','Launch from Haven','Haven');const first=fly(3,localPort(p,'Haven',T.moonLaunch));capture(T.boardIn,first,carrierAt(T.boardIn),'board-in',p.hardware[0].id,'dock');
 p.phases[1].push({start:T.boardIn,end:T.releaseIn,kind:'ride',fuel,fuelEnd:fuel,used,cargo});event(T.releaseIn,'undock','release-in','Leave Wayfarer',p.hardware[0].id);
 const landA=fly(4,carrierAt(T.releaseIn));capture(T.asterLand,landA,localPort(p,'Cairn',T.asterLand),'aster-capture','Cairn','land');assert(fuel>=.3,'Aster reserve');support(T.asterLand,T.asterUnload,'Cairn');flow(T.asterUnload,'Cairn','delivery');support(T.asterUnload,T.asterRefill,'Cairn');flow(T.asterRefill,'Cairn','import');support(T.asterRefill,T.asterLaunch,'Cairn');event(T.asterLaunch,'launch','aster-launch','Launch from Cairn','Cairn');
 const out=fly(5,localPort(p,'Cairn',T.asterLaunch));capture(T.boardOut,out,carrierAt(T.boardOut),'board-out',p.hardware[0].id,'dock');p.phases[1].push({start:T.boardOut,end:T.releaseOut,kind:'ride',fuel,fuelEnd:fuel,used,cargo});event(T.releaseOut,'undock','release-out','Leave Wayfarer',p.hardware[0].id);
 const landM=fly(6,carrierAt(T.releaseOut));capture(T.moonLand,landM,localPort(p,'Haven',T.moonLand),'moon-capture','Haven','land');assert(fuel>=.3,'Haven reserve');support(T.moonLand,T.moonUnload,'Haven');flow(T.moonUnload,'Haven','delivery');support(T.moonUnload,T.moonRefill,'Haven');flow(T.moonRefill,'Haven','import');support(T.moonRefill,p.period,'Haven');p.cost[1]=used;
 for(const phases of p.phases)for(let i=0;i<phases.length;i++)assert(phases[i].start===(i?phases[i-1].end:0),'phase coverage');
 const carrierArcs=p.phases[0].filter(s=>s.control),rides=p.phases[1].filter(s=>s.kind==='ride');assert(rides.every(r=>carrierArcs.every(a=>r.end<=a.start||r.start>=a.end)),'loaded carrier burn conflict');
 p.events.sort((a,b)=>a.t-b.t);p.work.bytes=new TextEncoder().encode(JSON.stringify(p)).byteLength;assert(p.work.bytes<8_000_000,'template bytes');
 for(const actor of [0,1]){const a=ownSample(p,actor,0),b=ownSample(p,actor,p.period);assert(a.propellant===b.propellant&&a.logistics!.cargoMass===b.logistics!.cargoMass&&a.logistics!.dockedPortId===b.logistics!.dockedPortId,'cycle resource closure');}
 return {template:p,traces,source:v};
}
