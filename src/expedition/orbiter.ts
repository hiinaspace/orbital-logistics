import {Runner,type Sample} from '../sim/runner';
import type {Scenario,State} from '../sim/schema';
import type {ViewSample} from '../model-set/model';
export interface OrbiterDefinition {id:string;name:string;color:string;state:State}
export interface OrbiterDelta {samples:ViewSample[];end:number;nodes:number;physicsBytes:number;fault?:ViewSample}
// Eight-unit anchored ownership. Only canonical endpoints initialize successors.
export class OrbiterStream {
 end=0;fault?:ViewSample;#state:State;#chunks:{start:number;end:number;runner:Runner;bytes:number}[]=[];#rows:ViewSample[]=[];
 constructor(readonly scenario:Scenario,readonly definition:OrbiterDefinition,readonly atmosphereTop:number){this.#state=[...definition.state];}
 extend(through:number){
  if(!Number.isFinite(through)||through<0||through>1_000_000)throw Error('Orbiter calendar outside budget');
  while(this.end<through&&!this.fault){
   const start=this.end,end=Math.min(1_000_000,start+8),s=structuredClone(this.scenario);
   s.epoch=start;s.duration=end-start;delete s.logistics;delete s.rendezvous;
   s.policy={step:1/256,maxNodes:8192,maxSubdivision:20};s.bodies[0].radius=this.atmosphereTop;
   s.ship={id:this.definition.id,state:this.#state,dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
   const r=new Runner({scenario:s,program:{schemaVersion:3,id:this.definition.id+':'+start,burns:[]}}, {maxNodeStorageBytes:2_000_000}),terminal=r.advanceTo(end);
   const stop=terminal.t,at=(t:number):ViewSample=>({...r.sample(t),t,fuelUsed:0,mass:1,activity:{kind:'flying'}});
   const rows:ViewSample[]=[];for(let i=0;start+i/32<stop;i++)rows.push(at(start+i/32));rows.push(at(stop));
   if(terminal.status!=='horizon'||stop!==end){this.fault={...terminal,fuelUsed:0,mass:1,activity:{kind:'fault',knownEpoch:stop,reason:terminal.status+' '+terminal.detail}};rows[rows.length-1]=this.fault;}
   this.#rows.push(...rows.filter(q=>q.t>(this.#rows.at(-1)?.t??-Infinity)));this.#chunks.push({start,end:stop,runner:r,bytes:r.ownStorageBytes()});this.#state=[...terminal.y];this.end=stop;
  }
 }
 sample(t:number):Sample{
  if(this.fault&&t>this.fault.t)throw Error('Orbiter physical epoch after fault');
  const chunk=this.#chunks.find(c=>t>=c.start&&t<=c.end);if(!chunk)throw Error('Orbiter physics outside retained chunks');
  return chunk.runner.sample(t);
 }
 delta(after:number,oldest:number,frontier:number):OrbiterDelta{
  let i=0;while(i+1<this.#rows.length&&this.#rows[i+1].t<=oldest)i++;this.#rows=this.#rows.slice(i);
  this.#chunks=this.#chunks.filter(c=>c.end>=frontier);
  const nodes=this.#chunks.reduce((n,c)=>n+c.runner.retainedNodes,0),physicsBytes=this.#chunks.reduce((n,c)=>n+c.bytes,0);
  if(this.#rows.length>5400||nodes>20000||physicsBytes>8_000_000)throw Error('Orbiter retained budget');
  return {samples:this.#rows.filter(q=>q.t>=after),end:this.end,nodes,physicsBytes,fault:this.fault};
 }
}
