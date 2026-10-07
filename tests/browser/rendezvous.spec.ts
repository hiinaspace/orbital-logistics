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
