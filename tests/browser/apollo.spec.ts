import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-expedition.json','utf8'));
test('planet–moon expedition, both surface views, entry, rewind and switching',async({page})=>{
 test.setTimeout(60000);
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 const state=async()=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
 const ready=async(id:string)=>expect.poll(async()=>{const s=await state();return s.ready&&s.set===id;},{timeout:30000}).toBe(true);
 const pause=async()=>{if((await state()).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
 const seek=async(t:number)=>{t=Math.round(t*1000)/1000;await page.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state()).t).toBe(t);};
 await page.goto('/');await ready('orison-freight');await pause();
 await page.getByLabel('Model set').selectOption(fixture.id);await ready(fixture.id);await pause();
 // Scrubs at exact samples skipped the failing support-to-flight interpolation.
 // Let requestAnimationFrame carry playback across release at ordinary speed.
 await seek(fixture.launch-.03);
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state()).t,{timeout:5000}).toBeGreaterThan(fixture.launch+.03);
 await pause();expect(errors).toEqual([]);
 await seek(.5);expect((await state()).ships[0].thrust.id).toBe('boost');
 await page.getByRole('button',{name:'Surface view',exact:true}).click();expect((await state()).frame).toBe('Cairn');
 await page.screenshot({path:'docs/evidence/apollo-launch.png',fullPage:true});
 await seek(22);await page.getByLabel('Reference frame').selectOption('rotating');
 expect(await page.getByLabel('Reference frame').locator('option:checked').textContent()).toBe('Aster–Selene rotating');
 expect((await state()).frame).toBe('rotating');
 await page.getByLabel('Reference frame').selectOption('inertial');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.getByLabel('Camera view').selectOption('oblique');await page.screenshot({path:'docs/evidence/apollo-transfer.png',fullPage:true});
 await seek(fixture.landing+.5);expect((await state()).ships[0].logistics.dockedPortId).toBe('Tranquility');
 await page.getByRole('button',{name:'Surface view',exact:true}).click();expect((await state()).frame).toBe('Tranquility');
 await page.screenshot({path:'docs/evidence/apollo-moon.png',fullPage:true});
 await seek(fixture.liftoff+.2);expect((await state()).ships[0].thrust.id).toBe('lunar-ascent');
 const recovery=(await state()).recoveries.Odyssey.recoveryEpoch;
 await seek(recovery-.8);await page.getByRole('button',{name:'Entry view',exact:true}).click();
 expect(['entry','braking']).toContain((await state()).ships[0].entryPhase);
 await page.screenshot({path:'docs/evidence/apollo-entry.png',fullPage:true});
 await seek(87);const final=(await state()).ships[0];expect(final.entryPhase).toBe('recovered');expect(final.propellant).toBeGreaterThan(2);
 await seek(22);await seek(87);expect((await state()).ships[0].y).toEqual(final.y);
 await seek(0);await page.getByLabel('Playback speed').fill('4');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state()).t,{timeout:20000}).toBe(87);
 expect((await state()).playing).toBe(false);expect(errors).toEqual([]);
 for(const id of ['selene-ground-service',fixture.id]){await page.getByLabel('Model set').selectOption(id);await ready(id);await pause();}
 await seek(87);expect((await state()).ships[0].propellant).toBe(final.propellant);expect(errors).toEqual([]);
});
