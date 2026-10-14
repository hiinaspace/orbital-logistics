// Production-only presentation profile. No physical engine options are changed.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
const browser=await chromium.launch({channel:'chrome',headless:true});
const summarize=values=>{const xs=[...values].sort((a,b)=>a-b);return {n:xs.length,p50:xs[Math.floor(xs.length*.5)],p95:xs[Math.floor(xs.length*.95)],max:xs.at(-1)};};
const results=[];
const cases=[
 {id:'orison-steered',width:1920,height:1080,layout:'single',speed:undefined},
 {id:'orison-steered',width:1920,height:1080,layout:'axes',speed:undefined},
 {id:'orison-steered',width:1920,height:1080,layout:'axes',speed:'1'},
 {id:'aster-selene-system',width:3840,height:2160,layout:'frames',speed:'1'},
 {id:'aster-selene-cycler-fleet-service',width:3840,height:2160,layout:'frames',relief:true,seconds:15},
];
const spot=process.argv.includes('--spot');
for(const c of (spot?cases.filter(c=>c.speed==='1'):cases)){const page=await browser.newPage({viewport:{width:c.width,height:c.height},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4178/#set='+c.id);await page.waitForFunction(id=>{const s=JSON.parse(document.querySelector('#state-json').textContent||'{}');return s.ready&&s.set===id},c.id,{timeout:90000});await page.getByLabel('View layout').selectOption(c.layout);if(c.speed)await page.getByLabel('Playback speed').fill(c.speed);if(c.id==='orison-steered')await page.locator('#replay').check();if(c.relief){const pane=page.locator('.scene').last();await pane.locator('.display-menu summary').click();await pane.locator('[data-control=layer-relief]').check();await pane.locator('.display-menu summary').click();}await page.waitForTimeout(1500);
 for(let i=0;i<(spot?1:3);i++){await page.evaluate(()=>window.orbitalProfile.start());await page.waitForTimeout((c.seconds??30)*1000);const rows=await page.evaluate(()=>window.orbitalProfile.stop());const state=JSON.parse(await page.locator('#state-json').textContent());const result={...c,run:i+1,seconds:c.seconds??30,metrics:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,summarize(v)])),epoch:state.t,frontier:state.traffic?.frontier,rate:state.playbackRate,backingPixels:state.views.reduce((n,v)=>n+v.size.backing,0),fieldBytes:state.views.map(v=>v.field.bytes),errors};results.push(result);console.log(JSON.stringify({id:c.id,layout:c.layout,relief:c.relief??false,rate:state.playbackRate,run:i+1,frame:result.metrics.frameGap?.p95,draw:result.metrics.draw?.p95,refresh:result.metrics.refresh?.p95}));fs.writeFileSync(spot?'docs/design/viewer-polish/workspace-finalspot.json':'docs/design/viewer-polish/workspace-performance.json',JSON.stringify({environment:{cpu:os.cpus()[0].model,platform:os.platform(),browser:browser.version(),headless:true,deviceScaleFactor:1},note:spot?'Final geometry/projection optimization check: one30-second sample per case. Nonisolated desktop/production/SwiftShader/DPR1; no mobile or hardware-GPU claim.':'Nonisolated desktop, production build. 30-second triples except optional relief15-second triples. Headless uses SwiftShader; no mobile/hardware-GPU claim. Percentiles of different phases are not additive. Page field bytes are partial accounting, not total process/GPU memory.',results},null,2)+'\n');}
 await page.close();}
await browser.close();
