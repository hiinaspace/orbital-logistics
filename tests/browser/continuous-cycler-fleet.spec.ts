import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {setRate} from './playback-controls';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:45000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
test('continuous fleet retains long rotating trails, funded rides and held/Live playback at 4K/16x',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:3840,height:2160});await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler-fleet-service');await ready(page,'aster-selene-cycler-fleet-service');await pause(page);
 await page.getByLabel('Reference frame').selectOption('rotating');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.locator('#layers summary').click();await page.getByRole('slider',{name:'Trail length',exact:true}).fill('1.5');expect((await state(page)).trailScale).toBe(1.5);expect((await state(page)).trailSpan).toBeGreaterThan(360);await page.locator('#layers summary').click();
 await setRate(page,16);await page.evaluate(()=>(window as any).orbitalProfile.start());await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>{const s=await state(page);if(s.traffic?.error||s.traffic?.halt)throw Error(s.traffic.error||s.traffic.halt);return s.t;},{timeout:90000}).toBeGreaterThan(900);
 const metrics=await page.evaluate(()=>(window as any).orbitalProfile.stop());await pause(page);const s=await state(page);
 expect(s.traffic.stats.cacheCompilations).toBe(1);expect(s.traffic.stats.deliveries).toBeGreaterThanOrEqual(12);expect(s.traffic.stats.maintenanceClosures).toBeGreaterThanOrEqual(6);expect(s.ships.every((v:any)=>v.propellant>=.3)).toBe(true);expect(s.traffic.stats.retainedDrawingBytes).toBeLessThan(24_000_001);
 expect(s.traffic.stats.retainedDrawingSamples).toBeLessThan(40001);expect(s.traffic.frontier-s.traffic.oldest).toBeGreaterThan(480);
 await page.screenshot({path:'docs/evidence/continuous-cycler-rotating.png',fullPage:true});
 const head=s.traffic.frontier;await page.getByLabel('Simulation time').fill(String(Math.ceil((head-180)*1000)/1000));const held=await state(page);expect(held.traffic.live).toBe(false);expect(held.t).toBeLessThan(head-170);await page.screenshot({path:'docs/evidence/continuous-cycler-held.png',fullPage:true});
 await setRate(page,-4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(held.t);await pause(page);
 await page.locator('#live').click();await expect.poll(async()=>(await state(page)).traffic.live).toBe(true);await pause(page);
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByLabel('Reference frame').selectOption('inertial');await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:'docs/evidence/continuous-cycler-inertial.png',fullPage:true});
 const timeline=page.locator('#timelines'),box=(await timeline.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+4);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-80,{steps:5});await page.mouse.up();expect((await timeline.boundingBox())!.height).toBeGreaterThan(box.height+20);
 for(const id of ['aster-selene-cycler-fleet','aster-selene-system','aster-selene-cycler-fleet-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 expect((await state(page)).trailScale).toBe(1.5);
 const summary=Object.fromEntries(Object.entries(metrics).map(([k,v])=>{const a=(v as number[]).sort((x,y)=>x-y);return [k,{n:a.length,p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)}];}));writeFileSync('docs/evidence/continuous-cycler-browser.json',JSON.stringify({summary,errors,stats:s.traffic.stats,head:s.traffic.frontier,time:s.t},null,2)+'\n');expect(errors).toEqual([]);
});
