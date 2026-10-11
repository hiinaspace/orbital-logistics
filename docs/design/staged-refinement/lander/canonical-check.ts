/* Canonical local ascent/dock check for the exported offline candidate. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {prepareStagedApollo,validateStagedApollo} from '../../../../src/model-set/staged-apollo';
import {Runner} from '../../../../src/sim/runner';
import {validateBundle} from '../../../../src/sim/schema';
import {portState,surfaceNormal} from '../../../../src/sim/logistics';
import {derivative,bodyState} from '../../../../src/sim/dynamics';
import {paidCapture} from '../../../../src/sim/capture';
import {dot,norm} from '../../../../src/sim/vectors';

const dir=resolve(import.meta.dirname);
const candidateId=process.argv[2]??'4';
const original=JSON.parse(readFileSync(resolve(dir,'baseline-mission.json'),'utf8'));
const candidate=JSON.parse(readFileSync(resolve(dir,candidateId==='4'?'exact-mission.json':`exact-mission-${candidateId}.json`),'utf8'));
const baseline=prepareStagedApollo(original);
const d=validateStagedApollo(candidate),w=d.world,h=d.hardware,step=w.policy.step;
const split=baseline.outbound.sample(d.lunarSeparation);
const parkingScenario={...structuredClone(w),epoch:d.lunarSeparation,duration:Math.ceil((d.lunarDock-d.lunarSeparation)/step)*step,
 ship:{id:h.orbiter.id,state:split.y,dryMass:h.orbiter.dryMass,cargoMass:0,propellant:split.propellant,tankCapacity:h.orbiter.tankCapacity,
 exhaustVelocity:h.orbiter.exhaustVelocity,engine:h.orbiter.engine}};
parkingScenario.bodies[0].radius+=d.entry.atmosphere.topHeight;
const parking=new Runner(validateBundle({scenario:parkingScenario,program:{schemaVersion:4,id:'candidate-parking',burns:[],thrustArcs:[]}}));
const parkingHead=parking.advanceTo(d.lunarDock);
const start=portState(d.ports[1],d.liftoff);
const ascentScenario={...structuredClone(w),epoch:d.liftoff,duration:Math.ceil((d.lunarDock-d.liftoff)/step)*step,
 ship:{id:h.lander.id,state:start,dryMass:h.lander.dryMass,cargoMass:0,propellant:baseline.capture.propellantAfter,tankCapacity:h.lander.tankCapacity,
 exhaustVelocity:h.lander.exhaustVelocity,engine:h.lander.engine}};
ascentScenario.bodies[0].radius+=d.entry.atmosphere.topHeight;
const supportAcceleration=(()=>{const owner=w.bodies[1],pose=bodyState(owner,d.liftoff);const rail=owner.rail;
 if(rail.kind!=='circular')throw Error('expected circular');
 return pose.slice(0,3).map((v,i)=>-(v-rail.center[i])*rail.rate**2);
})();
const force=Math.min(h.lander.engine!.maxThrust*d.programs.lander[1].throttle,h.lander.engine!.maxAcceleration!*(h.lander.dryMass+baseline.capture.propellantAfter));
const gravity=derivative(ascentScenario,d.liftoff,start).slice(3);
const acceleration=gravity.map((v,i)=>v-supportAcceleration[i]+force/(h.lander.dryMass+baseline.capture.propellantAfter)*d.programs.lander[1].direction[i]);
const outwardAcceleration=dot(acceleration,surfaceNormal(d.ports[1],d.liftoff));
const ascent=new Runner(validateBundle({scenario:ascentScenario,program:{schemaVersion:4,id:'candidate-ascent',burns:[],thrustArcs:d.programs.lander.slice(1)}}));
const ascentHead=ascent.advanceTo(d.lunarDock);
const target=parking.sample(d.lunarDock);
const incoming=ascent.sample(d.lunarDock);
let capture:ReturnType<typeof paidCapture>|null=null, captureError:string|undefined;
try{capture=paidCapture(incoming.y,target.y,{dryMass:h.lander.dryMass,cargoMass:0,propellant:incoming.propellant,exhaustVelocity:h.lander.exhaustVelocity},{position:2e-6,velocity:2e-6},'candidate');}
catch(e){captureError=String(e);}
let fullMission:string;
try{const full=prepareStagedApollo(candidate);fullMission=`admitted: recovery ${JSON.stringify(full.recoveries)}`;}
catch(e){fullMission=`rejected: ${String(e)}`;}
const out={parkingStatus:parkingHead.status,ascentStatus:ascentHead.status,outwardAcceleration,
 positionError:norm(incoming.y.slice(0,3).map((v,i)=>v-target.y[i]) as [number,number,number]),
 velocityError:norm(incoming.y.slice(3).map((v,i)=>v-target.y[i+3]) as [number,number,number]),
 arrivalFuel:incoming.propellant,capture,captureError,fullMission,
 arrivalState:incoming.y,targetState:target.y,
 surfaceClearanceStart:norm(start.slice(0,3).map((v,i)=>v-bodyState(w.bodies[1],d.liftoff)[i]) as [number,number,number])-w.bodies[1].radius};
writeFileSync(resolve(dir,candidateId==='4'?'canonical-result.json':`canonical-result-${candidateId}.json`),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
