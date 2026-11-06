import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { fixtureServer } from './qa-local-server.mjs';

export async function checkBrowser(page, origin) {
  await page.goto(new URL('/qa.html', origin).href);
  assert.equal(await page.locator('#language').inputValue(), '');
  assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
  await page.selectOption('#language', 'hu');
  await page.fill('#question', 'Utalhat-e egy jel a fizikai formáján túlmutató dologra?');
  await page.locator('button[type=submit]').click();
  await page.locator('#answer blockquote').first().waitFor();
  assert.match(await page.locator('#answer').innerText(), /A sign can refer beyond/);
  assert.match(await page.locator('#answer').innerText(), /Generált fordítás/);
  assert.match(await page.locator('#answer').innerText(), /csak egy részére/);
  const sourceUrl = await page.locator('#answer details a').getAttribute('href');
  const source = await page.request.get(new URL(sourceUrl, origin).href);
  assert.match(await source.text(), /reply \(1, 2\)/);
  await page.selectOption('#language', 'en');
  assert.equal(await page.locator('#answer').getAttribute('lang'), 'hu');
  await page.fill('#question', 'Who won the latest election?');
  await page.locator('button[type=submit]').click();
  await page.getByText('The available sources do not support an answer.').waitFor();
}

let handler;
const server = createServer((req, res) => handler(req, res));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const origin = 'http://127.0.0.1:' + server.address().port;
  handler = fixtureServer({ origin });
  const browser = await chromium.launch();
  try {
    await checkBrowser(await browser.newPage(), origin);
  } finally {
    await browser.close();
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
