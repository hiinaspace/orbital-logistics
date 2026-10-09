import type {State} from './schema';
import {distance,relativeSpeed} from './vectors';
export class CaptureFailure extends Error {}
// One paid constrained-point capture rule for legacy operations and coupled
// service plans. Pure: a rejection cannot mutate either body or either tank.
export function paidCapture(state:State,target:State,ship:{dryMass:number;cargoMass:number;propellant:number;exhaustVelocity:number},limits:{position:number;velocity:number},label:string){
 if(![ship.dryMass,ship.cargoMass,ship.propellant,ship.exhaustVelocity,limits.position,limits.velocity].every(Number.isFinite)||ship.dryMass<=0||ship.cargoMass<0||ship.propellant<0||ship.exhaustVelocity<=0||limits.position<0||limits.velocity<0)throw new CaptureFailure('Invalid capture hardware or tolerance');
 const miss=distance(state,target),speed=relativeSpeed(state,target);
 if(!Number.isFinite(miss)||!Number.isFinite(speed)||miss>limits.position||speed>limits.velocity)throw new CaptureFailure(`Capture ${label}: miss ${miss.toExponential(2)}, speed ${speed.toExponential(2)}`);
 const used=(ship.dryMass+ship.cargoMass+ship.propellant)*-Math.expm1(-speed/ship.exhaustVelocity);
 if(used>ship.propellant||!Number.isFinite(used))throw new CaptureFailure('Not enough fuel for capture residual');
 return {y:[...target] as State,positionError:miss,deltaV:speed,fuelUsed:used,propellantBefore:ship.propellant,propellantAfter:ship.propellant-used};
}
