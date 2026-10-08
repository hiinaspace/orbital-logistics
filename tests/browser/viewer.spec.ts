import {test, expect, type Page} from '@playwright/test';
async function state(page: Page) { return JSON.parse(await page.locator('#state-json').textContent() ?? '{}'); }
async function ready(page: Page) { await expect.poll(async () => (await state(page)).ready, {timeout: 20000}).toBe(true); }
async function pause(page: Page) { if ((await state(page)).playing) await page.getByRole('button', {name:'Pause', exact:true}).click(); }
async function seek(page: Page, t: number) { const rounded = Math.round(t * 1000) / 1000; await page.getByLabel('Simulation time').fill(String(rounded)); await expect.poll(async () => (await state(page)).t).toBe(rounded); }
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({page}) => {
  const list: string[] = []; errors.set(page, list);
  page.on('pageerror', e => list.push(e.message));
  page.on('console', m => {if (m.type() === 'error') list.push(m.text());});
  await page.goto('/'); await ready(page); await pause(page);
});
test.afterEach(async ({page}) => expect(errors.get(page)).toEqual([]));

test('freight scene is immediately watchable; shared resources and all ships rewind together', async ({page}) => {
  await expect(page.locator('#fleet .object-row')).toHaveCount(4);
  await expect(page.locator('#stations .object-row')).toHaveCount(4);
  await expect(page.getByRole('button', {name:'Plan trajectory'})).toHaveCount(0);
  await seek(page, 0); const initial = await state(page);
  initial.ships.forEach((s: {propellant:number;logistics:{cargoMass:number}}) => {expect(s.propellant).toBe(0.65);expect(s.logistics.cargoMass).toBe(0);});
  const e = initial.events.find((e:{vessel:string;kind:string}) => e.vessel === 'Kestrel' && e.kind === 'transfer');
  await seek(page, e.t); expect((await state(page)).ships[0].logistics.cargoMass).toBe(0.16);
  await seek(page, 50); const later = await state(page);
  expect(later.stocks).not.toEqual(initial.stocks);
  await seek(page, 6); const first = await state(page);
  await seek(page, 19); await seek(page, 6); const second = await state(page);
  expect(second.ships.map((s:{y:number[]}) => s.y)).toEqual(first.ships.map((s:{y:number[]}) => s.y));
  expect(second.stocks).toEqual(first.stocks); expect(second.events).toEqual(initial.events);
  await page.screenshot({path:'test-results/model-set-freight.png', fullPage:true});
  await page.locator('#fleet [data-object="Kestrel"]').click();
  await expect(page.locator('.budget-chart')).toBeVisible();
  await page.locator('#next-event').click();
  expect((await state(page)).t).toBeGreaterThan(6);
  await page.locator('#stations [data-object="Anchor"]').click();
  await expect(page.locator('#readouts')).toContainText('Freight stock');
});

test('frames and layers change presentation without changing the fleet, stocks or events', async ({page}) => {
  await seek(page, 8.7); const before = await state(page);
  for (const frame of ['rotating', 'Anchor', 'Kestrel', 'inertial']) {
    await page.getByLabel('Reference frame').selectOption(frame);
    await expect.poll(async () => (await state(page)).frame).toBe(frame);
    const s = await state(page);
    expect(s.ships.map((s:{y:number[]}) => s.y)).toEqual(before.ships.map((s:{y:number[]}) => s.y));
    expect(s.stocks).toEqual(before.stocks); expect(s.events).toEqual(before.events);
  }
  await page.locator('#layers summary').click();
  await page.locator('#layer-orbits').uncheck(); await page.getByRole('button', {name:'Clear view'}).click();
  expect((await state(page)).layers).toEqual({orbits:false,trails:false,plan:false,labels:false});
  await page.getByRole('button', {name:'Clear view'}).click();
  expect((await state(page)).layers).toEqual({orbits:false,trails:true,plan:true,labels:true});
  expect((await state(page)).stocks).toEqual(before.stocks);
});

