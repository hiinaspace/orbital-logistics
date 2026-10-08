// Freeze the accepted surface witnesses as a narrow recurring service definition.
import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {validateBundle} from '../../../src/sim/schema';
import {validateTraffic,type TrafficDefinition} from '../../../src/traffic/planner';
const set=JSON.parse(fs.readFileSync('fixtures/model-sets/selene-return.json','utf8')),b=validateBundle(set.vessels[0].bundle),s=b.scenario,p=b.program;
const departure=p.operations!.find(o=>o.kind==='undock')!.t,arrival=p.operations!.find(o=>o.kind==='land')!.t;
const refuel=new Runner(b).sample(departure).propellant;
const leg=(id:string,source:string,destination:string,referenceDeparture:number,end:number,cargo:number,propellant:number,start:number,stop:number)=>({id,source,destination,referenceDeparture,duration:end-referenceDeparture,cargo,propellant,arcs:p.thrustArcs!.slice(start,stop).map(a=>({...a,start:a.start-referenceDeparture,end:a.end-referenceDeparture})),provenance:'Unchanged paid finite surface round-trip witness, rotated at integer synodic windows and independently revalidated. Fixed loadout/hardware.'});
b.program={schemaVersion:3,id:'surface-service-world',burns:[]};
const d:TrafficDefinition={schemaVersion:1,domain:'airless-surface-v1',id:'selene-service',name:'Selene · continuous surface service',extent:set.extent,description:'Swift carries supplies up to Lantern and brings return freight to Cairn.',provenance:'Fictional airless world. Finite powered launch/descent, rotating supported pad, explicit external cargo/fuel flows and rolling history. Fixed witnessed loadouts and windows; no atmosphere or runtime steering optimizer.',rotating:set.rotating,world:b,historyDuration:128,sampleStep:1/16,forecastDuration:12,
 stations:[{id:'Cairn',role:'Surface supply terminal',berths:1,cargo:.3,cargoCapacity:1,propellant:2,tankCapacity:3,cargoRate:.005,propellantRate:.1},{id:'Lantern',role:'Orbital freight depot',berths:1,cargo:.1,cargoCapacity:1,propellant:2,tankCapacity:3,cargoRate:-.002,propellantRate:.08}],
 templates:[leg('Cairn-Lantern','Cairn','Lantern',.3,1.7207514043249135,.1,1.4,0,8),leg('Lantern-Cairn','Lantern','Cairn',departure,arrival,.05,refuel,8,16)],vessels:[{id:'swift',name:'Swift',color:set.vessels[0].color,cargo:'Freight',portId:'Cairn',propellant:1.2,route:['Cairn-Lantern','Lantern-Cairn']}]};
fs.writeFileSync('fixtures/traffic/selene-service.json',JSON.stringify(validateTraffic(d),null,2)+'\n');
