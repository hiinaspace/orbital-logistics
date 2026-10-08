import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const set=JSON.parse(readFileSync('fixtures/model-sets/orison-steered.json','utf8'));
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(p:Page,t:number){await p.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(p)).t).toBe(t);}
const physical=(s:any)=>({ships:s.ships.map(({screen,occludedBy,...rest}:any)=>rest),stocks:s.stocks,events:s.events,t:s.t});
function heading(arc:any,t:number){
 const keys=arc.steering.keys,hi=keys.findIndex((k:any)=>k.offset>t-arc.start),a=keys[hi-1],b=keys[hi],x=(t-arc.start-a.offset)/(b.offset-a.offset),u=x*x*(3-2*x),dot=a.direction.reduce((v:number,k:number,i:number)=>v+k*b.direction[i],0),theta=Math.acos(Math.max(-1,Math.min(1,dot)));
 const q=a.direction.map((v:number,i:number)=>(Math.sin((1-u)*theta)*v+Math.sin(u*theta)*b.direction[i])/Math.sin(theta)),n=Math.hypot(...q);return q.map((v:number)=>v/n);
}
test('see-through bodies is optional, preserves truth and permits rear marker selection',async({page})=>{
 await page.goto('/');await ready(page);expect((await state(page)).seeThroughBodies).toBe(false);
 await page.getByLabel('Model set').selectOption('crossing-planes');await ready(page);await pause(page);await seek(page,13);await page.getByLabel('Camera view').selectOption('side');
 const baseline=await state(page);expect(baseline.ships[0].occludedBy).toBe('Orison');
 await page.locator('#layers summary').click();await page.getByLabel('See-through bodies').check();
 await expect.poll(async()=>(await state(page)).ships[0].occludedBy).toBeUndefined();const clear=await state(page);expect(clear.seeThroughBodies).toBe(true);expect(physical(clear)).toEqual(physical(baseline));expect(clear.hits.some((h:any)=>h.id==='tern')).toBe(true);
 await page.locator('#layers summary').click();const box=(await page.locator('#space').boundingBox())!;
 await page.mouse.click(box.x+clear.ships[0].screen[0],box.y+clear.ships[0].screen[1]);await expect(page.locator('#hit-menu')).toBeVisible();await page.locator('#hit-menu').getByRole('button',{name:'Tern',exact:true}).click();expect((await state(page)).selected).toBe('tern');
 await page.locator('#layers summary').click();await page.getByLabel('See-through bodies').uncheck();await expect.poll(async()=>(await state(page)).ships[0].occludedBy).toBe('Orison');
 expect(physical(await state(page))).toEqual(physical(baseline));
});
test('inclined finite transfer shows genuinely continuous steered thrust and paid docking across frames',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-steered');await ready(page);await pause(page);await seek(page,13.7);
 let s=await state(page);expect(s.camera.preset).toBe('oblique');expect(s.ships[0].thrust.acceleration).toBeLessThanOrEqual(.14+1e-12);expect(s.thrustWhiskers.length).toBeGreaterThanOrEqual(3);
 const arc=set.vessels[0].bundle.program.thrustArcs[1];for(let i=0;i<3;i++)expect(s.ships[0].thrust.direction[i]).toBeCloseTo(heading(arc,13.7)[i],12);
 const cy=Math.cos(s.camera.yaw),sy=Math.sin(s.camera.yaw),sp=Math.sin(s.camera.pitch),cp=Math.cos(s.camera.pitch);
 const directions=[];
 for(const w of s.thrustWhiskers){const d=heading(arc,w.t),x=cy*d[0]+sy*d[1],y=-sy*sp*d[0]+cy*sp*d[1]+cp*d[2],length=3+15*Math.sqrt(w.force/.25);directions.push(d);
  expect(w.to[0]-w.from[0]).toBeCloseTo(-x*length,7);expect(w.to[1]-w.from[1]).toBeCloseTo(y*length,7);
 }
 expect(Math.hypot(...directions[0].map((x:number,i:number)=>x-directions.at(-1)![i]))).toBeGreaterThan(.1);
 const baseline=physical(s);for(const frame of ['rotating','Incline','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect(physical(await state(page))).toEqual(baseline);}
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:'docs/evidence/smooth-steering.png',fullPage:true});
 const before=s.ships[0].thrust.direction;await seek(page,13.701);s=await state(page);const distance=Math.hypot(...s.ships[0].thrust.direction.map((x:number,i:number)=>x-before[i]));expect(distance).toBeGreaterThan(1e-6);expect(distance).toBeLessThan(.01);
 await seek(page,15.3);s=await state(page);expect(s.ships[0].logistics.dockedPortId).toBe('Incline');expect(s.ships[0].logistics.cargoMass).toBe(0);expect(s.stocks.find((p:any)=>p.id==='Incline').cargo).toBe(.05);expect(s.ships[0].thrust).toBeUndefined();
 expect(s.events.filter((e:any)=>e.kind==='burn')).toHaveLength(0);expect(s.events.find((e:any)=>e.id==='capture').deltaV).toBeLessThan(1e-7);
 await seek(page,13.7);expect(physical(await state(page))).toEqual(baseline);expect(errors).toEqual([]);
});
