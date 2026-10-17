import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8092';
const examples = JSON.parse(fs.readFileSync(new URL('../public/book-examples.json', import.meta.url))).examples;
const statement = examples.flatMap(e => e.commands).find(c => /^Statement Luke-22,37\+53\b/.test(c));
assert.ok(statement, 'Luke 22:37 diagram from the screenshot exists');
const browser = await chromium.launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected', null, { timeout: 60000 });
  await page.evaluate(async command => { await window.bibrefTerminal.exec(command); }, statement);
  await page.waitForSelector('.diagram-graphic select', { timeout: 120000 });
  const options = await page.locator('.diagram-graphic select option').evaluateAll(nodes => nodes.filter(n => n.textContent.startsWith('LXX Isaiah 53:12')).map(n => n.value));
  assert.equal(options.length, 3, 'Both quotation blocks and the unquoted Isaiah interval are inspectable');
  for (const value of options) {
    await page.locator('.diagram-graphic select').selectOption(value);
    await page.waitForFunction(() => document.querySelector('.diagram-inspector')?.textContent.includes('Ezért a nagyok között adok neki részt'), null, { timeout: 60000 });
    assert.match(await page.locator('.diagram-inspector').innerText(), /HunRUF Isaiah 53:12/);
    assert.doesNotMatch(await page.locator('.diagram-inspector').innerText(), /not mapped|No verified/);
  }
  // The next prompt must have actual visual clearance from the white diagram.
  for (const viewport of [{ width: 1280, height: 1000, minGap: 32 }, { width: 375, height: 812, minGap: 24 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.locator('#terminal .cmd').scrollIntoViewIfNeeded();
    const spacing = await page.locator('.diagram').evaluate(diagram => {
      const prompt = document.querySelector('#terminal .cmd');
      return { margin: parseFloat(getComputedStyle(diagram).marginBottom), gap: prompt.getBoundingClientRect().top - diagram.getBoundingClientRect().bottom };
    });
    assert.ok(spacing.margin >= viewport.minGap, JSON.stringify({ viewport, spacing }));
    assert.ok(spacing.gap >= viewport.minGap - 1, JSON.stringify({ viewport, spacing }));
    await page.screenshot({ path: `/tmp/bibref-diagram-spacing-${viewport.width}.png` });
  }
  await page.evaluate(async () => { await window.bibrefTerminal.exec('lookup HunRUF Isaiah 53:12'); });
  const lines = await page.locator('#terminal .text-line').allTextContents();
  assert.ok(lines.some(line => line.includes('Ezért a nagyok között')));
  assert.ok(!lines.some(line => line.trim() === 'true' || line.trim() === 'false'), 'Internal command status must not be echoed');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['Isaiah 53:12 quotation and unquoted blocks show Hungarian context', 'manual lookup works without printing internal true/false', 'diagram spacing clears the next prompt on desktop and mobile'] }));
} finally { await browser.close(); }
