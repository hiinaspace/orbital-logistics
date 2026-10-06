import { expect, test, type Page } from '@playwright/test';
import { circular, impulse } from '../sim/helpers';
import { Runner } from '../../src/sim/runner';
import { validateBundle } from '../../src/sim/schema';

async function state(page: Page) { return JSON.parse(await page.locator('#state-json').textContent() ?? '{}'); }
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
test('live scene, pause, advance, seek and reset use the headless runner', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A small orbit, running for real.' })).toBeVisible();
  const runner = new Runner(validateBundle(circular));
  await page.locator('#step').click();
  expect((await state(page)).y).toEqual(runner.advanceTo(0.25).y);
  await page.locator('#play').click();
  await expect(page.locator('#status')).toHaveText('Running');
  await expect.poll(async () => (await state(page)).t).toBeGreaterThan(0.3);
  await page.locator('#play').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  const paused = (await state(page)).t;
  await page.waitForTimeout(80); expect((await state(page)).t).toBe(paused);
  await page.locator('#warp').selectOption('16');
  await page.locator('#epoch').fill('6');
  expect((await state(page)).y).toEqual(runner.seek(6).y);
  await page.locator('#reset').click();
  expect((await state(page)).y).toEqual(circular.scenario.ship.state);
  const pixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [...canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data]);
  expect(pixels[3]).toBe(255);
});

test('impulse, fuel, save/load, invalid import and download', async ({ page }) => {
  await page.goto('/'); await page.locator('#program').selectOption('impulse');
  await page.locator('#epoch').fill('1.136'); expect((await state(page)).propellant).toBe(0.6);
  await page.locator('#epoch').fill('1.137');
  const runner = new Runner(validateBundle({ ...circular, program: impulse }));
  const expected = runner.advanceTo(1.137);
  expect((await state(page)).y).toEqual(expected.y);
  expect((await state(page)).propellant).toBe(expected.propellant);
  await expect(page.locator('#ledger')).toContainText('burn · departure');
  await page.locator('#epoch').fill('4');
  await page.getByText('Save / load scenario and program', { exact: true }).click();
  await page.locator('#save').click(); const saved = await page.locator('#json').inputValue();
  await page.locator('#reset').click(); await page.locator('#load').click();
  expect((await state(page)).y).toEqual(runner.advanceTo(4).y);
  const before = await state(page); await page.locator('#json').fill('{"scenario":{}}');
  await page.locator('#load').click(); await expect(page.locator('#import-status')).toContainText('Import rejected');
  expect(await state(page)).toEqual(before);
  await page.locator('#json').fill(saved); await page.locator('#load').click();
  const downloading = page.waitForEvent('download'); await page.locator('#download').click();
  expect((await downloading).suggestedFilename()).toBe('orbital-logistics-run.json');
  await page.getByText('Save / load scenario and program', { exact: true }).click();
  await page.screenshot({ path: 'docs/evidence/m0-scene.png', fullPage: true });
});

test('failed burns terminate the browser forecast and execution', async ({ page }) => {
  await page.goto('/'); await page.getByText('Save / load scenario and program', { exact: true }).click();
  const bundle = structuredClone({ ...circular, program: impulse });
  bundle.program.burns[0].transverse = 100;
  await page.locator('#json').fill(JSON.stringify(bundle)); await page.locator('#load').click();
  await page.locator('#epoch').fill('4');
  await expect(page.locator('#status')).toContainText('burn-rejected');
  expect((await state(page)).t).toBe(1.137);
  expect((await state(page)).propellant).toBe(0.6);
});
