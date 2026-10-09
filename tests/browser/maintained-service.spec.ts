import {test,expect,type Page} from '@playwright/test';
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page,id?:string){await expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:30000}).toBe(true);}
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();const held=await state(p);await expect.poll(async()=>(await state(p)).traffic?.pending??false).toBe(false);if(held.set==='orison-maintained-service'){const acknowledged=await state(p);expect(acknowledged.t).toBe(held.t);expect(acknowledged.ships[0].y).toEqual(held.ships[0].y);}}
test('online maintained service visits repeatedly, holds history, separates corrections and survives worker changes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.stack??e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-maintained-service');await ready(page,'orison-maintained-service');await page.getByLabel('Playback speed').fill('4');
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:100000}).toBeGreaterThan(150);await pause(page);
 const head=await state(page);expect(head.traffic.stats.completed).toBeGreaterThanOrEqual(3);expect(head.traffic.stats.controllerCorrected).toBeGreaterThan(8);expect(head.traffic.stats.controllerFailed).toBe(0);expect(head.traffic.error).toBe('');expect(head.traffic.stats.viewBytes).toBeLessThan(8_000_000);expect(head.traffic.oldest).toBeGreaterThan(20);
 await page.getByLabel('Simulation time').fill('84.5');const past=await state(page);expect(past.maintenance.Meridian.propellant).toBeLessThan(.6);expect(past.ships[0].logistics.dockedPortId).toBe('Meridian');
 await page.getByRole('button',{name:'Meridian',exact:true}).click();await page.getByLabel('Camera tracking').selectOption('follow');
 for(const frame of ['rotating','Meridian','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(past.ships[0].y);}
 await page.getByLabel('Camera tracking').selectOption('chase');expect((await state(page)).ships[0].y).toEqual(past.ships[0].y);
 await expect(page.locator('[data-vessel="Meridian"] svg')).toHaveAttribute('aria-label',/small teal/);
 await page.getByLabel('Simulation time').fill('86.5');await page.screenshot({path:'docs/evidence/maintained-service.png',fullPage:true});
 await page.waitForTimeout(250);expect((await state(page)).traffic.frontier).toBe(head.traffic.frontier);
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:20000}).toBeGreaterThan(head.traffic.frontier);await pause(page);
 await page.getByLabel('Playback speed').fill('0');await page.getByTitle('Restart run').click();await ready(page,'orison-maintained-service');await pause(page);expect((await state(page)).t).toBeLessThan(2);
 for(const id of ['orison-maintained','selene-service','orison-service','orison-maintained-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
