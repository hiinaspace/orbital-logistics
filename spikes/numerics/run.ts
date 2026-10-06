import { writeFileSync } from 'node:fs';
import { hostname, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { advance, angularMomentum, canonical, distance, energy, error, jacobi, planetMoon, query, rk4, twoBody, type Burn, type Field, type State } from './model.ts';

const here = new URL('.',import.meta.url);
const STEPS=[1/128,1/256,1/512,1/1024];
const HORIZON=6;
const E=0.6;
function ellipse(t:number):State {
  let anomaly=t;
  for(let i=0;i<20;i++)anomaly-=(anomaly-E*Math.sin(anomaly)-t)/(1-E*Math.cos(anomaly));
  const den=1-E*Math.cos(anomaly),s=Math.sqrt(1-E*E);
  return [Math.cos(anomaly)-E,s*Math.sin(anomaly),-Math.sin(anomaly)/den,s*Math.cos(anomaly)/den];
}
function hyperbola(t:number):State {
  const e=1.5;
  let h=Math.asinh(t/e);
  for(let i=0;i<20;i++)h-=(e*Math.sinh(h)-h-t)/(e*Math.cosh(h)-1);
  const den=e*Math.cosh(h)-1,s=Math.sqrt(e*e-1);
  return [e-Math.cosh(h),s*Math.sinh(h),-Math.sinh(h)/den,s*Math.cosh(h)/den];
}
const analytic=[
  {name:'circular',horizon:2*Math.PI,solution:(t:number):State=>[Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t)]},
  {name:'eccentric_e0.6',horizon:2*Math.PI,solution:ellipse},
  {name:'hyperbolic_e1.5',horizon:4,solution:hyperbola},
];
const twoBodyChecks=analytic.map(c=>({name:c.name,horizon:c.horizon,steps:STEPS.map(step=>{
  const initial=c.solution(0),nodes=canonical(initial,c.horizon,step,twoBody),end=query(nodes,c.horizon,twoBody);
  const e0=energy(initial),l0=angularMomentum(initial);
  return {step,stateError:error(end,c.solution(c.horizon)),positionError:distance(end,c.solution(c.horizon)),maxEnergyDrift:Math.max(...nodes.map(n=>Math.abs(energy(n.y)-e0))),maxAngularMomentumDrift:Math.max(...nodes.map(n=>Math.abs(angularMomentum(n.y)-l0)))};
})}));

// Construct backward from a chosen relative periapsis candidate, then verify forward.
const encounterEpoch=2.5;
const moon=planetMoon(encounterEpoch)[1]!.state;
const c=Math.cos(encounterEpoch),s=Math.sin(encounterEpoch);
const encounter:State=[moon[0]+0.12*c,moon[1]+0.12*s,moon[2]-0.6*s,moon[3]+0.6*c];
const initial=advance(encounterEpoch,encounter,0,1/8192,planetMoon);
const burns:Burn[]=[{t:1.137,dv:[0.015,-0.01]}];
const h=1/512;
function inspect(nodes:ReturnType<typeof canonical>,field:Field) {
  let closest={t:0,distance:Infinity,speed:0};
  let minPlanet=Infinity,minMoon=Infinity;
  const points=[];
  for(let i=0;i<=6000;i++) {
    const t=i*HORIZON/6000,y=query(nodes,t,field),b=field(t);
    const moonDistance=distance(y,b[1]!.state);
    if(moonDistance<closest.distance)closest={t,distance:moonDistance,speed:Math.hypot(y[2]-b[1]!.state[2],y[3]-b[1]!.state[3])};
    minPlanet=Math.min(minPlanet,distance(y,b[0]!.state)); minMoon=Math.min(minMoon,moonDistance);
    if(i%10===0)points.push({t,ship:y,planet:b[0]!.state,moon:b[1]!.state});
  }
  return {closest,minPlanet,minMoon,points};
}
const baseline=canonical(initial,HORIZON,h,planetMoon),edited=canonical(initial,HORIZON,h,planetMoon,burns);
const baseInfo=inspect(baseline,planetMoon),editInfo=inspect(edited,planetMoon);
if(baseInfo.minPlanet<0.08||editInfo.minPlanet<0.08||baseInfo.minMoon<0.025||editInfo.minMoon<0.025)throw new Error('fixture collides on dense samples; revise it');
const convergence=STEPS.map(step=>{
  const a=canonical(initial,HORIZON,step,planetMoon),b=canonical(initial,HORIZON,step,planetMoon,burns);
  return {step,baselineFinal:query(a,HORIZON,planetMoon),editedFinal:query(b,HORIZON,planetMoon),maxBaselineJacobiDrift:Math.max(...a.map(n=>Math.abs(jacobi(n.t,n.y)-jacobi(0,initial)))),baselineClosest:inspect(a,planetMoon).closest,editedClosest:inspect(b,planetMoon).closest};
});

