export interface Depot {
 id:string;role:string;berths:number;cargo:number;cargoCapacity:number;propellant:number;tankCapacity:number;
 cargoRate:number;propellantRate:number;
}
export interface ResourceStock {id:string;cargo:number;propellant:number}
export interface ResourceAnchor {t:number;stocks:ResourceStock[];cargoImported:number;cargoExported:number;fuelImported:number;fuelExported:number}
const clamp=(x:number,max:number)=>Math.max(0,Math.min(max,x));
// Immutable flow anchor: arbitrary reads and worker/display chunks cannot rebase it.
export function resourcesAt(anchor:ResourceAnchor,depots:Depot[],t:number):ResourceAnchor {
 if(t<anchor.t || !Number.isFinite(t))throw new Error('Resource epoch outside anchor');
 const next=structuredClone(anchor);next.t=t;
 for(const stock of next.stocks) {
  const d=depots.find(d=>d.id===stock.id)!,cargo=clamp(stock.cargo+d.cargoRate*(t-anchor.t),d.cargoCapacity),fuel=clamp(stock.propellant+d.propellantRate*(t-anchor.t),d.tankCapacity);
  const dc=cargo-stock.cargo,df=fuel-stock.propellant;
  if(dc>=0)next.cargoImported+=dc;else next.cargoExported-=dc;
  if(df>=0)next.fuelImported+=df;else next.fuelExported-=df;
  stock.cargo=cargo;stock.propellant=fuel;
 }
 return next;
}
