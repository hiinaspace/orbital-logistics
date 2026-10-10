import fs from 'node:fs';
import {shootForces} from '../../../src/maintained/shoot';
import {portState} from '../../../src/sim/logistics';
import type {Port,Scenario,Vec3} from '../../../src/sim/schema';
const d=JSON.parse(fs.readFileSync('fixtures/traffic/orison-shuttle-service.json','utf8'));
const crown=d.world.scenario.logistics.ports[1] as Port;
const ports=[crown],templates=[];
for(const [name,radius,departure] of [['Meridian',2.1,3],['Lantern',2.8,7]] as [string,number,number][]){
 const rate=radius**-1.5,T=Math.PI*((1.4+radius)/2)**1.5;
 const rail=crown.rail as any;
 const dest:Port={...structuredClone(crown),id:name,rail:{...rail,radius,rate,phase:rail.phase+rail.rate*departure+Math.PI-rate*(departure+T)}};
 ports.push(dest);
 for(const [source,target,cargo] of [[crown,dest,.025],[dest,crown,0]] as [Port,Port,number][]){
  const a=source.rail as any,b=target.rail as any,period=2*Math.PI/Math.abs(b.rate-a.rate);
  let ref=departure;if(source!==crown){ref=(Math.PI-b.phase+a.phase-b.rate*T)/(b.rate-a.rate);ref+=Math.ceil((.3-ref)/period)*period;}
  const y=portState(source,ref),at=portState(target,ref+T),fuel=.8;
  const scenario:Scenario={...structuredClone(d.world.scenario),epoch:0,duration:Math.ceil(T*128)/128,logistics:undefined,policy:{step:1/128,maxNodes:65536,maxSubdivision:20},ship:{...d.world.scenario.ship,state:y,cargoMass:cargo,propellant:fuel}};
  // Target at T, scenario horizon is padded only for schema grid admissibility.
  scenario.duration=T; // shoot internal expects exact duration; use T quantized below
  const duration=Math.round(T*64)/64;
  scenario.duration=duration;
  const final=portState(target,ref+duration);
  const pulse=.8;
  const ra=a.radius,rb=b.radius,speed1=ra**-.5*(Math.sqrt(2*rb/(ra+rb))-1),speed2=rb**-.5*(1-Math.sqrt(2*ra/(ra+rb)));
  const seed=[-y[1]/ra*speed1*(1+cargo+fuel)/pulse,y[0]/ra*speed1*(1+cargo+fuel)/pulse,0,-final[1]/rb*speed2*(1+cargo+fuel)/pulse,final[0]/rb*speed2*(1+cargo+fuel)/pulse,0];
  const shot=shootForces(scenario,[{start:0,end:pulse},{start:duration-pulse,end:duration}],final,seed,100,'sphere');
  const t={id:source.id+'-'+target.id,source:source.id,destination:target.id,referenceDeparture:ref,duration,cargo,propellant:fuel,integrationStep:1/128,arcs:shot.arcs,provenance:'Offline six-state finite-force shooting; primary-only complete certified flight.'};
  templates.push(t);console.log(t.id,shot.evaluations,shot.residual,shot.runner.current.propellant,shot.arcs.map(a=>a.throttle*32));
 }
}
fs.writeFileSync('docs/design/freight-district/orbital-authoring.json',JSON.stringify({ports,templates},null,2));
