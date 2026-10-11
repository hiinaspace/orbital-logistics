import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {setRate} from './playback-controls';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const summary=(a:number[])=>{const s=[...a].sort((a,b)=>a-b);return {n:a.length,mean:a.reduce((n,x)=>n+x,0)/Math.max(1,a.length),p95:s[Math.floor(.95*(s.length-1))]??0,p99:s[Math.floor(.99*(s.length-1))]??0,max:s.at(-1)??0,over200:a.filter(x=>x>200).length};};
test('production rendering matrix for staged baseline and composed exhibit',async({page})=>{
 test.skip(!process.env.PROFILE_OUTPUT,'Opt-in bounded browser diagnostic');test.setTimeout(360000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{(window as any).longTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if((window as any).longTasks.length<5000)(window as any).longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});});
 await page.goto('/');await expect.poll(async()=>(await state(page)).ready).toBe(true);if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();
 const results:any[]=[];
 for(const size of [{width:1440,height:900},{width:3840,height:2160}])for(const id of ['aster-selene-staged-service','aster-selene-system']){
  await page.setViewportSize(size);await page.getByLabel('Model set').selectOption(id);
  await expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:50000}).toBe(true);if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);await page.getByLabel('Simulation time').fill('20');await page.locator('#fleet [data-object="Odyssey"]').click();await page.getByLabel('Camera view').selectOption('oblique');await page.getByRole('button',{name:'Fit',exact:true}).click();
  for(const mode of ['frozen','bodies','inertial-1x','rotating-16x']){
   if(mode==='bodies'){await page.locator('#layers').evaluate((e:any)=>e.open=true);await page.locator('#clear-view').click();await page.locator('#layers').evaluate((e:any)=>e.open=false);}
   if(mode==='inertial-1x'){await page.locator('#layers').evaluate((e:any)=>e.open=true);await page.locator('#clear-view').click();await page.locator('#layers').evaluate((e:any)=>e.open=false);await setRate(page,1);await page.getByRole('button',{name:'Play',exact:true}).click();}
   if(mode==='rotating-16x'){await page.getByLabel('Reference frame').selectOption('rotating');await setRate(page,16);if(!(await state(page)).traffic.live)await page.getByRole('button',{name:'Return to live',exact:true}).click();}
   const before=await state(page);await page.evaluate(()=>{(window as any).longTasks=[];(window as any).orbitalProfile.start();});await page.waitForTimeout(mode==='frozen'||mode==='bodies'?3500:10000);
   const data=await page.evaluate(()=>({rows:(window as any).orbitalProfile.stop(),tasks:(window as any).longTasks,heap:(performance as any).memory?.usedJSHeapSize,dom:document.querySelectorAll('*').length,svg:document.querySelectorAll('svg *').length})),after=await state(page);
   const r={id,size,mode,before:before.t,after:after.t,frontier:after.traffic.frontier,stats:after.traffic.stats,dom:data.dom,svg:data.svg,heap:data.heap,tasks:summary(data.tasks),timings:Object.fromEntries(Object.entries(data.rows).map(([k,v])=>[k,summary(v as number[])])),error:after.traffic.error};results.push(r);writeFileSync(process.env.PROFILE_OUTPUT!,JSON.stringify({results,errors},null,2)+'\n');
   console.log(id,size.width,mode,r.timings);expect(r.timings.frameGap?.n??0).toBeGreaterThan(20);expect(after.traffic.error).toBe('');
  }
  if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByLabel('Reference frame').selectOption('inertial');
 }
 expect(errors).toEqual([]);
});
