import {test,expect,type Page} from '@playwright/test';
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function seek(p:Page,t:number){await p.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(p)).t).toBe(t);}
const truth=(s:any)=>({ships:s.ships.map(({screen,occludedBy,...rest}:any)=>rest),maintenance:s.maintenance,events:s.events,stocks:s.stocks,t:s.t});
test('maintained relay exposes paid correction history and matches the visitor through dwell/release across camera and physical frames',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-maintained');await ready(page);await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(page,20.7);
 const s=await state(page);expect(s.selected).toBe('Meridian');expect(s.camera.preset).toBe('oblique');expect(s.maintenance.Meridian.thrust.force).toBeGreaterThan(0);expect(s.maintenance.Meridian.error.position).toBeLessThan(.02);expect(s.thrustWhiskers.some((w:any)=>w.vessel==='Meridian')).toBe(true);
 await expect(page.getByText('Maintenance fuel',{exact:true})).toBeVisible();const before=truth(s);
 await page.getByLabel('Camera tracking').selectOption('follow');expect(truth(await state(page))).toEqual(before);
 for(const frame of ['rotating','Meridian','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect(truth(await state(page))).toEqual(before);}
 const box=(await page.locator('#space').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-650);await expect.poll(async()=>(await state(page)).camera.scale).toBeGreaterThan(s.camera.scale*2);await page.screenshot({path:'docs/evidence/stationkeeping.png',fullPage:true});
 await seek(page,35);let a=await state(page);expect(a.ships[0].logistics.dockedPortId).toBe('Meridian');for(let i=0;i<6;i++)expect(a.ships[0].y[i]).toBeCloseTo(a.maintenance.Meridian.y[i],12);
 await seek(page,36);a=await state(page);expect(a.ships[0].logistics.dockedPortId).toBeUndefined();for(let i=0;i<6;i++)expect(a.ships[0].y[i]).toBeCloseTo(a.maintenance.Meridian.y[i],10);
 await seek(page,64);a=await state(page);expect(a.maintenance.Meridian.propellant).toBeLessThan(.6);expect(a.maintenance.Meridian.propellant).toBeGreaterThan(.3);expect(a.ships[0].logistics.cargoMass).toBe(.05);
 await seek(page,20.7);expect(truth(await state(page))).toEqual(before);
 for(const id of ['selene-service','orison-service','orison-steered','orison-maintained']){await page.getByLabel('Model set').selectOption(id);await ready(page);expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
