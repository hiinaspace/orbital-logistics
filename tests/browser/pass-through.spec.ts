import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {setRate} from './playback-controls';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:45000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};

test('pass-through service shows real parking, unpowered circuits, captures and rewind',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1920,height:1080});await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler');await ready(page,'aster-selene-cycler');await pause(page);
 expect(await page.getByLabel('Model set').locator('option[value="aster-selene-cycler-service"]').count()).toBe(0);
 expect(await page.getByRole('button',{name:'Live',exact:true}).count()).toBe(0);
 for(const [t,frame,actor,name] of [[2,'Cairn','Pipit','ascent'],[30,'inertial','Pipit','parking'],[52,'inertial','Pipit','phasing'],[68,'Selene','Pipit','lunar-braking'],[72,'Haven','Pipit','lunar-descent'],[96,'inertial','Pipit','return-parking'],[102.3,'Cairn','Pipit','aster-descent'],[70,'rotating','Wayfarer','carrier']] as const){
  await page.getByLabel('Simulation time').fill(String(t));await page.getByLabel('Reference frame').selectOption(frame);await page.getByRole('button',{name:'Fit',exact:true}).click();await page.locator(`#fleet [data-object="${actor}"]`).click();
  const s=await state(page);expect(s.ships.find((v:any)=>v.id==='Wayfarer').thrust).toBeUndefined();expect(s.ships.every((v:any)=>v.propellant>=0)).toBe(true);
  if(t===30||t===96)expect(s.ships.find((v:any)=>v.id==='Pipit').thrust).toBeUndefined();
  await page.screenshot({path:`docs/evidence/pass-through-${name}.png`,fullPage:true});
 }
 for(const [t,hidden] of [[56,true],[66,false],[79.5,true],[83.5,false]] as const){await page.getByLabel('Simulation time').fill(String(t));expect((await state(page)).ships.find((v:any)=>v.id==='Pipit').opacity===0).toBe(hidden);}
 await page.getByLabel('Simulation time').fill('74');expect((await state(page)).ships.find((v:any)=>v.id==='Pipit').propellant).toBe(3);
 await page.getByLabel('Simulation time').fill('73.5');expect((await state(page)).ships.find((v:any)=>v.id==='Pipit').propellant).toBeGreaterThan(.3);
 await page.getByLabel('Simulation time').fill('220');const later=await state(page);await setRate(page,-4);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(later.t);await pause(page);
 await page.getByLabel('Simulation time').fill('0');expect((await state(page)).passThrough.resources.fuelImported).toBe(0);
 expect(errors).toEqual([]);
});

test('finite two-circuit playback remains responsive at 4K/16x and switches cleanly',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:3840,height:2160});await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-cycler');await ready(page,'aster-selene-cycler');await pause(page);
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByLabel('Reference frame').selectOption('rotating');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.getByLabel('Simulation time').fill('0');await setRate(page,16);await page.evaluate(()=>(window as any).orbitalProfile.start());await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).t,{timeout:45000}).toBeGreaterThan(240);
 const profile=await page.evaluate(()=>(window as any).orbitalProfile.stop());await pause(page);const s=await state(page);
 expect(s.passThrough.resources.cargoExported).toBeCloseTo(.6,12);expect(s.ships.find((v:any)=>v.id==='Wayfarer').propellant).toBe(6);expect(s.ships.find((v:any)=>v.id==='Pipit').propellant).toBe(3);
 await page.getByLabel('Simulation time').fill('52');await page.locator('#fleet [data-object="Pipit"]').click();await page.getByLabel('Camera tracking').selectOption('follow');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.getByLabel('Camera tracking').selectOption('chase');await page.screenshot({path:'docs/evidence/pass-through-3d.png',fullPage:true});
 for(const id of ['aster-selene-system','solar-cycler','aster-selene-cycler']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 const summary=Object.fromEntries(Object.entries(profile).map(([k,v])=>{const a=(v as number[]).sort((x,y)=>x-y);return [k,{n:a.length,p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)}];}));
 writeFileSync('docs/evidence/pass-through-browser.json',JSON.stringify({summary,work:s.passThrough.work,resources:s.passThrough.resources,errors},null,2)+'\n');expect(errors).toEqual([]);
});
