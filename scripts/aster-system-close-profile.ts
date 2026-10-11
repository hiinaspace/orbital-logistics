import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {speedPosition} from '../src/traffic/playback';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[],results:unknown[]=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.VIEWER_URL??'http://127.0.0.1:4178');await page.waitForFunction(()=>(window as any).orbitalPlayback.ready);
 await page.locator('#play').click();await page.locator('#set').selectOption('aster-selene-system');await page.waitForFunction(()=>(window as any).orbitalPlayback.ready);
 await page.locator('#speed').fill(String(speedPosition(16,16)));await page.waitForFunction(()=>(window as any).orbitalPlayback.frontier>150,{},{timeout:60000});
 if(await page.locator('#play').textContent()==='Pause')await page.locator('#play').click();await page.waitForFunction(()=>!JSON.parse(document.querySelector('#state-json')!.textContent!).traffic.pending);
 for(const [size,tracking]of [[{width:1440,height:900},'follow'],[{width:3840,height:2160},'chase']] as const){
  await page.setViewportSize(size);await page.locator('#time').fill('78');await page.locator('#fleet [data-object="Odyssey"]').click();await page.locator('#frame').selectOption('inertial');await page.locator('#launch-view').click();await page.locator('#tracking').selectOption(tracking);
  await page.locator('#speed').fill(speedPosition(.1,16).toFixed(4));await page.locator('#play').click();await page.evaluate(()=>(window as any).orbitalProfile.start());await page.waitForTimeout(3500);const rows=await page.evaluate(()=>(window as any).orbitalProfile.stop());await page.locator('#play').click();
  const state=JSON.parse(await page.locator('#state-json').textContent()??'{}'),gaps=rows.frameGap as number[];
  if(!gaps?.length||state.traffic.error||!Number.isFinite(state.camera.center[0])||state.t<=78||state.camera.scale<500)throw Error('Close camera profile failed');
  results.push({size,tracking,epoch:state.t,fps:1000/(gaps.reduce((n,x)=>n+x,0)/gaps.length),maxGap:Math.max(...gaps),rows});
  if(tracking==='follow')await page.screenshot({path:'docs/evidence/aster-system-entry.png'});
 }
 if(errors.length)throw Error(errors.join('\n'));writeFileSync('docs/design/aster-system/close-profile.json',JSON.stringify({results,errors},null,2)+'\n');console.log(results.map((r:any)=>({size:r.size,tracking:r.tracking,fps:r.fps,maxGap:r.maxGap})));
}finally{await browser.close();}
