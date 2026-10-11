import {test,expect,type Page} from '@playwright/test';
import {setRate} from './playback-controls';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync('fixtures/model-sets/selene-staging.json','utf8'));
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page,id?:string){await expect.poll(async()=>{const s=await state(page);return s.ready&&(!id||s.set===id);},{timeout:20000}).toBe(true);}
async function pause(page:Page){if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(page:Page,t:number){await page.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(page)).t).toBe(t);}
test('launch assembly splits into paid delivery and booster recovery; lifetime, frames, follow and replay stay coherent',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
   const traces:{t?:number;x:number;y:number;dx:number;dy:number}[]=[];
   (window as any).rocketPaint=traces;
   const move=CanvasRenderingContext2D.prototype.moveTo;
   CanvasRenderingContext2D.prototype.moveTo=function(x:number,y:number){
     if(y===0&&(x===8||x===10)){
       const m=this.getTransform(),ratio=devicePixelRatio;
       traces.push({t:(window as any).orbitalPlayback?.epoch,x:m.e/ratio,y:m.f/ratio,dx:m.a,dy:m.b});if(traces.length>200)traces.shift();
     }
     return move.call(this,x,y);
   };
 });
 await page.goto('/');await ready(page);await pause(page);await page.getByLabel('Model set').selectOption('selene-staging');await ready(page,'selene-staging');await pause(page);await seek(page,0);
 expect((await state(page)).playbackRate).toBe(.1);
 expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);expect((await state(page)).hits.filter((h:any)=>['kestrel','wren'].includes(h.id))).toEqual([]);
 await expect(page.locator('.timeline-row')).toHaveCount(3);await expect(page.locator('#frame option[value="wren"]')).toHaveJSProperty('disabled',true);
 await page.locator('[data-select="wren"]').click();await expect(page.locator('#object-status')).toHaveText('Attached to launch stack');await expect(page.locator('#object-frame')).toBeDisabled();
 await page.locator('[data-select="kestrel-stack"]').click();await seek(page,.55);await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.screenshot({path:'docs/evidence/staging-launch.png',fullPage:true});
 await page.getByLabel('Camera tracking').selectOption('follow');await page.getByLabel('Reference frame').selectOption('kestrel-stack');await seek(page,.8);
 expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([false,true,true]);expect((await state(page)).frame).toBe('inertial');expect((await state(page)).camera.tracking).toBe('off');await expect(page.locator('#object-status')).toHaveText('Separated');await expect(page.locator('#frame option[value="kestrel-stack"]')).toHaveJSProperty('disabled',true);
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Camera view').selectOption('oblique');await page.locator('[data-select="kestrel"]').click();await page.getByLabel('Reference frame').selectOption('kestrel');await seek(page,1.2);
 await page.locator('#layers > summary').click();await page.getByLabel('See-through bodies').check();const flying=await state(page);expect(flying.thrustWhiskers.some((w:any)=>w.vessel==='kestrel')).toBe(true);expect(flying.thrustWhiskers.flatMap((w:any)=>[...w.from,...w.to]).every(Number.isFinite)).toBe(true);
 await page.getByLabel('Reference frame').selectOption('inertial');await page.screenshot({path:'docs/evidence/staging-recovery.png',fullPage:true});
 await page.locator('#layers > summary').click();await page.getByLabel('Camera view').selectOption('top');await seek(page,1.6);
 const braking=await state(page),ship=braking.ships.find((s:any)=>s.id==='kestrel');
 expect(ship.glyph).toBe('rocket');expect(ship.axis).toEqual(ship.thrust.direction);
 const speed=Math.hypot(...ship.y.slice(3));expect(ship.axis.reduce((n:number,x:number,i:number)=>n+x*ship.y[i+3]/speed,0)).toBeLessThan(-.99);
 const painted=await page.evaluate(({screen,t})=>(window as any).rocketPaint.filter((p:any)=>Math.abs(p.t-t)<1e-8&&Math.hypot(p.x-screen[0],p.y-screen[1])<.01).at(-1),{screen:ship.screen,t:braking.t});
 expect(painted,JSON.stringify({screen:ship.screen,t:braking.t,trace:await page.evaluate(()=>(window as any).rocketPaint.slice(-6))})).toBeTruthy();const length=Math.hypot(painted.dx,painted.dy);expect(painted.dx/length).toBeCloseTo(ship.axis[0],10);expect(painted.dy/length).toBeCloseTo(-ship.axis[1],10);
 await page.getByRole('button',{name:'Surface view',exact:true}).click();await page.screenshot({path:'docs/evidence/staging-rocket.png',fullPage:true});
 await seek(page,1.8);const landed=(await state(page)).ships.find((s:any)=>s.id==='kestrel');
 expect(landed.axis[0]).toBeCloseTo(Math.cos(Math.PI/2+.003*1.8),10);expect(landed.axis[1]).toBeCloseTo(Math.sin(Math.PI/2+.003*1.8),10);
 await page.locator('[data-select="wren"]').click();await seek(page,1.3);const coast=(await state(page)).ships.find((s:any)=>s.id==='wren');expect(coast.thrust).toBeUndefined();const held=coast.axis;
 await seek(page,1.4);expect((await state(page)).ships.find((s:any)=>s.id==='wren').axis).toEqual(held);
 await seek(page,1.3);expect((await state(page)).ships.find((s:any)=>s.id==='wren').axis).toEqual(held);
 await seek(page,4);const final=await state(page);expect(final.ships.find((s:any)=>s.id==='kestrel').logistics.dockedPortId).toBe('Cairn');expect(final.ships.find((s:any)=>s.id==='wren').logistics.dockedPortId).toBe('Lantern');expect(final.stocks.find((s:any)=>s.id==='Lantern').cargo).toBe(.1);expect(final.stocks.map((s:any)=>s.occupied)).toEqual([1,1]);
 await page.locator('[data-select="wren"]').click();await page.getByLabel('Reference frame').selectOption('wren');await page.getByLabel('Camera tracking').selectOption('chase');await seek(page,1.2);await seek(page,.6);expect((await state(page)).frame).toBe('inertial');expect((await state(page)).camera.tracking).toBe('off');await seek(page,4);expect((await state(page)).ships.map(({id,present,y,propellant,logistics}:any)=>({id,present,y,propellant,logistics}))).toEqual(final.ships.map(({id,present,y,propellant,logistics}:any)=>({id,present,y,propellant,logistics})));
 await page.locator('[data-select="kestrel-stack"]').click();await seek(page,.6);await page.locator('#next-event').click();expect((await state(page)).t).toBe(d.separation.t);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([false,true,true]);
 await page.locator('#restart').click();expect((await state(page)).t).toBe(0);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);
 await setRate(page,0.25);
 await page.getByLabel('Model set').selectOption('orison-service');await ready(page,'orison-service');await pause(page);expect((await state(page)).playbackRate).toBe(1);await page.getByLabel('Model set').selectOption('selene-staging');await ready(page,'selene-staging');await pause(page);await seek(page,0);expect((await state(page)).ships.map((s:any)=>s.present)).toEqual([true,false,false]);expect((await state(page)).playbackRate).toBe(.25);expect(errors).toEqual([]);
});
