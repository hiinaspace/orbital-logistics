import {readFileSync} from 'node:fs';
import {MaintainedWorld,validateMaintained,type MaintainedDefinition} from '../../../src/maintained/world';
import {transferSeed} from '../../../src/maintained/seed';
import {shootForces} from '../../../src/maintained/shoot';
import type {State} from '../../../src/sim/schema';
const d=validateMaintained(JSON.parse(readFileSync('fixtures/traffic/orison-maintained-service.json','utf8')) as MaintainedDefinition),world=new MaintainedWorld(d);world.ensure(80,0);
for(const departure of [6,14,22,30,38,46]){
 let fuel=.9;const rows=[];
 try{for(const [start,from,to] of [[departure,'Equator','Meridian'],[departure+16,'Meridian','Equator']] as const){
 const y=world.sample(from,start).y,target=world.sample(to,start+14).y,mass=1.05+fuel;
 const seed=transferSeed(y,target,14,mass);
 const s={...d.world.scenario,epoch:start,duration:14,ship:{...d.world.scenario.ship,state:y as State,propellant:fuel}};
 const at=performance.now(),shot=shootForces(s,[{start,end:start+1.6},{start:start+12.2,end:start+14}],target,seed,96);fuel=shot.runner.sample(start+14).propellant;rows.push({start,evaluations:shot.evaluations,fuel,ms:performance.now()-at});}
 console.log({departure,rows});}catch(e){console.log({departure,rows,error:(e as Error).message});}
}
