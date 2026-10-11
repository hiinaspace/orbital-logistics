import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page,id:string){await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:30000}).toBe(true);}
async function pause(page:Page){if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(page:Page,t:number){await page.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(page)).t).toBe(t);}
test('atmospheric stack, boostback, orbital delivery, both recoveries and view switches',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await ready(page,'orison-freight');await pause(page);await page.getByLabel('Model set').selectOption('aster-launch');await ready(page,'aster-launch');await pause(page);
 expect((await state(page)).playbackRate).toBe(.1);await seek(page,.57);const launch=await state(page);
 expect(launch.ships.filter((s:any)=>s.present)).toHaveLength(1);expect(launch.ships[0].thrust.id).toBe('boost');expect(launch.ships[0].aero.density).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.locator('#layers > summary').click();await page.getByLabel('Aerodynamic forces').check();await page.locator('#layers > summary').click();
 expect((await state(page)).aeroVectors.some((v:any)=>v.kind==='drag')).toBe(true);await page.screenshot({path:'docs/evidence/atmospheric-launch-close.png',fullPage:true});
 await seek(page,.9);expect((await state(page)).ships[0].present).toBe(false);expect((await state(page)).ships.slice(1).every((s:any)=>s.present)).toBe(true);
 await page.locator('[data-select="wren"]').click();await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Reference frame').selectOption('inertial');await page.getByLabel('Camera view').selectOption('oblique');
 await page.locator('#layers > summary').click();await page.getByLabel('See-through bodies').check();await page.locator('#layers > summary').click();
 await seek(page,1.05);expect((await state(page)).ships[2].thrust.id).toBe('insertion');expect((await state(page)).ships[2].entryPhase).toBeUndefined();expect((await state(page)).thrustWhiskers.some((s:any)=>s.vessel==='wren')).toBe(true);
 const arrival=(await state(page)).events.find((e:any)=>e.vessel==='wren'&&e.kind==='dock').t;await page.locator('#schedule summary').click();await page.locator('[data-time="'+arrival+'"]').first().click();await expect.poll(async()=>(await state(page)).t).toBe(arrival);
 expect((await state(page)).ships[2].logistics.dockedPortId).toBe('Lantern');expect((await state(page)).ships[2].mass).toBeGreaterThan(.5);
 await page.locator('[data-time="'+(arrival+.3)+'"]').first().click();expect((await state(page)).stocks.find((s:any)=>s.id==='Lantern').cargo).toBe(.1);
 await page.screenshot({path:'docs/evidence/atmospheric-mission-orbit.png',fullPage:true});
 await seek(page,4.2);expect((await state(page)).ships[1].entryPhase).toBe('recovered');expect((await state(page)).ships[2].logistics.cargoMass).toBe(0);
 await seek(page,8.1);await page.getByRole('button',{name:'Entry view',exact:true}).click();
 await page.screenshot({path:'docs/evidence/atmospheric-mission-return.png',fullPage:true});expect((await state(page)).ships[2].aero.density).toBeGreaterThan(0);expect((await state(page)).ships[2].mass).toBeLessThan(.5);
 await seek(page,12);const final=await state(page);expect(final.ships.slice(1).every((s:any)=>s.entryPhase==='recovered'&&s.propellant>0)).toBe(true);
 await expect(page.locator('#object-status')).toHaveText('Recovered · Ocean');await expect(page.locator('#readouts')).toContainText('0.0387');expect(final.stocks.every((s:any)=>s.occupied===0)).toBe(true);
 // Actual playback crosses terminal guidance and recovery, then deterministic rewind.
 await seek(page,8.2);await setRate(page,0.5);await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).ships[2].entryPhase).toBe('recovered');await pause(page);
 await seek(page,1.05);expect((await state(page)).ships[2].thrust.id).toBe('insertion');await seek(page,12);expect((await state(page)).ships[2].y).toEqual(final.ships[2].y);
 for(const id of ['aster-entry','selene-staging','orison-service','aster-launch']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 await seek(page,12);expect((await state(page)).ships[2].propellant).toBe(final.ships[2].propellant);expect(errors).toEqual([]);
});
