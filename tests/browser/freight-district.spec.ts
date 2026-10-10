import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
const ready=async(p:Page,id?:string)=>expect.poll(async()=>{const s=await state(p);return s.ready&&(!id||s.set===id);},{timeout:60000}).toBe(true);
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();const a=await state(p);await expect.poll(async()=>(await state(p)).traffic.pending,{timeout:30000}).toBe(false);const b=await state(p);expect(b.t).toBe(a.t);expect(b.ships.map((s:any)=>s.y)).toEqual(a.ships.map((s:any)=>s.y));}
async function meter(p:Page,rate:number){
 await p.getByLabel('Playback speed').fill(String(Math.log2(rate)));
 await p.evaluate(()=>{const w=window as any;w.districtMeter={start:performance.now(),epoch:w.orbitalPlayback.epoch,last:performance.now(),maxGapMs:0,stop:false};const tick=(now:number)=>{const m=w.districtMeter;m.maxGapMs=Math.max(m.maxGapMs,now-m.last);m.last=now;if(!m.stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await p.waitForTimeout(18000);
 return p.evaluate(()=>{const w=window as any,m=w.districtMeter;m.stop=true;return {...m,seconds:(performance.now()-m.start)/1000,effectiveRate:(w.orbitalPlayback.epoch-m.epoch)/((performance.now()-m.start)/1000)};});
}
test('three connected ships sustain live distribution, paused rewind and both playback speeds',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-freight-district');await ready(page,'orison-freight-district');
 const one=await meter(page,1),two=await meter(page,2);writeFileSync('docs/evidence/freight-district-playback.json',JSON.stringify({one,two},null,2)+'\n');
 expect(one.effectiveRate).toBeGreaterThan(.92);expect(two.effectiveRate).toBeGreaterThan(1.85);expect(Math.max(one.maxGapMs,two.maxGapMs)).toBeLessThan(500);
 await pause(page);let s=await state(page);expect(s.traffic.error).toBe('');expect(s.ships).toHaveLength(3);expect(s.stocks).toHaveLength(4);expect(s.traffic.stats.flightCacheEntries).toBe(6);expect(s.traffic.stats['unloaded:Meridian']).toBeGreaterThan(0);expect(s.traffic.stats['unloaded:Lantern']).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Tern',exact:true}).click();await page.getByLabel('Simulation time').fill('1.2');await page.getByRole('button',{name:'Surface view',exact:true}).click();
 expect((await state(page)).ships[0].thrust.acceleration).toBeCloseTo(1.2,8);await page.screenshot({path:'docs/evidence/freight-district-launch.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('8');await page.getByRole('button',{name:'Ibis',exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
 const pose=(await state(page)).ships.map((s:any)=>s.y);
 for(const frame of ['Crown','Ibis','rotating','inertial']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships.map((s:any)=>s.y)).toEqual(pose);}
 await page.screenshot({path:'docs/evidence/freight-district-network.png',fullPage:true});
 await page.getByRole('button',{name:'Return to live',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(50);
 for(const id of ['orison-shuttle-service','orison-relay-network','orison-freight-district']){await page.getByLabel('Model set').selectOption(id);await ready(page,id);}
 expect(errors).toEqual([]);
});
test('northern launch and landing remain spatial in close views and use actual pad normals',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);
 await page.getByLabel('Model set').selectOption('orison-latitude-shuttle');await ready(page,'orison-latitude-shuttle');await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByLabel('Simulation time').fill('0.2');let s=await state(page);expect(s.camera.preset).toBe('oblique');expect(s.ships[0].axis[2]).toBeCloseTo(Math.sin(20*Math.PI/180),10);expect(s.ships[0].occludedBy).toBeUndefined();
 await page.getByLabel('Simulation time').fill('1.2');s=await state(page);expect(Math.abs(s.ships[0].y[2])).toBeGreaterThan(.3);expect(Math.abs(s.ships[0].y[5])).toBeGreaterThan(.01);expect(s.ships[0].axis).toEqual(s.ships[0].thrust.direction);expect(s.ships[0].occludedBy).toBeUndefined();
 await page.screenshot({path:'docs/evidence/northern-shuttle-3d.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('0.51');await page.getByRole('button',{name:'Surface view',exact:true}).click();s=await state(page);expect(s.camera.rig.up[2]).toBeCloseTo(Math.sin(20*Math.PI/180),10);expect(s.camera.center[2]).toBeGreaterThan(0);await page.screenshot({path:'docs/evidence/northern-shuttle-launch.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('15.6');await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.screenshot({path:'docs/evidence/northern-shuttle-landing.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('16');s=await state(page);expect(s.ships[0].logistics.dockedPortId).toBe('Northport');expect(s.ships[0].axis[2]).toBeCloseTo(Math.sin(20*Math.PI/180),10);expect(s.ships[0].propellant).toBeGreaterThan(.4);expect(errors).toEqual([]);
});
