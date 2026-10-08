// Compile bounded independent two-arc witnesses into inspectable v3 programs.
import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {validateBundle,type Bundle,type ThrustArc} from '../src/sim/schema';
import {prepareSet,type ModelSet} from '../src/model-set/model';
const report=JSON.parse(readFileSync('docs/design/bounded-propulsion/search-report.json','utf8'));
function compile(name:string,thrust:number,id:string):Bundle {
 const solutions=['outbound','return'].map(leg=>report.solutions.find((s:any)=>s.case.name===`${name}-${leg}` && s.thrust===thrust));
 if(solutions.some(s=>!s))throw new Error('Missing complete powered witness');
 const b=validateBundle(solutions[0].case.bundle),end=solutions[1].case.arrival;
 b.scenario.ship.id=id;b.scenario.ship.engine={maxThrust:thrust};b.program.id=`${id}-powered-service-v3`;b.program.burns=[];
 b.scenario.policy.step=1/4096;
 if(name==='Kestrel'){b.scenario.duration=16;b.scenario.policy.step=1/2048;b.scenario.policy.maxNodes=65536;}
 b.program.operations=b.program.operations!.filter(o=>o.t<=end);
 b.program.thrustArcs=solutions.flatMap((s:any,leg:number)=>{
  const [a1,a2,d1,d2]=s.parameters,c=s.case;
  return [{id:`leg${leg}-departure`,start:c.departure,end:c.departure+d1,direction:[Math.cos(a1),Math.sin(a1),0],throttle:1},
    {id:`leg${leg}-braking`,start:c.arrival-d2,end:c.arrival,direction:[Math.cos(a2),Math.sin(a2),0],throttle:1}] as ThrustArc[];
 });
 const away=b.program.operations!.find(o=>o.t===solutions[0].case.arrival && o.kind==='transfer')!;
 if(away.kind!=='transfer')throw new Error('Missing refueling service');
 away.propellant=0;
 const r=new Runner(b),prefix=r.advanceTo(away.t);
 if(prefix.status!=='running')throw new Error(`${id} outbound: ${prefix.status} ${prefix.detail}`);
 // Return shooting starts from the retained actual refueled mass, not a reset.
 away.propellant=solutions[1].case.before.propellant-prefix.propellant;
 return validateBundle(b);
}
const source=JSON.parse(readFileSync('fixtures/model-sets/selene-freight.json','utf8')) as ModelSet;
const lunar:ModelSet={...source,id:'selene-powered',name:'Selene · powered freight',description:'Two freighters fly the same lunar service with different thrust limits.',
 provenance:'Fictional normalized binary. Independently targeted finite-thrust arcs, engine force2/4, exhaust velocity3; no authored impulses. Finite stocks and paid capture residuals. Same schedule, different engine limits; no real-engine calibration.',
 vessels:[{name:'Wren',color:'#efb878',cargo:'Supplies',bundle:compile('Wren',2,'Wren')},
 {name:'Lark',color:'#78c9c0',cargo:'Supplies',bundle:compile('Wren',4,'Lark')}]};
const orison=JSON.parse(readFileSync('fixtures/model-sets/orison-freight.json','utf8')) as ModelSet;
const fixed:ModelSet={...orison,id:'orison-powered',name:'Orison · powered transfer',description:'A finite-thrust freighter supplies an orbital depot and returns.',
 provenance:'Fixed-primary validation scene. Two fixed inertial thrust arcs per leg, force1, exhaust velocity3, paid fuel/service/capture. Finite prepared trip.',
 vessels:[{name:'Kestrel',color:'#efb878',cargo:'Supplies',bundle:compile('Kestrel',1,'Kestrel')}]};
for(const set of [fixed,lunar]) {
 const run=prepareSet(set);if(run.vessels.some(v=>!v.samples.at(-1)!.logistics?.completedAt))throw new Error('Incomplete powered trip');
 writeFileSync(`fixtures/model-sets/${set.id}.json`,JSON.stringify(set,null,2)+'\n');
 console.log(set.id,run.vessels.map(v=>({name:v.name,fuel:v.samples.at(-1)!.propellant,captures:v.ledger.filter(e=>e.kind==='dock')})));
}
