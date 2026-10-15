import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import { createApp } from '../app.js';

const app = createApp({ store: { rate: async () => {}, config: {} }, manifest: {},
  secret: 'runtime-test-only-'.repeat(3), pythonEnabled: true, log: () => {} });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.on('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
await fs.mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.on('console', message => { if (message.type() === 'error') console.error(name, message.text()); });
      page.on('pageerror', error => console.error(name, error.message));
      await page.goto(`${base}/notices.html`);
      assert.equal(await page.evaluate(() => crossOriginIsolated), true);
      const result = await page.evaluate(async () => {
        const { startPython } = await import('/python/runtime.js');
        let text = '', calls = [];
        return new Promise(resolve => startPython(`from bibref.tools import *
maxresults(10000)
for name in ["Farec", "Zara"]:
    text1(name)
    occurrences = find1("LXX")
    print(f"{name}:{len(occurrences)} ", end='')
assert latin_to_greek('abcdefghijklmnopqrstuvwxyz') == 'αβψδεφγηιξκλμνοπζρστθωςχυζ'
`, { operation: async (operation, args, sequence) => {
          calls.push({ operation, args, sequence });
          return operation === 'find_n' ? [['Genesis 1:1', 1, 2]] : operation === 'maxresults' ? 10000 : 'farec';
        }, output: chunk => { text += chunk; }, state: () => {},
        completed: () => resolve({ ok: true, text, calls }), failed: error => resolve({ ok: false, text, error: error.message }) }));
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.text, 'Farec:1 Zara:1 ');
      assert.deepEqual(result.calls.map(x => x.sequence), [0, 1, 2, 3, 4]);
      assert.deepEqual(result.calls[1].args, [1, 'Φαρες']);
      const denied = await page.evaluate(async () => {
        const { startPython } = await import('/python/runtime.js');
        return new Promise(resolve => startPython(`import js
request = js.XMLHttpRequest.new()
request.open('GET', '/api/health', False)
request.send()`, { operation: () => {}, output: () => {}, state: () => {},
          completed: () => resolve(false), failed: error => resolve(error.message) }));
      });
      assert.match(denied, /PythonError|SyntaxError|fetch|Content Security|network/i);
      const forged = await page.evaluate(async () => {
        const { startPython } = await import('/python/runtime.js');
        return new Promise(resolve => startPython(`from js import bibref_call
bibref_call('quit', '[]')`, { operation: () => { throw new Error('forged operation reached bridge'); }, output: () => {}, state: () => {},
          completed: () => resolve('unexpected completion'), failed: error => resolve(error.message) }));
      });
      assert.equal(forged, 'Invalid Python bridge request');
      const stop = await page.evaluate(async () => {
        const { startPython } = await import('/python/runtime.js');
        return new Promise(resolve => {
          const run = startPython('while True: pass', { operation: () => {}, output: () => {}, state: value => {
            if (value === 'Running') setTimeout(() => { run.stop(); resolve(true); }, 50);
          }, completed: () => resolve(false), failed: () => resolve(false) });
        });
      });
      assert.equal(stop, true);
      console.log(`${name}: synchronous calls, output, isolation and termination passed`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
