import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { EditorSession } from '../../src/editor/session';
import { Runner } from '../../src/sim/runner';
import { validateBundle } from '../../src/sim/schema';
import { project } from '../../src/view/coordinates';
import { bodyState } from '../../src/sim/dynamics';

const orbit = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m1-orbit.json', import.meta.url), 'utf8')));
const binary = validateBundle(JSON.parse(readFileSync(new URL('../../fixtures/m0-binary.json', import.meta.url), 'utf8')));
async function state(page: Page) { return JSON.parse(await page.locator('#state-json').textContent() ?? '{}'); }
async function ready(page: Page) { await expect.poll(async () => { const s = await state(page); return !s.pending && s.readyRevision === s.revision; }).toBe(true); }
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
async function canvasPoint(page: Page, p: number[]): Promise<[number, number]> {
  const r = (await page.locator('canvas').boundingBox())!;
  return [r.x + p[0] * r.width / 1000, r.y + p[1] * r.height / 650];
}
async function add(page: Page, time = 1.137) {
  if (await page.locator('#plan').textContent() === 'Plan trajectory') await page.locator('#plan').click();
  await page.locator('#epoch').fill(String(time)); await page.locator('#add').click(); await ready(page);
}
async function component(page: Page, id: string, value: string) {
  if (!(await page.locator('#precision').getAttribute('open'))) { // empty boolean attributes are present but falsy
    if (!await page.locator('#radial').isVisible()) await page.locator('#precision summary').click();
  }
  await page.locator('#' + id).fill(value); await page.locator('#' + id).press('Tab'); await ready(page);
}
async function handleMove(page: Page, delta: number, cancel = false) {
  const before = await state(page), h = before.handles.find((h: any) => h.axis === 'transverse');
  const start = await canvasPoint(page, h.p);
  const end = await canvasPoint(page, [h.p[0] + h.direction[0] * delta * 600, h.p[1] + h.direction[1] * delta * 600]);
  await page.mouse.click(...start); expect((await state(page)).mode).toBe('handle-edit');
  await page.mouse.move(...end); if (cancel) await page.keyboard.press('Escape'); else await page.mouse.click(...end);
  await ready(page);
}
async function load(page: Page, json: string) {
  if (!await page.locator('#json').isVisible()) await page.locator('#files').click();
  await page.locator('#json').fill(json); await page.locator('#load').click(); await ready(page);
}

test('playback uses the core while preview is independent', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Logistics', exact: true })).toBeVisible();
  const runner = new Runner(orbit);
  await page.locator('#step').click(); expect((await state(page)).y).toEqual(runner.advanceTo(0.25).y);
  await page.locator('#epoch').fill('6'); expect((await state(page)).t).toBe(0.25); expect((await state(page)).previewTime).toBe(6);
  await page.locator('#play').click(); await expect.poll(async () => (await state(page)).t).toBeGreaterThan(0.3);
  await page.locator('#play').click(); await expect(page.locator('#status')).toHaveText('Paused');
  const paused = await state(page); await page.waitForTimeout(60); expect((await state(page)).t).toBe(paused.t);
  await page.locator('#reset').click(); expect((await state(page)).y).toEqual(orbit.scenario.ship.state);
});

test('path hover, click-to-pin and latched handle achieve, undo and reverse the orbit goal', async ({ page }) => {
  await page.locator('#plan').click();
  const s = await state(page), time = 1.137, p = project([Math.cos(time), Math.sin(time)], s.camera);
  await page.mouse.move(...await canvasPoint(page, p));
  expect((await state(page)).draft.burns).toHaveLength(0);
  expect((await state(page)).previewTime).toBeCloseTo(time, 2);
  await page.mouse.click(...await canvasPoint(page, p)); await ready(page);
  const node = (await state(page)).draft.burns[0]; expect(node.t).toBeCloseTo(time, 2);
  await handleMove(page, 0.1); await expect(page.locator('#goal-value')).toContainText('In band');
  expect((await state(page)).draft.burns[0].transverse).toBeCloseTo(0.1, 2);
  expect((await state(page)).accepted.burns).toHaveLength(0);
  await page.screenshot({ path: 'docs/evidence/m1-orbit.png', fullPage: true });
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft.burns[0].transverse).toBe(0);
  await handleMove(page, -0.05); expect((await state(page)).draft.burns[0].transverse).toBeLessThan(0);
  await expect(page.locator('#goal-value')).not.toContainText('In band');
  await handleMove(page, 0.03, true); expect((await state(page)).draft.burns[0].transverse).toBeCloseTo(-0.05, 2);
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft.burns[0].transverse).toBe(0);
  const h = (await state(page)).handles.find((h: any) => h.axis === 'transverse');
  await page.mouse.click(...await canvasPoint(page, h.p));
  await page.mouse.move(...await canvasPoint(page, [h.p[0] + h.direction[0] * 30, h.p[1] + h.direction[1] * 30]));
  await page.locator('[data-object="primary"]').click(); await ready(page);
  expect((await state(page)).mode).not.toBe('handle-edit');
  expect((await state(page)).draft.burns[0].transverse).toBe(0);
});

