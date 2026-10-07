import { test, expect, type Page } from '@playwright/test';
import { Runner } from '../../src/sim/runner';
import { readFileSync } from 'node:fs';
import { validateBundle } from '../../src/sim/schema';
const fixture = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m2-rendezvous.json', import.meta.url), 'utf8')));
async function state(page: Page) { return JSON.parse(await page.locator('#state-json').textContent() ?? '{}'); }
async function ready(page: Page) { await expect.poll(async () => { const s = await state(page); return !s.pending && s.readyRevision === s.revision; }).toBe(true); }
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({page}) => {
  const list: string[] = []; errors.set(page, list); page.on('pageerror', e => list.push(e.message));
  page.on('console', m => { if (m.type() === 'error') list.push(m.text()); });
  await page.goto('/'); await ready(page); await page.locator('#scene').selectOption('rendezvous'); await ready(page);
  await page.locator('[data-burn="departure"]').click();
});
test.afterEach(async ({page}) => { expect(errors.get(page)).toEqual([]); });
test('rendezvous is an explicit reversible proposal with a charged arrival and reproducible execution', async ({page}) => {
  const before = await state(page);
  await page.locator('#solve').click(); await expect(page.locator('#proposal')).toBeVisible();
  const solved = await state(page); expect(solved.draft).toEqual(before.draft); expect(solved.accepted).toEqual(before.accepted);
  expect(solved.targeting.proposal.program.burns).toHaveLength(2);
  await page.locator('#reject-proposal').click(); expect((await state(page)).draft).toEqual(before.draft);
  await page.locator('#solve').click(); await expect(page.locator('#proposal')).toBeVisible();
  await page.screenshot({path: 'test-results/m2-proposal.png', fullPage: true});
  await page.locator('#accept-proposal').click(); await ready(page);
  await expect(page.locator('#goal-value')).toHaveText('Matched');
  const acceptedDraft = (await state(page)).draft; expect(acceptedDraft.burns).toHaveLength(2);
  expect((await state(page)).accepted).toEqual(before.accepted);
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft).toEqual(before.draft);
  await page.locator('#redo').click(); await ready(page); expect((await state(page)).draft).toEqual(acceptedDraft);
  await page.locator('[data-burn="rendezvous-arrival"]').click(); await page.locator('#frame').selectOption('target');
  expect((await state(page)).draft).toEqual(acceptedDraft);
  await page.screenshot({path: 'test-results/m2-arrival.png', fullPage: true});
  await page.locator('#execute').click(); await page.locator('#warp').selectOption('16');
  await expect(page.locator('#status')).toHaveText('Complete');
  const execution = await state(page), runner = new Runner({scenario: fixture.scenario, program: acceptedDraft});
  expect(execution.y).toEqual(runner.advanceTo(6).y); expect(execution.ledger).toHaveLength(2);
  await page.locator('#files').click(); await page.locator('#save').click();
  const saved = await page.locator('#json').inputValue(); expect(JSON.parse(saved).scenario.rendezvous.target.id).toBe('target');
  await page.locator('#reset').click(); await page.locator('#load').click(); await ready(page); expect((await state(page)).y).toEqual(execution.y);
});
test('cancelled and obsolete solves cannot replace a changed draft or execution', async ({page}) => {
  const before = await state(page);
  await page.locator('#solve').click(); await page.locator('#solve').click();
  await expect(page.locator('#proposal')).toBeHidden(); expect((await state(page)).targeting.solving).toBe(false);
  await page.locator('#precision summary').click();
  await page.locator('#solve').click(); await page.locator('#transverse').fill('0.07'); await page.locator('#transverse').press('Tab'); await ready(page);
  await page.waitForTimeout(400); const edited = await state(page);
  expect(edited.draft.burns[0].transverse).toBe(0.07); expect(edited.targeting.proposal).toBeNull();
  expect(edited.targeting.solving).toBe(false); expect(edited.accepted).toEqual(before.accepted);
});
test('an unaffordable arrival produces a readable failure and leaves the plan untouched', async ({page}) => {
  const low = structuredClone(fixture); low.scenario.ship.propellant = 0.05;
  await page.locator('#files').click(); await page.locator('#json').fill(JSON.stringify(low)); await page.locator('#load').click(); await ready(page);
  await page.locator('[data-burn="departure"]').click(); const before = await state(page);
  await page.locator('#solve').click(); await expect(page.locator('#solve-status')).toContainText('Not enough fuel for arrival burn');
  await expect(page.locator('#proposal')).toBeHidden(); expect((await state(page)).draft).toEqual(before.draft); expect((await state(page)).accepted).toEqual(before.accepted);
});

