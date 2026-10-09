import {writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
const state=async(p:Page)=>JSON.parse(await p.locator('#state-json').textContent()??'{}');
test('timeline selection survives live worker updates',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);
 await page.getByLabel('Model set').selectOption('orison-flexible-service');
 await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set==='orison-flexible-service';},{timeout:60000}).toBe(true);
 await page.locator('.timeline-name[data-select="Meridian"]').click();
 const initialTime=(await state(page)).t;
 await page.evaluate(()=>{
  const observations:{selected:string;rows:string[]}[]=[];
  const controls=Array.from(document.querySelectorAll('.timeline-name,.timeline-seek'));
  (window as any).selectionObservations=observations;
  const sample=()=>{const selected=JSON.parse(document.querySelector('#state-json')!.textContent!).selected;
   const rows=Array.from(document.querySelectorAll('.timeline-row.selected')).map(r=>r.querySelector<HTMLElement>('[data-select]')!.dataset.select!);
   if(selected!=='Meridian'||rows.length!==1||rows[0]!==selected||controls.some(c=>!c.isConnected))observations.push({selected,rows});
   if(!(window as any).stopSelectionObserver)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 await expect.poll(async()=>(await state(page)).t,{timeout:15000}).toBeGreaterThan(initialTime+6);
 await page.evaluate(()=>{(window as any).stopSelectionObserver=true;});
 expect(await page.evaluate(()=>(window as any).selectionObservations)).toEqual([]);
});
test('worker errors drain acknowledged playback, stop at its head and preserve scrubbing',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  const Native=window.Worker;
  window.Worker=class extends Native {
   count=0;trafficWorker=false;
   constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.trafficWorker=options?.name==='continuous-traffic';}
   postMessage(message:any,transferOrOptions?:any){
    if(this.trafficWorker&&++this.count===12){setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{generation:message.generation,sequence:message.sequence,error:'injected planner failure'}})),50);return;}
    super.postMessage(message,transferOrOptions);
   }
  };
 });
 await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);
 await page.getByLabel('Model set').selectOption('orison-flexible-service');
 await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set==='orison-flexible-service';},{timeout:60000}).toBe(true);
 await page.getByLabel('Playback speed').fill('4');
 await expect.poll(async()=>(await state(page)).traffic.error).toContain('injected planner failure');
 await expect.poll(async()=>(await state(page)).playing).toBe(false);
 const stopped=await state(page);expect(stopped.t).toBe(stopped.traffic.frontier);expect(stopped.traffic.pending).toBe(false);
 await page.getByLabel('Simulation time').fill('1');expect((await state(page)).t).toBe(1);
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).playing).toBe(false);
 expect((await state(page)).t).toBe(stopped.traffic.frontier);expect((await state(page)).traffic.sequence).toBe(stopped.traffic.sequence);
});
test('one-times playback continues through retry and route planning with committed history',async({page})=>{
 const through=Number(process.env.RESPONSIVE_THROUGH??72);
 test.setTimeout((through+90)*1000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);
 const loadStarted=Date.now();
 await page.getByLabel('Model set').selectOption('orison-flexible-service');
 await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set==='orison-flexible-service';},{timeout:60000}).toBe(true);
 expect((await state(page)).traffic.frontier).toBeGreaterThanOrEqual(16);
 const startupMs=Date.now()-loadStarted;
 await page.evaluate(through=>{
  const meter={maxHoldMs:0,minimumLead:Infinity,maximumLead:0,unchangedHeadFrames:0,samples:0,lastTime:-1,lastChange:performance.now()};
  (window as any).playbackMeter=meter;
  const sample=(now:number)=>{const s=JSON.parse(document.querySelector('#state-json')!.textContent!);
   if(s.playing&&s.t>1&&s.t<through){meter.samples++;const lead=s.traffic.frontier-s.t;meter.minimumLead=Math.min(meter.minimumLead,lead);meter.maximumLead=Math.max(meter.maximumLead,lead);
    if(s.t!==meter.lastTime){meter.maxHoldMs=Math.max(meter.maxHoldMs,now-meter.lastChange);meter.lastTime=s.t;meter.lastChange=now;}
    if(s.traffic.stats.planningPending)meter.unchangedHeadFrames++;
   }else meter.lastChange=now;
   if(!(window as any).stopPlaybackMeter)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 },through);
 await expect.poll(async()=>(await state(page)).t,{timeout:(through+25)*1000}).toBeGreaterThan(through);
 await page.evaluate(()=>{(window as any).stopPlaybackMeter=true;});
 const s=await state(page),meter=await page.evaluate(()=>(window as any).playbackMeter);
 writeFileSync(`docs/design/responsive-service/browser-timing${through===72?'':`-${through}`}.json`,JSON.stringify({speed:s.playbackRate,startupMs,cursor:s.t,frontier:s.traffic.frontier,...meter,stats:s.traffic.stats,errors},null,2)+'\n');
 expect(s.playbackRate).toBe(1);expect(meter.maxHoldMs).toBeLessThan(600);expect(meter.minimumLead).toBeGreaterThan(1);expect(meter.maximumLead).toBeLessThanOrEqual(17.1);expect(meter.unchangedHeadFrames).toBeGreaterThan(10);expect(s.traffic.stats.planningFailed).toBeGreaterThan(0);expect(s.traffic.stats.completed).toBeGreaterThanOrEqual(1);expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await state(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);expect((await state(page)).t).toBe(held.t);expect((await state(page)).ships[0].y).toEqual(held.ships[0].y);
 await page.getByLabel('Simulation time').fill(Math.max(24.123,held.traffic.oldest+1).toFixed(3));const past=await state(page);await page.getByLabel('Reference frame').selectOption('rotating');expect((await state(page)).ships[0].y).toEqual(past.ships[0].y);
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier).toBeGreaterThan(s.traffic.frontier);
});
test('retained adaptive history catches up across admissions at fast speed',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);
 await page.getByLabel('Model set').selectOption('orison-flexible-service');
 await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set==='orison-flexible-service';},{timeout:60000}).toBe(true);
 await page.getByLabel('Playback speed').fill('4');
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:90000}).toBeGreaterThan(264);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);
 const head=await state(page);expect(head.traffic.oldest).toBeGreaterThan(128);
 const past=Number((head.traffic.oldest+1).toFixed(3));await page.getByLabel('Simulation time').fill(String(past));
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t,{timeout:15000}).toBeGreaterThan(past+25);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Return to live'}).click();
 await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:15000}).toBeGreaterThan(head.traffic.frontier);
 expect(errors).toEqual([]);
});