// Naive request-driven splitting changes the RK4 arithmetic and future states.
const partitionY:State=[0.4,0,0,2],partitionHorizon=6,partitionStep=1/32;
function requestAdvance(t:number,y:State,end:number):State {
  // Common naive playback: take h steps from the latest request boundary and
  // shorten only the final step, then retain that endpoint as the next start.
  for(let i=0;t+i*partitionStep<end;i++) {
    const at=t+i*partitionStep;
    y=rk4(at,y,Math.min(partitionStep,end-at),twoBody);
  }
  return y;
}
const direct=requestAdvance(0,partitionY,partitionHorizon);
let naive=[...partitionY] as State,t=0;
const requestTimes=[0.137,0.234,0.789,1.137,2.002,2.999,3.14159,4.567,5.912,6];
for(const end of requestTimes) {naive=requestAdvance(t,naive,end); t=end;}
const grid=canonical(partitionY,partitionHorizon,partitionStep,twoBody),before=query(grid,6,twoBody);
for(const at of requestTimes) query(grid,at,twoBody);
const after=query(grid,6,twoBody);
const partition={step:partitionStep,requestTimes,naiveEndpointDifference:error(direct,naive),canonicalEndpointDifference:error(before,after),naiveAnalyticError:error(naive,ellipse(6)),directAnalyticError:error(direct,ellipse(6))};

// Exact off-grid impulse split versus another independent analytic circular coast.
const impulseEpoch=1.137,impulse:Burn={t:impulseEpoch,dv:[0.015,-0.01]};
const impulseNodes=canonical([1,0,0,1],2,1/128,twoBody,[impulse]);
const post=query(impulseNodes,impulseEpoch,twoBody),pre=advance(0,[1,0,0,1],impulseEpoch,1/128,twoBody);
const impulseCheck={epoch:impulseEpoch,gridRemainder:impulseEpoch%(1/128),positionErrorAtBurn:distance(post,[Math.cos(impulseEpoch),Math.sin(impulseEpoch),0,0]),velocityJumpError:Math.hypot(post[2]-pre[2]-impulse.dv[0],post[3]-pre[3]-impulse.dv[1]),note:'velocityJumpError compares different coast partitions; see exactSamePartitionJumpError'};
const exactPre=rk4(1.1328125,query(impulseNodes,1.1328125,twoBody),impulseEpoch-1.1328125,twoBody);
const exactSamePartitionJumpError=Math.hypot(post[2]-exactPre[2]-impulse.dv[0],post[3]-exactPre[3]-impulse.dv[1]);

