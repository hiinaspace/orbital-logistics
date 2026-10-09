import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync('fixtures/model-sets/selene-staging.json','utf8'));
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page,id?:string){await expect.poll(async()=>{const s=await state(page);return s.ready&&(!id||s.set===id);},{timeout:20000}).toBe(true);}
async function pause(page:Page){if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(page:Page,t:number){await page.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(page)).t).toBe(t);}
test('launch assembly splits into paid delivery and booster recovery; lifetime, frames, follow and replay stay coherent',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await ready(page);await pause(page);await page.getByLabel('Model set').selectOption('selene-staging');await ready(page,'selene-staging');await pause(page);await seek(page,0);
 expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);expect((await state(page)).hits.filter((h:any)=>['kestrel','wren'].includes(h.id))).toEqual([]);
 await expect(page.locator('.timeline-row')).toHaveCount(3);await expect(page.locator('#frame option[value="wren"]')).toHaveJSProperty('disabled',true);
 await page.locator('[data-select="wren"]').click();await expect(page.locator('#object-status')).toHaveText('Attached to launch stack');await expect(page.locator('#object-frame')).toBeDisabled();
 await page.locator('[data-select="kestrel-stack"]').click();await seek(page,.55);await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.screenshot({path:'docs/evidence/staging-launch.png',fullPage:true});
 await page.getByLabel('Camera tracking').selectOption('follow');await page.getByLabel('Reference frame').selectOption('kestrel-stack');await seek(page,.8);
 expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([false,true,true]);expect((await state(page)).frame).toBe('inertial');expect((await state(page)).camera.tracking).toBe('off');await expect(page.locator('#object-status')).toHaveText('Separated');await expect(page.locator('#frame option[value="kestrel-stack"]')).toHaveJSProperty('disabled',true);
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Camera view').selectOption('oblique');await page.locator('[data-select="kestrel"]').click();await page.getByLabel('Reference frame').selectOption('kestrel');await seek(page,1.2);
 await page.locator('#layers > summary').click();await page.getByLabel('See-through bodies').check();const flying=await state(page);expect(flying.thrustWhiskers.some((w:any)=>w.vessel==='kestrel')).toBe(true);expect(flying.thrustWhiskers.flatMap((w:any)=>[...w.from,...w.to]).every(Number.isFinite)).toBe(true);
 await page.getByLabel('Reference frame').selectOption('inertial');await page.screenshot({path:'docs/evidence/staging-recovery.png',fullPage:true});
 await seek(page,4);const final=await state(page);expect(final.ships.find((s:any)=>s.id==='kestrel').logistics.dockedPortId).toBe('Cairn');expect(final.ships.find((s:any)=>s.id==='wren').logistics.dockedPortId).toBe('Lantern');expect(final.stocks.find((s:any)=>s.id==='Lantern').cargo).toBe(.1);expect(final.stocks.map((s:any)=>s.occupied)).toEqual([1,1]);
 await page.locator('[data-select="wren"]').click();await page.getByLabel('Reference frame').selectOption('wren');await page.getByLabel('Camera tracking').selectOption('chase');await seek(page,1.2);await seek(page,.6);expect((await state(page)).frame).toBe('inertial');expect((await state(page)).camera.tracking).toBe('off');await seek(page,4);expect((await state(page)).ships.map(({id,present,y,propellant,logistics}:any)=>({id,present,y,propellant,logistics}))).toEqual(final.ships.map(({id,present,y,propellant,logistics}:any)=>({id,present,y,propellant,logistics})));
 await page.locator('[data-select="kestrel-stack"]').click();await seek(page,.6);await page.locator('#next-event').click();expect((await state(page)).t).toBe(d.separation.t);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([false,true,true]);
 await page.locator('#restart').click();expect((await state(page)).t).toBe(0);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);
 await page.getByLabel('Model set').selectOption('orison-service');await ready(page,'orison-service');await pause(page);await page.getByLabel('Model set').selectOption('selene-staging');await ready(page,'selene-staging');await pause(page);await seek(page,0);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);expect(errors).toEqual([]);
});
