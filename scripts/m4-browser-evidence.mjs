// Separate headless browser; does not control the user's review tab.
import {chromium} from '@playwright/test';
import {writeFile,rm} from 'node:fs/promises';
import {hostname} from 'node:os';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),directory='scratch/m4-recording';
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:directory,size:{width:1440,height:1000}}});
const page=await context.newPage(),errors=[],observations=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=async()=>JSON.parse(await page.locator('#state-json').textContent());
const ready=async()=>page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#state-json').textContent);return !s.pending&&s.readyRevision===s.revision;});
try{
 await page.goto('http://127.0.0.1:4178/');await ready();await page.locator('#scene').selectOption('return-ticket');await ready();
 await page.locator('#warp').selectOption('16');
 for(const [departure,arrival] of [[15.5,19.5],[14,18]]){
  if(departure===14){await page.locator('#puzzle-restart').click();await ready();}
  await page.locator('#port-departure').fill(String(departure));await page.locator('#port-arrival').fill(String(arrival));await page.locator('#port-arrival').press('Tab');
  await page.locator('#port-place').click();await ready();const before=(await state()).draft;
  const start=performance.now();await page.locator('#solve').click();await page.waitForFunction(()=>!JSON.parse(document.querySelector('#state-json').textContent).targeting.solving);
  const proposed=await state();assert.ok(proposed.targeting.proposal,proposed.targeting.status);assert.deepEqual(proposed.draft,before);
  observations.push({departure,arrival,dispatchToProposalMs:performance.now()-start,evaluations:proposed.targeting.proposal.evaluations});
  if(departure===14)await page.screenshot({path:'docs/evidence/m4-proposal.png',fullPage:true});
  await page.locator('#accept-proposal').click();await ready();await page.locator('#execute').click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#state-json').textContent).status==='horizon');
 }
 assert.equal(await page.locator('#solution-count').textContent(),'2');
 await page.locator('#solutions summary').click();await page.screenshot({path:'docs/evidence/m4-solutions.png',fullPage:true});
 await page.locator('#reset').click();await page.locator('#play').click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#state-json').textContent).t>16);
 await page.locator('#play').click();await page.screenshot({path:'docs/evidence/m4-trails.png',fullPage:true});
 const beforeLayers=await state();await page.locator('#layers summary').click();await page.locator('#bodies-only').click();await page.locator('#layers summary').click();
 assert.deepEqual((await state()).y,beforeLayers.y);await page.screenshot({path:'docs/evidence/m4-bodies.png',fullPage:true});
 await page.locator('#layers summary').click();await page.locator('#bodies-only').click();await page.locator('#layers summary').click();
 await page.locator('#play').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#state-json').textContent).status==='horizon');
 await page.locator('#files').click();await page.locator('#save').click();await writeFile('docs/evidence/m4-browser-replay.json',(await page.locator('#json').inputValue()).trimEnd()+'\n');
 const final=await state();assert.deepEqual(errors,[]);
 const report={host:hostname(),chrome:browser.version(),observations,errors,final:final.logisticsResult,method:'Two actual fixed-window local solves and executed returns in a separate headless production browser. Timing is two individual observations, not a latency distribution.'};
 await writeFile('docs/evidence/m4-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 const video=page.video();await context.close();await video.saveAs('docs/evidence/m4-puzzles.webm');await video.delete();
}finally{await browser.close();await rm(directory,{recursive:true,force:true});}
