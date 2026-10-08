import {test,expect,type Page} from '@playwright/test';
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();}
test('continuous service holds history, returns live, restarts and cancels stale workers',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('orison-service');await ready(page);
 await page.getByLabel('Playback speed').fill('4');
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:20000}).toBeGreaterThan(12);
 await pause(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);
 const held=await state(page);await page.waitForTimeout(300);expect((await state(page)).t).toBe(held.t);expect((await state(page)).traffic.frontier).toBe(held.traffic.frontier);
 await page.getByLabel('Simulation time').fill('2');const past=await state(page);expect(past.t).toBe(2);expect(past.traffic.frontier).toBe(held.traffic.frontier);expect(past.events.every((e:{t:number;kind:string})=>e.t<=2 || !['transfer','undock'].includes(e.kind))).toBe(true);
 await page.getByLabel('Reference frame').selectOption('rotating');await page.screenshot({path:'docs/evidence/continuous-traffic.png',fullPage:true});
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(2.3);await pause(page);
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier).toBeGreaterThan(held.traffic.frontier);
 await pause(page);await page.getByLabel('Playback speed').fill('0');await page.getByTitle('Restart run').click();await ready(page);await pause(page);expect((await state(page)).t).toBeLessThan(2);
 await page.getByRole('button',{name:'Return to live'}).click();await page.getByLabel('Model set').selectOption('lunar-loop');await ready(page);await pause(page);expect((await state(page)).set).toBe('lunar-loop');expect((await state(page)).traffic).toBeUndefined();await page.waitForTimeout(200);expect((await state(page)).set).toBe('lunar-loop');
 expect(errors).toEqual([]);
});


test('pause during a delayed reply acknowledges the head without moving the cursor or queuing more work',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.Worker;
  window.Worker=class extends Native {
   constructor(url:string|URL,options?:WorkerOptions){
    super(url,options);
    if(String(url).includes('traffic.worker'))Object.defineProperty(this,'onmessage',{set(fn:(e:MessageEvent)=>void){this.addEventListener('message',e=>setTimeout(()=>fn(e as MessageEvent),180));}});
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
