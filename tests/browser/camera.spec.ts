import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const powered=JSON.parse(readFileSync('fixtures/model-sets/selene-powered.json','utf8'));
async function state(p:Page){return JSON.parse(await p.locator('#state-json').textContent()??'{}');}
async function ready(p:Page){await expect.poll(async()=>(await state(p)).ready,{timeout:20000}).toBe(true);}
async function pause(p:Page){if((await state(p)).playing)await p.getByRole('button',{name:'Pause',exact:true}).click();}
async function seek(p:Page,t:number){await p.getByLabel('Simulation time').fill(String(t));await expect.poll(async()=>(await state(p)).t).toBe(t);}
const physical=(s:any)=>({ships:s.ships.map(({screen,occludedBy,...rest}:any)=>rest),stocks:s.stocks,events:s.events,t:s.t});
test('spatial camera orbits, pans, anchors zoom and returns overhead without editing the maneuver',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);
 await page.getByLabel('Model set').selectOption('crossing-planes');await ready(page);await pause(page);await seek(page,8);
 const initial=await state(page);expect(initial.camera.preset).toBe('oblique');expect(initial.ships.every((s:{y:number[]})=>Math.abs(s.y[2])>.5)).toBe(true);
 const box=(await page.locator('#space').boundingBox())!,x=box.x+box.width*.75,y=box.y+box.height*.25;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+30,{steps:5});await page.mouse.up();
 await expect.poll(async()=>(await state(page)).camera.yaw).toBeCloseTo(initial.camera.yaw-.36,8);expect((await state(page)).camera.preset).toBe('custom');expect(physical(await state(page))).toEqual(physical(initial));
 const rotated=await state(page);await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y-20);await page.mouse.up();await page.keyboard.up('Shift');
 await expect.poll(async()=>(await state(page)).camera.center).not.toEqual(rotated.camera.center);expect((await state(page)).camera.yaw).toBe(rotated.camera.yaw);
 await page.getByRole('button',{name:'Orbit',exact:true}).click();
 const explicitPan=await state(page);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-25,y+15);await page.mouse.up();
 await expect.poll(async()=>(await state(page)).camera.center).not.toEqual(explicitPan.camera.center);expect((await state(page)).camera.yaw).toBe(explicitPan.camera.yaw);
 await page.getByRole('button',{name:'Pan',exact:true}).click();await expect(page.getByRole('button',{name:'Orbit',exact:true})).toBeVisible();
 await page.mouse.move(x,y);await page.mouse.wheel(0,-200);await expect.poll(async()=>(await state(page)).camera.scale).toBeGreaterThan(rotated.camera.scale);
 await page.getByRole('button',{name:'Fit',exact:true}).click();expect((await state(page)).camera.preset).toBe('custom');
 for(const f of ['rotating','tern','lark','inertial']){await page.getByLabel('Reference frame').selectOption(f);expect(physical(await state(page))).toEqual(physical(initial));}
 await page.getByLabel('Camera view').selectOption('top');await expect.poll(async()=>(await state(page)).camera.preset).toBe('top');
 const top=await state(page);for(const s of top.ships){expect(s.screen[0]).toBeCloseTo(box.width/2+s.y[0]*top.camera.scale,6);expect(s.screen[1]).toBeCloseTo(box.height/2-s.y[1]*top.camera.scale,6);}
 await page.getByLabel('Camera view').selectOption('oblique');await page.locator('#space').focus();await page.keyboard.press('ArrowRight');await expect.poll(async()=>(await state(page)).camera.preset).toBe('custom');
 await page.keyboard.press('t');await expect.poll(async()=>(await state(page)).camera.preset).toBe('top');
 await page.getByLabel('Camera view').selectOption('oblique');await page.screenshot({path:'docs/evidence/spatial-viewer.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('rear ships and reference beacons are occluded and cannot be selected through a body',async({page})=>{
 await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('crossing-planes');await ready(page);await pause(page);await seek(page,13);await page.getByLabel('Camera view').selectOption('side');
 await expect.poll(async()=>(await state(page)).ships[0].occludedBy).toBe('Orison');const side=await state(page);expect(side.hits.some((h:{id:string})=>h.id==='tern')).toBe(false);expect(side.labels.some((l:{id:string})=>l.id==='tern')).toBe(false);
 const box=(await page.locator('#space').boundingBox())!;await page.mouse.click(box.x+side.ships[0].screen[0],box.y+side.ships[0].screen[1]);expect((await state(page)).selected).toBe('Orison');
 await page.getByLabel('Camera view').selectOption('top');await expect.poll(async()=>(await state(page)).hits.some((h:{id:string})=>h.id==='tern')).toBe(true);expect((await state(page)).ships[0].occludedBy).toBeUndefined();
 await seek(page,4);await page.getByLabel('Camera view').selectOption('front');const overlap=await state(page),target=overlap.hits.find((h:{id:string})=>h.id==='tern');
 await page.mouse.click(box.x+target.x,box.y+target.y);await expect(page.locator('#hit-menu')).toBeVisible();await page.locator('#hit-menu').getByRole('button',{name:'Tern',exact:true}).click();expect((await state(page)).selected).toBe('tern');
});
test('camera-projected exhaust whiskers and continuous surface history share unchanged physics',async({page})=>{
 test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);await page.getByLabel('Model set').selectOption('selene-powered');await ready(page);await pause(page);await seek(page,3.1);
 await page.getByLabel('Camera view').selectOption('oblique');const s=await state(page);expect(s.thrustWhiskers.length).toBeGreaterThan(0);
 const cy=Math.cos(s.camera.yaw),sy=Math.sin(s.camera.yaw),sp=Math.sin(s.camera.pitch),cp=Math.cos(s.camera.pitch);
 for(const w of s.thrustWhiskers){const v=powered.vessels.find((v:any)=>v.bundle.scenario.ship.id===w.vessel),a=v.bundle.program.thrustArcs.find((a:any)=>a.start<w.t&&a.end>w.t),d=a.direction;
  const x=cy*d[0]+sy*d[1],y=-sy*sp*d[0]+cy*sp*d[1]+cp*d[2],pixels=3+15*Math.sqrt(w.force/v.bundle.scenario.ship.engine.maxThrust);
  expect(w.to[0]-w.from[0]).toBeCloseTo(-x*pixels,6);expect(w.to[1]-w.from[1]).toBeCloseTo(y*pixels,6);
 }
 await page.getByLabel('Model set').selectOption('selene-service');await ready(page);await page.getByLabel('Playback speed').fill('4');await expect.poll(async()=>(await state(page)).traffic.frontier,{timeout:30000}).toBeGreaterThan(14);await pause(page);await expect.poll(async()=>(await state(page)).traffic.pending).toBe(false);await seek(page,9.9);
 const baseline=await state(page);for(const camera of ['oblique','front','side','top']){await page.getByLabel('Camera view').selectOption(camera);expect(physical(await state(page))).toEqual(physical(baseline));expect((await state(page)).traffic.frontier).toBe(baseline.traffic.frontier);}
 await page.getByLabel('Camera view').selectOption('oblique');const timings=await page.evaluate(async()=>{const xs:number[]=[];let last=performance.now();for(let i=0;i<60;i++)await new Promise<void>(resolve=>requestAnimationFrame(t=>{xs.push(t-last);last=t;resolve();}));xs.sort((a,b)=>a-b);return {median:xs[30],p95:xs[57]};});
 writeFileSync('docs/evidence/spatial-viewer-browser.json',JSON.stringify({frameIntervalsMs:timings,note:'Production installed headless Chrome; continuous surface set, paused historical cursor9.9 in oblique view. Local diagnostic, not hardware-independent guarantee.'},null,2)+'\n');expect(timings.p95).toBeLessThan(200);
 await page.getByRole('button',{name:'Surface view',exact:true}).click();expect((await state(page)).camera.preset).toBe('top');expect((await state(page)).frame).toBe('Cairn');expect((await state(page)).camera.scale).toBeGreaterThan(1000);
 for(const id of ['orison-service','selene-return','crossing-planes']){await page.getByLabel('Model set').selectOption(id);await ready(page);await pause(page);expect((await state(page)).traffic?.error??'').toBe('');}
 expect(errors).toEqual([]);
});
