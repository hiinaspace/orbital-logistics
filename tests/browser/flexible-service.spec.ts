import {test,expect,type Page} from '@playwright/test';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();const held=await state(p);await expect.poll(async()=>(await state(p)).traffic.pending,{timeout:30000}).toBe(false);const ack=await state(p);expect(ack.t).toBe(held.t);expect(ack.ships[0].y).toEqual(held.ships[0].y);}
test('flexible service delivers relay fuel, rides loaded maintenance, preserves scrubbing and switches workers',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack??e.message);});
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-flexible-service');await ready(page,'orison-flexible-service');await page.getByLabel('Playback speed').fill('2');
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:140000}).toBeGreaterThan(136);await pause(page);
 const head=await state(page);expect(head.traffic.stats.completed).toBeGreaterThanOrEqual(2);expect(head.traffic.stats.fuelDelivered).toBeGreaterThan(.06);expect(head.traffic.stats.controllerFailed).toBe(0);expect(Math.abs(head.traffic.stats.fuelBalanceError)).toBeLessThan(1e-10);expect(head.traffic.stats.viewBytes).toBeLessThan(8_000_000);expect(head.traffic.error).toBe('');
 await page.getByLabel('Simulation time').fill('24.5');const past=await state(page);expect(past.ships[0].logistics.dockedPortId).toBe('Meridian');expect(past.ships[0].thrust).toBeUndefined();expect(past.maintenance.Meridian.thrust.force).toBeGreaterThan(0);expect(past.maintenance.Meridian.mass).toBeGreaterThan(6);
 for(const frame of ['rotating','Meridian','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(past.ships[0].y);}
 await expect(page.locator('#event-list')).toContainText('Deliver fuel');await page.getByRole('button',{name:'Meridian',exact:true}).click();await page.screenshot({path:'docs/evidence/flexible-service.png',fullPage:true});
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:30000}).toBeGreaterThan(head.traffic.frontier);await pause(page);
 for(const id of ['orison-maintained-service','selene-freight','orison-flexible-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
