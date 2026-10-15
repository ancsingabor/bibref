// Exercise the actual terminal layout with a long result, without using hosted quotas.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
 for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  const page = await browser.newPage({viewport});
  await page.route('http://bibref.test/**', async route => {
   const path = new URL(route.request().url()).pathname;
   if (path === '/api/meta') return route.fulfill({json:{version:'test',vocabulary:[],limits:{commandSeconds:720}}});
   if (path === '/api/sessions') return route.fulfill({json:{id:'scroll-test',history:[],revision:0}});
   const file = new URL(`../public${path === '/' ? '/index.html' : path}`, import.meta.url);
   await route.fulfill({body:await readFile(file),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://bibref.test/');
  await page.waitForFunction(()=>window.bibrefTerminal && document.querySelector('#status').textContent==='Connected');
  await page.evaluate(()=>{
   bibrefTerminal.echo('EARLIER COMMAND: text1 Αβρααμ');
   for(let i=0;i<100;i++) bibrefTerminal.echo(`Found in Genesis 24:${i+1} (book position 56826-56831)`);
   bibrefTerminal.echo('100 occurrences.');
   bibrefTerminal.scroll_to_bottom();
  });
  const scroller = page.locator('.terminal-scroller');
  await scroller.hover();
  for(let i=0;i<100;i++) await page.mouse.wheel(0,-800);
  await page.waitForTimeout(300);
  assert.ok(await scroller.evaluate(el=>el.scrollTop<10),'wheel reaches earliest history');
  assert.ok(await page.getByText('EARLIER COMMAND: text1 Αβρααμ',{exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'page stays within viewport');
  for(let i=0;i<100;i++) await page.mouse.wheel(0,800);
  await page.waitForTimeout(300);
  assert.ok(await scroller.evaluate(el=>el.scrollTop>0),'wheel can return toward prompt');
  const submissions = [];
  page.on('request', request => {
   if (request.url().includes('/commands')) submissions.push(request.url());
  });
  await page.evaluate(async()=>{ await bibrefTerminal.exec('clear'); });
  assert.equal(await page.locator('.terminal-output').innerText(), '', 'clear removes visible output');
  assert.equal(submissions.length, 0, 'clear makes no engine request');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('bibref-session')), 'scroll-test', 'clear preserves session');
  await page.evaluate(()=>bibrefTerminal.echo('Terminal still usable'));
  assert.ok(await page.getByText('Terminal still usable',{exact:true}).isVisible());
  console.log(`Scroll and clear checks passed: ${viewport.width}×${viewport.height}`);
  await page.close();
 }
} finally { await browser.close(); }
