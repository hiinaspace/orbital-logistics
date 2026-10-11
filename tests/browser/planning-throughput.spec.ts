import {test,expect} from '@playwright/test';
import {setRate} from './playback-controls';
import {writeFileSync} from 'node:fs';
test('measure committed playback across route windows',async({page})=>{
 test.skip(!process.env.PLANNING_RATES,'Opt-in wall-clock performance witness');
 const rates=process.env.PLANNING_RATES!.split(',').map(Number),through=Number(process.env.PLANNING_THROUGH??256),rows=[];
 test.setTimeout(rates.reduce((t,r)=>t+(through/r+90)*1000,0));
 const state=async()=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
 for(const rate of rates){
  await page.goto('/');await expect.poll(async()=>(await state()).ready).toBe(true);
  const started=Date.now();await page.getByLabel('Model set').selectOption('orison-flexible-service');
  await expect.poll(async()=>{const s=await state();return s.ready&&s.set==='orison-flexible-service';},{timeout:60000}).toBe(true);
  const startupMs=Date.now()-started;
  await setRate(page,rate);
  await page.evaluate(()=>{
   const s=JSON.parse(document.querySelector('#state-json')!.textContent!),meter={start:performance.now(),startTime:s.t,maxGapMs:0,minLead:Infinity,lastTime:s.t,lastChange:performance.now(),underflowFrames:0};
   (window as any).throughput=meter;(window as any).stopMeter=false;
   const sample=(now:number)=>{const s=JSON.parse(document.querySelector('#state-json')!.textContent!);if(s.t!==meter.lastTime){meter.maxGapMs=Math.max(meter.maxGapMs,now-meter.lastChange);meter.lastTime=s.t;meter.lastChange=now;}const lead=s.traffic.frontier-s.t;meter.minLead=Math.min(meter.minLead,lead);if(lead<.001)meter.underflowFrames++;if(!(window as any).stopMeter)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await expect.poll(async()=>(await state()).t,{timeout:(through/rate+90)*1000}).toBeGreaterThan(through);
  const result=await page.evaluate(()=>{(window as any).stopMeter=true;const s=JSON.parse(document.querySelector('#state-json')!.textContent!),m=(window as any).throughput,seconds=(performance.now()-m.start)/1000;return {rate:s.playbackRate,seconds,effectiveRate:(s.t-m.startTime)/seconds,...m,cursor:s.t,frontier:s.traffic.frontier,stats:s.traffic.stats};});
  rows.push({startupMs,...result});writeFileSync(`docs/design/sensitivity-planning/browser-${through}.json`,JSON.stringify(rows,null,2)+'\n');
  console.log({rate,effective:result.effectiveRate,maxGapMs:result.maxGapMs,minLead:result.minLead,underflowFrames:result.underflowFrames});
  expect((await state()).traffic.error).toBe('');
  // This gate applies to the production envelope; higher-speed experiments
  // deliberately retain their underflows as evidence rather than pass claims.
  if(rate<=4){expect(result.effectiveRate).toBeGreaterThan(rate*.95);expect(result.maxGapMs).toBeLessThan(600);expect(result.underflowFrames).toBe(0);}
 }
});
test('set-specific range caps a requested rate and restores each set preference',async({page})=>{
 test.setTimeout(45000);await page.goto('/');
 const state=async()=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
 await expect.poll(async()=>(await state()).ready).toBe(true);await setRate(page,16);
 await page.getByLabel('Model set').selectOption('orison-flexible-service');await expect.poll(async()=>(await state()).ready).toBe(true);
 await expect(page.getByLabel('Playback speed')).toHaveAttribute('max','1');await expect(page.getByLabel('Playback speed')).toHaveAttribute('data-maximum','4');expect((await state()).playbackRate).toBe(1);await setRate(page,16);expect((await state()).playbackRate).toBe(4);await expect(page.locator('#speed-value')).toHaveText('4×');
 await page.getByLabel('Model set').selectOption('orison-freight');await expect.poll(async()=>(await state()).ready).toBe(true);
 await expect(page.getByLabel('Playback speed')).toHaveAttribute('max','1');await expect(page.getByLabel('Playback speed')).toHaveAttribute('data-maximum','16');expect((await state()).playbackRate).toBe(16);
});
