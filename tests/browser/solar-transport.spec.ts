import {test,expect} from '@playwright/test';
import {setRate} from './playback-controls';
import {readFileSync,writeFileSync} from 'node:fs';
const state=async(page:any)=>JSON.parse(await page.locator('#state-json').textContent()??'{}');
const ready=async(page:any,id:string)=>expect.poll(async()=>{const s=await state(page);return s.ready&&s.set===id;},{timeout:45000}).toBe(true);
const pause=async(page:any)=>{if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();};
test('solar cycler supports local and system inspection, signed day playback and finite resource replay',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page,'orison-freight');await pause(page);
 await page.getByLabel('Model set').selectOption('solar-cycler');await ready(page,'solar-cycler');await pause(page);
 await expect(page.locator('#clock')).toContainText('Day');expect((await state(page)).ships).toHaveLength(4);
 await page.getByLabel('Simulation time').fill('0.02');await page.locator('#fleet [data-object="Peregrine-1"]').click();
 await expect(page.locator('#readouts')).toContainText('m/s²');expect((await state(page)).ships.find((v:any)=>v.id==='Peregrine-1').thrust.force).toBeGreaterThan(0);
 await page.getByLabel('Reference frame').selectOption('Earth');await page.getByLabel('Camera view').selectOption('oblique');await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.screenshot({path:'docs/evidence/solar-earth-departure.png',fullPage:true});
 for(const frame of ['rotating','Earth','Moon','Mars','Jupiter','inertial']){await page.getByLabel('Reference frame').selectOption(frame);await page.getByRole('button',{name:'Fit',exact:true}).click();expect((await state(page)).frame).toBe(frame);}
 await page.getByLabel('Camera view').selectOption('oblique');await page.getByLabel('Simulation time').fill('0.36');
 await page.locator('#fleet [data-object="Wayfarer"]').click();
 await page.screenshot({path:'docs/evidence/solar-cycler.png',fullPage:true});
 await page.getByLabel('Simulation time').fill('0.04');expect((await state(page)).ships.find((v:any)=>v.id==='Peregrine-1').opacity).toBe(0);
 await page.getByLabel('Simulation time').fill('4.8');expect((await state(page)).stocks.find((s:any)=>s.id==='Mars gateway').cargo).toBe(3);
 await page.getByLabel('Simulation time').fill('1');expect((await state(page)).stocks.find((s:any)=>s.id==='Mars gateway').cargo).toBe(1);
 const artifact=JSON.parse(readFileSync('fixtures/model-sets/solar-cycler.json','utf8'));
 for(const v of artifact.vessels.slice(1))for(const epoch of [v.start!+.000001,v.end!-.000001]){
  await page.getByLabel('Simulation time').fill(epoch.toFixed(6));await page.getByLabel('Reference frame').selectOption(v.id);
  await page.getByRole('button',{name:'Fit',exact:true}).click();expect((await state(page)).frame).toBe(v.id);
 }
 await page.getByLabel('Reference frame').selectOption('inertial');await page.getByLabel('Simulation time').fill('1');
 await setRate(page,16);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeGreaterThan(1.01);await pause(page);
 const t=(await state(page)).t;await setRate(page,-16);await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(t-.01);await pause(page);
 await page.getByLabel('Model set').selectOption('aster-selene-system');await ready(page,'aster-selene-system');await pause(page);
 await page.getByLabel('Model set').selectOption('solar-cycler');await ready(page,'solar-cycler');await pause(page);
 expect(errors).toEqual([]);
});
test('solar exhibit production frame budgets at system and planet scales',async({page})=>{
 test.skip(!process.env.PROFILE_OUTPUT,'Opt-in bounded performance witness');test.setTimeout(120000);
 const errors:string[]=[],results:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await ready(page,'orison-freight');await pause(page);await page.getByLabel('Model set').selectOption('solar-cycler');await ready(page,'solar-cycler');await pause(page);
 await page.getByLabel('Camera view').selectOption('oblique');
 const summary=(a:number[])=>{const s=[...a].sort((a,b)=>a-b);return {n:s.length,mean:s.reduce((a,b)=>a+b,0)/Math.max(1,s.length),p95:s[Math.floor((s.length-1)*.95)]??0,max:s.at(-1)??0};};
 for(const size of [{width:1440,height:900},{width:3840,height:2160}])for(const frame of ['inertial','Earth','Mars']){
  await page.setViewportSize(size);await page.getByLabel('Reference frame').selectOption(frame);await page.getByRole('button',{name:'Fit',exact:true}).click();
  await page.getByLabel('Simulation time').fill(frame==='Mars'?'0.4':'0.01');await page.locator('#fleet [data-object="Peregrine-1"]').click();
  await setRate(page,16);await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.evaluate(()=>(window as any).orbitalProfile.start());await page.waitForTimeout(5000);
  const rows=await page.evaluate(()=>(window as any).orbitalProfile.stop());await pause(page);
  const timings=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,summary(v as number[])]));
  results.push({size,frame,timings,dom:await page.locator('*').count()});
  writeFileSync(process.env.PROFILE_OUTPUT!,JSON.stringify({results,errors},null,2)+'\n');
  expect(timings.frameGap.n).toBeGreaterThan(50);expect(timings.frameGap.p95).toBeLessThan(100);
 }
 expect(errors).toEqual([]);
});
