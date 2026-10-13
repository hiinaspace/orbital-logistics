import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:60000}).toBe(true);
const seek=async(page:any,t:number)=>{await page.locator('#time').fill(String(t));await page.locator('#time').dispatchEvent('input');await expect.poll(async()=>(await state(page)).t).toBe(t);};
test('finite halo, Lissajous and paid insertion show real 3D motion in local and inertial frames',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1920,height:1080});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page,'orison-freight');const results=[];
 for(const id of ['sol-earth-halo','sol-earth-lissajous','sol-earth-observatory-insertion']){
  await page.getByLabel('Model set').selectOption(id);await ready(page,id);if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(page,54);
  let s=await state(page);expect(s.frame).toBe('libration');expect(s.camera.preset).toBe('oblique');expect(s.equilibria).toHaveLength(5);expect(s.ships[0].glyph).toBe('observatory');expect(Math.abs(s.ships[0].y[2])).toBeGreaterThan(.001);
  await page.locator('#layers summary').click();await page.getByLabel('Lagrange points',{exact:true}).check();await expect(page.getByLabel('Relief',{exact:true})).toBeHidden();await page.locator('#layers summary').click();await page.screenshot({path:`docs/evidence/${id}.png`,fullPage:true});
  await page.getByLabel('Reference frame').selectOption('rotating');const physical=(await state(page)).ships[0].y;await page.getByLabel('Reference frame').selectOption('inertial');expect((await state(page)).ships[0].y).toEqual(physical);await page.getByLabel('Reference frame').selectOption('Orison');await page.getByLabel('Camera view').selectOption('side');await page.getByLabel('Camera view').selectOption('oblique');
  await page.getByLabel('Reference frame').selectOption('libration');await seek(page,14);const fuel=(await state(page)).ships[0].propellant;await seek(page,2);await seek(page,14);expect((await state(page)).ships[0].propellant).toBe(fuel);
  await page.locator('#speed').fill('1');await page.locator('#speed').dispatchEvent('input');if(!(await state(page)).playing)await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(1000);s=await state(page);expect(s.t).toBeGreaterThan(14);await page.getByRole('button',{name:'Pause',exact:true}).click();results.push({id,state:s});
 }
 await page.getByLabel('Model set').selectOption('aster-selene-cycler-fleet-service');await ready(page,'aster-selene-cycler-fleet-service');await page.getByLabel('Model set').selectOption('sol-earth-halo');await ready(page,'sol-earth-halo');expect(errors).toEqual([]);writeFileSync('docs/evidence/libration-orbit-browser.json',JSON.stringify({results,errors},null,2)+'\n');
});
test('grid strength is stable and circular fade removes rotating rectangular corners',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await ready(page,'orison-freight');await page.getByLabel('Model set').selectOption('aster-selene-cycler-fleet-service');await ready(page,'aster-selene-cycler-fleet-service');await page.getByRole('button',{name:'Pause',exact:true}).click();await page.locator('#layers summary').click();await page.getByLabel('Relief',{exact:true}).check();const slider=page.getByRole('slider',{name:'Grid strength',exact:true});expect((await state(page)).gridStrength).toBe(.55);const first=(await slider.boundingBox())!;
 for(const value of ['0','0.1','1','0.55']){await slider.fill(value);await expect.poll(async()=>(await state(page)).gridStrength).toBe(Number(value));const rect=(await slider.boundingBox())!;expect(Math.abs(rect.x-first.x)).toBeLessThan(.5);expect(Math.abs(rect.width-first.width)).toBeLessThan(.5);}
 await page.locator('#layers summary').click();await page.getByLabel('Camera view').selectOption('oblique');await seek(page,20);await expect.poll(async()=>(await state(page)).field.mode).toBe('relief');await page.screenshot({path:'docs/evidence/relief-circular-fade.png',fullPage:true});expect((await state(page)).field.reliefError).toBe('');
});