test('numeric edits, bounds, deletion, history and latest worker revision', async ({ page }) => {
  await add(page); await component(page, 'transverse', '0.1');
  for (const value of ['0.09', '0.11', '0.08']) { await page.locator('#transverse').fill(value); await page.locator('#transverse').press('Tab'); }
  await ready(page); const current = await state(page);
  expect(current.draft.burns[0].transverse).toBe(0.08); expect(current.readyRevision).toBe(current.revision);
  await component(page, 'radial', '0.3'); await expect(page.locator('#message')).toContainText('Range');
  expect((await state(page)).draft.burns[0].radial).toBe(0);
  await component(page, 'burn-time', '2'); expect((await state(page)).draft.burns[0].t).toBe(2);
  await page.locator('#delete').click(); await ready(page); expect((await state(page)).draft.burns).toHaveLength(0);
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft.burns).toHaveLength(1);
  await page.locator('#redo').click(); await ready(page); expect((await state(page)).draft.burns).toHaveLength(0);
});

test('queue apsis snap, stale provenance, explicit re-snap, execute and save/load', async ({ page }) => {
  const session = new EditorSession(orbit), first = session.addBurn(0, 'primary'); session.updateBurn(first, { transverse: 0.1 }); session.addBurn(6, 'primary');
  await load(page, session.serialize(6)); await page.locator('[data-burn="burn-2"]').click();
  await page.locator('#snap').click(); await ready(page); const snapped = (await state(page)).draft.burns[1].t;
  expect(snapped).toBeGreaterThan(4); expect(snapped).toBeLessThan(6);
  await page.locator('[data-burn="burn-1"]').click(); await component(page, 'transverse', '0.101');
  await page.locator('[data-burn="burn-2"]').click();
  await expect(page.locator('#snap-state')).toContainText('stale'); await expect(page.locator('#execute')).toBeDisabled();
  expect((await state(page)).draft.burns[1].t).toBe(snapped);
  await page.locator('#snap').click(); await ready(page); await expect(page.locator('#execute')).toBeEnabled();
  await page.locator('#execute').click(); await page.locator('#play').click();
  const executed = await state(page), runner = new Runner({ scenario: orbit.scenario, program: executed.accepted });
  expect(executed.y).toEqual(runner.advanceTo(executed.t).y);
  await page.locator('#save').click(); const saved = await page.locator('#json').inputValue(), savedState = await state(page);
  expect(JSON.parse(saved).editor.baseline.burns).toHaveLength(0);
  await page.locator('#reset').click(); await page.locator('#load').click(); await ready(page);
  expect((await state(page)).y).toEqual(savedState.y); expect((await state(page)).draft).toEqual(savedState.draft);
  const before = await state(page); await page.locator('#json').fill('{"scenario":{}}'); await page.locator('#load').click();
  await expect(page.locator('#import-status')).toContainText('Import rejected'); expect((await state(page)).draft).toEqual(before.draft);
  const downloading = page.waitForEvent('download'); await page.locator('#download').click(); expect((await downloading).suggestedFilename()).toBe('orbital-logistics-plan.json');
});

test('moon preview and body-centered frames use synchronized sample-time origins', async ({ page }) => {
  await page.locator('#scene').selectOption('moon'); await ready(page); await add(page);
  await component(page, 'radial', '0.015'); await component(page, 'transverse', '-0.01');
  const program = (await state(page)).draft;
  await page.locator('#epoch').fill('2.5'); await page.locator('#frame').selectOption('moon');
  const centered = await state(page), moon = centered.objectPoints.find((o: any) => o.id === 'moon');
  expect(moon.p).toEqual(project([0, 0], centered.camera)); expect(centered.t).toBe(0);
  await page.locator('#frame').selectOption('inertial');
  const inertial = await state(page), body = bodyState(binary.scenario.bodies[1], 2.5);
  const actual = inertial.objectPoints.find((o: any) => o.id === 'moon').p, expected = project(body, inertial.camera);
  expect(actual[0]).toBeCloseTo(expected[0], 5); expect(actual[1]).toBeCloseTo(expected[1], 5);
  expect(inertial.draft).toEqual(program);
  await page.locator('#frame').selectOption('ship'); expect((await state(page)).draft).toEqual(program);
  await page.locator('#frame').selectOption('moon'); await page.screenshot({ path: 'docs/evidence/m1-moon.png', fullPage: true });
});