async function point(page: Page, p: number[]): Promise<[number, number]> {
  const r = (await page.locator('canvas').boundingBox())!; return [r.x + p[0] * r.width / 1000, r.y + p[1] * r.height / 650];
}
async function manual(page: Page, transverse = Math.sqrt(7 / 6) - 1) {
  await page.locator('#precision summary').click();
  await page.locator('#radial').fill('0'); await page.locator('#radial').press('Tab'); await ready(page);
  await page.locator('#transverse').fill(String(transverse)); await page.locator('#transverse').press('Tab'); await ready(page);
}
test('selected-node hover scrubs target without changing the node or execution', async ({page}) => {
  const before = await state(page), p = before.geometry.find((p: any) => p.t > 2 && p.t < 2.02);
  await page.mouse.move(...await point(page, p.p));
  const after = await state(page); expect(after.previewTime).toBeCloseTo(p.t, 2);
  expect(after.draft).toEqual(before.draft); expect(after.y).toEqual(before.y); expect(after.selectedBurn).toBe('departure');
  expect(after.objectPoints.find((o: any) => o.id === 'target').p).not.toEqual(before.objectPoints.find((o: any) => o.id === 'target').p);
});
test('recreated departure remains targetable at its authored epoch', async ({page}) => {
  await page.locator('#delete').click(); await ready(page); await expect(page.locator('#solve')).toBeDisabled();
  await page.locator('#epoch').fill('0.8'); await page.locator('#add').click(); await ready(page);
  await expect(page.locator('#solve')).toBeEnabled(); await page.locator('#solve').click();
  await expect(page.locator('#proposal')).toBeVisible(); expect((await state(page)).targeting.proposal.departure.t).toBe(0.8);
});
test('overlapping tangent markers offer intercept, orbit match and a manual maneuver', async ({page}) => {
  await manual(page); const before = await state(page), marker = before.encounterPoints.find((p: any) => p.event.kind === 'intercept');
  expect(marker).toBeTruthy(); await page.mouse.click(...await point(page, marker.p));
  await expect(page.getByRole('menuitem', {name: /^Intercept/})).toBeVisible();
  await expect(page.getByRole('menuitem', {name: /^Match orbit/})).toBeVisible();
  await expect(page.getByRole('menuitem', {name: /^Add new manual maneuver/})).toBeVisible();
  await page.screenshot({path: 'test-results/m2-encounter-menu.png', fullPage: true});
  await page.getByRole('menuitem', {name: /^Intercept/}).click(); await ready(page);
  await expect.poll(async () => (await state(page)).draft.burns.length).toBe(2); await ready(page);
  const after = await state(page); expect(after.draft.burns[0]).toEqual(before.draft.burns[0]);
  expect(after.draft.burns[1].assist.kind).toBe('intercept'); expect(after.accepted).toEqual(before.accepted);
  await expect(page.locator('#goal-value')).toHaveText('Matched');
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft).toEqual(before.draft);
  const restored = (await state(page)).encounterPoints.find((p: any) => p.event.kind === 'intercept');
  await page.mouse.click(...await point(page, restored.p)); await page.getByRole('menuitem', {name: /^Add new manual maneuver/}).click(); await ready(page);
  const added = (await state(page)).draft.burns[1]; expect(added.assist).toBeUndefined(); expect(added.transverse).toBe(0); expect(added.radial).toBe(0);
});
test('phase-offset crossing offers orbit matching without claiming an intercept', async ({page}) => {
  await manual(page, 0.1); const marker = (await state(page)).encounterPoints[0];
  await page.mouse.click(...await point(page, marker.p));
  await expect(page.getByRole('menuitem', {name: /^Intercept/})).toHaveCount(0);
  await page.getByRole('menuitem', {name: /^Match orbit/}).click();
  await expect.poll(async () => (await state(page)).draft.burns.length).toBe(2); await ready(page);
  await expect(page.locator('#goal-value')).toHaveText('Orbit matched');
  await page.screenshot({path: 'test-results/m2-orbit-matched.png', fullPage: true});
});
