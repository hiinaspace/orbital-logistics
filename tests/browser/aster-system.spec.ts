import {test,expect} from '@playwright/test';
import {setRate} from './playback-controls';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:50000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
test('full Aster–Selene service joins staged flight, courier, free satellites and responsive lanes',async({page})=>{
 test.setTimeout(200000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-system');await ready(page,'aster-selene-system');await pause(page);
 expect((await state(page)).ships).toHaveLength(7);expect((await state(page)).stocks).toHaveLength(4);
 const label=page.locator('.timeline-name[data-select="Atlas-stack"]');await expect(label).toHaveAttribute('title','Atlas · Odyssey · Eagle');
 for(const viewport of [{width:1440,height:900},{width:3840,height:2160},{width:390,height:844}]){
  await page.setViewportSize(viewport);expect(await label.evaluate((e:any)=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(26);
  expect(await page.locator('.timeline-track').first().evaluate((e:any)=>e.getBoundingClientRect().width)).toBeGreaterThan(160);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});await page.getByLabel('Simulation time').fill('20');
 await page.locator('#fleet [data-object="Kestrel"]').click();await expect(page.locator('#readouts')).toContainText('Relay parcels');
 await page.getByLabel('Reference frame').selectOption('rotating');await page.getByLabel('Camera view').selectOption('oblique');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.screenshot({path:'docs/evidence/aster-system.png',fullPage:true});
 await setRate(page,16);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t,{timeout:90000}).toBeGreaterThan(330);await pause(page);
 const s=await state(page);expect(s.traffic.error).toBe('');expect(s.traffic.stats.cacheCompilations).toBe(2);expect(s.traffic.stats.parcelsDelivered).toBeGreaterThan(1);expect(s.traffic.stats.completedTrips).toBeGreaterThanOrEqual(3);expect(s.traffic.stats.orbiterFaults).toBe(0);expect(s.traffic.stats.physicalNodes).toBeLessThan(200000);
 const head=s.traffic.frontier;await setRate(page,-4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(s.t-1);await pause(page);expect((await state(page)).traffic.frontier).toBeLessThanOrEqual(head+1);
 await page.getByRole('button',{name:'Return to live',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(s.t);await pause(page);
 for(const id of ['aster-selene-beacon','aster-selene-staged-service','aster-selene-system']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 expect((await state(page)).traffic.error).toBe('');expect(errors).toEqual([]);
});
