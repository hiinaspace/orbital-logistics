import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
import {writeFileSync} from 'node:fs';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();const before=await state(p);await expect.poll(async()=>(await state(p)).traffic.pending,{timeout:30000}).toBe(false);expect((await state(p)).t).toBe(before.t);expect((await state(p)).ships.map((s:any)=>s.y)).toEqual(before.ships.map((s:any)=>s.y));}
test('cached whole flights operate live with two ships, smooth rockets, close views and retained rewind',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-shuttle-service');await ready(page,'orison-shuttle-service');
 expect((await state(page)).playbackRate).toBeCloseTo(.1,3);await setRate(page,2);
 await page.evaluate(()=>{const w=window as any;w.shuttleMeter={start:performance.now(),epoch:w.orbitalPlayback.epoch,last:performance.now(),maxGapMs:0,stop:false};const tick=(now:number)=>{const m=w.shuttleMeter;m.maxGapMs=Math.max(m.maxGapMs,now-m.last);m.last=now;if(!m.stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:45000}).toBeGreaterThan(40);
 const meter=await page.evaluate(()=>{const w=window as any,m=w.shuttleMeter;m.stop=true;return {...m,seconds:(performance.now()-m.start)/1000,effectiveRate:(w.orbitalPlayback.epoch-m.epoch)/((performance.now()-m.start)/1000)};});
 writeFileSync('docs/evidence/shuttle-service-playback.json',JSON.stringify(meter,null,2)+'\n');expect(meter.effectiveRate).toBeGreaterThan(1.85);expect(meter.maxGapMs).toBeLessThan(500);
 await pause(page);let s=await state(page);expect(s.traffic.error).toBe('');expect(s.traffic.stats.flightCacheEntries).toBe(2);expect(s.traffic.stats.flightCacheHits).toBeGreaterThan(3);expect(s.traffic.stats.delivered).toBeGreaterThan(.1);
 await page.getByRole('button',{name:'Tern',exact:true}).click();await page.getByLabel('Simulation time').fill('1.2');await page.getByRole('button',{name:'Surface view',exact:true}).click();
 s=await state(page);expect(s.ships[0].thrust.acceleration).toBeCloseTo(1.2,7);expect(s.ships[0].glyph).toBe('rocket');expect(s.ships[0].axis).toEqual(s.ships[0].thrust.direction);
 await page.screenshot({path:'docs/evidence/shuttle-service-launch.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('15');await page.getByRole('button',{name:'Surface view',exact:true}).click();expect((await state(page)).ships[0].thrust.acceleration).toBeCloseTo(1.2,7);
 await page.screenshot({path:'docs/evidence/shuttle-service-landing.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('25.8');const pose=(await state(page)).ships.map((s:any)=>s.y);
 for(const frame of ['rotating','Crown','Ibis','Tern','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships.map((s:any)=>s.y)).toEqual(pose);}
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:'docs/evidence/shuttle-service-network.png',fullPage:true});
 await page.getByRole('button',{name:'Return to live',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(40);
 for(const id of ['orison-low-orbit-shuttle','orison-shuttle-service']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);}
 expect(errors).toEqual([]);
});
