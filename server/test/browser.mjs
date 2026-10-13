import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const url = process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8090/';
const output = process.env.BIBREF_RESULTS || path.join(import.meta.dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
if (process.env.VERCEL_OIDC_TOKEN && url.startsWith('https://')) {
  const origin = new URL(url).origin;
  await context.route(origin + '/**', route => route.continue({ headers: {
    ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
  } }));
}
const page = await context.newPage(), errors = [], resources = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => resources.push(r.url()));
const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '');
const events = text => text.trim().split('\n\n').filter(s => s.startsWith('data: ')).map(s => JSON.parse(s.slice(6)));
try {
  const start = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Connected', { timeout: 60000 });
  const loadMs = Date.now() - start;
  async function command(text, fragments = []) {
    const response = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().method() === 'POST');
    const start = Date.now();
    await page.evaluate(async text => { await window.bibrefTerminal.exec(text); }, text);
    const r = await response;
    assert.equal(r.status(), 200, text);
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected', { timeout: 30000 });
    const requestId = r.request().postDataJSON().requestId;
    const recorded = await page.evaluate(async id => {
      const session = sessionStorage.getItem('bibref-session');
      return (await fetch(`/api/sessions/${session}/commands/${id}`)).json();
    }, requestId);
    const last = recorded.record;
    const body = last.events.map(e => e.text).join('');
    assert.equal(last.status, 'completed', `${text}: ${JSON.stringify(last)}`);
    for (const fragment of fragments) assert.ok(normalize(body).includes(normalize(fragment)), `${text}: missing ${fragment}`);
    results.push({ command: text, durationMs: Date.now() - start, output: body, status: last.status });
    return { last, body };
  }
  await command('help', ['Aleppo', 'HunRUF', 'KJV', 'LXX', 'SBLGNT', 'StatResGNT']);
  await command('lookup HunRUF Matthew 1:1', ['Jézus']);
  await command('lookup HunRUF Psalms 47:10', ['népek']);
  await command('lookup LXX Psalms 46:10', ['θε']);
  await command('lookup Aleppo Isaiah 11:1', ['ויצא']);
  await command('lookup Aleppo Psalms 119:176', ['תעיתי']);
  await command('lookup Aleppo Exodus 12:46', ['בבית']);
  await command('lookup Aleppo Zechariah 12:10', ['ושפכתי']);
  await command('lookup LXX Genesis 1:1', ['αρχη']);
  await command('lookup SBLGNT Matthew 1:23', ['παρθενος']);
  await command('lookup StatResGNT Matthew 1:23', ['παρθενος']);
  await command('lookup KJV Matthew 12:18', ['servant']);
  await command('lookup SBLGNT I_Corinthians 2:16', ['κυριου']);
  await command('lookup1 LXX Genesis 1:1', ['Stored']);
  await command('lookup2 LXX Genesis 1:1', ['Stored']);
  await command('jaccard12', ['0.000000']);
  await command('tokens StatResGNT John 7:38', ['4215', '5204']);
  await command('search LXX 4215 5204 2', ['Psalms']);
  await page.screenshot({ path: path.join(output, 'hebrew.png'), fullPage: true });
  const statement = fs.readFileSync(path.join(import.meta.dirname, '../../statements/StatResGNT/John/John-1,23+6.brst'), 'utf8');
  // Paste the real multiline statement through the terminal input.
  const response = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().method() === 'POST');
  await page.keyboard.insertText(statement); await page.keyboard.press('Enter');
  const statementResponse = await response; assert.equal(statementResponse.status(), 200);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
  assert.ok(await page.locator('#terminal svg').count());
  results.push({ command: 'multiline Statement / SVG', status: 'completed' });
  await page.keyboard.insertText('lookup Hun'); await page.keyboard.press('Tab');
  assert.ok((await page.evaluate(() => window.bibrefTerminal.get_command())).includes('HunRUF'));
  await page.evaluate(() => window.bibrefTerminal.set_command(''));
  await page.screenshot({ path: path.join(output, 'statement.png'), fullPage: true });
  await page.reload(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
  await command('print1', ['εν', 'αρχη']);
  await command('jaccard12', ['0.000000']);
  assert.ok(await page.locator('#terminal svg').count(), 'SVG history should resume');
  // Hostile clipboard text must never become executable HTML.
  await command('latintext1 <img src=x onerror=alert(1)>');
  await command('print1');
  assert.equal(await page.locator('#terminal img').count(), 0);
  assert.ok(!resources.some(u => /bibref\.(js|data)|\/modules\/|\.zip(?:$|\?)/.test(u)));
  assert.deepEqual(errors, []);
  const assetBytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => !r.name.includes('/api/')).reduce((n,r)=>n+r.decodedBodySize,0));
  assert.ok(assetBytes < 500 * 1024, `client assets ${assetBytes} exceed 500 KiB`);
  const report = { url, loadMs, assetBytes, errors, results };
  fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ url, loadMs, assetBytes, checks: results.length, errors, output }, null, 2));
  await page.evaluate(async () => {
    const id = sessionStorage.getItem('bibref-session');
    await fetch(`/api/sessions/${id}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:'{}' });
  });
} finally { await browser.close(); }
