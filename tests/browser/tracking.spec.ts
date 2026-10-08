import {test,expect,type Page} from '@playwright/test';
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function seek(p:Page,t:number){await p.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(p)).t).toBe(t);}
const physical=(s:any)=>({ships:s.ships.map(({screen,occludedBy,...rest}:any)=>rest),stocks:s.stocks,events:s.events,t:s.t,frame:s.frame});
test('follow holds the selected ship at close zoom without changing inertial trajectories; chase and rewind are deterministic',async({page})=>{
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-steered');await ready(page);await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(page,1.3);
 const before=await state(page);await page.getByLabel('Camera tracking').selectOption('follow');let s=await state(page);expect(physical(s)).toEqual(physical(before));expect(s.camera.yaw).toBe(before.camera.yaw);expect(s.camera.pitch).toBe(before.camera.pitch);
 const box=(await page.locator('#space').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-2000);
 await seek(page,2);s=await state(page);expect(s.camera.scale).toBeGreaterThan(before.camera.scale*10);for(let i=0;i<3;i++)expect(s.camera.center[i]).toBeCloseTo(s.ships[0].y[i],12);expect(s.frame).toBe('inertial');
 expect(s.ships[0].screen[0]).toBeCloseTo(box.width/2,6);expect(s.ships[0].screen[1]).toBeCloseTo(box.height/2,6);
 await page.getByLabel('Camera tracking').selectOption('chase');const chased=await state(page);expect(physical(chased)).toEqual(physical(s));expect(chased.camera.rig).toBeDefined();await seek(page,13.7);expect((await state(page)).camera.rig).not.toEqual(chased.camera.rig);
 await seek(page,2);expect((await state(page)).camera).toEqual(chased.camera);
 await page.getByLabel('Camera tracking').selectOption('off');const frozen=(await state(page)).camera;await seek(page,3);expect((await state(page)).camera).toEqual(frozen);
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Camera view').selectOption('oblique');await page.getByLabel('Camera tracking').selectOption('follow');await seek(page,13.7);await page.screenshot({path:'docs/evidence/camera-follow.png',fullPage:true});
 await page.getByLabel('Model set').selectOption('crossing-planes');await ready(page);expect((await state(page)).camera.tracking).toBe('off');
});
test('orbit gestures rotate about the selected object while preserving its projected position',async({page})=>{
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-steered');await ready(page);await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(page,2);
 const before=await state(page),box=(await page.locator('#space').boundingBox())!;
 await page.mouse.move(box.x+box.width*.8,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.8+80,box.y+box.height*.3+30,{steps:8});await page.mouse.up();
 await expect.poll(async()=>(await state(page)).camera.preset).toBe('custom');const after=await state(page);expect(physical(after)).toEqual(physical(before));for(let i=0;i<2;i++)expect(after.ships[0].screen[i]).toBeCloseTo(before.ships[0].screen[i],7);
});
