// Research-only refinement: canonical vacuum windows split on the same dyadic
// grid after 16,384 steps, outside burns. No production limits are relaxed.
import fs from 'node:fs';
import {Runner} from '../../../src/sim/runner';
import {prepareAtmosphericLeg,atmosphericStateAt} from '../../../src/sim/atmospheric-propulsion';
import {prepareEntry} from '../../../src/model-set/entry';
import {paidCapture} from '../../../src/sim/capture';
import {portState} from '../../../src/sim/logistics';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-staged-expedition.json','utf8'));
const step=1/Number(process.argv[2]??1024),h=d.hardware,w=d.world;
const rows:any[]=[];
function scenario(part:string,t:number,end:number,y:any,fuel:number,attached=0){return {...structuredClone(w),epoch:t,duration:Math.ceil((end-t)/step)*step,policy:{step,maxNodes:65536,maxSubdivision:20},ship:{id:h[part].id,state:y,dryMass:h[part].dryMass+attached,cargoMass:0,propellant:fuel,tankCapacity:h[part].tankCapacity,exhaustVelocity:h[part].exhaustVelocity,engine:h[part].engine}};}
function air(part:string,t:number,end:number,y:any,fuel:number,attached:number,area:number,arcs:any[]){const run=prepareAtmosphericLeg({scenario:scenario(part,t,end,y,fuel,attached),atmosphere:d.entry.atmosphere,aero:{...d.entry.aero,dragArea:area,liftToDrag:0},start:t,end,arcs});const z=atmosphericStateAt(run,end);rows.push({name:part+':air:'+end,t:end,y:z.slice(0,6),fuel:z[6]});return {y:z.slice(0,6),fuel:z[6]};}
function vacuum(name:string,part:string,start:number,end:number,y:any,fuel:number,attached:number,arcs:any[]){let t=start;let n=0;
 while(t<end){let stop=Math.min(end,start+(++n)*16384*step);const crossing=arcs.find(a=>a.start<stop&&stop<a.end);if(crossing)stop=Math.min(end,start+Math.ceil((crossing.end-start)/step)*step);
 const s=scenario(part,t,stop,y,fuel,attached);s.bodies[0].radius+=d.entry.atmosphere.topHeight;
 const runner=new Runner({scenario:s,program:{schemaVersion:4,id:name+':'+n,burns:[],thrustArcs:arcs.filter(a=>a.start>=t&&a.end<=stop)}});const last=runner.advanceTo(stop);
 if(!['running','horizon'].includes(last.status)||last.t!==stop)throw Error(last.status+' '+last.detail);y=last.y;fuel=last.propellant;t=stop;
 }
 rows.push({name,t:end,y,fuel});return {y,fuel};
}
const upperMass=h.orbiter.dryMass+h.orbiter.propellant+h.lander.dryMass+h.lander.propellant;
const split=air('booster',d.launch,d.boosterSeparation,portState(d.ports[0],d.launch),h.booster.propellant,upperMass,d.dragAreas.stack,d.programs.stack);
const landerMass=h.lander.dryMass+h.lander.propellant;
const upper=air('orbiter',d.boosterSeparation,d.ascentEnd,split.y,h.orbiter.propellant,landerMass,d.dragAreas.upper,d.programs.orbiterOutbound.filter((a:any)=>a.start<d.ascentEnd));
const lunar=vacuum('lunar-split','orbiter',d.ascentEnd,d.lunarSeparation,upper.y,upper.fuel,landerMass,d.programs.orbiterOutbound.filter((a:any)=>a.start>=d.ascentEnd));
const parked=vacuum('orbiter-dock','orbiter',d.lunarSeparation,d.lunarDock,lunar.y,lunar.fuel,0,[]);
const land=vacuum('landing-before','lander',d.lunarSeparation,d.landing,lunar.y,h.lander.propellant,0,d.programs.lander.filter((a:any)=>a.end<=d.landing));
const capture=paidCapture(land.y,portState(d.ports[1],d.landing),{...h.lander,cargoMass:0,propellant:land.fuel},{position:2e-6,velocity:2e-6},'ground');
const ascending=vacuum('dock-before','lander',d.liftoff,d.lunarDock,portState(d.ports[1],d.liftoff),capture.propellantAfter,0,d.programs.lander.filter((a:any)=>a.start>=d.liftoff));
const dock=paidCapture(ascending.y,parked.y,{...h.lander,cargoMass:0,propellant:ascending.fuel},{position:2e-6,velocity:2e-6},'orbiter');
const returning=vacuum('entry-before','orbiter',d.lunarDock,d.entryStart,parked.y,parked.fuel,h.lander.dryMass+dock.propellantAfter,d.programs.orbiterReturn);
const enter=(part:string,t:number,y:any,fuel:number,attached:number)=>prepareEntry({...d.entry,id:d.id,name:d.name,extent:d.extent,description:d.description,provenance:d.provenance,scenario:{...scenario(part,t,t+7,y,fuel,attached),duration:7,policy:{step,maxNodes:32768,maxSubdivision:20}}},{displayRate:1});
const entry=enter('orbiter',d.entryStart,returning.y,returning.fuel,h.lander.dryMass+dock.propellantAfter);
const boost=air('booster',d.boosterSeparation,d.boosterEntryStart,split.y,split.fuel,0,d.dragAreas.booster,d.programs.booster);
const be=enter('booster',d.boosterEntryStart,boost.y,boost.fuel,0);
const result={step,rows,capture,dock,entry:{t:entry.contact.t,y:entry.contact.before,speed:entry.contact.relativeSpeed},booster:{t:be.contact.t,y:be.contact.before}};
fs.writeFileSync((process.argv[3]??'docs/design/staged-apollo')+'/convergence-'+Math.round(1/step)+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
