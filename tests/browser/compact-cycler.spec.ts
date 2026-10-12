import {test,expect} from '@playwright/test';
import {setRate} from './playback-controls';
import {writeFileSync} from 'node:fs';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:45000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
test('compact finite cycler has physical transfers, boarding, frames and reversible playback',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler');await ready(page,'aster-selene-cycler');await pause(page);
 for(const [t,frame,actor,name] of [[7,'inertial','Pipit','launch'],[25,'rotating','Wayfarer','coast'],[19,'inertial','Pipit','aster-landing'],[23,'inertial','Pipit','aster-launch'],[67,'rotating','Pipit','moon-return']] as const){
  await page.getByLabel('Simulation time').fill(String(t));await page.getByLabel('Reference frame').selectOption(frame);await page.getByRole('button',{name:'Fit',exact:true}).click();await page.locator(`#fleet [data-object="${actor}"]`).click();
  await page.screenshot({path:`docs/evidence/compact-refinement-${name}.png`,fullPage:true});expect((await state(page)).ships.every((v:any)=>v.propellant>=0)).toBe(true);
 }
 for(const t of [9,16,25,65]){await page.getByLabel('Simulation time').fill(String(t));const q=(await state(page)).ships.find((v:any)=>v.id==='Pipit');expect(q.opacity===0).toBe(t===9||t===25);}
 await page.getByLabel('Simulation time').fill('20');const restored=(await state(page)).ships.find((v:any)=>v.id==='Pipit');expect(restored.propellant).toBe(3);
 await page.getByLabel('Simulation time').fill('19.5');expect((await state(page)).ships.find((v:any)=>v.id==='Pipit').propellant).toBeLessThan(3);
 await page.getByLabel('Simulation time').fill('0');await page.getByLabel('Reference frame').selectOption('inertial');await page.locator('#fleet [data-object="Wayfarer"]').click();await setRate(page,4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t,{timeout:30000}).toBeGreaterThan(73);await pause(page);
 expect(errors).toEqual([]);
});
test('compact continuous cache holds resource history and keeps up at 16x',async({page})=>{
test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:3840,height:2160});await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler-service');await ready(page,'aster-selene-cycler-service');await pause(page);await setRate(page,16);await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.evaluate(()=>(window as any).orbitalProfile.start());await expect.poll(async()=>(await state(page)).t,{timeout:60000}).toBeGreaterThan(240);
 const profile=await page.evaluate(()=>(window as any).orbitalProfile.stop());await pause(page);const q=await state(page);expect(q.traffic.halt).toBeFalsy();expect(q.traffic.error).toBeFalsy();expect(q.traffic.stats.deliveries).toBeGreaterThanOrEqual(6);
 await page.getByLabel('Simulation time').evaluate((input:HTMLInputElement,time:number)=>{input.value=String(time);input.dispatchEvent(new Event('input',{bubbles:true}));},q.traffic.oldest+2);const held=await state(page);await page.waitForTimeout(1000);expect((await state(page)).ships).toEqual(held.ships);
 await setRate(page,-4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(held.t);await pause(page);
 await page.getByRole('button',{name:'Return to live',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(held.t);
 for(const id of ['aster-selene-system','solar-cycler','aster-selene-cycler-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 const summary=Object.fromEntries(Object.entries(profile).map(([k,v])=>{const a=(v as number[]).sort((x,y)=>x-y);return [k,{n:a.length,p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)}];}));
 writeFileSync('docs/evidence/compact-refinement-browser.json',JSON.stringify({summary,stats:q.traffic.stats,errors},null,2)+'\n');expect(errors).toEqual([]);
});
