// Acceptance test against a real native-engine server (local disposable storage
// by default). Exercises clipboard snapshots across all operations in the book.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8092/');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
  const terminal = () => page.evaluate(async () =>
    (await fetch(`/api/sessions/${sessionStorage.getItem('bibref-session')}`)).json());
  const before = await terminal();
  await page.locator('#python-tab').click();
  await page.waitForSelector('.cm-content');
  await page.locator('#python-examples').selectOption('nearest');
  assert.match(await page.locator('.cm-content').innerText(), /Ος αν απολυση/);
  await page.locator('#python-run').click();
  await page.waitForFunction(() => ['Completed', 'Failed', 'Stopped'].includes(
    document.querySelector('#python-status').textContent), null, { timeout: 720000 });
  const output = await page.locator('#python-output').innerText();
  assert.equal(await page.locator('#python-status').innerText(), 'Completed', output);
  for (const expected of ['39.5349', '41.8605', '44.186',
    'Leviticus 7:9+90 7:10-69', 'Numbers 5:26+66 5:26-2',
    'Deuteronomy 32:15+104 32:16-45', 'Odes 2:15+104 2:16-45']) {
    assert.ok(output.includes(expected), `Missing ${expected}: ${output}`);
  }
  const after = await terminal();
  assert.deepEqual(after.state, before.state);
  assert.equal(after.revision, before.revision);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', output, terminalUnchanged: true }));
} finally { await browser.close(); }
