// Independent headless browser; never connects to or changes the user's tab.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import assert from 'node:assert/strict';

const url = process.env.M1_PREVIEW_URL ?? 'http://127.0.0.1:4178/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: 'test-results/m1-recording', size: { width: 1440, height: 1000 } } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const state = async () => JSON.parse(await page.locator('#state-json').textContent());
const ready = async () => page.waitForFunction(() => {
  const state = JSON.parse(document.querySelector('#state-json').textContent);
  return !state.pending && state.readyRevision === state.revision;
});
const pixel = async p => {
  const box = await page.locator('canvas').boundingBox(); return [box.x + p[0] * box.width / 1000, box.y + p[1] * box.height / 650];
};
try {
  const start = performance.now(); await page.goto(url); await ready(); const coldLoadMs = performance.now() - start;
  await page.locator('#plan').click(); await page.locator('#epoch').fill('1.137'); await page.locator('#add').click(); await ready();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#state-json').textContent).latency.length > 0);
  const handle = (await state()).handles.find(h => h.axis === 'transverse');
  await page.mouse.click(...await pixel(handle.p));
  const handleMs = [], feedbackMs = [];
  for (let i = 0; i < 20; i++) {
    const value = 0.035 + i * 0.004, oldCount = (await state()).latency.length;
    const p = [handle.p[0] + handle.direction[0] * value * 600, handle.p[1] + handle.direction[1] * value * 600];
    await page.mouse.move(...await pixel(p));
    await page.waitForFunction(count => JSON.parse(document.querySelector('#state-json').textContent).latency.length > count, oldCount);
    const sample = await state(); handleMs.push(sample.latency.at(-1)); feedbackMs.push(sample.feedbackLatency.at(-1));
  }
  // Rapid moves force real cancellation/replacement of unfinished worker jobs.
  // Keep this separate from steady input; measure the final edit in each burst.
  const burstMs = [];
  for (let burst = 0; burst < 3; burst++) {
    const oldCount = (await state()).latency.length;
    for (let i = 0; i < 10; i++) {
      const value = 0.04 + i * 0.007 + burst * 0.001;
      await page.mouse.move(...await pixel([handle.p[0] + handle.direction[0] * value * 600, handle.p[1] + handle.direction[1] * value * 600]));
    }
    await ready();
    await page.waitForFunction(count => JSON.parse(document.querySelector('#state-json').textContent).latency.length > count, oldCount);
    burstMs.push((await state()).latency.at(-1));
  }
  await page.mouse.click(...await pixel((await state()).handles.find(h => h.axis === 'transverse').p)); await ready();
  await page.locator('#undo').click(); await ready(); assert.equal((await state()).draft.burns[0].transverse, 0);
  await page.locator('#redo').click(); await ready();
  await page.locator('#precision summary').click(); await page.locator('#transverse').fill('0.1'); await page.locator('#transverse').press('Tab'); await ready();
  assert.match(await page.locator('#goal-value').textContent(), /In band/);
  await page.locator('#precision summary').click();
  await page.screenshot({ path: 'docs/evidence/m1-orbit.png', fullPage: true });
  await page.locator('#execute').click(); await page.locator('#warp').selectOption('16');
  await page.waitForFunction(() => JSON.parse(document.querySelector('#state-json').textContent).status === 'horizon');
  await page.locator('#epoch').fill('4.5'); await page.locator('#frame').selectOption('primary');
  await page.locator('#files').click(); await page.locator('#save').click();
  await writeFile('docs/evidence/m1-browser-orbit.json', (await page.locator('#json').inputValue()).trimEnd() + '\n');
  await page.locator('#scene').selectOption('moon'); await ready();
  await page.locator('#json').fill(await readFile('docs/evidence/m1-moon-after.json', 'utf8')); await page.locator('#load').click(); await ready();
  await page.locator('#files').click(); await page.locator('#epoch').fill('2.5'); await page.locator('#frame').selectOption('moon');
  await page.screenshot({ path: 'docs/evidence/m1-moon.png', fullPage: true });
  const summary = rows => { const sorted = [...rows].sort((a, b) => a - b); return { median: sorted[Math.floor(rows.length / 2)], p95: sorted[Math.ceil(rows.length * 0.95) - 1], min: sorted[0], max: sorted.at(-1) }; };
  const report = { host: hostname(), chrome: browser.version(), url, viewport: { width: 1440, height: 1000 },
    coldLoadMs, handleSamples: handleMs, feedbackSamples: feedbackMs, burstSettlingSamples: burstMs,
    freshPredictionMs: summary(handleMs), handleFeedbackMs: summary(feedbackMs), burstSettlingMs: summary(burstMs), errors,
    method: 'DOM pointer event handler entry to two animation-frame fences after fresh worker result and path drawing; feedback uses the next animation frame. Includes worker startup/transfer, transforms and paint scheduling. Actual display/compositor latency is not measured.' };
  assert.deepEqual(errors, []); await writeFile('docs/evidence/m1-browser-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ coldLoadMs, freshPredictionMs: report.freshPredictionMs, handleFeedbackMs: report.handleFeedbackMs, burstSettlingMs: report.burstSettlingMs, errors }, null, 2));
  const video = page.video(); await context.close(); await mkdir('docs/evidence', { recursive: true });
  await video.saveAs('docs/evidence/m1-editor.webm'); await video.delete();
} finally { await browser.close(); }
