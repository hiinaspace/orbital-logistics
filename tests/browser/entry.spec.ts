import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page,id:string){await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:30000}).toBe(true);}
async function pause(page:Page){if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(page:Page,t:number){await page.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(page)).t).toBe(t);}
test('atmospheric density, physical force arrows, glow, entry tracking and exact ocean recovery replay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await ready(page,'orison-freight');await pause(page);await page.getByLabel('Model set').selectOption('aster-entry');await ready(page,'aster-entry');await pause(page);
 expect((await state(page)).playbackRate).toBe(.1);await seek(page,3.2);
 await page.locator('#layers > summary').click();await page.getByLabel('Aerodynamic forces').check();await page.locator('#layers > summary').click();
 const entry=await state(page),ship=entry.ships[0];expect(ship.entryPhase).toBe('entry');expect(ship.aero.density).toBeGreaterThan(0);expect(entry.aeroVectors.map((v:any)=>v.kind)).toEqual(['drag','lift']);
 const arrows=entry.aeroVectors;expect(arrows.flatMap((v:any)=>[...v.from,...v.to]).every(Number.isFinite)).toBe(true);
 for(const arrow of arrows){const vector=ship.aero[arrow.kind];const dx=arrow.to[0]-arrow.from[0],dy=arrow.to[1]-arrow.from[1];expect((dx*vector[0]-dy*vector[1])/Math.hypot(dx,dy)/Math.hypot(...vector)).toBeCloseTo(1,8);}
 await page.screenshot({path:'docs/evidence/entry-overview.png',fullPage:true});
 await page.getByRole('button',{name:'Entry view',exact:true}).click();expect((await state(page)).camera.tracking).toBe('follow');await seek(page,3.6);await page.screenshot({path:'docs/evidence/entry-close.png',fullPage:true});
 await page.locator('#layers > summary').click();await page.getByLabel('See-through bodies').check();await page.locator('#layers > summary').click();await page.getByLabel('Reference frame').selectOption('rotating');await page.getByLabel('Camera view').selectOption('oblique');await seek(page,4.2);const burning=await state(page);expect(burning.ships[0].thrust.force).toBeGreaterThan(0);expect(burning.thrustWhiskers.length).toBeGreaterThan(0);expect(burning.aeroVectors).toHaveLength(2);
 await page.getByLabel('Camera tracking').selectOption('chase');await seek(page,4.3);await page.screenshot({path:'docs/evidence/entry-terminal.png',fullPage:true});
 await page.locator('#layers > summary').click();await page.getByLabel('Atmosphere',{exact:true}).uncheck();await page.getByLabel('Entry glow').uncheck();await page.getByLabel('Aerodynamic forces').uncheck();const physical=(await state(page)).ships[0];await page.locator('#layers > summary').click();
 await seek(page,4.301);await seek(page,4.3);expect((await state(page)).ships[0].y).toEqual(physical.y);expect((await state(page)).aeroVectors).toHaveLength(0);
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Reference frame').selectOption('inertial');await page.getByLabel('Camera view').selectOption('top');await seek(page,6);
 const final=await state(page);expect(final.ships[0].entryPhase).toBe('recovered');expect(final.ships[0].thrust).toBeUndefined();expect(final.ships[0].aero).toBeUndefined();expect(final.entry.relativeSpeed).toBeLessThan(.06);expect(final.stocks).toEqual([]);await expect(page.locator('#object-status')).toHaveText('Recovered · Ocean');
 await page.locator('#schedule summary').click();await page.locator('[data-time="'+final.entry.recoveryEpoch+'"]').last().click();expect((await state(page)).t).toBe(final.entry.recoveryEpoch);expect((await state(page)).ships[0].entryPhase).toBe('recovered');
 await seek(page,3.9);await setRate(page,0.5);await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await state(page)).ships[0].entryPhase).toBe('recovered');await pause(page);
 await seek(page,4.375);expect((await state(page)).ships[0].entryPhase).toBe('braking');await seek(page,6);expect((await state(page)).ships[0].y).toEqual(final.ships[0].y);
 await page.locator('#restart').click();expect((await state(page)).ships[0].entryPhase).toBe('coast');
 for(const id of ['selene-staging','orison-service','aster-entry']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);await pause(page);}
 await seek(page,6);expect((await state(page)).ships[0].propellant).toEqual(final.ships[0].propellant);expect(errors).toEqual([]);
});