test('overlapping docked objects open a chooser; panning and zooming preserve selection and time', async ({page}) => {
  await seek(page, 0);
  await expect.poll(async () => (await state(page)).hits.filter((h:{id:string}) => h.id === 'Anchor').length).toBe(1);
  const s = await state(page), anchor = s.hits.find((h:{id:string}) => h.id === 'Anchor');
  const box = (await page.locator('#space').boundingBox())!;
  await page.mouse.click(box.x + anchor.x, box.y + anchor.y);
  await expect(page.locator('#hit-menu')).toBeVisible();
  await page.locator('#hit-menu').getByRole('button', {name:'Petrel',exact:true}).click();
  expect((await state(page)).selected).toBe('Petrel');
  await page.getByRole('button', {name:'View from here'}).click();
  expect((await state(page)).frame).toBe('Petrel');
  const before = await state(page);
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2); await page.mouse.wheel(0,-180);
  await expect.poll(async () => (await state(page)).camera.scale).toBeGreaterThan(before.camera.scale);
  await page.mouse.down(); await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+30); await page.mouse.up();
  await expect.poll(async () => (await state(page)).camera.center).not.toEqual(before.camera.center);
  expect((await state(page)).t).toBe(0); expect((await state(page)).selected).toBe('Petrel');
});

test('lunar set supports rotating exploration, finite playback and explicit replay', async ({page}) => {
  await page.getByLabel('Model set').selectOption('lunar-loop'); await ready(page); await pause(page);
  await expect(page.locator('#fleet .object-row')).toHaveCount(1);
  await page.getByLabel('Reference frame').selectOption('rotating');
  await seek(page, 7); await page.screenshot({path:'test-results/model-set-lunar.png',fullPage:true});
  await seek(page, 23.99); await page.getByLabel('Playback speed').fill('4'); await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await expect(page.locator('#load-status')).toHaveText('End of scene');
  expect((await state(page)).t).toBe(24);
  await page.getByLabel('Replay',{exact:true}).check(); await seek(page,23.99); await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(async () => (await state(page)).t).toBeLessThan(23);
  await pause(page);
  await page.getByLabel('Model set').selectOption('orison-freight');
  await page.locator('#restart').click(); // Loading controls must be safe.
  await page.getByLabel('Model set').selectOption('lunar-loop'); await ready(page);
  expect((await state(page)).set).toBe('lunar-loop');
});

