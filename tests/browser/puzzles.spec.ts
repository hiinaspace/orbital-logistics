import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const patient=JSON.parse(readFileSync('fixtures/m4-patient-solution.json','utf8'));
const express=JSON.parse(readFileSync('fixtures/m4-express-solution.json','utf8'));
async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page){await expect.poll(async()=>{const s=await state(page);return !s.pending&&s.readyRevision===s.revision;}).toBe(true);}
async function load(page:Page,bundle:unknown){await page.locator('#file-panel').evaluate((e:HTMLDetailsElement)=>e.open=true);await page.locator('#json').fill(JSON.stringify(bundle));await page.locator('#load').click();await ready(page);}
async function execute(page:Page){await page.locator('#warp').selectOption('16');await page.locator('#execute').click();await expect(page.locator('#status')).toHaveText('Complete');}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});await page.goto('/');await ready(page);});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
test('layer switches and bodies-only are reversible and leave the executed state/program unchanged',async({page})=>{
 await load(page,patient);await page.locator('#execute').click();await page.locator('#play').click();await page.locator('#step').click();
 const before=await state(page);await page.locator('#layers summary').click();await page.locator('#bodies-only').click();
 const after=await state(page);expect(after.layers).toEqual({plan:false,orbits:false,markers:false,trail:false});
 expect(after.geometry).toEqual([]);expect(after.nodePoints).toEqual([]);expect(after.apsisPoints).toEqual([]);expect(after.encounterPoints).toEqual([]);expect(after.handles).toEqual([]);
 expect(after.y).toEqual(before.y);expect(after.ledger).toEqual(before.ledger);expect(after.draft).toEqual(before.draft);expect(after.revision).toBe(before.revision);
 await page.screenshot({path:'test-results/m4-bodies.png',fullPage:true});
 await page.locator('#bodies-only').click();expect((await state(page)).layers).toEqual({plan:true,orbits:true,markers:true,trail:true});
 await page.locator('#layer-orbits').uncheck();await page.locator('#bodies-only').click();await page.locator('#bodies-only').click();expect((await state(page)).layers.orbits).toBe(false);
 await page.locator('#layer-plan').uncheck();expect((await state(page)).geometry).toEqual([]);
});
test('port targeting accepts a paid return as one undoable proposal; target edits cancel stale work',async({page})=>{
 await page.locator('#scene').selectOption('return-ticket');await ready(page);await expect(page.locator('#round-trip')).toBeHidden();
 await page.locator('#port-place').click();await ready(page);const before=await state(page);
 await page.locator('#solve').click();await expect(page.locator('#proposal')).toBeVisible({timeout:15000});
 expect((await state(page)).draft).toEqual(before.draft);await expect(page.locator('#proposal-values')).toContainText('Undock Depot');await expect(page.locator('#proposal-values')).toContainText('Dock Home');
 await page.locator('#port-arrival').fill('19.4');await page.locator('#port-arrival').press('Tab');await expect(page.locator('#proposal')).toBeHidden();
 await page.locator('#port-arrival').fill('19.5');await page.locator('#port-arrival').press('Tab');
 await page.locator('#solve').click();await expect(page.locator('#proposal')).toBeVisible({timeout:15000});await page.locator('#accept-proposal').click();await ready(page);
 await expect(page.locator('#goal-value')).toHaveText('Delivery complete');expect((await state(page)).draft.burns).toHaveLength(4);
 expect((await state(page)).accepted.burns).toHaveLength(2);await expect(page.locator('#solution-count')).toHaveText('0');
 const acceptedDraft=(await state(page)).draft;await page.locator('#undo').click();await ready(page);expect((await state(page)).draft).toEqual(before.draft);
 await page.locator('#redo').click();await ready(page);expect((await state(page)).draft).toEqual(acceptedDraft);
 await execute(page);await expect(page.locator('#puzzle-run')).toContainText('Solved');await expect(page.locator('#solution-count')).toHaveText('1');
 await page.locator('#puzzle-restart').click();await ready(page);await expect(page.locator('#goal-value')).toHaveText('Return to Home');await expect(page.locator('#solution-count')).toHaveText('1');
});
test('two executed tradeoffs persist, export and replay; deadline and altered rules do not earn false scores',async({page})=>{
 await load(page,patient);await expect(page.locator('#solution-count')).toHaveText('0');await execute(page);
 await load(page,express);await execute(page);await expect(page.locator('#solution-count')).toHaveText('2');
 await page.locator('#solutions summary').click();await expect(page.locator('#solution-list')).toContainText('19.627');await expect(page.locator('#solution-list')).toContainText('18.000');
 await page.screenshot({path:'test-results/m4-solutions.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download solution',exact:true}).first().click();expect((await download).suggestedFilename()).toBe('return-ticket-solution.json');
 await page.reload();await ready(page);await page.locator('#scene').selectOption('return-ticket');await ready(page);await expect(page.locator('#solution-count')).toHaveText('2');
 await page.locator('#solutions summary').click();await page.getByRole('button',{name:'Replay',exact:true}).first().click();await page.locator('#warp').selectOption('16');await expect(page.locator('#status')).toHaveText('Complete');await expect(page.locator('#puzzle-run')).toContainText('time 18.000');
 await page.locator('#scene').selectOption('express-return');await ready(page);await page.locator('#files').click();await page.locator('#save').click();const rules=JSON.parse(await page.locator('#json').inputValue()).scenario;
 await load(page,{...patient,scenario:rules});await execute(page);await expect(page.locator('#puzzle-run')).toBeEmpty();await expect(page.locator('#goal-value')).toContainText('after deadline');await expect(page.locator('#solution-count')).toHaveText('0');
 await load(page,{...express,scenario:rules});await execute(page);await expect(page.locator('#solution-count')).toHaveText('1');
 const altered=structuredClone(express);altered.scenario.ship.propellant=0.6;await load(page,altered);await expect(page.locator('#puzzle')).toBeHidden();
});