test('visible apsides place snapped nodes and node clicks edit time as one reversible gesture', async ({ page }) => {
  const session = new EditorSession(orbit), first = session.addBurn(0, 'primary');
  session.updateBurn(first, { transverse: 0.1 });
  await load(page, session.serialize(4.7));
  // Apsis markers are visible even outside planning mode and without a node there.
  const apsis = (await state(page)).apsisPoints.find((a: any) => a.event.kind === 'apoapsis');
  expect(apsis).toBeTruthy(); expect((await state(page)).draft.burns).toHaveLength(1);
  await page.locator('#files').click(); await page.locator('#plan').click();
  const p = await canvasPoint(page, [apsis.p[0] + 2, apsis.p[1] + 2]);
  await page.mouse.move(...p); expect((await state(page)).previewTime).toBe(apsis.event.t);
  await page.mouse.click(...p); await ready(page);
  const snapped = (await state(page)).draft.burns[1];
  expect(snapped.t).toBe(apsis.event.t); expect(snapped.snap.kind).toBe('apoapsis');
  await expect(page.locator('#snap-state')).toContainText('Snapped');
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft.burns).toHaveLength(1);
  await page.locator('#redo').click(); await ready(page);
  const node = (await state(page)).nodePoints.find((n: any) => n.id === snapped.id);
  await page.mouse.click(...await canvasPoint(page, node.p)); expect((await state(page)).mode).toBe('time-edit');
  const moved = await canvasPoint(page, [node.p[0] + 40, node.p[1]]);
  await page.mouse.move(...moved); await page.mouse.click(...moved); await ready(page);
  const shifted = (await state(page)).draft.burns[1];
  expect(shifted.t - snapped.t).toBeGreaterThan(0.37); expect(shifted.t - snapped.t).toBeLessThan(0.43); expect(shifted.snap).toBeUndefined();
  expect(shifted.radial).toBe(snapped.radial); expect(shifted.transverse).toBe(snapped.transverse);
  expect((await state(page)).accepted.burns).toHaveLength(0);
  await page.locator('#undo').click(); await ready(page); expect((await state(page)).draft.burns[1]).toEqual(snapped);
  const restored = (await state(page)).nodePoints.find((n: any) => n.id === snapped.id);
  await page.mouse.click(...await canvasPoint(page, restored.p));
  await page.mouse.move(...await canvasPoint(page, [restored.p[0] - 60, restored.p[1]]));
  await page.keyboard.press('Escape'); await ready(page); expect((await state(page)).draft.burns[1]).toEqual(snapped);
  // Time gestures cannot cross adjacent burns or create duplicate epochs.
  await add(page, 6); const middle = (await state(page)).nodePoints.find((n: any) => n.id === snapped.id);
  await page.mouse.click(...await canvasPoint(page, middle.p));
  const far = await canvasPoint(page, [middle.p[0] + 500, middle.p[1]]);
  await page.mouse.move(...far); await page.mouse.click(...far); await ready(page);
  expect((await state(page)).draft.burns[1].t).toBeCloseTo(5.999999, 6);
  await page.locator('#undo').click(); await ready(page);
  await page.screenshot({ path: 'docs/evidence/m1-apsis-editor.png', fullPage: true });
});

test('rejected burn and unsupported approach block execution and truncate the path', async ({ page }) => {
  const bundle = structuredClone(orbit);
  bundle.program.burns = [{ id: 'bad', t: 1.137, referenceBodyId: 'primary', basis: 'radial-transverse-ccw-v1', radial: 0, transverse: 100 }];
  await load(page, JSON.stringify(bundle)); await expect(page.locator('#execute')).toBeDisabled();
  expect((await state(page)).terminal.status).toBe('burn-rejected'); expect((await state(page)).terminal.t).toBe(1.137);
  bundle.program.burns[0].radial = -200; bundle.program.burns[0].transverse = 0;
  await load(page, JSON.stringify(bundle)); await expect(page.locator('#execute')).toBeDisabled();
  expect((await state(page)).terminal.status).toBe('burn-rejected'); // fuel is checked before a dangerous coast can execute
  const impact = structuredClone(orbit); impact.scenario.ship.state = [1, 0, -200, 0];
  await load(page, JSON.stringify(impact)); expect((await state(page)).terminal.status).toBe('unsupported-approach');
  await expect(page.locator('#execute')).toBeDisabled();
});
