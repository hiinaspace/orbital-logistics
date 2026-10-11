import fs from 'node:fs';
import {prepareStagedApollo} from '../../../src/model-set/staged-apollo';
import {bodyState} from '../../../src/sim/dynamics';
const root='docs/design/staged-refinement/';
const baseline=JSON.parse(fs.readFileSync(root+'arrival-baseline.json','utf8')).fixture;
const selected=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-staged-expedition.json','utf8'));
const rows=[baseline,selected].map(d=>{
 const m=prepareStagedApollo(d),moon=m.definition.world.bodies[1];
 const sample=(id:string,t:number)=>{const y=m.sample(id,t,true).y,c=bodyState(moon,t);return {t,y,r:y.slice(0,3).map((v,i)=>v-c[i])};};
 return {insertion:Array.from({length:257},(_,i)=>sample('Odyssey',29.25+i*1.15/256)),
 ascent:Array.from({length:513},(_,i)=>{const t=d.liftoff+i*(d.lunarDock-d.liftoff)/512;return {eagle:sample('Eagle',t),odyssey:sample('Odyssey',t)};})};
});
fs.writeFileSync(root+'shape-traces.json',JSON.stringify(rows)+'\n');
