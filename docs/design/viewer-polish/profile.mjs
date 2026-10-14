// Historical pre-polish baseline script; current selectors are in workspace-profile.mjs.
// Bounded planning baseline, isolated browser. Not a mobile-device benchmark.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const stats=xs=>{xs=[...xs].sort((a,b)=>a-b);return {n:xs.length,p50:xs[Math.floor(xs.length*.5)]??null,p95:xs[Math.floor(xs.length*.95)]??null,max:xs.at(-1)??null};};
const results=[];
for(const size of [{width:1920,height:1080},{width:3840,height:2160}]){
 const page=await browser.newPage({viewport:size,deviceScaleFactor:1});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4178/');await page.waitForFunction(()=>JSON.parse(document.querySelector('#state-json').textContent).ready,{timeout:60000});
 for(const id of ['orison-freight','aster-selene-system','aster-selene-cycler-fleet-service']){
  const began=performance.now();await page.getByLabel('Model set').selectOption(id);await page.waitForFunction(id=>{const s=JSON.parse(document.querySelector('#state-json').textContent);return s.ready&&s.set===id;},id,{timeout:90000});const loadMs=performance.now()-began;
  const state=()=>page.locator('#state-json').textContent().then(JSON.parse);if(!(await state()).playing)await page.getByRole('button',{name:'Play',exact:true}).click();
  const modes=id.includes('cycler')?['plain','relief']:['plain'];
  for(const mode of modes){if(mode==='relief'){await page.locator('#layers summary').click();await page.getByLabel('Relief',{exact:true}).check();await page.locator('#layers summary').click();}
   await page.waitForTimeout(700);await page.evaluate(()=>window.orbitalProfile.start());await page.waitForTimeout(3000);const rows=await page.evaluate(()=>window.orbitalProfile.stop());const dom=await page.evaluate(()=>({elements:document.querySelectorAll('*').length,canvases:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,hidden:c.hidden})),heap:performance.memory?.usedJSHeapSize,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize}))}));
   results.push({size,deviceScaleFactor:1,id,mode,loadMs,metrics:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,stats(v)])),dom,state:await state(),errors});
  }
 }
 await page.close();
}
await browser.close();fs.writeFileSync('docs/design/viewer-polish/baseline.json',JSON.stringify({note:'Nonisolated headless desktop Chrome, DPR1, 3-second samples. Heap is page-only, excludes worker/GPU/native allocations; no mobile claim.',results},null,2)+'\n');console.log(results.map(r=>({size:r.size,id:r.id,mode:r.mode,load:Math.round(r.loadMs),frame:r.metrics.frameGap,draw:r.metrics.draw,panels:r.metrics.panels,elements:r.dom.elements,heap:r.dom.heap})));
