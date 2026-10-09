import {Runner} from '../sim/runner';
import type {Bundle} from '../sim/schema';

// Only complete, exact canonical ballistic intervals are shared. A display
// interpolation, approximate anchor or another mass/event history cannot hit.
export class OriginIntervals {
 #entries=new Map<string,Runner>();hits=0;misses=0;peakNodes=0;
 #owners=new Map<object,()=>Runner[]>();peakResidentNodes=0;
 constructor(readonly enabled=true,readonly limit=400000){}
 watch(owner:{runners:Runner[]}){this.#owners.set(owner,()=>owner.runners);return ()=>this.#owners.delete(owner);}
 hold(runner:Runner){return this.watch({runners:[runner]});}
 reserve(extra=0){const runners=new Set(this.runners);for(const read of this.#owners.values())for(const r of read())runners.add(r);const nodes=[...runners].reduce((n,r)=>n+r.retainedNodes,0)+extra;this.peakResidentNodes=Math.max(this.peakResidentNodes,nodes);if(nodes>this.limit)throw Error('Network transient physical storage budget exceeded');}
 get(bundle:Bundle):Runner {
  if(bundle.program.burns.length||bundle.program.thrustArcs?.length||bundle.program.operations?.length||bundle.scenario.ship.propellant!==0)throw Error('Origin cache requires an unpaid ballistic interval');
  const key=JSON.stringify(bundle),found=this.enabled?this.#entries.get(key):undefined;
  if(found){this.hits++;return found;}
  this.reserve(Math.ceil(bundle.scenario.duration/bundle.scenario.policy.step)+1024);
  const runner=new Runner(bundle),end=bundle.scenario.epoch+bundle.scenario.duration,last=runner.advanceTo(end);
  if(last.t!==end||last.status!=='horizon')throw Error('Origin interval did not complete');
  if(this.enabled)this.#entries.set(key,runner);this.misses++;
  // FIFO eviction removes cache ownership only; an active physical forecast
  // retains its own immutable reference until that forecast is evicted.
  if(this.#entries.size>24)this.#entries.delete(this.#entries.keys().next().value!);
  this.peakNodes=Math.max(this.peakNodes,this.nodes);return runner;
 }
 evict(frontier:number){for(const [key,r] of this.#entries)if(r.bundle.scenario.epoch+r.bundle.scenario.duration<frontier)this.#entries.delete(key);}
 get runners(){return [...this.#entries.values()];}
 get nodes(){return this.runners.reduce((n,r)=>n+r.retainedNodes,0);}
}
