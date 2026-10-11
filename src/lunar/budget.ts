import type {Scenario} from '../sim/schema';
import {GRID} from './world';
// Two short ballistic/physical owners, with <=5 steering keys and eight ops.
// Worst-schema padding puts each ballistic node below512 bytes and the fixed
// bundle/ledger/event envelope below28KiB; reserve64KiB for final event mutations.
// Ship nodes vary greatly between powered and attached intervals, so cap their
// actual incremental serialization instead of reserving the worst for every node.
export function reserveLunarRunner(s:Scenario,otherBytes:number):number|undefined {
 const available=Math.min(32_000_000,40_000_000-otherBytes),grid=s.duration/GRID;
 const target=s.logistics!.ports[1].rail;if(target.kind!=='ballistic')throw Error('depot');
 const targetNodes=Math.ceil(grid)+2,nodeBytes=Math.floor(available-65536-targetNodes*512);
 if(nodeBytes<4096)return undefined;
 s.policy.maxNodes=32768;target.policy.maxNodes=targetNodes;
 return nodeBytes;
}
