import {validateAdaptive,type AdaptiveDefinition} from '../adaptive/world';
import type {Depot} from '../traffic/resources';

export interface NetworkDefinition {
 schemaVersion:1;domain:'maintained-network-v1';id:string;name:string;description:string;provenance:string;
 lanes:[AdaptiveDefinition,AdaptiveDefinition];
}
export const isNetwork=(d:{domain?:string}):d is NetworkDefinition=>d.domain==='maintained-network-v1';
// This version is an assigned-pair exhibit: one physical owner and visitor per
// relay, sharing a two-berth ballistic hub. It does not admit arbitrary routing.
export function validateNetwork(value:NetworkDefinition):NetworkDefinition {
 if(!isNetwork(value)||value.schemaVersion!==1||!Array.isArray(value.lanes)||value.lanes.length!==2)throw Error('Wrong maintained network version');
 if(![value.id,value.name,value.description,value.provenance].every(s=>typeof s==='string'&&s.trim()))throw Error('Invalid network identity');
 const lanes=value.lanes.map(validateAdaptive).sort((a,b)=>a.vessels[0].id.localeCompare(b.vessels[0].id)) as NetworkDefinition['lanes'];
 const [a,b]=lanes,equal=(x:unknown,y:unknown)=>JSON.stringify(x)===JSON.stringify(y);
 if(!equal(a.origin,b.origin)||!equal(a.stations[0],b.stations[0])||!equal(a.world.scenario.bodies,b.world.scenario.bodies)||!equal(a.world.scenario.policy,b.world.scenario.policy)||!equal(a.world.scenario.units,b.world.scenario.units))throw Error('Network lanes require the identical physical hub and field');
 const ids=[a.origin.id,...lanes.map(l=>l.relay.id),...lanes.map(l=>l.vessels[0].id),...a.world.scenario.bodies.map(body=>body.id)];
 if(new Set(ids).size!==ids.length)throw Error('Network actor identities must be unique');
 return {...structuredClone(value),lanes};
}
export function networkDepots(d:NetworkDefinition):Depot[]{return [{...d.lanes[0].stations[0],berths:2},...d.lanes.map(l=>({...l.stations[1]}))];}
