import {readFileSync,writeFileSync} from 'node:fs';
import {Runner} from '../src/sim/runner';
import {chromium} from '@playwright/test';
import {bodyState} from '../src/sim/dynamics';
const rows=JSON.parse(readFileSync('spikes/lunar-return/comparison.json','utf8')),old=JSON.parse(readFileSync('spikes/lunar-return/baseline-input.json','utf8'));
const paths=[];
for(const c of old.cases){const candidates=rows.filter((r:any)=>r.id===c.id&&r.accepted&&r.coast===.012).sort((a:any,b:any)=>a.dv-b.dv);for(const [kind,bundle] of [['original',c.grids[0].bundle],['coast',candidates[0]?.bundle]] as const){if(!bundle)continue;const runner=new Runner(bundle),arcs=bundle.program.thrustArcs.slice(1),start=arcs[0].start,end=arcs.at(-1).end;runner.advanceTo(bundle.scenario.epoch+bundle.scenario.duration);
paths.push({id:c.id,kind,arcs,points:Array.from({length:257},(_,i)=>{const t=start+(end-start)*i/256,p=runner.sample(t).y,m=bodyState(bundle.scenario.bodies[1],t);return {t,xyz:p.slice(0,3).map((x,j)=>(x-m[j])/.025),burn:arcs.some((a:any)=>a.start<=t&&t<=a.end)};})});}}
writeFileSync('spikes/lunar-return/paths.json',JSON.stringify(paths));

const svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" style="background:#101820;font-family:sans-serif">'];
for(const [row,id] of [0,1,4,10].entries())for(const [col,axes] of [[0,1],[0,2],[1,2]].entries()){
 const cx=165+col*330,cy=145+row*290,scale=80;
 svg.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+scale+'" fill="#263644" stroke="#557080"/>');
 svg.push('<text x="'+(cx-140)+'" y="'+(cy-120)+'" fill="white">Trip '+id+' · '+'XYZ'[axes[0]]+'XYZ'[axes[1]]+'</text>');
 for(const path of paths.filter(p=>p.id===id)){const color=path.kind==='coast'?'#ffbd77':'#73879b',points=path.points.map(p=>(cx+p.xyz[axes[0]]*scale)+','+(cy-p.xyz[axes[1]]*scale)).join(' ');svg.push('<polyline points="'+points+'" fill="none" stroke="'+color+'" stroke-width="2"/>');}
}
svg.push('<text x="20" y="1180" fill="#ffbd77">Gold: coast return · grey: original · unrotated Moon-relative coordinates</text></svg>');
writeFileSync('spikes/lunar-return/paths.svg',svg.join('\n'));
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1000,height:1200}});
await page.goto('file://'+process.cwd()+'/spikes/lunar-return/paths.svg');await page.screenshot({path:'spikes/lunar-return/paths.png'});await browser.close();
