import {test,expect,type Page} from '@playwright/test';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&s.set===id;},{timeout:30000}).toBe(true);
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(p:Page,t:number){await p.getByLabel('Simulation time').fill(String(Math.round(t*1000)/1000));}
test('prepared northern atmospheric mission shows latitude, spatial staging, inclined delivery and both ocean recoveries',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await ready(page,'orison-freight');await page.getByLabel('Model set').selectOption('aster-northern-launch');await ready(page,'aster-northern-launch');await pause(page);
 let s=await state(page);expect(s.camera.preset).toBe('oblique');expect(s.playbackRate).toBe(.1);
 await seek(page,.2);s=await state(page);expect(s.ships[0].axis[2]).toBeCloseTo(Math.sin(26*Math.PI/180),8);
 await seek(page,.32);await page.getByRole('button',{name:'Surface view',exact:true}).click();s=await state(page);expect(s.camera.rig.up[2]).toBeCloseTo(Math.sin(26*Math.PI/180),8);
 await page.locator('#layers > summary').click();await page.getByLabel('Aerodynamic forces').check();await page.locator('#layers > summary').click();
 await page.screenshot({path:'docs/evidence/spatial-atmosphere-launch.png',fullPage:true});
 await seek(page,.91);expect((await state(page)).ships.slice(1).every((s:any)=>s.present&&Math.abs(s.y[2])>.5)).toBe(true);
 await page.locator('[data-select="wren"]').click();await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Reference frame').selectOption('inertial');await page.getByLabel('Camera view').selectOption('oblique');
 await page.locator('#layers > summary').click();await page.getByLabel('See-through bodies').check();await page.locator('#layers > summary').click();
 await seek(page,1.8);s=await state(page);expect(s.ships[2].logistics.dockedPortId).toBe('Lantern');expect(s.stocks.find((s:any)=>s.id==='Lantern').cargo).toBe(.1);
 await page.screenshot({path:'docs/evidence/spatial-atmosphere-orbit.png',fullPage:true});
 const pose=s.ships.map((s:any)=>s.y);
 for(const frame of ['rotating','Aster','Lantern','wren','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships.map((s:any)=>s.y)).toEqual(pose);}
 await seek(page,8.15);await page.getByRole('button',{name:'Entry view',exact:true}).click();s=await state(page);expect(s.camera.preset).toBe('custom');expect(s.camera.rig.up[2]).toBeLessThan(-.2);expect(Math.abs(s.ships[2].y[2])).toBeGreaterThan(.2);expect(s.ships[2].aero.density).toBeGreaterThan(0);expect(s.aeroVectors.some((v:any)=>v.kind==='drag')).toBe(true);
 await page.screenshot({path:'docs/evidence/spatial-atmosphere-entry.png',fullPage:true});
 await seek(page,12);const final=await state(page);expect(final.ships.slice(1).every((s:any)=>s.entryPhase==='recovered'&&s.propellant>.1)).toBe(true);
 await seek(page,8.2);await page.getByLabel('Playback speed').fill('-1');await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).ships[2].entryPhase).toBe('recovered');await pause(page);
 await seek(page,.91);expect((await state(page)).ships[2].present).toBe(true);await seek(page,12);expect((await state(page)).ships[2].y).toEqual(final.ships[2].y);
 for(const id of ['aster-launch','orison-freight-district','aster-northern-launch']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 await seek(page,12);expect((await state(page)).ships[2].propellant).toBe(final.ships[2].propellant);expect(errors).toEqual([]);
});
