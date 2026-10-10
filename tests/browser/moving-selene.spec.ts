import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('fixtures/model-sets/selene-ground.json','utf8'));
const arcs=fixture.vessels[0].bundle.program.thrustArcs;
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
test('moving lunar ground service stays spatial through delivery, return and local surface cameras',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('selene-ground');await ready(page,'selene-ground');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 let s=await state(page);expect(s.frame).toBe('moon');expect(s.camera.preset).toBe('oblique');expect(s.playbackRate).toBe(.01);
 await page.getByLabel('Simulation time').fill('0.04');s=await state(page);
 expect(s.ships[0].thrust.acceleration).toBeCloseTo(38.4,8);expect(Math.abs(s.ships[0].y[2])).toBeGreaterThan(.005);expect(Math.abs(s.ships[0].y[5])).toBeGreaterThan(.01);
 await page.screenshot({path:'docs/evidence/moving-selene-local.png',fullPage:true});
 const pose=s.ships[0].y;
 for(const frame of ['inertial','rotating','Crescent','Tern','moon']){
  await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(pose);
  if(frame==='inertial')await page.screenshot({path:'docs/evidence/moving-selene-overview.png',fullPage:true});
 }
 await page.getByLabel('Simulation time').fill('0.016');await page.getByRole('button',{name:'Surface view',exact:true}).click();s=await state(page);
 expect(s.frame).toBe('Northhaven');expect(s.camera.rig.up[2]).toBeCloseTo(Math.sin(20*Math.PI/180),10);
 expect(s.camera.scale).toBeGreaterThan(10000);expect(s.camera.center[2]).toBeCloseTo(.025*.075*Math.sin(20*Math.PI/180),10);
 await page.screenshot({path:'docs/evidence/moving-selene-launch.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('0.1');s=await state(page);
 expect(s.ships[0].logistics.dockedPortId).toBe('Crescent');expect(s.stocks.find((p:any)=>p.id==='Crescent').cargo).toBe(.05);
 await page.getByLabel('Simulation time').fill('0.378');await page.getByRole('button',{name:'Surface view',exact:true}).click();
 await page.screenshot({path:'docs/evidence/moving-selene-landing.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('0.4');s=await state(page);
 expect(s.ships[0].logistics.dockedPortId).toBe('Northhaven');expect(s.ships[0].propellant).toBeGreaterThan(.1);
 expect(s.ships[0].axis[2]).toBeCloseTo(Math.sin(20*Math.PI/180),10);
 const states=[s];
 // Playback through the exact landing event, then finite replay through the launch.
 await page.getByLabel('Simulation time').fill('0.37');await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).ships[0].logistics?.dockedPortId,{timeout:8000}).toBe('Northhaven');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.locator('#replay').check();await page.getByLabel('Simulation time').fill('0.499');await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).t,{timeout:5000}).toBeLessThan(.02);
 await page.getByRole('button',{name:'Pause',exact:true}).click();states.push(await state(page));
 for(const id of ['selene-powered','orison-freight-district','selene-ground']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);}
 writeFileSync('docs/evidence/moving-selene-browser.json',JSON.stringify({arcs,states,errors},null,2)+'\n');expect(errors).toEqual([]);
});
