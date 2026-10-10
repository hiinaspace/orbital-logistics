import {test,expect,type Page} from '@playwright/test';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
test('direct surface flight supports close inspection, event scrubbing and cached/live set switching',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-direct-surface');await ready(page,'orison-direct-surface');
 await page.getByRole('button',{name:'Pause',exact:true}).click();let s=await state(page);
 expect(s.selected).toBe('Tern');expect(s.playbackRate).toBeCloseTo(.1,3);expect(s.traffic).toBeUndefined();
 const launch=s.events.find((e:any)=>e.kind==='launch').t,arrival=s.events.find((e:any)=>e.kind==='dock'&&e.portId==='Meridian').t,landing=s.events.find((e:any)=>e.kind==='land').t;
 expect(s.events.filter((e:any)=>e.kind==='handoff')).toHaveLength(0);
 await page.getByLabel('Simulation time').fill(String(Math.round((launch+.17)*1000)/1000));await page.getByRole('button',{name:'Surface view',exact:true}).click();
 s=await state(page);expect(s.ships[0].thrust.acceleration).toBeCloseTo(3,8);expect(s.ships[0].glyph).toBe('rocket');
 await page.screenshot({path:'docs/evidence/direct-surface-launch.png',fullPage:true});
 await page.getByLabel('Simulation time').fill(String(Math.round((launch+1.5)*1000)/1000));await page.getByLabel('Reference frame').selectOption('inertial');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.screenshot({path:'docs/evidence/direct-surface-flight.png',fullPage:true});expect((await state(page)).ships[0].thrust).toBeUndefined();
 const ignition=s.events.filter((e:any)=>e.kind==='thrust-start'&&e.vessel==='Tern')[1].t;
 await page.getByLabel('Simulation time').fill(String(Math.round((ignition-.5)*1000)/1000));const held=(await state(page)).ships[0].axis;
 await page.getByLabel('Simulation time').fill(String(Math.round((ignition-.3)*1000)/1000));const turning=(await state(page)).ships[0].axis;
 expect(Math.hypot(...held.map((v:number,i:number)=>v-turning[i]))).toBeGreaterThan(.01);
 await page.getByLabel('Simulation time').fill(String(Math.round((ignition-.001)*1000)/1000));const preIgnition=(await state(page)).ships[0];
 expect(preIgnition.thrust).toBeUndefined();
 await page.getByLabel('Simulation time').fill(String(Math.round((ignition+.001)*1000)/1000));const firing=(await state(page)).ships[0];
 expect(firing.axis).toEqual(firing.thrust.direction);expect(Math.hypot(...preIgnition.axis.map((v:number,i:number)=>v-firing.axis[i]))).toBeLessThan(.001);
 await page.getByLabel('Simulation time').fill(String(Math.round((ignition-.3)*1000)/1000));expect((await state(page)).ships[0].axis).toEqual(turning);
 await page.getByLabel('Simulation time').fill(String(Math.round((arrival+.01)*1000)/1000));expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Meridian');
 await page.getByLabel('Simulation time').fill(String(Math.round((landing-.17)*1000)/1000));await page.getByRole('button',{name:'Surface view',exact:true}).click();
 s=await state(page);const pose=s.ships[0].y;expect(s.ships[0].thrust.acceleration).toBeCloseTo(3,8);
 for(const frame of ['rotating','Meridian','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(pose);}
 await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.getByLabel('Camera view').selectOption('oblique');await page.locator('#layers>summary').click();await page.getByLabel('See-through bodies').check();await page.locator('#layers>summary').click();
 await page.getByLabel('Camera view').selectOption('top');await page.locator('#layers>summary').click();await page.getByLabel('See-through bodies').uncheck();await page.locator('#layers>summary').click();
 await page.screenshot({path:'docs/evidence/direct-surface-landing.png',fullPage:true});
 await page.getByLabel('Simulation time').fill(String(Math.round((landing+.01)*1000)/1000));s=await state(page);expect(s.ships[0].logistics.dockedPortId).toBe('Equator');expect(s.ships[0].propellant).toBeGreaterThan(.05);
 for(const id of ['orison-surface-flexible','orison-direct-surface']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await page.getByRole('button',{name:'Pause',exact:true}).click();}
 expect(errors).toEqual([]);
});
