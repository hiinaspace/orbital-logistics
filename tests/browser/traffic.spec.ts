import {writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();}
test('continuous service holds history, returns live, restarts and cancels stale workers',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-service');await ready(page);
 await setRate(page,16);
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:20000}).toBeGreaterThan(12);
 await pause(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);
 const held=await state(page);await page.waitForTimeout(300);expect((await state(page)).t).toBe(held.t);expect((await state(page)).traffic.frontier).toBe(held.traffic.frontier);
 await page.getByLabel('Simulation time').fill('2');const past=await state(page);expect(past.t).toBe(2);expect(past.traffic.frontier).toBe(held.traffic.frontier);expect(past.events.every((e:{t:number;kind:string})=>e.t<=2 || !['transfer','undock'].includes(e.kind))).toBe(true);
 await page.getByLabel('Reference frame').selectOption('rotating');await page.screenshot({path:'docs/evidence/continuous-traffic.png',fullPage:true});
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(2.3);await pause(page);
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier).toBeGreaterThan(held.traffic.frontier);
 await pause(page);await setRate(page,1);await page.getByTitle('Restart run').click();await ready(page);await pause(page);expect((await state(page)).t).toBeLessThan(2);
 await page.getByRole('button',{name:'Return to live'}).click();await page.getByLabel('Model set').selectOption('lunar-loop');await ready(page);await pause(page);expect((await state(page)).set).toBe('lunar-loop');expect((await state(page)).traffic).toBeUndefined();await page.waitForTimeout(200);expect((await state(page)).set).toBe('lunar-loop');
 expect(errors).toEqual([]);
});


test('pause during a delayed reply acknowledges the head without moving the cursor or queuing more work',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.Worker;
  window.Worker=class extends Native {
   constructor(url:string|URL,options?:WorkerOptions){
    super(url,options);
    if(options?.name==='continuous-traffic')Object.defineProperty(this,'onmessage',{set(fn:(e:MessageEvent)=>void){this.addEventListener('message',e=>setTimeout(()=>fn(e as MessageEvent),180));}});
   }
  };
 });
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-service');await ready(page);
 await expect.poll(async()=>(await state(page)).traffic.pending).toBe(true);await pause(page);const paused=await state(page);
 await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);const acknowledged=await state(page);
 expect(acknowledged.t).toBe(paused.t);expect(acknowledged.traffic.frontier).toBeGreaterThanOrEqual(paused.traffic.frontier);
 await page.waitForTimeout(250);expect((await state(page)).traffic.sequence).toBe(acknowledged.traffic.sequence);
 expect((await state(page)).t).toBe(paused.t);
 await page.getByRole('button',{name:'Return to live'}).click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);const hidden=await state(page);
 await page.waitForTimeout(250);expect((await state(page)).traffic.frontier).toBe(hidden.traffic.frontier);expect((await state(page)).playing).toBe(false);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 expect((await state(page)).playing).toBe(false);
});

test('an already-open viewer can switch sets after old worker assets are retired',async({page})=>{
 test.setTimeout(45000);
 await page.goto('/');await ready(page);
 await page.getByLabel('Model set').selectOption('orison-service');await ready(page);await pause(page);
 await page.getByLabel('Model set').selectOption('selene-freight');await ready(page);await pause(page);
 // Models an open old tab after a build removed its hashed worker files.
 await page.route(/\/assets\/[^/]*worker[^/]*\.js(?:\?.*)?$/,route=>route.fulfill({status:404,body:'retired worker asset'}));
 await page.getByLabel('Model set').selectOption('orison-service');await ready(page);
 expect((await state(page)).traffic.error).toBe('');
 await pause(page);await page.getByLabel('Model set').selectOption('selene-freight');await ready(page);await pause(page);
 await page.getByLabel('Model set').selectOption('orison-service');await ready(page);expect((await state(page)).traffic.error).toBe('');
});

