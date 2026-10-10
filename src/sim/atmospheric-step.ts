// Shared seven-state RK kernel. Control mode and immutable mass/configuration
// are captured by the caller for the whole interval, including its endpoint.
export type FuelState=[number,number,number,number,number,number,number];
export function atmosphericStep(t:number,z:FuelState,h:number,derivative:(t:number,z:FuelState)=>FuelState,check?:(t:number,z:FuelState)=>void):FuelState {
 const add=(x:FuelState,k:FuelState,dt:number)=>x.map((v,i)=>v+dt*k[i]) as FuelState;
 const rate=(t:number,z:FuelState)=>{check?.(t,z);return derivative(t,z);};
 const a=rate(t,z),b=rate(t+h/2,add(z,a,h/2)),c=rate(t+h/2,add(z,b,h/2)),e=rate(t+h,add(z,c,h));
 return z.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+e[i])/6) as FuelState;
}
