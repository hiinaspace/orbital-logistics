import {readFileSync,writeFileSync} from 'node:fs';
import {prepareSet,type ModelSet} from '../src/model-set/model';
import type {Bundle,Vec3} from '../src/sim/schema';
const mu=1,duration=24;
function orbit(radius:number,node:number,inclination:number) {
 const u:Vec3=[Math.cos(node),Math.sin(node),0],v:Vec3=[-Math.sin(node)*Math.cos(inclination),Math.cos(node)*Math.cos(inclination),Math.sin(inclination)];
 return {u,v,radius,rate:Math.sqrt(mu/radius**3)};
}
const specs=[{id:'tern',name:'Tern',color:'#efbf7c',radius:2,node:0,before:0,after:Math.PI/4},
 {id:'lark',name:'Lark',color:'#7ccbc7',radius:2.8,node:.9,before:-Math.PI/6,after:25*Math.PI/180}];
const worlds=specs.map(s=>{const r=orbit(s.radius,s.node,s.before);return {id:s.name+' Beacon',rail:{kind:'circular' as const,center:[0,0,0] as Vec3,...r,phase:-r.rate*4},cargo:0,cargoCapacity:1,propellant:0,tankCapacity:1,serviceDuration:.3};});
const set:ModelSet={schemaVersion:1,id:'crossing-planes',name:'Orison · crossing planes',extent:3.4,description:'Tern and Lark tilt their orbital planes at the nodes, then return to their original planes.',provenance:'Analytic circular plane-change witnesses with paid impulses. Different node axes and inclinations; fixed spherical primary. Reference beacons stay on their original orbits.',stations:worlds.map(p=>({id:p.id,role:'Reference orbit',berths:1})),rotating:{name:'Tern rotating',rate:Math.sqrt(1/8),phase:0},vessels:specs.map(s=>{
 const initial=orbit(s.radius,s.node,s.before),next=orbit(s.radius,s.node,s.after),n=initial.rate,theta=-n*4;
 const y=[...initial.u.map((u,i)=>s.radius*(u*Math.cos(theta)+initial.v[i]*Math.sin(theta))),...initial.u.map((u,i)=>s.radius*n*(-u*Math.sin(theta)+initial.v[i]*Math.cos(theta)))];
 const dv=next.v.map((x,i)=>s.radius*n*(x-initial.v[i])) as Vec3;
 const bundle:Bundle={scenario:{schemaVersion:3,modelVersion:'rk4-canonical-v3',id:s.id+'-plane-changes',units:{length:'Orison radius',time:'√(R³/μ)',mass:'mass unit'},epoch:0,duration,policy:{step:1/1024,maxNodes:65536,maxSubdivision:20},bodies:[{id:'Orison',mu,radius:1,rail:{kind:'fixed',position:[0,0,0]}}],ship:{id:s.id,state:y as Bundle['scenario']['ship']['state'],dryMass:1,cargoMass:0,propellant:.9,tankCapacity:1,exhaustVelocity:3},logistics:{modelVersion:'kinematic-ports-v1',ports:worlds,cargoCapacity:.1,capture:{position:1e-7,velocity:1e-7},objective:{destinationId:worlds[1].id,quota:.1,returnPortId:worlds[0].id,minPropellant:.1,hardwareCost:0}}},program:{schemaVersion:3,id:s.id+'-inclination-demonstration',burns:[{id:s.id+'-plane-change-out',t:4,referenceBodyId:'Orison',basis:'inertial-cartesian-v2',deltaVelocity:dv},{id:s.id+'-plane-change-back',t:4+Math.PI/n,referenceBodyId:'Orison',basis:'inertial-cartesian-v2',deltaVelocity:dv}]}};
 return {name:s.name,color:s.color,cargo:'Freight',bundle};})};
prepareSet(set);
const path='fixtures/model-sets/crossing-planes.json',json=JSON.stringify(set,null,2)+'\n';
if(process.argv.includes('--check')) {
 if(readFileSync(path,'utf8')!==json)throw Error('Crossing-plane fixture differs from its generator');
} else writeFileSync(path,json);
