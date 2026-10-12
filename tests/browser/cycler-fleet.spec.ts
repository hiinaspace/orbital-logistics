import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {setRate} from './playback-controls';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:45000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
test('later-pass fleet plays, scrubs ownership exchanges and remains responsive at 4K/16x',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:3840,height:2160});await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler-fleet');await ready(page,'aster-selene-cycler-fleet');await pause(page);
 const initial=await state(page);expect(initial.ships).toHaveLength(4);
 for(const [t,frame,actor,name] of [[90,'inertial','Pipit','lunar-dwell'],[126,'Selene','Pipit','lunar-parking'],[132.5,'Selene','Pipit','later-connection'],[136.5,'rotating','Nomad','second-carrier'],[155,'inertial','Wren','fleet']] as const){
  await page.getByLabel('Simulation time').fill(String(t));await page.getByLabel('Reference frame').selectOption(frame);await page.getByRole('button',{name:'Fit',exact:true}).click();await page.locator(`#fleet [data-object="${actor}"]`).click();
  const s=await state(page);for(const id of ['Wayfarer','Nomad']){expect(s.ships.find((v:any)=>v.id===id).thrust).toBeUndefined();expect(s.ships.find((v:any)=>v.id===id).propellant).toBe(6);}
  await page.screenshot({path:`docs/evidence/cycler-fleet-${name}.png`,fullPage:true});
 }
 for(const [actor,t,parent] of [['Pipit',56,'Wayfarer'],['Pipit',136.252338163614,'Nomad'],['Wren',116.25233816361401,'Nomad'],['Wren',196.50467632722803,'Wayfarer']] as const){
  await page.getByLabel('Simulation time').fill(String(Math.ceil((t+.000001)*1000)/1000));const s=await state(page);expect(s.ships.find((v:any)=>v.id===actor).opacity).toBe(0);expect(s.ships.find((v:any)=>v.id===actor).y).toEqual(s.ships.find((v:any)=>v.id===parent).y);
 }
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByLabel('Reference frame').selectOption('rotating');await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Simulation time').fill('0');await setRate(page,16);await page.evaluate(()=>(window as any).orbitalProfile.start());await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).t,{timeout:45000}).toBeGreaterThan(223.5);const metrics=await page.evaluate(()=>(window as any).orbitalProfile.stop());await pause(page);
 const end=await state(page);expect(end.passThrough.resources.cargoExported).toBeCloseTo(.6,12);expect(end.ships.every((v:any)=>v.propellant>=0)).toBe(true);
 await setRate(page,-4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(end.t);await pause(page);
 for(const id of ['aster-selene-system','aster-selene-cycler','aster-selene-cycler-fleet']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 const summary=Object.fromEntries(Object.entries(metrics).map(([k,v])=>{const a=(v as number[]).sort((x,y)=>x-y);return [k,{n:a.length,p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)}];}));writeFileSync('docs/evidence/cycler-fleet-browser.json',JSON.stringify({summary,errors,work:end.passThrough.work,resources:end.passThrough.resources},null,2)+'\n');expect(errors).toEqual([]);
});
