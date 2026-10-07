// Separate headless production replay; never attaches to the user's browser.
import {chromium} from '@playwright/test';
import {writeFile, rm} from 'node:fs/promises';
import {hostname} from 'node:os';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const directory='test-results/m3-recording';
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:directory,size:{width:1440,height:1000}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=async()=>JSON.parse(await page.locator('#state-json').textContent());
const ready=async()=>page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#state-json').textContent);return !s.pending&&s.readyRevision===s.revision;});
try{
  await page.goto('http://127.0.0.1:4178/');await ready();await page.locator('#scene').selectOption('delivery');await ready();
  assert.equal((await state()).logisticsResult.reason,'Return to Home');
  await page.locator('#round-trip').click();await ready();assert.equal((await state()).logisticsResult.complete,true);
  await page.screenshot({path:'docs/evidence/m3-plan.png',fullPage:true});
  await page.locator('[data-operation="dock-depot"]').click();const epoch=await page.locator('#op-time').inputValue();
  const observations=[];
  for(const value of ['4.5',epoch]){
    await page.locator('#op-time').fill(value);const start=performance.now();await page.locator('#op-save').click();await ready();
    await page.waitForTimeout(100);const s=await state();
    observations.push({epoch:Number(value),dispatchToReadyMs:performance.now()-start,latestInputToFreshPaintMs:s.latency.at(-1),status:s.terminal.status});
    if(value==='4.5')await page.screenshot({path:'docs/evidence/m3-blocked.png',fullPage:true});
  }
  await page.locator('#op-close').click();await page.locator('#warp').selectOption('16');await page.locator('#execute').click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#state-json').textContent).status==='horizon');
  await page.screenshot({path:'docs/evidence/m3-complete.png',fullPage:true});
  const final=await state();assert.equal(final.logistics.dockedPortId,'Home');assert.equal(final.logistics.cargoMass,0);
  await page.locator('#files').click();await page.locator('#save').click();
  await writeFile('docs/evidence/m3-browser-replay.json',(await page.locator('#json').inputValue()).trimEnd()+'\n');
  assert.deepEqual(errors,[]);
  const report={host:hostname(),chrome:browser.version(),viewport:{width:1440,height:1000},observations,errors,final:final.logisticsResult,
    method:'Two separate headless edit observations, recorded alongside the regression suite. Dispatch includes a final 100ms settling wait; input-to-fresh-paint is application instrumentation. Not a latency distribution.'};
  await writeFile('docs/evidence/m3-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  const video=page.video();await context.close();await video.saveAs('docs/evidence/m3-delivery.webm');await video.delete();
}finally{await browser.close();await rm(directory,{recursive:true,force:true});}
