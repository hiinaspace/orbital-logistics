import {test,expect,type Page} from '@playwright/test';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
const seek=async(p:Page,t:number)=>p.getByLabel('Simulation time').fill(String(Math.round(t*1000)/1000));
test('low orbit shuttle sustains flight, turns before departure and supports reversible viewing',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-low-orbit-shuttle');await ready(page,'orison-low-orbit-shuttle');
 await page.getByRole('button',{name:'Pause',exact:true}).click();let s=await state(page);
 expect(s.selected).toBe('Tern');expect(s.playbackRate).toBeCloseTo(.1,3);
 const launch=s.events.find((e:any)=>e.kind==='launch').t,arrival=s.events.find((e:any)=>e.kind==='dock'&&e.portId==='Crown').t,release=s.events.find((e:any)=>e.kind==='undock').t,landing=s.events.find((e:any)=>e.kind==='land').t;
 expect(arrival-launch).toBeGreaterThan(1.9);expect(s.events.filter((e:any)=>e.kind==='handoff')).toHaveLength(0);
 for(const fraction of [.1,.25,.5,.75,.9]){await seek(page,launch+(arrival-launch)*fraction);s=await state(page);expect(s.ships[0].thrust.acceleration).toBeCloseTo(1.2,8);expect(s.ships[0].axis).toEqual(s.ships[0].thrust.direction);}
 await seek(page,launch+.7);await page.getByRole('button',{name:'Surface view',exact:true}).click();
 await page.screenshot({path:'docs/evidence/surface-shuttle-launch.png',fullPage:true});
 await seek(page,arrival+.01);expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Crown');
 await seek(page,release-.3);const before=(await state(page)).ships[0];expect(before.thrust).toBeUndefined();
 await seek(page,release+.001);const after=(await state(page)).ships[0];expect(after.thrust.acceleration).toBeCloseTo(1.2,8);expect(Math.hypot(...before.axis.map((v:number,i:number)=>v-after.axis[i]))).toBeGreaterThan(.01);
 await seek(page,release-.3);expect((await state(page)).ships[0].axis).toEqual(before.axis);
 await seek(page,landing-.7);await page.getByRole('button',{name:'Surface view',exact:true}).click();s=await state(page);
 const pose=s.ships[0].y;
 for(const frame of ['rotating','Crown','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(pose);}
 await page.getByRole('button',{name:'Surface view',exact:true}).click();
 await page.screenshot({path:'docs/evidence/surface-shuttle-landing.png',fullPage:true});
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.screenshot({path:'docs/evidence/surface-shuttle-oblique.png',fullPage:true});
 await seek(page,landing+.01);s=await state(page);expect(s.ships[0].logistics.dockedPortId).toBe('Equator');expect(s.ships[0].propellant).toBeGreaterThan(.4);
 for(const id of ['orison-direct-surface','orison-low-orbit-shuttle']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await page.getByRole('button',{name:'Pause',exact:true}).click();}
 expect(errors).toEqual([]);
});