test('narrow layout keeps the scene and transport usable without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width:780,height:860}); await seek(page,3);
  await expect(page.locator('#space')).toBeVisible();
  await expect(page.locator('#time')).toBeVisible();
  const dimensions = await page.evaluate(() => ({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({path:'test-results/model-set-narrow.png',fullPage:true});
});


test('labels retain anchors through scrub, reversal, frames, pause and selection',async({page})=>{
  await seek(page,6);const initial=await state(page),anchors=new Map(initial.labels.map((l:{id:string;anchor:number})=>[l.id,l.anchor]));
  for(const t of [6.01,6.2,6.1,6,8,4,6]) {
    await seek(page,t);
    for(const l of (await state(page)).labels)if(anchors.has(l.id))expect(l.anchor).toBe(anchors.get(l.id));
  }
  await page.getByLabel('Reference frame').selectOption('rotating');
  await expect.poll(async()=> (await state(page)).frame).toBe('rotating');
  for(const l of (await state(page)).labels)if(anchors.has(l.id))expect(l.anchor).toBe(anchors.get(l.id));
  await page.locator('#fleet [data-object="Tern"]').click();
  await expect.poll(async()=> (await state(page)).labels.find((l:{id:string})=>l.id==='Tern')?.alpha).toBe(1);
  const before=(await state(page)).labels.map((l:{id:string;anchor:number;left:number;top:number})=>[l.id,l.anchor,l.left,l.top]);
  await expect.poll(async()=> (await state(page)).labels.map((l:{id:string;anchor:number;left:number;top:number})=>[l.id,l.anchor,l.left,l.top])).toEqual(before);
});

test('lunar freight exposes three finite round trips, depot stocks and shared rotating frames',async({page})=>{
  await page.getByLabel('Model set').selectOption('selene-freight');await ready(page);await pause(page);
  await expect(page.locator('#fleet .object-row')).toHaveCount(3);await expect(page.locator('#stations .object-row')).toHaveCount(3);
  await seek(page,12);const end=await state(page);
  expect(end.stocks.find((p:{id:string})=>p.id==='Selene Hub').cargo).toBeCloseTo(.48,12);
  expect(end.ships.every((s:{propellant:number;logistics:{dockedPortId:string;cargoMass:number}})=>s.propellant>.05 && s.logistics.cargoMass===0 && ['Nightfall','Meridian'].includes(s.logistics.dockedPortId))).toBe(true);
  await seek(page,8);const before=await state(page);
  for(const frame of ['rotating','Selene Hub','moon','inertial']) {
    await page.getByLabel('Reference frame').selectOption(frame);await expect.poll(async()=> (await state(page)).frame).toBe(frame);
    expect((await state(page)).ships.map((s:{y:number[]})=>s.y)).toEqual(before.ships.map((s:{y:number[]})=>s.y));
  }
  await page.getByLabel('Reference frame').selectOption('rotating');
  await page.locator('#stations [data-object="Selene Hub"]').click();await expect(page.locator('#readouts')).toContainText('Freight stock');
  await page.screenshot({path:'test-results/selene-freight.png',fullPage:true});
  await seek(page,0);expect((await state(page)).stocks.find((p:{id:string})=>p.id==='Selene Hub').cargo).toBe(0);
});

test('continuous playback speed supports intermediate rates without changing physics or pause',async({page})=>{
  await seek(page,8);const before=await state(page);
  await page.getByLabel('Playback speed').fill('-1');
  expect((await state(page)).playbackRate).toBe(.5);
  expect((await state(page)).playing).toBe(false);
  expect((await state(page)).ships).toEqual(before.ships);
  await expect(page.locator('#speed-value')).toHaveText('0.50×');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(async()=> (await state(page)).t).toBeGreaterThan(8.05);
  await pause(page);const stopped=await state(page);
  await page.getByLabel('Playback speed').fill('0');
  expect((await state(page)).playing).toBe(false);expect((await state(page)).t).toBe(stopped.t);
});

test('powered freight shows finite acceleration, continuous resources and both completed returns',async({page})=>{
 await page.getByLabel('Model set').selectOption('selene-powered');await ready(page);await pause(page);
 await expect(page.locator('#fleet .object-row')).toHaveCount(2);await expect(page.locator('#stations .object-row')).toHaveCount(3);
 await page.locator('#fleet [data-object="Wren"]').click();await seek(page,.6);
 const burning=await state(page);expect(burning.ships[0].thrust.force).toBe(2);
 await expect(page.locator('#object-status')).toContainText('Powered flight');await expect(page.locator('#readouts')).toContainText('Thrust');
 await seek(page,.61);expect((await state(page)).ships[0].propellant).toBeLessThan(burning.ships[0].propellant);
 await page.getByLabel('Reference frame').selectOption('rotating');await seek(page,3.2);
 await page.screenshot({path:'test-results/selene-powered.png',fullPage:true});
 const before=await state(page);await page.getByLabel('Reference frame').selectOption('Wren');
 expect((await state(page)).ships.map((s:{y:number[];propellant:number})=>[s.y,s.propellant])).toEqual(before.ships.map((s:{y:number[];propellant:number})=>[s.y,s.propellant]));
 await seek(page,12);const end=await state(page);
 expect(end.stocks.find((p:{id:string})=>p.id==='Selene Hub').cargo).toBeCloseTo(.32,12);
 expect(end.ships.every((s:{propellant:number;logistics:{dockedPortId:string;cargoMass:number}})=>s.propellant>.05 && s.logistics.cargoMass===0 && s.logistics.dockedPortId==='Nightfall')).toBe(true);
 await page.getByLabel('Model set').selectOption('orison-powered');await ready(page);await pause(page);await seek(page,16);
 expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Anchor');
});

test('future thrust whiskers follow the plan layer and never mark flown history',async({page})=>{
 await page.getByLabel('Model set').selectOption('selene-powered');await ready(page);await pause(page);
 await seek(page,3.1);const future=await state(page);
 expect(future.thrustWhiskers.length).toBeGreaterThan(1);
 expect(future.thrustWhiskers.every((w:{t:number})=>w.t>=future.t && w.t<=3.5)).toBe(true);
 await page.getByLabel('Reference frame').selectOption('rotating');
 await expect.poll(async()=> (await state(page)).frame).toBe('rotating');
 const rotated=await state(page);expect(rotated.thrustWhiskers.map((w:{t:number})=>w.t).length).toBeGreaterThan(0);
 const box=(await page.locator('#space').boundingBox())!,ship=rotated.ships[0].screen;
 await page.mouse.move(box.x+ship[0],box.y+ship[1]);await page.mouse.wheel(0,-800);
 await expect.poll(async()=> (await state(page)).camera.scale).toBeGreaterThan(rotated.camera.scale);
 await page.screenshot({path:'test-results/future-thrust-whiskers.png',fullPage:true});
 await page.locator('#layers summary').click();await page.locator('#layer-plan').uncheck();
 await expect.poll(async()=> (await state(page)).thrustWhiskers.length).toBe(0);
 expect((await state(page)).layers.trails).toBe(true);
 await page.locator('#layer-plan').check();await seek(page,12);
 expect((await state(page)).thrustWhiskers).toEqual([]);
});

test('surface freight is readable at launch and orbital scales; frames and replay preserve the flight',async({page})=>{
 await page.getByLabel('Model set').selectOption('selene-ascent');await ready(page);await pause(page);await seek(page,0);
 await expect(page.getByRole('button',{name:'Launch view',exact:true})).toBeVisible();
 await expect(page.locator('#object-status')).toContainText('Loading');
 await page.getByRole('button',{name:'Launch view',exact:true}).click();
 expect((await state(page)).frame).toBe('Cairn');expect((await state(page)).camera.scale).toBeGreaterThan(1000);
 await seek(page,.31);await expect(page.locator('#object-status')).toContainText('Powered flight');await expect(page.locator('#readouts')).toContainText('Altitude');
 const launched=await state(page);expect(launched.stocks.find((s:{id:string})=>s.id==='Cairn').occupied).toBe(0);expect(launched.thrustWhiskers.length).toBeGreaterThan(0);
 await page.getByLabel('Playback speed').fill('-10');await expect(page.locator('#speed-value')).toHaveText('0.000977×');expect((await state(page)).playbackRate).toBeGreaterThan(0);
 await seek(page,.55);await page.screenshot({path:'docs/evidence/surface-launch.png',fullPage:true});await seek(page,.31);
 for(const frame of ['swift','rotating','Selene','inertial']){await page.getByLabel('Reference frame').selectOption(frame);const s=await state(page);expect(s.ships.map((v:{y:number[]})=>v.y)).toEqual(launched.ships.map((v:{y:number[]})=>v.y));expect(s.stocks).toEqual(launched.stocks);expect(s.events).toEqual(launched.events);}
 await seek(page,2.1);expect((await state(page)).ships[0].logistics.cargoMass).toBe(0);expect((await state(page)).ships[0].logistics.dockedPortId).toBe('Lantern');
 await page.screenshot({path:'docs/evidence/surface-orbit.png',fullPage:true});
 await seek(page,.31);expect((await state(page)).ships.map(({screen,...s}:{screen:unknown})=>s)).toEqual(launched.ships.map(({screen,...s}:{screen:unknown})=>s));
 await page.getByLabel('Replay',{exact:true}).check();await seek(page,5.99);await page.getByLabel('Playback speed').fill('4');await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>(await state(page)).t).toBeLessThan(5);await pause(page);
 for(const set of ['orison-service','selene-freight','selene-ascent','orison-service','selene-ascent']){await page.getByLabel('Model set').selectOption(set);await ready(page);await pause(page);expect((await state(page)).set).toBe(set);await expect(page.locator('#load-status')).not.toContainText('failed');}
});
