import {atmosphericStep,type FuelState} from './atmospheric-step';
import {derivative,bodyState} from './dynamics';
import {aerodynamicForces,densityAt,type Atmosphere,type AeroConfiguration,type AeroTelemetry} from './atmosphere';
import {cross,dot,norm,scale,subtract,type State,type Vec3} from './vectors';
import type {Scenario} from './schema';

export interface EntryGuidance {startHeight:number;fullHeight:number;descentSpeed:number;descentGain:number;velocityGain:number}
export interface EntryPhysics {scenario:Scenario;atmosphere:Atmosphere;aero:AeroConfiguration;guidance:EntryGuidance;recovery:{height:number;maxSpeed:number}}
export type EntryState=FuelState;
export interface EntryForces {aero:AeroTelemetry;force:Vec3;axis:Vec3;mass:number;engagement:number}
export function entryForces(d:EntryPhysics,t:number,z:EntryState):EntryForces {
 const s=d.scenario,body=s.bodies[0],y=z.slice(0,6) as State,mass=s.ship.dryMass+s.ship.cargoMass+z[6];
 if(!Number.isFinite(mass)||mass<=0||z[6]<0)throw new Error('Entry fuel depleted');
 const aero=aerodynamicForces(body,d.atmosphere,d.aero,t,y),b=bodyState(body,t),r=subtract(y.slice(0,3) as Vec3,b.slice(0,3) as Vec3),radius=norm(r),normal=scale(r,1/radius);
 const a=scale(subtract(aero.drag,scale(aero.lift,-1)),1/mass),g=d.guidance;
 const u=Math.max(0,Math.min(1,(g.startHeight-aero.altitude)/(g.startHeight-g.fullHeight))),engagement=u*u*(3-2*u);
 const target=-Math.sqrt(g.descentSpeed**2+2*g.descentGain*Math.max(0,aero.altitude-d.recovery.height));
 const gravity=derivative(s,t,y).slice(3) as Vec3;
 const requested=normal.map((x,i)=>mass*engagement*(-gravity[i]-a[i]+g.velocityGain*(target*x-aero.relativeVelocity[i]))) as Vec3;
 const maximum=Math.min(s.ship.engine!.maxThrust,(s.ship.engine!.maxAcceleration??Infinity)*mass),length=norm(requested);
 const force=length>maximum?scale(requested,maximum/length):requested;
 // Entry body command is broadside to the flow with its nose toward local up.
 // Blend toward terminal thrust without adding angular dynamics to translation.
 const relativeSpeed=norm(aero.relativeVelocity),flow=relativeSpeed>1e-12?scale(aero.relativeVelocity,1/relativeSpeed):normal;
 const broadside=subtract(normal,scale(flow,dot(normal,flow))),l=norm(broadside);
 const entryAxis=l>1e-6?scale(broadside,1/l):normal,thrustAxis=norm(force)>1e-10?scale(force,1/norm(force)):normal;
 const blend=entryAxis.map((x,i)=>(1-engagement)*x+engagement*thrustAxis[i]) as Vec3;
 return {aero,force,axis:norm(blend)>1e-8?scale(blend,1/norm(blend)):normal,mass,engagement};
}
export function entryDerivative(d:EntryPhysics,t:number,z:EntryState):EntryState {
 const f=entryForces(d,t,z),rate=derivative(d.scenario,t,z.slice(0,6) as State);
 for(let i=0;i<3;i++)rate[i+3]+=(f.aero.drag[i]+f.aero.lift[i]+f.force[i])/f.mass;
 return [...rate,-norm(f.force)/d.scenario.ship.exhaustVelocity];
}
export function entryStep(d:EntryPhysics,t:number,z:EntryState,h:number,check?:(t:number,z:EntryState)=>void):EntryState {
 return atmosphericStep(t,z,h,(t,z)=>entryDerivative(d,t,z),check);
}
// Conservative local enclosure: speed can grow by at most allowance; all
// stages and continuous motion stay in each body's half-clearance ball.
// Density, relative air speed, aero magnitude, gravity and thrust are bounded
// there. The self-consistent B*h test makes the speed bound valid, even though
// quadratic drag is not globally bounded. No assumption of drag helping safety.
export function entryStepEnvelope(d:Pick<EntryPhysics,'scenario'|'atmosphere'|'aero'>,t:number,z:EntryState,h:number):{half:number;allowance:number;bound:number;safe:boolean} {
 const s=d.scenario,y=z.slice(0,6) as State,body=s.bodies[0],b=bodyState(body,t),r=norm(subtract(y.slice(0,3) as Vec3,b.slice(0,3) as Vec3)),clearance=r-body.radius;
 if(clearance<=0||!Number.isFinite(h)||h<=0)return {half:0,allowance:0,bound:Infinity,safe:false};
 const half=clearance/2,speed=norm(y.slice(3) as Vec3),allowance=.25;
 const relativeBound=speed+allowance+norm(d.atmosphere.spin)*(r+half);
 const density=densityAt(d.atmosphere,clearance-half),nonfuel=s.ship.dryMass+s.ship.cargoMass;
 const aero=.5*density*d.aero.dragArea*relativeBound**2*(1+Math.abs(d.aero.liftToDrag))/nonfuel;
 const bound=body.mu/(body.radius+half)**2+s.ship.engine!.maxThrust/nonfuel+aero;
 return {half,allowance,bound,safe:bound*h<allowance && speed*h+bound*h*h/2<half};
}
export interface RecoveryPose {t:number;y:State;spin:Vec3;center:Vec3}
export function recoveredState(p:RecoveryPose,t:number):State {
 const dt=t-p.t,omega=norm(p.spin),axis=omega?scale(p.spin,1/omega):[0,0,1] as Vec3,r=subtract(p.y.slice(0,3) as Vec3,p.center),angle=omega*dt,c=Math.cos(angle),s=Math.sin(angle),turn=cross(axis,r);
 const position=r.map((x,i)=>p.center[i]+x*c+turn[i]*s+axis[i]*dot(axis,r)*(1-c)) as Vec3;
 return [...position,...cross(p.spin,subtract(position,p.center))];
}

export function certifiedEntryStep(d:EntryPhysics,t:number,z:EntryState,h:number):boolean {return entryStepEnvelope(d,t,z,h).safe;}
