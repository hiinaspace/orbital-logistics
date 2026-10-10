import {Runner,type Sample,type EventBoundary,type LedgerEntry} from '../sim/runner';
import {paidCapture,CaptureFailure} from '../sim/capture';
import {portState} from '../sim/logistics';
import type {Bundle,State,Vec3} from '../sim/schema';

// A completed read-only flight, never a physical restart/checkpoint interface.
export type PreparedFlight=Pick<Runner,'bundle'|'sample'|'current'|'ledger'|'eventBoundaries'|'retainedNodes'>;
interface Reference {runner:Runner;bundle:Bundle;boundaries:EventBoundary[];ledger:LedgerEntry[];bytes:number}
const copy=<T>(x:T):T=>structuredClone(x);
export class WholeFlightCache {
 #references=new Map<string,Reference>();#hits=0;
 get(key:string,bundle:Bundle,rotation:number,make:()=>Runner):PreparedFlight {
  let r=this.#references.get(key);
  if(!r){
   if(this.#references.size>=2)throw Error('Whole flight cache entry budget exceeded');
   const runner=make();r={runner,bundle:runner.bundle,boundaries:runner.eventBoundaries,ledger:runner.ledger,bytes:runner.ownStorageBytes()};
   if(runner.retainedNodes+[...this.#references.values()].reduce((n,r)=>n+r.runner.retainedNodes,0)>20000)throw Error('Whole flight cache physical budget exceeded');
   r.bytes+=new TextEncoder().encode(JSON.stringify({key,bundle:r.bundle,boundaries:r.boundaries,ledger:r.ledger})).byteLength;
   if(r.bytes+[...this.#references.values()].reduce((n,r)=>n+r.bytes,0)>8_000_000)throw Error('Whole flight cache serialized storage budget exceeded');
   this.#references.set(key,r);
  }else this.#hits++;
  try{return rotatedFlight(r,bundle,rotation);}catch(error){if(error instanceof CaptureFailure)throw Error('Powered transfer admission failed',{cause:error});throw error;}
 }
 stats(){return {flightCacheEntries:this.#references.size,flightCacheHits:this.#hits,flightCacheSerializedBytes:[...this.#references.values()].reduce((n,r)=>n+r.bytes,0),flightCacheNodes:[...this.#references.values()].reduce((n,r)=>n+r.runner.retainedNodes,0)};}
}
function rotatedFlight(r:Reference,value:Bundle,angle:number):PreparedFlight {
 const b=copy(value),s=b.scenario,c=Math.cos(angle),sn=Math.sin(angle),end=b.program.operations!.at(-1)!.t;
 const rotate=(v:Vec3):Vec3=>[c*v[0]-sn*v[1],sn*v[0]+c*v[1],v[2]];
 const state=(y:State):State=>[...rotate(y.slice(0,3) as Vec3),...rotate(y.slice(3) as Vec3)] as State;
 const ids=new Map<string,string>();
 r.bundle.program.thrustArcs!.forEach((a,i)=>ids.set(a.id,b.program.thrustArcs![i].id));
 r.bundle.program.operations!.forEach((o,i)=>ids.set(o.id,b.program.operations![i].id));
 const id=(x:string)=>ids.get(x)??x;
 const source=s.logistics!.ports.find(p=>p.id!==b.program.operations!.at(-1)!.portId)!;
 if(Math.hypot(...state(r.runner.sample(0).y).map((v,i)=>v-portState(source,0)[i]))>1e-8)throw Error('Powered transfer admission failed');
 const terminal=r.boundaries.find(x=>x.t===end)?.before;
 if(!terminal)throw Error('Whole flight missing physical arrival boundary');
 const destination=s.logistics!.ports.find(p=>p.id===b.program.operations!.at(-1)!.portId)!;
 const cap=paidCapture(state(terminal.y),portState(destination,end),{...s.ship,propellant:terminal.propellant},{position:Math.min(1e-7,s.logistics!.capture.position,destination.rail.kind==='surface'?destination.rail.centerHeight/4:Infinity),velocity:Math.min(1e-7,s.logistics!.capture.velocity)},'cached arrival');
 if(cap.propellantAfter<.05||cap.positionError+1e-8>=1e-7||cap.deltaV+1e-8>=1e-7)throw Error('Powered transfer admission failed');
 const free=(raw:Sample):Sample=>{
  const p=copy(raw);p.y=state(p.y);if(p.thrust){p.thrust.id=id(p.thrust.id);p.thrust.direction=rotate(p.thrust.direction);}
  if(p.logistics?.service)p.logistics.service.id=id(p.logistics.service.id);
  if(p.logistics?.dockedPortId)p.y=portState(s.logistics!.ports.find(port=>port.id===p.logistics!.dockedPortId)!,p.t);
  return p;
 };
 const after=(raw:Sample):Sample=>{
  const p=free(raw);
  if(p.t>=end){p.y=portState(destination,p.t);p.propellant=cap.propellantAfter;p.fuelUsed=s.ship.propellant-cap.propellantAfter;p.logistics!.fuelUsed=p.fuelUsed;}
  return p;
 };
 const boundaries=r.boundaries.map(e=>({t:e.t,before:free(e.before),after:after(e.after)}));
 const ledger=r.ledger.map(e=>({...e,id:id(e.id),...(e.id===r.bundle.program.operations!.at(-1)!.id?{positionError:cap.positionError,deltaV:cap.deltaV,fuelUsed:cap.fuelUsed,propellantBefore:cap.propellantBefore,propellantAfter:cap.propellantAfter}:{})}));
 const sample=(t:number)=>after(r.runner.sample(t));
 // The source bundle contains the actual local rail phases and programs. It
 // can be replayed independently, but this provider exposes no restore/fork.
 return {get bundle(){return copy(b);},sample,get current(){return sample(s.epoch+s.duration);},get eventBoundaries(){return copy(boundaries);},get ledger(){return copy(ledger);},retainedNodes:0};
}
