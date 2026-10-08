import {readFileSync,writeFileSync} from 'node:fs';
import {validateBundle,type Bundle,type Vec3,type ThrustArc} from '../src/sim/schema';
import {portState} from '../src/sim/logistics';
import {prepareSet,type ModelSet} from '../src/model-set/model';
const report=JSON.parse(readFileSync('docs/design/smooth-steering/search-report.json','utf8'));
const c=report.constants,rate=(r:number)=>Math.sqrt(1/r**3),u:Vec3=[Math.cos(c.node),Math.sin(c.node),0];
const ports=[{id:'Equator',radius:c.r1,tilt:0,phase:-rate(c.r1)*report.departure},
 {id:'Incline',radius:c.r2,tilt:c.tilt,phase:Math.PI-rate(c.r2)*report.arrival}].map(p=>({id:p.id,rail:{kind:'circular' as const,center:[0,0,0] as Vec3,u,v:[-Math.sin(c.node)*Math.cos(p.tilt),Math.cos(c.node)*Math.cos(p.tilt),Math.sin(p.tilt)] as Vec3,radius:p.radius,rate:rate(p.radius),phase:p.phase},cargo:0,cargoCapacity:1,propellant:0,tankCapacity:1,serviceDuration:.3}));
const [d1,d2]=report.parameters.slice(-2);
const arcs:ThrustArc[]=[[report.departure,report.departure+d1],[report.arrival-d2,report.arrival]].map(([start,end],i)=>{
 const directions=report.directions[i] as Vec3[],duration=end-start;
 return {id:i?'inclined-braking':'inclined-departure',start,end,direction:directions[0],throttle:1,steering:{kind:'spherical-smoothstep-v1',keys:directions.map((direction,j)=>({offset:duration*j/2,direction}))}};
});
const bundle:Bundle=validateBundle({scenario:{schemaVersion:3,modelVersion:'rk4-canonical-v3',id:'inclined-finite-transfer',units:{length:'Orison radius',time:'√(R³/μ)',mass:'mass unit'},epoch:0,duration:24,policy:{step:1/1024,maxNodes:65536,maxSubdivision:20},bodies:[{id:'Orison',mu:1,radius:1,rail:{kind:'fixed',position:[0,0,0]}}],ship:{id:'Tern',state:portState(ports[0],0),dryMass:c.dry,cargoMass:c.cargo,propellant:c.fuel,tankCapacity:1,exhaustVelocity:c.ve,engine:{maxThrust:c.force,maxAcceleration:c.cap}},logistics:{modelVersion:'kinematic-ports-v1',ports,cargoCapacity:.1,capture:{position:1e-7,velocity:1e-7},objective:{destinationId:'Incline',quota:c.cargo,returnPortId:'Equator',minPropellant:.2,hardwareCost:0}}},program:{schemaVersion:4,id:'tern-steered-delivery',burns:[],thrustArcs:arcs,operations:[{id:'initial-dock',kind:'dock',portId:'Equator',t:0},{id:'depart',kind:'undock',portId:'Equator',t:report.departure},{id:'capture',kind:'dock',portId:'Incline',t:report.arrival},{id:'unload',kind:'transfer',portId:'Incline',t:report.arrival,cargo:-c.cargo,propellant:0}]}});
const set:ModelSet={schemaVersion:1,id:'orison-steered',name:'Orison · inclined transfer',extent:3.5,description:'Tern delivers freight from an equatorial station to a depot in a 35° inclined orbit.',provenance:'Finite departure/braking with continuous inertial steering, bounded force/acceleration and paid fuel/capture. Fictional normalized primary; no authored impulses. Offline targeted program. Example physical scale: radius 1,000km, gravity parameter 1,000km³/s², time unit 1,000s and mass unit 1,000kg. Engine 250N, acceleration cap 0.14m/s², exhaust 3km/s; no real mission or engine model.',stations:[{id:'Equator',role:'Departure',berths:1},{id:'Incline',role:'Inclined depot',berths:1}],rotating:{name:'Equator rotating',rate:rate(c.r1),phase:ports[0].rail.phase},vessels:[{name:'Tern',color:'#efbf7c',cargo:'Supplies',bundle}]};
const run=prepareSet(set),arrival=run.vessels[0].ledger.find(e=>e.id==='capture')!;
if(arrival.deltaV+1e-8>=1e-7 || arrival.positionError!+1e-8>=1e-7 || run.vessels[0].samples.at(-1)!.logistics!.cargoMass!==0)throw Error('Inclined finite transfer admission failed');
const path='fixtures/model-sets/orison-steered.json',json=JSON.stringify(set,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==json)throw Error('Steering fixture differs');}else writeFileSync(path,json);
console.log({arrival,remaining:run.vessels[0].samples.at(-1)!.propellant});
