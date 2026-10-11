import {writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();const held=await state(p);await expect.poll(async()=>(await state(p)).traffic.pending,{timeout:30000}).toBe(false);expect((await state(p)).t).toBe(held.t);expect((await state(p)).ships[0].y).toEqual(held.ships[0].y);}
test('prepared surface flights share live relay service, precise views, scrubbing and worker switches',async({page})=>{
 test.setTimeout(240000);page.setDefaultTimeout(30000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-surface-flexible');await ready(page,'orison-surface-flexible');await pause(page);
 await page.getByRole('button',{name:'Tern',exact:true}).click();await page.getByLabel('Simulation time').fill('13.4');
 await page.getByRole('button',{name:'Surface view',exact:true}).click();await setRate(page,2 ** -3.32);
 let s=await state(page);expect(s.ships[0].thrust.acceleration).toBe(3);expect(s.ships[0].thrust.force).toBeGreaterThan(10);expect(s.traffic.stats.surfaceCacheBytes).toBeLessThan(600000);
 await page.getByLabel('Camera view').selectOption('oblique');await page.locator('#layers>summary').click();await page.getByLabel('See-through bodies').check();await page.locator('#layers>summary').click();await page.screenshot({path:'docs/evidence/surface-flexible-launch.png',fullPage:true});
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByRole('button',{name:'Return to live',exact:true}).click();await setRate(page,2);
 await page.evaluate(()=>{const w=window as any,p=w.orbitalPlayback;w.surfaceMeter={start:performance.now(),epoch:p.epoch,minLead:Infinity,underflowFrames:0,maxGapMs:0,last:performance.now(),stop:false};const tick=(now:number)=>{const m=w.surfaceMeter,p=w.orbitalPlayback;m.maxGapMs=Math.max(m.maxGapMs,now-m.last);m.last=now;m.minLead=Math.min(m.minLead,p.frontier-p.epoch);if(p.frontier-p.epoch<.001)m.underflowFrames++;if(!m.stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:150000}).toBeGreaterThan(150);
 const meter=await page.evaluate(()=>{const w=window as any,m=w.surfaceMeter;m.stop=true;return {...m,seconds:(performance.now()-m.start)/1000,effectiveRate:(w.orbitalPlayback.epoch-m.epoch)/((performance.now()-m.start)/1000)};});writeFileSync('docs/evidence/surface-flexible-playback.json',JSON.stringify(meter,null,2)+'\n');expect(meter.underflowFrames).toBe(0);
 await pause(page);s=await state(page);
 expect(s.traffic.error).toBe('');expect(s.traffic.stats.completed).toBeGreaterThanOrEqual(2);expect(s.traffic.stats.controllerFailed).toBe(0);expect(Math.abs(s.traffic.stats.fuelBalanceError)).toBeLessThan(1e-10);expect(s.traffic.stats.viewBytes).toBeLessThan(8_000_000);
 await page.getByLabel('Simulation time').fill('69.95');await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.screenshot({path:'docs/evidence/surface-flexible-landing.png',fullPage:true});
 s=await state(page);expect(s.ships[0].thrust.acceleration).toBe(3);expect(s.ships[0].logistics.dockedPortId).toBeUndefined();const pose=s.ships[0].y;
 for(const frame of ['rotating','Meridian','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships[0].y).toEqual(pose);}
 await page.getByLabel('Simulation time').fill('70.31');expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Equator');expect((await state(page)).ships[0].propellant).toBeLessThan(1);
 await page.getByLabel('Simulation time').fill('73');expect((await state(page)).ships[0].propellant).toBe(6);
 for(const id of ['orison-flexible-service','aster-launch','orison-surface-flexible']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
