// Uses a new headless browser, separate from the user's preview tab.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import assert from 'node:assert/strict';
const url = process.env.M2_PREVIEW_URL ?? 'http://127.0.0.1:4178/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: {width: 1440, height: 1000}, recordVideo: {dir: 'test-results/m2-recording', size: {width: 1440, height: 1000}} });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const state = async () => JSON.parse(await page.locator('#state-json').textContent());
const ready = async () => page.waitForFunction(() => { const s = JSON.parse(document.querySelector('#state-json').textContent); return !s.pending && s.readyRevision === s.revision; });
try {
  await page.goto(url); await ready(); await page.locator('#scene').selectOption('rendezvous'); await ready();
  await page.locator('[data-burn="departure"]').click(); await page.locator('#precision summary').click();
  const runs = [];
  for (const [label, radial, transverse] of [['initial', 0.015, 0.065], ['worse', 0.05, 0.02], ['closer', 0, 0.078]]) {
    for (const [id, value] of [['radial', radial], ['transverse', transverse]]) { await page.locator('#' + id).fill(String(value)); await page.locator('#' + id).press('Tab'); }
    await ready(); const before = await state(), start = performance.now();
    await page.locator('#solve').click(); await page.locator('#proposal').waitFor({state: 'visible'});
    const elapsedMs = performance.now() - start, after = await state();
    assert.deepEqual(after.draft, before.draft); assert.deepEqual(after.accepted, before.accepted);
    runs.push({label, elapsedMs, iterations: after.targeting.proposal.iterations, evaluations: after.targeting.proposal.evaluations});
    if (label === 'initial') { await page.locator('#precision summary').click(); await page.screenshot({path: 'docs/evidence/m2-proposal.png', fullPage: true}); await page.locator('#precision summary').click(); }
    await page.waitForTimeout(500); await page.locator('#reject-proposal').click(); assert.deepEqual((await state()).draft, before.draft);
  }
  // Restore the authored initial seed for the retained accepted replay.
  for (const [id, value] of [['radial', 0.015], ['transverse', 0.065]]) { await page.locator('#' + id).fill(String(value)); await page.locator('#' + id).press('Tab'); }
  await ready(); await page.locator('#precision summary').click(); await page.locator('#solve').click(); await page.locator('#proposal').waitFor({state: 'visible'});
  await page.locator('#accept-proposal').click(); await ready(); assert.equal(await page.locator('#goal-value').textContent(), 'Matched');
  await page.locator('[data-burn="rendezvous-arrival"]').click(); await page.locator('#frame').selectOption('target');
  await page.screenshot({path: 'docs/evidence/m2-arrival.png', fullPage: true}); await page.waitForTimeout(500);
  await page.locator('#execute').click(); await page.locator('#warp').selectOption('16');
  await page.waitForFunction(() => JSON.parse(document.querySelector('#state-json').textContent).status === 'horizon');
  await page.locator('#files').click(); await page.locator('#save').click();
  await writeFile('docs/evidence/m2-browser-replay.json', (await page.locator('#json').inputValue()).trimEnd() + '\n');
  assert.deepEqual(errors, []);
  const report = {host: hostname(), chrome: browser.version(), url, viewport: {width: 1440, height: 1000}, runs, errors,
    method: 'External Playwright click dispatch through visible proposal, including protocol scheduling, worker startup/solve/verification/transfer and DOM rendering; three individual runs, not a latency distribution.'};
  await writeFile('docs/evidence/m2-browser-report.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
  const video = page.video(); await context.close(); await video.saveAs('docs/evidence/m2-rendezvous.webm'); await video.delete();
} finally { await browser.close(); }
