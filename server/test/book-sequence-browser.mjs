import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8092';
const browser = await chromium.launch();
const results = [];
try {
  for (const scenario of ['failure', 'cancel', 'uncertain']) {
    const context = await browser.newContext(); const page = await context.newPage();
    const commands = []; let release;
    const state = { id: crypto.randomUUID(), revision: 0, state: {}, history: [], compatible: true };
    await page.route('**/book-examples.json', route => route.fulfill({ json: { examples: [{ id: 'sequence', title: 'Sequence test', chapter: 'Tests', page: 1, pageVerified: true, runtime: 'bibref', kind: 'commands', source: 'help\nlength1', prerequisites: [], commands: ['help', 'length1'], modules: [] }] } }));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/meta') return route.fulfill({ json: { version: 'test', modules: [], vocabulary: [], features: {}, limits: { commandSeconds: 1 } } });
      if (path === '/api/sessions') { state.id = crypto.randomUUID(); return route.fulfill({ json: state }); }
      if (path.endsWith('/cancel')) {
        release?.(); return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith('/commands')) {
        const body = route.request().postDataJSON(); commands.push(body.command);
        if (scenario === 'cancel') await new Promise(resolve => { release = resolve; });
        const events = scenario === 'uncertain' ? [{ type: 'accepted', requestId: body.requestId }] : [{ type: 'failed', revision: 1, message: scenario === 'cancel' ? 'Cancelled' : 'Invalid command' }];
        return route.fulfill({ contentType: 'text/event-stream', body: events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') });
      }
      if (path.includes('/commands/')) return route.fulfill({ json: { status: 'failed', record: { status: 'failed', events: [], message: 'Outcome unavailable' } } });
      return route.fulfill({ json: state });
    });
    await page.goto(base); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Connected');
    await page.locator('#book-open').click(); await page.getByRole('button', { name: 'Run example', exact: true }).click();
    if (scenario === 'cancel') {
      await page.waitForFunction(() => document.querySelector('#status').textContent === 'Running on server');
      await page.getByRole('button', { name: 'Stop example', exact: true }).click();
    }
    await page.waitForFunction(() => document.querySelector('#book-progress').textContent.startsWith('Stopped:'), null, { timeout: 15000 });
    assert.deepEqual(commands, ['help'], `${scenario}: no second command or automatic replay`);
    results.push(scenario); await context.close();
  }
  console.log(JSON.stringify({ passed: results }));
} finally { await browser.close(); }
