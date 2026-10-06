// Feasibility spike, deliberately allocation-heavy. No DOM or player runtime.
export type State = [number, number, number, number];
export type Body = { mu: number; state: State; radius: number };
export type Field = (t: number) => Body[];
export type Burn = { t: number; dv: [number, number] };
export type Node = { t: number; y: State };

export const planetMoon: Field = (t) => {
  // G(Mp+Mm)=1, separation=1, angular rate=1, barycenter at origin.
  const c = Math.cos(t), s = Math.sin(t);
  return [
    { mu: 0.98, radius: 0.08, state: [-0.02*c, -0.02*s, 0.02*s, -0.02*c] },
    { mu: 0.02, radius: 0.025, state: [0.98*c, 0.98*s, -0.98*s, 0.98*c] },
  ];
};
export const twoBody: Field = () => [{mu: 1, radius: 0, state: [0,0,0,0]}];
export function rhs(t: number, y: State, field: Field): State {
  let ax = 0, ay = 0;
  for (const b of field(t)) {
    const dx = b.state[0]-y[0], dy = b.state[1]-y[1];
    const r3 = Math.hypot(dx, dy)**3;
    ax += b.mu*dx/r3; ay += b.mu*dy/r3;
  }
  return [y[2], y[3], ax, ay];
}
function add(y: State, k: State, s: number): State {
  return y.map((v,i)=>v+s*k[i]!) as State;
}
export function rk4(t: number, y: State, h: number, field: Field): State {
  const a = rhs(t,y,field), b = rhs(t+h/2,add(y,a,h/2),field);
  const c = rhs(t+h/2,add(y,b,h/2),field), d = rhs(t+h,add(y,c,h),field);
  return y.map((v,i)=>v+h*(a[i]!+2*b[i]!+2*c[i]!+d[i]!)/6) as State;
}
export function advance(t: number, y: State, end: number, h: number, field: Field): State {
  const n = Math.ceil(Math.abs(end-t)/h);
  const step = (end-t)/n;
  for (let i=0;i<n;i++) y=rk4(t+i*step,y,step,field);
  return y;
}
export function canonical(y0: State, horizon: number, h: number, field: Field, burns: Burn[]=[]): Node[] {
  if (!(h>0) || !(horizon>=0) || !Number.isFinite(h+horizon)) throw new Error('invalid integration range');
  // The terminal partial node is valid for this fixed horizon; do not append from
  // it when extending a trajectory. Rebuild from the preceding grid/event node.
  const epochs = new Set<number>([0,horizon]);
  for(let i=1;i<=Math.floor(horizon/h);i++) epochs.add(i*h);
  for(const b of burns) {
    if(b.t<0 || b.t>horizon) throw new Error('burn outside horizon');
    epochs.add(b.t);
  }
  const nodes: Node[]=[];
  let t=0, y=[...y0] as State;
  for(const end of [...epochs].sort((a,b)=>a-b)) {
    if(end>t) y=rk4(t,y,end-t,field);
    for(const burn of burns.filter(b=>b.t===end)) y=[y[0],y[1],y[2]+burn.dv[0],y[3]+burn.dv[1]];
    t=end; nodes.push({t,y});
  }
  return nodes;
}
export function query(nodes: Node[], t: number, field: Field): State {
  if(!Number.isFinite(t) || t<0 || nodes.length===0 || t>nodes[nodes.length-1]!.t) throw new Error('invalid query');
  let lo=0,hi=nodes.length-1;
  while(lo<hi) {const mid=Math.ceil((lo+hi)/2); if(nodes[mid]!.t<=t)lo=mid;else hi=mid-1;}
  const node=nodes[lo]!;
  // Ephemeral partial step: never writes back into canonical nodes.
  return t===node.t ? [...node.y] as State : rk4(node.t,node.y,t-node.t,field);
}
export function distance(a: State,b: State): number {return Math.hypot(a[0]-b[0],a[1]-b[1]);}
export function error(a: State,b: State): number {return Math.hypot(...a.map((v,i)=>v-b[i]!));}
export function energy(y: State): number {return (y[2]**2+y[3]**2)/2-1/Math.hypot(y[0],y[1]);}
export function angularMomentum(y: State): number {return y[0]*y[3]-y[1]*y[2];}
export function jacobi(t:number,y:State):number {
  const bodies=planetMoon(t);
  // Rotating velocity v_rot = R(-t) (v_inertial - omega cross r).
  const v2=(y[2]+y[1])**2+(y[3]-y[0])**2;
  return y[0]**2+y[1]**2+2*bodies.reduce((s,b)=>s+b.mu/distance(y,b.state),0)-v2;
}