function apsisCandidates(nodes:ReturnType<typeof canonical>,field:Field,bodyIndex:number) {
  const radialProducts=nodes.map(n=>{
    const b=field(n.t)[bodyIndex]!.state;
    return {t:n.t,g:(n.y[0]-b[0])*(n.y[2]-b[2])+(n.y[1]-b[1])*(n.y[3]-b[3])};
  });
  const brackets=[];
  for(let i=1;i<radialProducts.length;i++) {
    const a=radialProducts[i-1]!,b=radialProducts[i]!;
    if(a.g*b.g<0)brackets.push({from:a.t,to:b.t,kind:a.g<0?'periapsis':'apoapsis'});
  }
  return {maxAbsRadialProduct:Math.max(...radialProducts.map(p=>Math.abs(p.g))),brackets};
}
const apsisInvestigation={
  criterion:'relative r dot relative v = 0; negative-to-positive is a periapsis candidate only on a continuous coast',
  circular:apsisCandidates(canonical([1,0,0,1],6,1/512,twoBody),twoBody,0),
  eccentric:apsisCandidates(canonical([0.4,0,0,2],6,1/512,twoBody),twoBody,0),
  moonBaseline:apsisCandidates(baseline,planetMoon,1),
  moonEdited:apsisCandidates(edited,planetMoon,1),
  warning:'No event locator implemented. Circular coast gives near-zero radial product everywhere; raw sign flips are meaningless. Burn discontinuities need separate handling; branch identity cannot be a mutable ordinal alone.',
};
const tunnelingCounterexample={radius:0.025,stepStart:[-0.1,0],stepEnd:[0.1,0],midpoint:[0,0],bothEndpointsOutside:true,midpointInside:true,note:'Synthetic straight segment: endpoint-only collision checks cannot certify a continuous trajectory.'};
for(const c of twoBodyChecks)if(c.steps[3]!.stateError>1e-8)throw new Error(`analytic check failed: ${c.name}`);
if(partition.canonicalEndpointDifference!==0||exactSamePartitionJumpError>1e-14)throw new Error('query or impulse contract failed');

// Node process microbenchmark; excludes all browser, drawing, worker and UI costs.
const timings=[];
for(const horizon of [6,20,60])for(const step of [1/256,1/512,1/1024]) {
  canonical(initial,horizon,step,planetMoon,burns);
  const ms=[];
  for(let i=0;i<7;i++){const start=performance.now();canonical(initial,horizon,step,planetMoon,burns);ms.push(performance.now()-start);}
  ms.sort((a,b)=>a-b);
  timings.push({horizon,step,steps:Math.floor(horizon/step)+1,medianMs:ms[3],minMs:ms[0],maxMs:ms[6],repetitions:7});
}
// Long horizons above are throughput timings only, not validity/collision certification.
const oracleRequest={initial,horizon:HORIZON,burns,checkTimes:Array.from({length:601},(_,i)=>i/100),tsBaseline:baseInfo.points.map(p=>p.ship),tsEdited:editInfo.points.map(p=>p.ship),steps:convergence};
writeFileSync(new URL('oracle-input.json',here),JSON.stringify(oracleRequest,null,2)+'\n');
writeFileSync(new URL('encounter-samples.json',here),JSON.stringify({meta:{horizon:HORIZON,step:h,muPlanet:0.98,muMoon:0.02,planetRadius:0.08,moonRadius:0.025,burn:burns[0],initial,provenance:'Constructed backward from relative periapsis candidate, not a player-authored maneuver.'},baseline:baseInfo.points,edited:editInfo.points},null,2)+'\n');
const report={environment:{hostname:hostname(),cpu:cpus()[0]?.model,node:process.version,platform:process.platform,arch:process.arch},units:{distance:'planet–moon separation',time:'inverse binary angular rate',massParameter:'G(Mplanet+Mmoon)=1',binaryPeriod:2*Math.PI},twoBodyChecks,fixture:{initial,horizon:HORIZON,step:h,burns,deltaV:Math.hypot(...burns[0]!.dv),baseline:{closest:baseInfo.closest,minPlanet:baseInfo.minPlanet,minMoon:baseInfo.minMoon},edited:{closest:editInfo.closest,minPlanet:editInfo.minPlanet,minMoon:editInfo.minMoon},endpointPositionChange:distance(query(baseline,HORIZON,planetMoon),query(edited,HORIZON,planetMoon))},convergence,partition,impulseCheck:{...impulseCheck,exactSamePartitionJumpError},apsisInvestigation,tunnelingCounterexample,timings};
writeFileSync(new URL('report.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