test('repeated lunar freight and live round trips reset their worker generations',async({page})=>{
 test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);
 for(let i=0;i<3;i++)for(const id of ['orison-service','selene-freight','orison-service','selene-powered']){
  await page.getByLabel('Model set').selectOption(id);await ready(page);await pause(page);
  const s=await state(page);expect(s.set).toBe(id);expect(s.traffic?.error??'').toBe('');
 }
 expect(errors).toEqual([]);
});

test('continuous surface service lands, rewinds retained history, stays live and restarts the selected set',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const meter={peakMainHeapBytes:0,readings:0};(window as unknown as {surfaceMeter:typeof meter}).surfaceMeter=meter;setInterval(()=>{const m=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;if(m){meter.peakMainHeapBytes=Math.max(meter.peakMainHeapBytes,m.usedJSHeapSize);meter.readings++;}},250);});
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('selene-service');await ready(page);
 await setRate(page,16);
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:30000}).toBeGreaterThan(11);await pause(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);
 await page.getByLabel('Simulation time').fill('9.9');await page.getByRole('button',{name:'Surface view',exact:true}).click();
 const approach=await state(page);expect(approach.frame).toBe('Cairn');expect(approach.ships[0].thrust.force).toBeGreaterThan(0);expect(approach.ships[0].thrust.acceleration).toBeLessThanOrEqual(3);
 await setRate(page,1 / 32);await page.screenshot({path:'docs/evidence/continuous-surface.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('9.986');await page.locator('#next-event').click();
 expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Cairn');
 expect((await state(page)).events.some((e:{kind:string})=>e.kind==='land')).toBe(true);
 await setRate(page,16);await page.getByRole('button',{name:'Return to live'}).click();
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:60000}).toBeGreaterThan(150);await pause(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);
 const head=await state(page);expect(head.traffic.oldest).toBeGreaterThan(20);expect(head.traffic.error).toBe('');expect(head.traffic.stats.episodes).toBeLessThanOrEqual(18);
 const retained=Math.round((head.traffic.frontier-20)*1000)/1000;
 await page.getByLabel('Simulation time').fill(String(retained));const past=await state(page);
 for(const frame of ['rotating','swift','inertial','Cairn']){await page.getByLabel('Reference frame').selectOption(frame);expect((await state(page)).ships.map((s:{y:number[]})=>s.y)).toEqual(past.ships.map((s:{y:number[]})=>s.y));}
 const timing=await page.evaluate(async()=>{
  const intervals:number[]=[];let before=performance.now();for(let i=0;i<60;i++)await new Promise<void>(resolve=>requestAnimationFrame(now=>{intervals.push(now-before);before=now;resolve();}));
  intervals.sort((a,b)=>a-b);return {medianFrameMs:intervals[30],p95FrameMs:intervals[57],memory:(()=>{const m=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;return m?{usedJSHeapSize:m.usedJSHeapSize,totalJSHeapSize:m.totalJSHeapSize,jsHeapSizeLimit:m.jsHeapSizeLimit}:null;})()};
 });
 const meter=await page.evaluate(()=>(window as unknown as {surfaceMeter:{peakMainHeapBytes:number;readings:number}}).surfaceMeter);
 const report={frontier:head.traffic.frontier,stats:head.traffic.stats,...timing,...meter,note:'Headless installed Chrome, production build. Main-window heap sampled every 250ms includes rendering and incoming packets; excludes worker heap and may miss shorter transient peaks.'};
 writeFileSync('docs/evidence/surface-traffic-browser.json',JSON.stringify(report,null,2)+'\n');
 await test.info().attach('retained surface view performance',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 expect(timing.p95FrameMs).toBeLessThan(200);
 await setRate(page,1);await page.getByTitle('Restart run').click();await ready(page);await pause(page);expect((await state(page)).set).toBe('selene-service');expect((await state(page)).t).toBeLessThan(2);
 for(const id of ['orison-service','selene-return','selene-service']){await page.getByLabel('Model set').selectOption(id);await ready(page);await pause(page);expect((await state(page)).set).toBe(id);expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
