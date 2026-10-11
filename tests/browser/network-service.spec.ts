import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
import {readFileSync,writeFileSync} from 'node:fs';
const state=async(page:Page)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
async function load(page:Page){await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);await page.getByLabel('Model set').selectOption('orison-relay-network');await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set==='orison-relay-network';},{timeout:90000}).toBe(true);}
test('two maintained lanes preserve selection, paused poses, shared stocks and set switching',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page);
 let s=await state(page);expect(s.ships.map((v:any)=>v.id)).toEqual(['Ibis','Tern']);expect(Object.keys(s.maintenance)).toEqual(['Solstice','Meridian']);expect(s.stocks.find((p:any)=>p.id==='Equator').occupied).toBe(2);expect(s.traffic.frontier).toBeGreaterThanOrEqual(32);
 await page.locator('.timeline-name[data-select="Solstice"]').click();await page.getByLabel('Reference frame').selectOption('Solstice');await page.getByLabel('Camera tracking').selectOption('follow');const initial=(await state(page)).t;
 await expect.poll(async()=>(await state(page)).t,{timeout:15000}).toBeGreaterThan(initial+5);s=await state(page);expect(s.selected).toBe('Solstice');expect(s.camera.tracking).toBe('follow');
 await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await state(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);expect((await state(page)).ships.map((s:any)=>s.y)).toEqual(held.ships.map((s:any)=>s.y));
 await page.getByLabel('Simulation time').fill('24.123');const past=await state(page);await page.getByLabel('Reference frame').selectOption('rotating');expect((await state(page)).ships.map((s:any)=>s.y)).toEqual(past.ships.map((s:any)=>s.y));
 await page.getByRole('button',{name:'Return to live'}).click();await expect.poll(async()=>(await state(page)).traffic.frontier).toBeGreaterThan(held.traffic.frontier);
 await page.getByLabel('Model set').selectOption('selene-freight');await expect.poll(async()=>(await state(page)).ready).toBe(true);
 await setRate(page,16);await page.getByLabel('Model set').selectOption('orison-relay-network');await expect.poll(async()=>(await state(page)).ready,{timeout:90000}).toBe(true);expect((await state(page)).playbackRate).toBe(1);await setRate(page,16);expect((await state(page)).playbackRate).toBe(2);await expect(page.getByLabel('Playback speed')).toHaveAttribute('max','1');await expect(page.getByLabel('Playback speed')).toHaveAttribute('data-maximum','2');expect((await state(page)).traffic.error).toBe('');expect(errors).toEqual([]);
 await page.screenshot({path:'docs/design/multiship-service/browser.png',fullPage:true});
});
test('live fuel chart replacements keep the time cursor at the displayed epoch',async({page})=>{
 test.setTimeout(90000);await load(page);await setRate(page,2);
 await page.evaluate(()=>{
  const result={replacements:0,invalid:[] as string[]};(window as any).chartCursorWitness=result;
  new MutationObserver(records=>{
   if(!records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&n.matches('.budget-chart'))))return;
   result.replacements++;const cursor=document.querySelector('.budget-cursor'),epoch=(window as any).orbitalPlayback.epoch;
   const position=Number(cursor?.getAttribute('transform')?.match(/^translate\(([^,]+),0\)$/)?.[1]);
   // Replacements may precede the next panel tick; their own chart carries
   // exact window bounds rather than borrowing the stale inspector clock.
   const chart=cursor?.closest('svg'),from=Number(chart?.getAttribute('data-start')),to=Number(chart?.getAttribute('data-end')),expected=4+(epoch-from)/(to-from)*232;
   if(!Number.isFinite(position)||!Number.isFinite(expected)||Math.abs(position-expected)>1e-7)result.invalid.push(`${epoch}:${position}/${expected}`);
  }).observe(document.querySelector('#inspector')!,{childList:true,subtree:true});
 });
 await expect.poll(async()=>(await state(page)).t,{timeout:15000}).toBeGreaterThan(12);
 const witness=await page.evaluate(()=>(window as any).chartCursorWitness);expect(witness.replacements).toBeGreaterThan(10);expect(witness.invalid).toEqual([]);
});
test('measure actual network display frames and committed-buffer continuity',async({page})=>{
 test.skip(!process.env.NETWORK_RATES,'Opt-in isolated production playback witness');
 const rates=process.env.NETWORK_RATES!.split(',').map(Number),through=Number(process.env.NETWORK_THROUGH??160),rows:any[]=[];
 test.setTimeout(rates.reduce((t,r)=>t+(through/r+120)*1000,0));
 for(const rate of rates){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const startup=performance.now();await load(page);const startupMs=performance.now()-startup;
  await setRate(page,rate);
  await page.evaluate(()=>{
   const read=()=> (window as any).orbitalPlayback,m={start:performance.now(),startEpoch:read().epoch,lastEpoch:read().epoch,lastChange:performance.now(),lastFrame:performance.now(),maxHoldMs:0,maxFrameGapMs:0,minLead:Infinity,underflows:0,frames:0,planningFrames:0,frameBins:Array(2048).fill(0),layerToggleMs:0};
   (window as any).networkMeter=m;(window as any).stopNetworkMeter=false;
   const sample=(now:number)=>{const s=read();m.frames++;const gap=now-m.lastFrame;m.frameBins[Math.min(2047,Math.round(gap))]++;if(s.planning){m.planningFrames++;if(!m.layerToggleMs){const started=performance.now();(document.querySelector('#layer-labels') as HTMLInputElement).click();(document.querySelector('#layer-labels') as HTMLInputElement).click();m.layerToggleMs=performance.now()-started;}}m.maxFrameGapMs=Math.max(m.maxFrameGapMs,now-m.lastFrame);m.lastFrame=now;if(s.epoch!==m.lastEpoch){m.maxHoldMs=Math.max(m.maxHoldMs,now-m.lastChange);m.lastEpoch=s.epoch;m.lastChange=now;}const lead=s.frontier-s.epoch;m.minLead=Math.min(m.minLead,lead);if(lead<.001)m.underflows++;if(!(window as any).stopNetworkMeter)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await expect.poll(async()=>(await state(page)).t,{timeout:(through/rate+90)*1000}).toBeGreaterThan(through);
  const row=await page.evaluate(()=>{(window as any).stopNetworkMeter=true;const s=JSON.parse(document.querySelector('#state-json')!.textContent!),m=(window as any).networkMeter,seconds=(performance.now()-m.start)/1000;const quantile=(q:number)=>{let total=0;return m.frameBins.findIndex((n:number)=>{total+=n;return total>=m.frames*q;});};return {...m,p95FrameGapMs:quantile(.95),p99FrameGapMs:quantile(.99),seconds,effectiveRate:(s.t-m.startEpoch)/seconds,cursor:s.t,frontier:s.traffic.frontier,stats:s.traffic.stats};});rows.push({rate,startupMs,...row,errors});writeFileSync(`docs/design/multiship-service/browser-${through}.json`,JSON.stringify(rows,null,2)+'\n');
  console.log({rate,effectiveRate:row.effectiveRate,maxHoldMs:row.maxHoldMs,maxFrameGapMs:row.maxFrameGapMs,minLead:row.minLead});expect(row.effectiveRate).toBeGreaterThan(rate*.95);expect(row.maxHoldMs).toBeLessThan(600);expect(row.maxFrameGapMs).toBeLessThan(600);expect(row.underflows).toBe(0);expect(row.planningFrames).toBeGreaterThan(0);expect(row.layerToggleMs).toBeLessThan(250);expect(row.stats.viewBytes).toBeLessThan(16000000);expect(errors).toEqual([]);
 }
});

test('a stopped station is a last-known marker and cannot become a reference frame',async({page})=>{
 test.setTimeout(30000);const delta=JSON.parse(readFileSync('docs/design/multiship-service/fault-display.json','utf8')),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // Feed the actual fault witness to the UI without rerunning planners. The
 // runtime fault matrix independently checks this packet's physical origin.
 await page.addInitScript(delta=>{const Native=window.Worker;window.Worker=class extends Native {
  trafficWorker=false;
  constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.trafficWorker=options?.name==='continuous-traffic';}
  postMessage(m:any,options?:any){if(this.trafficWorker&&m.definition?.id==='orison-relay-network'){this.terminate();setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{generation:m.generation,sequence:m.sequence,delta}})),20);return;}if(this.trafficWorker&&m.target!==undefined){setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{generation:m.generation,sequence:m.sequence,delta}})),20);return;}super.postMessage(m,options);}
 };},delta);
 await load(page);await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByLabel('Simulation time').fill('100');
 await page.locator('.timeline-name[data-select="Meridian"]').click();const s=await state(page);expect(s.maintenance.Meridian.activity.kind).toBe('fault');expect(s.maintenance.Meridian.activity.knownEpoch).toBe(20);expect(s.ships.find((v:any)=>v.id==='Ibis').activity.kind).not.toBe('fault');
 await expect(page.locator('#object-status')).toContainText('Fault · last seen 20.00');await expect(page.locator('#object-frame')).toBeDisabled();await expect(page.locator('#frame option[value="Meridian"]')).toHaveJSProperty('disabled',true);
 expect(s.hits.some((h:any)=>h.id==='Meridian')).toBe(true);await page.getByLabel('Simulation time').fill('10');await expect(page.locator('#object-frame')).toBeEnabled();expect(errors).toEqual([]);
});
