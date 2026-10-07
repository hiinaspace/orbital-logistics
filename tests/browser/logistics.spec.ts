import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {Runner} from '../../src/sim/runner';
import {validateBundle} from '../../src/sim/schema';
const fixture = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m3-round-trip.json', import.meta.url),'utf8')));
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page){await expect.poll(async()=>{const s=await state(page);return !s.pending&&s.readyRevision===s.revision;}).toBe(true);}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
  const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});
  await page.goto('/');await ready(page);await page.locator('#scene').selectOption('delivery');await ready(page);
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});
test('delivery needs a reusable return; example trip executes and reloads all inventories',async({page})=>{
  await expect(page.locator('#goal-value')).toHaveText('Return to Home');
  expect((await state(page)).logisticsResult.delivered).toBe(0.2);
  await page.locator('#round-trip').click();await ready(page);
  await expect(page.locator('#goal-value')).toHaveText('Delivery complete');
  const plan=(await state(page)).draft;expect(plan.operations).toHaveLength(7);
  expect((await state(page)).accepted.operations).toHaveLength(5);
  await page.locator('#undo').click();await ready(page);await expect(page.locator('#goal-value')).toHaveText('Return to Home');
  await page.locator('#redo').click();await ready(page);
  await page.locator('#frame').selectOption('Depot');expect((await state(page)).draft).toEqual(plan);
  await page.locator('#frame').selectOption('inertial');
  await page.screenshot({path:'test-results/m3-plan.png',fullPage:true});
  await page.locator('#warp').selectOption('16');await page.locator('#execute').click();await expect(page.locator('#status')).toHaveText('Complete');
  const end=await state(page), runner=new Runner({scenario:fixture.scenario,program:plan});runner.advanceTo(24);
  for(let i=0;i<4;i++)expect(end.y[i]).toBeCloseTo(runner.current.y[i],12);
  expect(end.logistics.ports).toEqual(runner.current.logistics!.ports);expect(end.logistics.cargoMass).toBe(runner.current.logistics!.cargoMass);
  expect(end.logistics.fuelUsed).toBeCloseTo(runner.current.logistics!.fuelUsed,12);
  expect(end.ledger.map((e:any)=>[e.t,e.kind,e.id])).toEqual(runner.ledger.map(e=>[e.t,e.kind,e.id]));
  for(let i=0;i<end.ledger.length;i++)expect(end.ledger[i].fuelUsed).toBeCloseTo(runner.ledger[i].fuelUsed,12);
  expect(end.logistics.ports.map((p:any)=>p.cargo)).toEqual([0.8,0.2]);
  await page.screenshot({path:'test-results/m3-complete.png',fullPage:true});
  await page.locator('#files').click();await page.locator('#save').click();const json=await page.locator('#json').inputValue();
  await page.locator('#reset').click();await page.locator('#load').click();await ready(page);
  expect((await state(page)).logistics).toEqual(end.logistics);expect(JSON.parse(json).program.operations).toEqual(plan.operations);
});
test('mistimed docking is diagnosed, cannot execute, and repairing its epoch restores the plan',async({page})=>{
  await page.locator('[data-operation="dock-depot"]').click();
  await page.locator('#op-time').fill('4.5');await page.locator('#op-save').click();await ready(page);
  await expect(page.locator('#execute')).toBeDisabled();await expect(page.locator('#message')).toContainText('Capture Depot: miss');
  expect((await state(page)).terminal.status).toBe('operation-rejected');
  await page.screenshot({path:'test-results/m3-blocked.png',fullPage:true});
  await page.locator('#op-time').fill(String(fixture.program.burns[1].t));await page.locator('#op-save').click();await ready(page);
  await expect(page.locator('#execute')).toBeEnabled();await expect(page.locator('#goal-value')).toHaveText('Return to Home');
  await expect(page.locator('#message')).toBeEmpty();
});
test('operation authoring, inventory preview and deletion are reversible',async({page})=>{
  const original=(await state(page)).draft;
  await page.locator('#op-new').click();await page.locator('#op-time').fill('4.7');await page.locator('#op-kind').selectOption('undock');
  await page.locator('#op-port').selectOption('Depot');await page.locator('#op-save').click();await ready(page);
  await expect(page.locator('#message')).toContainText('Service unload-refuel finishes');
  await page.locator('#op-delete').click();await ready(page);expect((await state(page)).draft).toEqual(original);
  await page.locator('[data-operation="load"]').click();await page.locator('#op-kind').selectOption('transfer');
  await page.locator('#op-cargo').fill('0.3');await page.locator('#op-save').click();await ready(page);
  await expect(page.locator('#message')).toContainText('Transfer exceeds');
  await page.locator('#undo').click();await ready(page);expect((await state(page)).draft).toEqual(original);
  await page.locator('#epoch').fill('0.3');await page.getByText('Inventories at preview',{exact:true}).click();
  await expect(page.locator('#inventories')).toContainText('0.200 / 0.200');
});
