import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { examples } from '../public/python/examples.js';

const url = process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8091/';
const directory = new URL('../test-results/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], requests = [], report = {};
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
async function edit(source) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(source);
}
async function run(source, shortcut = false) {
  if (source !== undefined) await edit(source);
  const start = Date.now();
  if (shortcut) await page.keyboard.press('ControlOrMeta+Enter');
  else await page.locator('#python-run').click();
  await page.waitForFunction(() => ['Completed', 'Failed', 'Stopped'].includes(document.querySelector('#python-status').textContent), { timeout: 180000 });
  return { durationMs: Date.now() - start, status: await page.locator('#python-status').innerText(), output: await page.locator('#python-output').innerText() };
}
async function terminalState() {
  return page.evaluate(async () => (await fetch(`/api/sessions/${sessionStorage.getItem('bibref-session')}`)).json());
}
try {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
  assert.ok(!requests.some(u => /pyodide|editor\.js/.test(u)), 'Terminal must not load Python/editor');
  const before = await terminalState();
  await page.locator('#python-tab').click();
  await page.waitForSelector('.cm-content');
  assert.equal((await page.locator('#python-run').isEnabled()), true);
  assert.ok(!requests.some(u => /pyodide/.test(u)), 'Opening the editor must not start Python');
  await page.screenshot({ path: new URL('python-desktop.png', directory).pathname });
  report.names = await run();
  assert.equal(report.names.status, 'Completed', report.names.output);
  // Full fixture is explicit rather than normalizing away differing counts.
  const counts = [20,41,1,58,27,10,2,35,0,8,43,41,1089,1,143,110,87,90,53,36,19,44,76,161,60,20,7,16,34,13,0,2,43,9,0,103,2,404,227];
  const names = [...examples.names.matchAll(/"([A-Z][A-Za-z]+)"/g)].map(m => m[1]).filter(n => n !== 'LXX');
  assert.equal(names.length, 39);
  assert.equal(report.names.output.trim(), names.map((name, i) => `${name}:${counts[i]}`).join(' '));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#python-copy').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), report.names.output);
  assert.deepEqual((await terminalState()).state, before.state); assert.equal((await terminalState()).revision, before.revision);
  // Worker resource timing is outside the page's performance timeline.
  report.assetSizes = {};
  for (const resource of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']) {
    report.assetSizes[resource] = Number((await page.request.head(new URL(`/vendor/pyodide/${resource}`, url).href)).headers()['content-length']);
  }
  await page.screenshot({ path: new URL('python-results.png', directory).pathname });
  report.wrappers = await run(`from bibref.tools import *
assert maxresults(10000) == 10000
assert text_n(1, "Farec") == "fares"
assert text2("Zara") == "zara"
assert latintext1("abc") is None
assert latintext_n(2, "abcd") is None
assert jaccard12() >= 0
assert isinstance(nearest12(), tuple)
assert isinstance(jaccard("υιος", "υιος"), float)
assert isinstance(lookup1("LXX Genesis 1:1"), str)
assert isinstance(lookup_n(2, "LXX Genesis 1:1"), str)
assert isinstance(find2("LXX"), list)
assert raw1("LXX", "Genesis", 1, 10) is None
assert raw_n(2, "LXX", "Genesis", 1, 10) is None
assert isinstance(getrefs_maxlength("SBLGNT LXX Psalms 2"), str)
assert latin_to_greek("abcdefghijklmnopqrstuvwxyz") == "αβψδεφγηιξκλμνοπζρστθωςχυζ"
for helper in [spawn_bibref, set_bibref_path]:
    try:
        helper()
        raise AssertionError("process helper must fail")
    except NotImplementedError:
        pass
print("All wrapper contracts passed")
`, true);
  assert.equal(report.wrappers.status, 'Completed', report.wrappers.output);
  assert.deepEqual((await terminalState()).state, before.state);
  report.traceback = await run('print("Before error")\nraise ValueError("example error")');
  assert.equal(report.traceback.status, 'Failed'); assert.match(report.traceback.output, /example error/);
  await page.getByRole('button', { name: 'Go to line 2' }).click();
  assert.equal(await page.locator('.cm-content').evaluate(e => e === document.activeElement), true);
  await edit('while True: pass'); await page.locator('#python-run').click();
  await page.waitForFunction(() => document.querySelector('#python-status').textContent === 'Running');
  const stopped = Date.now(); await page.locator('#python-stop').click();
  await page.waitForFunction(() => document.querySelector('#python-status').textContent === 'Stopped');
  report.stopMs = Date.now() - stopped;
  report.flood = await run('print("<img src=x onerror=alert(1)>")\nprint("x" * (2 * 1024 * 1024 + 1))');
  assert.equal(report.flood.status, 'Failed');
  assert.match(report.flood.output, /<img src=x onerror=alert\(1\)>/);
  assert.equal(await page.locator('#python-output img').count(), 0);
  assert.ok((await page.locator('#python-output').textContent()).length < 10000);
  await edit('print("<img src=x onerror=alert(1)>")');
  await page.reload(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
  await page.locator('#python-tab').click(); await page.waitForSelector('.cm-content');
  assert.match(await page.locator('.cm-content').innerText(), /onerror=alert/);
  assert.equal(await page.locator('#python-status').innerText(), 'Ready', 'Restored source must not execute');
  const download = page.waitForEvent('download'); await page.locator('#python-download').click();
  const file = await download;
  assert.equal(file.suggestedFilename(), 'bibref-script.py');
  assert.match(await fs.readFile(await file.path(), 'utf8'), /onerror=alert/);
  await page.locator('#python-examples').selectOption('compare');
  assert.match(await page.locator('.cm-content').innerText(), /lookup1/);
  assert.equal(await page.locator('#python-status').innerText(), 'Ready');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('python-mobile.png', directory).pathname });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('#python-output img').count(), 0);
  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual((await terminalState()).state, before.state);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await fs.writeFile(new URL('python-browser.json', directory), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.evaluate(async () => {
    const id = sessionStorage.getItem('bibref-session');
    if (id) await fetch(`/api/sessions/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }).catch(() => {});
  await browser.close();
}
