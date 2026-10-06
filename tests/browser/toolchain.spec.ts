import {expect, test} from '@playwright/test';
test('static shell, Canvas and module worker run in installed Chrome', async ({page}) => {
  const failures: string[] = [];
  page.on('pageerror', err => failures.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'One encounter. One small burn.'})).toBeVisible();
  await expect(page.locator('#status')).toHaveText('Browser worker ready');
  const pixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [...canvas.getContext('2d')!.getImageData(10,10,1,1).data]);
  expect(pixels[3]).toBe(255);
  await page.locator('#frame').selectOption('moon');
  await page.locator('#epoch').fill('300');
  await expect(page.locator('#time')).toHaveText('t = 3.00');
  await expect(page.locator('#readout')).toContainText('moon-center distance');
  expect(failures).toEqual([]);
  await page.screenshot({path:'docs/evidence/viewer.png', fullPage:true});
});
