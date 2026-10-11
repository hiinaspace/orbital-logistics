import {Runner} from '../sim/runner';
import {validateBundle,type State} from '../sim/schema';
import type {ModelSet} from '../model-set/model';
import type {Depot} from '../traffic/resources';
export const GRID=1/8192,CHUNK=.5,LUNAR_LEAD=.1,LUNAR_CALENDAR=64;
export interface LunarDefinition {schemaVersion:1;domain:'lunar-service-v1';id:string;name:string;source:ModelSet;stations:Depot[];historyDuration:.75;forecastDuration:.1;calendarLimit:64}
export const isLunar=(d:{domain?:string}):d is LunarDefinition=>d.domain==='lunar-service-v1';
export function validateLunar(value:LunarDefinition):LunarDefinition {
 const d=structuredClone(value),b=validateBundle(d.source.vessels[0].bundle),s=b.scenario,pad=s.logistics!.ports[0],target=s.logistics!.ports[1];
 if(!isLunar(d)||d.schemaVersion!==1||d.source.id!=='selene-ground'||d.source.vessels.length!==1||s.logistics!.modelVersion!=='moving-surface-ports-v6'||pad.rail.kind!=='surface'||target.rail.kind!=='ballistic'||s.bodies.length!==2||s.epoch!==0||s.ship.cargoMass!==0||s.ship.propellant!==6||s.policy.step!==GRID||target.rail.policy.step!==GRID||d.historyDuration!==.75||d.forecastDuration!==LUNAR_LEAD||d.calendarLimit!==LUNAR_CALENDAR||d.stations.length!==2)throw Error('Unsupported lunar service');
 const expected=[['primary',.98,.08,.02],['moon',.02,.025,.98]];
 for(let i=0;i<2;i++){const b=s.bodies[i],r=b.rail,e=expected[i];if(b.id!==e[0]||b.mu!==e[1]||b.radius!==e[2]||r.kind!=='circular'||r.radius!==e[3]||r.rate!==1||r.phase!==(i===0?Math.PI:0)||JSON.stringify(r.center)!=='[0,0,0]'||JSON.stringify(r.u)!=='[1,0,0]'||JSON.stringify(r.v)!=='[0,1,0]')throw Error('Unsupported lunar field');}
 if(pad.id!=='Northhaven'||target.id!=='Crescent'||pad.rail.bodyId!=='moon'||pad.rail.rate!==1||pad.rail.phase!==0||pad.rail.latitude!==20*Math.PI/180||pad.rail.centerHeight!==1e-6||s.ship.id!=='Tern'||s.ship.dryMass!==1||s.ship.tankCapacity!==6||Math.abs(s.ship.exhaustVelocity-2.6832815729997477)>1e-12||target.rail.minClearance!==.0001||!Number.isFinite(s.ship.engine?.maxAcceleration)||Math.abs((s.ship.engine?.maxAcceleration??NaN)-38.4)>1e-12||Math.abs((s.ship.engine?.maxThrust??0)-1024)>1e-12)throw Error('Unsupported lunar hardware/support');
 for(const p of d.stations)if(![pad.id,target.id].includes(p.id)||p.berths!==1||![p.cargo,p.cargoCapacity,p.propellant,p.tankCapacity,p.cargoRate,p.propellantRate].every(Number.isFinite)||p.cargo<0||p.cargo>p.cargoCapacity||p.propellant<0||p.propellant>p.tankCapacity||p.propellantRate<0||(p.id==='Northhaven'?p.cargoRate<0:p.cargoRate>0))throw Error('Invalid lunar stocks');
 if(new Set(d.stations.map(p=>p.id)).size!==2)throw Error('Duplicate lunar station');
 d.source.vessels[0].bundle=b;return d;
}
export interface DepotChunk {id:number;start:number;end:number;samples:{t:number;y:State}[]}
interface OwnedChunk {data:DepotChunk;runner:Runner;bytes:number}
export class LunarWorld {
 chunks:OwnedChunk[]=[];end=0;#state:State;generated=0;
 constructor(readonly definition:LunarDefinition){const r=definition.source.vessels[0].bundle.scenario.logistics!.ports[1].rail;if(r.kind!=='ballistic')throw Error('target');this.#state=structuredClone(r.state);}
 extend(through:number){
  if(through>LUNAR_CALENDAR||through<0)throw Error('Lunar calendar limit');
  if(Math.ceil(through/CHUNK)*CHUNK-(this.chunks[0]?.data.start??this.end)>3)throw Error('Lunar depot allocation budget exceeded');
  while(this.end<through){
   const start=this.end,end=start+CHUNK,s=structuredClone(this.definition.source.vessels[0].bundle.scenario),rail=s.logistics!.ports[1].rail;
   if(rail.kind!=='ballistic')throw Error('target');
   delete s.logistics;s.epoch=start;s.duration=CHUNK;s.policy=structuredClone(rail.policy);s.policy.maxNodes=8192;
   s.bodies.forEach(b=>b.radius+=rail.minClearance);
   s.ship={id:'Crescent',state:structuredClone(this.#state),dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
   const runner=new Runner({scenario:s,program:{schemaVersion:3,id:'lunar-canonical-depot',burns:[]}}),last=runner.advanceTo(end);
   if(last.status!=='horizon'||runner.retainedNodes!==4097)throw Error('Lunar depot checkpoint domain changed');
   const data={id:this.generated++,start,end,samples:Array.from({length:2049},(_,i)=>({t:start+CHUNK*i/2048,y:runner.sample(start+CHUNK*i/2048).y}))};
   this.chunks.push({data,runner,bytes:runner.treeStorageBytes()});this.#state=last.y;this.end=end;
  }
 }
 state(t:number):State{const c=this.chunks.find(c=>c.data.start<=t&&t<=c.data.end);if(!c)throw Error('Depot epoch outside lease');return c.runner.sample(t).y;}
 assertLease(runner:Runner,start:number,end:number){
  if(start/GRID!==Math.floor(start/GRID)||end/GRID!==Math.floor(end/GRID))throw Error('Lease is not global-grid aligned');
  for(let t=start;t<=end;t+=GRID)if(JSON.stringify(runner.portState('Crescent',t))!==JSON.stringify(this.state(t)))throw Error('Lunar canonical lease identity failed');
  for(const t of [start+GRID*.371,end-GRID*.27,(start+end)/2])if(JSON.stringify(runner.portState('Crescent',t))!==JSON.stringify(this.state(t)))throw Error('Lunar off-grid lease identity failed');
 }
 evict(before:number){this.chunks=this.chunks.filter(c=>c.data.end>=before);}
 get nodes(){return this.chunks.reduce((n,c)=>n+c.runner.retainedTreeNodes,0);}
 get bytes(){return this.chunks.reduce((n,c)=>n+c.bytes,0);}
}
