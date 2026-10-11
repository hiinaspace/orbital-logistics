import type {State,Vec3} from '../sim/schema';
import type {ViewSample} from '../model-set/model';
export interface SolarArc {referenceBody:number;localInitial:number[];id:string;start:number;end:number;keys:number[][];coefficients:number[][][];initial:number[];endpoint:number[]}
export interface SolarCapture {t:number;before:number[];beforeFuel:number;afterFuel:number;positionErrorMeters:number;velocityErrorMetersS:number;paidDeltaV:number}
export interface SolarPlayback {captures?:SolarCapture[];rows:number[][];arcs:SolarArc[];dryMass:number;initialFuel:number;cargo:number;rides?:{start:number;end:number;mass:number}[];ride?:{start:number;end:number};ports?:{origin:string;destination:string};exhaustVelocity:number;start:number;end:number}
function bracket(rows:number[][],t:number):number {
 if(!Number.isFinite(t)||t<rows[0][0]-1e-12||t>rows.at(-1)![0]+1e-12)throw Error('Solar query outside admitted interval');
 let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid][0]<=t)lo=mid;else hi=mid-1;}return lo;
}
export function solarStateAt(rows:number[][],t:number,captures:SolarCapture[]=[]):State {
 const i=bracket(rows,t),a=rows[i],b=rows[Math.min(rows.length-1,i+1)];if(t===a[0]||a===b)return a.slice(1,7) as State;
 const capture=captures.find(c=>c.t===b[0]),endpoint=capture?.before??b.slice(1,7);
 const h=b[0]-a[0],u=(t-a[0])/h,y=[0,0,0,0,0,0] as State;
 for(let j=0;j<3;j++){
  y[j]=(2*u**3-3*u*u+1)*a[j+1]+(u**3-2*u*u+u)*h*a[j+4]+(-2*u**3+3*u*u)*endpoint[j]+(u**3-u*u)*h*endpoint[j+3];
  y[j+3]=(6*u*u-6*u)/h*a[j+1]+(3*u*u-4*u+1)*a[j+4]+(-6*u*u+6*u)/h*endpoint[j]+(3*u*u-2*u)*endpoint[j+3];
 }
 return y;
}
export function solarControl(arc:SolarArc,t:number):Vec3 {
 if(t<arc.start||t>=arc.end)return [0,0,0];
 const i=Math.min(arc.coefficients.length-1,bracket(arc.keys,t)),d=t-arc.keys[i][0],c=arc.coefficients[i];
 return c[0].map((x,j)=>((x*d+c[1][j])*d+c[2][j])*d+c[3][j]) as Vec3;
}
export function sampleSolar(v:SolarPlayback,t:number):ViewSample {
 const i=bracket(v.rows,t),a=v.rows[i],b=v.rows[Math.min(v.rows.length-1,i+1)],u=b===a?0:(t-a[0])/(b[0]-a[0]);
 const endpointFuel=v.captures?.find(c=>c.t===b[0]&&t<b[0])?.beforeFuel??b[7],physicalFuel=a[7]+u*(endpointFuel-a[7]),propellant=v.ports&&t>=v.end?0:physicalFuel,cargo=v.ports&&t>=v.end?0:v.cargo,mass=v.dryMass+cargo+propellant+(v.rides??[]).filter(r=>t>=r.start&&t<r.end).reduce((s,r)=>s+r.mass,0);
 const sample:ViewSample={t,y:solarStateAt(v.rows,t,v.captures),propellant,fuelUsed:v.initialFuel-physicalFuel,burnCursor:0,status:'running',detail:'',mass};
 const ride=v.ride&&t>=v.ride.start&&t<v.ride.end;
 sample.logistics={operationCursor:0,cargoMass:cargo,fuelUsed:v.initialFuel-physicalFuel,ports:[],...(ride?{dockedPortId:'Wayfarer'}:{})};
 if(ride){sample.opacity=0;sample.activity={kind:'service',reason:'Aboard Wayfarer'};}
 else sample.activity={kind:'flying',reason:'Interplanetary cruise'};
 const arc=v.arcs.find(a=>t>=a.start&&t<a.end);
 if(arc){const acceleration=solarControl(arc,t),n=Math.hypot(...acceleration);if(n>1e-9){sample.thrust={id:arc.id,direction:acceleration.map(x=>x/n) as Vec3,force:n*mass,acceleration:n};sample.axis=[...sample.thrust.direction];sample.activity={kind:'flying',reason:arc.id.startsWith('turn')?'Powered Earth turn':arc.id};}}
 return sample;
}
