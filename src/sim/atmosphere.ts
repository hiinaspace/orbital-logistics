import {bodyState} from './dynamics';
import {cross,dot,norm,scale,subtract,type Vec3,type State} from './vectors';
import type {Body} from './schema';

export interface Atmosphere {
 bodyId:string; spin:Vec3; density:number; scaleHeight:number; fadeHeight:number; topHeight:number;
}
export interface AeroConfiguration {dragArea:number;liftToDrag:number;liftFadeHeight:number}
export interface AeroTelemetry {
 altitude:number;density:number;airVelocity:Vec3;relativeVelocity:Vec3;
 dynamicPressure:number;drag:Vec3;lift:Vec3;heatProxy:number;
}
export function densityAt(a:Atmosphere,altitude:number):number {
 if(altitude>=a.topHeight)return 0;
 const u=Math.max(0,Math.min(1,(a.topHeight-altitude)/(a.topHeight-a.fadeHeight)));
 return a.density*Math.exp(-Math.max(0,altitude)/a.scaleHeight)*u*u*(3-2*u);
}
// Pure translational forces. Cd*A is authored in area units; force/mass is
// applied by the integrator. Density and drag use the body's moving air frame.
export function aerodynamicForces(body:Body,a:Atmosphere,c:AeroConfiguration,t:number,y:State):AeroTelemetry {
 const b=bodyState(body,t),r=subtract(y.slice(0,3) as Vec3,b.slice(0,3) as Vec3),radius=norm(r),normal=scale(r,1/radius);
 const airVelocity=subtract(cross(a.spin,r),scale(b.slice(3) as Vec3,-1));
 const relativeVelocity=subtract(y.slice(3) as Vec3,airVelocity),speed=norm(relativeVelocity),altitude=radius-body.radius;
 const density=densityAt(a,altitude),dynamicPressure=.5*density*speed*speed,force=dynamicPressure*c.dragArea;
 const drag=speed>1e-12?scale(relativeVelocity,-force/speed):[0,0,0] as Vec3;
 const unit=speed>1e-12?scale(relativeVelocity,1/speed):[0,0,0] as Vec3;
 const projected=subtract(normal,scale(unit,dot(normal,unit)));
 // Smoothly lose lift authority when the radial lift reference degenerates.
 // This avoids inventing a direction when flight becomes nearly vertical.
 const reference=scale(projected,1/Math.sqrt(dot(projected,projected)+1e-8));
 const u=Math.max(0,Math.min(1,altitude/c.liftFadeHeight)),fade=u*u*(3-2*u);
 const lift=scale(reference,force*c.liftToDrag*fade);
 return {altitude,density,airVelocity,relativeVelocity,dynamicPressure,drag,lift,heatProxy:Math.sqrt(density)*speed**3};
}
