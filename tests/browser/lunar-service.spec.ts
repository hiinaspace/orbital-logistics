import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
test('continuous lunar ground service plays, rewinds and changes frames without restarting its physics',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('selene-ground-service');await ready(page,'selene-ground-service');
 let s=await state(page);expect(s.frame).toBe('moon');expect(s.playbackRate).toBe(.01);
 await page.getByLabel('Playback speed').fill('-5.65');
 const observations:any[]=[];const start=Date.now();
 while(Date.now()-start<60000){await page.waitForTimeout(1000);s=await state(page);observations.push({t:s.t,frontier:s.traffic.frontier,stats:s.traffic.stats,error:s.traffic.error});expect(s.traffic.error).toBe('');}
 expect(s.t).toBeGreaterThan(.9);expect(s.traffic.stats.voyages).toBeGreaterThanOrEqual(2);expect(s.traffic.stats.delivered).toBeGreaterThanOrEqual(.1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();s=await state(page);const held=s.ships[0].y;
 await page.waitForTimeout(1500);expect((await state(page)).ships[0].y).toEqual(held);
 const t=s.t-.15;await page.getByLabel('Simulation time').fill(String(Math.round(t*1000)/1000));const pose=(await state(page)).ships[0].y;
 for(const frame of ['inertial','rotating','Crescent','Tern','moon']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(pose);}
 await page.screenshot({path:'docs/evidence/lunar-service-local.png',fullPage:true});
 await page.getByRole('button',{name:'Return to live',exact:true}).click();await page.waitForTimeout(1500);expect((await state(page)).traffic.live).toBe(true);
 for(const id of ['selene-ground','orison-freight-district','selene-ground-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);}
 writeFileSync('docs/evidence/lunar-service-browser.json',JSON.stringify({observations,errors},null,2)+'\n');expect(errors).toEqual([]);
});
