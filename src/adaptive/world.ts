import {Runner,type EventBoundary} from '../sim/runner';
import type {OriginIntervals} from '../network/origin';
import type {Bundle,Scenario,State,ThrustArc} from '../sim/schema';
import {orbitError,type ViewSample,type ViewerEvent} from '../model-set/model';
import {validateMaintained,type MaintainedDefinition,type WorldChunk} from '../maintained/world';
import {shootForcesJob,PlanningFailure,type PropagationBudget} from '../maintained/shoot';
export type AdaptiveDefinition=Omit<MaintainedDefinition,'domain'>&{domain:'adaptive-relay-v1'};
export const isAdaptive=(d:{domain?:string}):d is AdaptiveDefinition=>d.domain==='adaptive-relay-v1';
export function validateAdaptive(value:AdaptiveDefinition):AdaptiveDefinition{
 if(!isAdaptive(value))throw Error('Wrong adaptive service version');
 const checked=validateMaintained({...value,domain:'maintained-relay-v1'});return {...checked,domain:'adaptive-relay-v1'};
}
export interface Anchor {t:number;y:State;fuel:number;used:number;origin:State;baseline:State;visitorFuel?:number}
export interface Ownership {t:number;kind:'capture'|'transfer'|'release';fuel?:number;amount?:number;visitorId:string}
export interface Control {t:number;arcs:ThrustArc[];check:WorldChunk['check']}
interface Piece {start:number;end:number;runner:Runner;used:number;visitorFuel?:number;dryMass:number}
interface Chunk {data:WorldChunk;pieces:Piece[];origin:Runner;baseline:Runner;anchor:Anchor;endAnchor:Anchor;control:Control}
export const aligned=(t:number)=>Number.isFinite(t)&&Number.isInteger(t*256);
export const quiet=(t:number)=>aligned(t)&&t%8>=4&&t%8<8;
const copy=<T>(v:T):T=>structuredClone(v);
export class AdaptiveWorld {
 chunks:Chunk[]=[];anchor:Anchor;checks=0;corrected=0;failed=0;evaluations=0;#release?:()=>void;
 dispose(){this.#release?.();this.#release=undefined;}
 constructor(readonly definition:AdaptiveDefinition,anchor?:Anchor,readonly work?:PropagationBudget,readonly originIntervals?:OriginIntervals){const d=definition;this.anchor=copy(anchor??{t:0,y:d.relay.ship.state,fuel:d.relay.ship.propellant,used:0,origin:d.origin.state,baseline:d.relay.ship.state});if(this.anchor.t%8!==0)throw Error('Owner anchor must be a control boundary');this.#release=originIntervals?.watch(this);}
 fork(){const w=new AdaptiveWorld(this.definition,this.anchor,undefined,this.originIntervals);w.chunks=[...this.chunks];w.checks=this.checks;w.corrected=this.corrected;w.failed=this.failed;w.evaluations=this.evaluations;return w;}
 get end(){return this.anchor.t;}
 scenario(t:number,duration:number,y:State,fuel:number,visitorFuel?:number,relay=true):Scenario{
  const d=this.definition,s=copy(d.world.scenario);s.epoch=t;s.duration=duration;delete s.logistics;delete s.rendezvous;s.bodies.forEach(b=>b.radius+=.2);
  // Network block reservations include a bounded subdivision allowance per
  // Runner. Enforce that allowance rather than inheriting the scene-wide cap.
  if(this.originIntervals)s.policy.maxNodes=Math.min(s.policy.maxNodes,Math.ceil(duration/s.policy.step)+1024);
  s.ship=relay?{...copy(d.relay.ship),state:copy(y),propellant:fuel,dryMass:d.relay.ship.dryMass+(visitorFuel===undefined?0:d.world.scenario.ship.dryMass+d.world.scenario.ship.cargoMass+visitorFuel)}:{id:d.origin.id,state:copy(y),dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};return s;
 }
 *extend(through:number,knownAt:number,events:Ownership[]=[],frozen?:Control[]):Generator<void,void>{
  if(!aligned(through)||through>10096||through<this.end)throw Error('Invalid owner horizon');
  if(frozen&&(new Set(frozen.map(c=>c.t)).size!==frozen.length||frozen.some(c=>c.t%8!==0||c.arcs.some(a=>a.start<c.t||a.end>c.t+4))))throw Error('Invalid frozen ownership controls');
  if(events.some((e,i)=>!quiet(e.t)||e.visitorId!==this.definition.world.scenario.ship.id||i>0&&e.t<=events[i-1].t))throw Error('Invalid coupled ownership calendar');
  while(this.end<through){yield;this.originIntervals?.reserve(3*(8*256+1024)+4096);const start=copy(this.anchor),t=start.t,s=this.scenario(t,8,start.y,start.fuel,start.visitorFuel),before=orbitError(start.y,this.definition.reference);let arcs:ThrustArc[]=[],check:WorldChunk['check']={t,outcome:'skip',before:[before.position,before.velocity],evaluations:0};
   if(frozen){const control=frozen.find(c=>c.t===t);if(!control)throw Error('Incomplete frozen station stream');arcs=copy(control.arcs);check=copy(control.check);}
   else if(before.position>.001||before.velocity>.0003){try{
    const coast=new Runner({scenario:s,program:{schemaVersion:3,id:'loaded-coast-seed',burns:[]}}),p=coast.sample(t+4).y,r=this.definition.reference,a=Math.atan2(p[1],p[0]),c=Math.cos(a),sn=Math.sin(a),target=[3*c,3*sn,0,-3*r.rate*sn,3*r.rate*c,0] as State;
    const shot=yield* shootForcesJob({...s,duration:4},[{start:t,end:t+1.9},{start:t+2.1,end:t+4}],target,undefined,64,'sphere',this.work,'sensitivity');
    const at=shot.runner.sample(t+4),err=orbitError(at.y,r);if(at.propellant<.1||err.position>Math.max(.001,before.position)||err.velocity>Math.max(.0003,before.velocity))throw new PlanningFailure('Loaded maintenance reserve/quality gate failed',shot.evaluations);
    arcs=shot.arcs.map((a,i)=>({...a,id:this.originIntervals?`network-${this.definition.relay.id}-maintain-${t}-${i}`:`adaptive-maintain-${t}-${i}`}));check={t,outcome:'correct',before:[before.position,before.velocity],after:[err.position,err.velocity],evaluations:shot.evaluations};
   }catch(error){if(!(error instanceof PlanningFailure))throw error;check={t,outcome:'failed',before:[before.position,before.velocity],evaluations:error.evaluations,detail:error.message};}}
   const local=events.filter(e=>e.t>=t&&e.t<t+8),pieces:Piece[]=[],ownershipBounds:EventBoundary[]=[],ledger:ViewerEvent[]=[];const releasePieces=this.originIntervals?.watch({get runners(){return pieces.map(p=>p.runner);}});let y=copy(start.y),fuel=start.fuel,used=start.used,visitorFuel=start.visitorFuel,at=t;
   try{for(const event of [...local,undefined]){
    const end=event?.t??t+8;if(end>at){const scenario=this.scenario(at,end-at,y,fuel,visitorFuel),runner=new Runner({scenario,program:{schemaVersion:3,id:`owned-${at}`,burns:[],thrustArcs:arcs.filter(a=>a.start>=at&&a.end<=end)}});yield;const last=runner.advanceTo(end);if(last.status!=='horizon'||last.t!==end)throw Error(`Coupled owner physical failure: ${last.status}`);
     pieces.push({start:at,end,runner,used,visitorFuel,dryMass:scenario.ship.dryMass});ledger.push(...runner.ledger);y=last.y;fuel=last.propellant;used+=last.fuelUsed??0;at=end;}
    if(!event)break;const beforeSample:ViewSample={mass:this.definition.relay.ship.dryMass+(visitorFuel===undefined?0:1.05+visitorFuel)+fuel,t:at,y:copy(y),propellant:fuel,fuelUsed:used,burnCursor:0,status:'running',detail:''};
    if(event.kind==='capture'){if(visitorFuel!==undefined||event.fuel===undefined||!Number.isFinite(event.fuel)||event.fuel<.05||event.fuel>this.definition.world.scenario.ship.tankCapacity)throw Error('Invalid attached visitor mass');visitorFuel=event.fuel;}
    else if(event.kind==='transfer'){const q=event.amount;if(visitorFuel===undefined||q===undefined||!Number.isFinite(q)||q<0||q>visitorFuel||fuel+q>this.definition.relay.ship.tankCapacity+1e-12)throw Error('Invalid coupled fuel transfer');visitorFuel-=q;fuel+=q;}
    else{if(visitorFuel===undefined)throw Error('Release without visitor');visitorFuel=undefined;}
    ownershipBounds.push({t:at,before:beforeSample,after:{...beforeSample,propellant:fuel,mass:this.definition.relay.ship.dryMass+(visitorFuel===undefined?0:1.05+visitorFuel)+fuel} as ViewSample});
   }
   const originBundle={scenario:this.scenario(t,8,start.origin,0,undefined,false),program:{schemaVersion:3 as const,id:`adaptive-origin-${t}`,burns:[]}};
   const origin=this.originIntervals?.get(originBundle)??new Runner(originBundle),baseline=new Runner({scenario:this.scenario(t,8,start.baseline,this.definition.relay.ship.propellant),program:{schemaVersion:3,id:`adaptive-baseline-${t}`,burns:[]}});
   yield;const o=origin.advanceTo(t+8);yield;const b=baseline.advanceTo(t+8);if(o.status!=='horizon'||b.status!=='horizon')throw Error('Coupled background physical failure');
   const sample=(epoch:number):ViewSample=>{const piece=pieces.find(p=>p.start<=epoch&&p.end>epoch)??pieces.at(-1)!;const a=piece.runner.sample(epoch);return {...a,fuelUsed:piece.used+(a.fuelUsed??0),mass:piece.dryMass+a.propellant} as ViewSample;};
   const times=[...new Set([...Array.from({length:257},(_,i)=>t+i/32),...ledger.map(e=>e.t),...local.map(e=>e.t)])].sort((a,b)=>a-b),boundaries=[...pieces.flatMap(p=>p.runner.eventBoundaries.map(b=>({t:b.t,before:{...b.before,mass:p.dryMass+b.before.propellant,fuelUsed:p.used+(b.before.fuelUsed??0)},after:{...b.after,mass:p.dryMass+b.after.propellant,fuelUsed:p.used+(b.after.fuelUsed??0)}}))),...ownershipBounds].sort((a,b)=>a.t-b.t);
   const endAnchor:Anchor={t:t+8,y,fuel,used,origin:o.y,baseline:b.y,...(visitorFuel===undefined?{}:{visitorFuel})};
   if(check.outcome==='failed')ledger.push({t,kind:'planning-failed',id:`adaptive-maintenance-failed-${t}`,deltaV:0,fuelUsed:0,propellantBefore:start.fuel,propellantAfter:start.fuel,detail:check.detail});
   const data:WorldChunk={id:t/8,start:t,end:t+8,knownAt,check,station:times.map(sample),origin:times.map(epoch=>({t:epoch,y:origin.sample(epoch).y})),baseline:times.map(epoch=>({t:epoch,y:baseline.sample(epoch).y})),arcs,ledger,boundaries};
   this.chunks.push({data,pieces,origin,baseline,anchor:start,endAnchor,control:{t,arcs,check}});this.anchor=endAnchor;this.checks++;this.evaluations+=check.evaluations;if(check.outcome==='correct')this.corrected++;if(check.outcome==='failed')this.failed++;
   }finally{releasePieces?.();}
  }
 }
 sample(id:string,t:number):ViewSample{
  const chunk=this.chunks.find(c=>c.data.start<=t&&c.data.end>t)??[...this.chunks].reverse().find(c=>c.data.end===t);if(!chunk){if(t===this.anchor.t){return {t,y:copy(id===this.definition.origin.id?this.anchor.origin:this.anchor.y),mass:id===this.definition.origin.id?1:this.definition.relay.ship.dryMass+this.anchor.fuel+(this.anchor.visitorFuel===undefined?0:1.05+this.anchor.visitorFuel),propellant:id===this.definition.origin.id?0:this.anchor.fuel,fuelUsed:id===this.definition.origin.id?0:this.anchor.used,burnCursor:0,status:'running',detail:''};}throw Error('No coupled owner at epoch');}
  if(id===this.definition.origin.id)return chunk.origin.sample(t);if(id!==this.definition.relay.id)throw Error('Unknown coupled target');
  const piece=chunk.pieces.find(p=>p.start<=t&&p.end>t)??chunk.pieces.at(-1)!,a=piece.runner.sample(t);return {...a,fuelUsed:piece.used+(a.fuelUsed??0),mass:piece.dryMass+a.propellant} as ViewSample;
 }
 get controls(){return this.chunks.map(c=>copy(c.control));}
 get runners(){return this.chunks.flatMap(c=>[...c.pieces.map(p=>p.runner),c.origin,c.baseline]);}
 get nodes(){return [...new Set(this.runners)].reduce((n,r)=>n+r.retainedNodes,0);}
 evict(t:number){this.chunks=this.chunks.filter(c=>c.data.end>=t);}
}
