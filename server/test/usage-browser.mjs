// Real HTTP app + isolated local Redis; a deterministic runner avoids native/corpus requirements.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { connectStore, initialState } from '../store.js';
import { createApp } from '../app.js';

const ns = `test:usage-browser:${randomUUID()}`;
const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' },
  { prefix: ns, global: `${ns}:limits`, concurrency: 1, commandMs: 1000, dailyMs: 600000, requestRate: 1000 });
let unavailable = false;
const readUsage = store.usage.bind(store);
store.usage = (...args) => { if (unavailable) throw new Error('Storage unavailable'); return readUsage(...args); };
const app = createApp({ store, manifest: { version: 'test', engineVersion: 'test', vocabulary: [], modules: [] },
  secret: 'local-browser-test-secret-'.repeat(3), log: () => {},
  runner: async ({ state }, { onEvent }) => { onEvent({ type: 'output', kind: 'text', text: 'OK\n' }); return { ok: true, state, closed: false }; } });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.on('listening', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const waitFor = async predicate => {
    for (let i = 0; i < 100; i++) {
      if (await page.evaluate(predicate)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Browser condition timed out: ${predicate}`);
  };
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/(usage|activity)$/.test(request.url())) requests.push(new URL(request.url()).pathname); });
  await page.clock.install();
  await page.goto(url);
  await waitFor(() => document.querySelector('#status').textContent === 'Connected' && document.querySelector('#shared-usage').dataset.state === 'available');
  assert.equal(await page.locator('#shared-usage').getAttribute('open'), null);
  assert.match(await page.locator('#usage-summary').innerText(), /0\/1 slots occupied/);
  assert.equal((await readUsage()).activeBrowsers, 0, 'loading alone is not activity');
  const activityResponse = page.waitForResponse(response => response.url().endsWith('/api/activity'));
  await page.locator('#shared-usage summary').focus(); await page.keyboard.press('Enter');
  await waitFor(() => document.querySelector('#shared-usage').open);
  await activityResponse;
  assert.equal((await readUsage()).activeBrowsers, 1);
  assert.match(await page.locator('#usage-reset').innerText(), /local time; midnight UTC/);
  const second = await context.newPage(); await second.goto(url);
  await second.locator('#shared-usage summary').click();
  assert.equal((await readUsage()).activeBrowsers, 1, 'multiple tabs share an anonymous identifier');
  assert.equal(await second.evaluate(() => localStorage.getItem('bibref-activity-id')), await page.evaluate(() => localStorage.getItem('bibref-activity-id')));
  await second.close(); await page.bringToFront();
  const activityRequests = requests.filter(x => x === '/api/activity').length;
  { const nextUsage = page.waitForResponse(response => response.url().endsWith('/api/usage')); await page.clock.fastForward(60000); await (await nextUsage).finished(); }
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'available');
  assert.equal(requests.filter(x => x === '/api/activity').length, activityRequests, 'idle time does not renew browser activity');

  const owner = randomUUID(), session = await store.create(owner, 'test');
  const claim = await store.claim(session.id, owner, 0, randomUUID(), 'help', 'test');
  { const nextUsage = page.waitForResponse(response => response.url().endsWith('/api/usage')); await page.clock.fastForward(60000); await (await nextUsage).finished(); }
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'limited');
  assert.match(await page.locator('#usage-summary').innerText(), /1\/1 slots occupied/);
  assert.match(await page.locator('#usage-breakdown').innerText(), /reserved/);
  await store.finish(session.id, claim.session, claim.job, { requestId: claim.job.requestId, command: 'help', status: 'completed', durationMs: 20, events: [] }, initialState());
  const commandResponse = page.waitForResponse(response => response.url().endsWith('/commands'));
  await page.evaluate(() => { void window.bibrefTerminal.exec('help'); });
  await page.clock.fastForward(100);
  await commandResponse;
  await waitFor(() => document.querySelector('#status').textContent === 'Connected');
  await page.clock.fastForward(5001);
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'available');
  assert.match(await page.locator('#usage-summary').innerText(), /0\/1 slots occupied/);

  unavailable = true; await page.clock.fastForward(60000);
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'unavailable');
  assert.match(await page.locator('#usage-summary').innerText(), /last known/);
  assert.equal(await page.locator('#new-session').isEnabled(), true);
  unavailable = false; await page.clock.fastForward(60000);
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'available');
  const beforeHidden = requests.length;
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.clock.fastForward(95000);
  assert.equal(requests.length, beforeHidden, 'hidden tabs stop usage polling');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await page.locator('#shared-usage').getAttribute('data-state'), 'stale');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => document.querySelector('#shared-usage').dataset.state === 'available');
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), 'usage stays within viewport');
    assert.ok(await page.locator('#shared-usage summary').isVisible());
    assert.ok(await page.locator('#terminal').evaluate(el => el.getBoundingClientRect().height > 80), 'terminal remains usable');
    await page.screenshot({ path: new URL(`../test-results/usage-${viewport.width}.png`, import.meta.url).pathname });
  }
  // The disclosure remains closable after scrolling its mobile explanation.
  await page.locator('#shared-usage').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.locator('#shared-usage summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#shared-usage').getAttribute('open'), null);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Usage browser checks passed: keyboard disclosure, multi-tab activity, idle expiry behavior, reservations, outcome refresh, unavailable/stale recovery, desktop/mobile layout.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await store.run.close();
}
