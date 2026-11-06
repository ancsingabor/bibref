import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeNative } from '../engine.js';
import { connectStore, ApiError } from '../store.js';
import { createApp } from '../app.js';

const resources = [];
after(async () => { for (const { server, store } of resources) { await new Promise(r => server.close(r)); await store.run.close(); } });
async function fixture(runner, config = {}, modules = [], appOptions = {}) {
  const ns = `test:${randomUUID()}`;
  const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' },
    { prefix: ns, global: `${ns}:limits`, commandMs: 500, dailyMs: 20000, requestRate: 1000, ...config });
  let executions = 0;
  const app = createApp({ store, manifest: { engineVersion: 'v1', vocabulary: [], modules }, secret: 'x'.repeat(48), runner: (...args) => { executions++; return runner(...args); },
    disconnectMs: 20, pollMs: 10, log: () => {}, ...appOptions });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r));
  resources.push({ server, store });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = async (url, method = 'GET', body, options = {}) => {
    const headers = new Headers({ Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) });
    for (const [key, value] of Object.entries(options.headers || {})) {
      if (value === null) headers.delete(key); else headers.set(key, value);
    }
    const response = await fetch(base + url, { method, headers,
      body: options.rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
    if (options.keepCookie !== false && response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const session = await (await request('/api/sessions', 'POST', {})).json();
  return { request, session, store, base, get cookie() { return cookie; }, get executions() { return executions; } };
}
const frames = text => text.trim().split('\n\n').map(x => JSON.parse(x.slice(6)));
const normal = async ({ state }, { onEvent }) => { onEvent({ type: 'output', kind: 'text', text: 'test\n' }); return { ok: true, state: { ...state, text: ['abc', ''], textset: [true, false] }, closed: false }; };

test('streamed output commits state, request deduplication avoids a second execution, no foreign access', async () => {
  let count = 0;
  const { request, session, base } = await fixture(async (...args) => { count++; return normal(...args); });
  const body = { requestId: randomUUID(), revision: 0, command: 'latintext1 abc' };
  const response = await request(`/api/sessions/${session.id}/commands`, 'POST', body);
  const events = frames(await response.text()); assert.equal(events.at(-1).type, 'completed'); assert.equal(events.at(-1).revision, 1);
  const duplicate = await request(`/api/sessions/${session.id}/commands`, 'POST', body);
  assert.equal(frames(await duplicate.text())[0].type, 'recorded'); assert.equal(count, 1);
  const restored = await (await request(`/api/sessions/${session.id}`)).json(); assert.equal(restored.state.text[0], 'abc');
  const foreign = await fetch(`${base}/api/sessions/${session.id}`); assert.equal(foreign.status, 404);
  const csrf = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(csrf.status, 403);
  for (const path of ['/bibref.js', '/bibref.data', '/.sword/mods.d/hunruf.conf', '/modules/texts/ztext/hunruf/nt.bzz']) assert.equal((await request(path)).status, 404);
});

test('cancellation rolls back state and releases the session', async () => {
  const runner = async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const { request, session } = await fixture(runner);
  const id = randomUUID();
  const running = await request(`/api/sessions/${session.id}/commands`, 'POST', { requestId: id, revision: 0, command: 'nearest12' });
  const cancel = await request(`/api/sessions/${session.id}/commands/${id}/cancel`, 'POST', {}); assert.equal(cancel.status, 200);
  const events = frames(await running.text()); assert.equal(events.at(-1).code, 'cancelled');
  const restored = await (await request(`/api/sessions/${session.id}`)).json(); assert.equal(restored.revision, 1); assert.deepEqual(restored.state.text, ['', '']); assert.equal(restored.active, null);
});

test('engine failure and oversized commands never change saved state', async () => {
  const { request, session } = await fixture(async () => { throw new ApiError('engine_crash'); });
  const response = await request(`/api/sessions/${session.id}/commands`, 'POST', { requestId: randomUUID(), revision: 0, command: 'bad' });
  assert.equal(frames(await response.text()).at(-1).code, 'engine_crash');
  const oversized = await request(`/api/sessions/${session.id}/commands`, 'POST', { requestId: randomUUID(), revision: 0, command: 'x'.repeat(65537) }); assert.equal(oversized.status, 400);
  const restored = await (await request(`/api/sessions/${session.id}`)).json(); assert.equal(restored.revision, 1);
});

test('storage failure fails closed and exposes no credentials or internal error', async () => {
  const { request, store } = await fixture(normal);
  const original = store.run;
  store.run = async () => { throw new Error('secret-token internal details'); };
  const response = await request('/api/meta'); assert.equal(response.status, 503);
  const body = await response.text(); assert.ok(!body.includes('secret-token')); assert.ok(!body.includes('internal details'));
  // Restore a close function for fixture cleanup.
  store.run = original;
});


test('Hungarian context uses shared jobs without changing reader state or history', async () => {
  const calls = [];
  const { request, session } = await fixture(async ({ command, state }, { onEvent }) => {
    calls.push(command); onEvent({ kind: 'text', text: 'Magyar szöveg' });
    return { ok: true, state: { ...state, text: ['changed', ''], diagram: 'info' } };
  }, {}, [{ name: 'HunRUF' }]);
  const before = await (await request(`/api/sessions/${session.id}`)).json();
  const response = await request(`/api/sessions/${session.id}/context`, 'POST', { book: 'Isaiah', verse: '7:14' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'Magyar szöveg');
  assert.deepEqual(calls, ['lookup HunRUF Isaiah 7:14']);
  const after = await (await request(`/api/sessions/${session.id}`)).json();
  assert.deepEqual(after.state, before.state); assert.deepEqual(after.history, before.history); assert.equal(after.revision, before.revision);
  assert.equal((await request(`/api/sessions/${session.id}/context`, 'POST', { book: 'Isaiah\nquit', verse: '7:14' })).status, 400);
  assert.equal((await request(`/api/sessions/${session.id}/context`, 'POST', { book: 'Isaiah', verse: '7:14 8:1' })).status, 400);
});
test('missing Hungarian modules and failed context jobs preserve the reader session', async () => {
  const absent = await fixture(normal);
  const response = await absent.request(`/api/sessions/${absent.session.id}/context`, 'POST', { book: 'Isaiah', verse: '7:14' });
  assert.equal(response.status, 422); assert.equal((await response.json()).code, 'module_unavailable');
  const failed = await fixture(async () => { throw new ApiError('engine_error', 422); }, {}, ['HunRUF']);
  assert.equal((await failed.request(`/api/sessions/${failed.session.id}/context`, 'POST', { book: 'Isaiah', verse: '7:14' })).status, 422);
  const after = await (await failed.request(`/api/sessions/${failed.session.id}`)).json();
  assert.equal(after.revision, 0); assert.deepEqual(after.history, []); assert.equal(after.active, null);
});

test('usage and activity endpoints expose only aggregates and enforce same-origin mutations', async () => {
  const { request, store, base } = await fixture(normal, { concurrency: 3, commandMs: 1234, dailyMs: 5678 });
  const response = await request('/api/usage');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const usage = await response.json();
  assert.deepEqual(Object.keys(usage).sort(), ['serverTime', 'resetAt', 'slotLimit', 'dailyLimitMs', 'commandMs', 'occupiedSlots', 'consumedMs', 'reservedMs', 'remainingMs', 'activeBrowsers'].sort());
  assert.equal(usage.slotLimit, 3); assert.equal(usage.remainingMs, 5678); assert.equal(usage.commandMs, 1234);
  const id = randomUUID();
  assert.equal((await request('/api/activity', 'POST', { browserId: id })).status, 200);
  assert.equal((await request('/api/activity', 'POST', { browserId: id })).status, 200);
  assert.equal((await (await request('/api/usage')).json()).activeBrowsers, 1);
  assert.equal((await request('/api/activity', 'POST', { browserId: 'bad' })).status, 400);
  assert.equal((await request('/api/activity', 'POST', {})).status, 400);
  const crossOrigin = await fetch(`${base}/api/activity`, { method: 'POST', headers: { Origin: 'https://elsewhere.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ browserId: randomUUID() }) });
  assert.equal(crossOrigin.status, 403);
  store.usage = async () => { throw new Error('private Redis details'); };
  const unavailable = await request('/api/usage');
  assert.equal(unavailable.status, 503); assert.doesNotMatch(await unavailable.text(), /private Redis/);
});

test('shared-IP browsers have independent session limits and actionable retry metadata', async () => {
  const { request, base } = await fixture(normal, { sessionRate: 2, sessionIpRate: 3 });
  assert.equal((await request('/api/sessions', 'POST', {})).status, 201);
  const before = Date.now();
  const blocked = await request('/api/sessions', 'POST', {});
  assert.equal(blocked.status, 429);
  const problem = await blocked.json();
  assert.equal(problem.rateLimit, 'sessions'); assert.match(problem.message, /browser/);
  assert.equal(blocked.headers.get('retry-after'), String(problem.retryAfter));
  assert.ok(problem.retryAfter > 3500 && problem.retryAfter <= 3600);
  assert.ok(problem.retryAt >= before + problem.retryAfter * 1000 && problem.retryAt <= Date.now() + problem.retryAfter * 1000);
  const freshBrowser = cookie => fetch(`${base}/api/sessions`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: '{}' });
  const second = await freshBrowser(); assert.equal(second.status, 201, 'another signed browser on the same IP is admitted');
  const secondSession = await second.json();
  const cookie = second.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/api/sessions/${secondSession.id}`, { headers: { Cookie: cookie } })).status, 200);
  const rotated = await freshBrowser(`bibref_owner=${randomUUID()}.9999999999999.invalid`);
  assert.equal(rotated.status, 429);
  const network = await rotated.json(); assert.equal(network.rateLimit, 'sessionIps'); assert.match(network.message, /network/);
  assert.equal((await request(`/api/sessions/${secondSession.id}`)).status, 404, 'limits do not change ownership isolation');
  assert.doesNotMatch(JSON.stringify(problem), /owner|cookie|token|127\.0\.0\.1/);
});

test('general API rate errors retain their scope and remaining minute-window retry', async () => {
  const { request } = await fixture(normal, { requestRate: 2 });
  assert.equal((await request('/api/meta')).status, 200);
  const blocked = await request('/api/meta'); assert.equal(blocked.status, 429);
  const problem = await blocked.json();
  assert.equal(problem.rateLimit, 'requests'); assert.ok(problem.retryAfter > 0 && problem.retryAfter <= 60);
  assert.equal(blocked.headers.get('retry-after'), String(problem.retryAfter));
});

// G1/G2 snapshots intentionally exclude quota counters, TTL renewal and cookie renewal.
// Raw saved session, active lease and cancellation flag must stay identical on denial.
async function protectedSnapshot(store, id) {
  return store.eval("return cjson.encode({redis.call('GET',KEYS[1]),redis.call('GET',KEYS[2]),redis.call('GET',KEYS[3])})",
    [store.key(id), store.lock(id), store.cancelKey(id)]);
}
async function independentOwner(f) {
  const response = await f.request('/api/sessions', 'POST', {}, { headers: { Cookie: null }, keepCookie: false });
  assert.equal(response.status, 201);
  await response.json();
  return response.headers.get('set-cookie').split(';')[0];
}
function noDisclosure(text, id) {
  assert.deepEqual(JSON.parse(text), { code: 'not_found', message: 'Session or command is unavailable or has expired.' });
  assert.doesNotMatch(text, /"(?:state|history|active|record|command|owner)"/);
  assert.ok(!text.includes(id));
}

test('G1 terminal/context ownership matrix (24 cases)', async t => {
  const routes = ['read', 'delete', 'command', 'receipt', 'cancel', 'context'];
  const owners = ['owning', 'other', 'missing', 'malformed'];
  for (const [routeIndex, route] of routes.entries()) for (const [ownerIndex, condition] of owners.entries()) {
    const id = `G1-${String(routeIndex * 4 + ownerIndex + 1).padStart(2, '0')}`;
    await t.test(`${id} ${route}: ${condition}`, async () => {
      const f = await fixture(normal, { commandMs: 5000, dailyMs: 100000 }, ['HunRUF']);
      const other = await independentOwner(f), requestId = randomUUID();
      const root = `/api/sessions/${f.session.id}`;
      if (route === 'receipt') {
        const response = await f.request(`${root}/commands`, 'POST', { requestId, revision: 0, command: 'help' });
        assert.equal(frames(await response.text()).at(-1).type, 'completed');
      }
      if (route === 'cancel') {
        const saved = await f.store.eval("return redis.call('GET',KEYS[1])", [f.store.key(f.session.id)]);
        await f.store.claim(f.session.id, saved.owner, 0, requestId, 'help', 'v1');
      }
      const before = await protectedSnapshot(f.store, f.session.id), calls = f.executions;
      const cookie = condition === 'owning' ? f.cookie : condition === 'other' ? other : condition === 'missing' ? null : 'bibref_owner=malformed';
      const paths = {
        read: [root, 'GET'], delete: [root, 'DELETE', {}],
        command: [`${root}/commands`, 'POST', { requestId, revision: 0, command: 'help' }],
        receipt: [`${root}/commands/${requestId}`, 'GET'],
        cancel: [`${root}/commands/${requestId}/cancel`, 'POST', {}],
        context: [`${root}/context`, 'POST', { book: 'Isaiah', verse: '7:14' }],
      };
      const [url, method, body] = paths[route];
      const response = await f.request(url, method, body, { headers: { Cookie: cookie }, keepCookie: false });
      const text = await response.text();
      if (condition !== 'owning') {
        assert.equal(response.status, 404); noDisclosure(text, f.session.id);
        assert.equal(f.executions, calls); assert.deepEqual(await protectedSnapshot(f.store, f.session.id), before);
      } else {
        assert.equal(response.status, 200);
        if (route === 'read') assert.equal(JSON.parse(text).id, f.session.id);
        if (route === 'delete') assert.equal((await protectedSnapshot(f.store, f.session.id))[0], false);
        if (route === 'command') { assert.equal(frames(text).at(-1).type, 'completed'); assert.equal(f.executions, calls + 1); }
        if (route === 'receipt') assert.equal(JSON.parse(text).record.requestId, requestId);
        if (route === 'cancel') assert.equal((await protectedSnapshot(f.store, f.session.id))[2], '1');
        if (route === 'context') { assert.equal(JSON.parse(text).text, 'test\n'); assert.equal(f.executions, calls + 1); }
      }
    });
  }
});

// Each boundary case has a fresh fixture so a rejection's side effects and subsequent
// positive controls cannot be hidden by an unrelated prior command or quota failure.
test('G2 B01–B24 cookie/origin/input boundaries', async t => {
  const labels = ['expired signed cookie', 'tampered signature', 'malformed cookie', 'missing origin',
    'foreign origin', 'literal null origin', 'valid origin', 'wrong content type', 'valid JSON type',
    'malformed JSON', 'parser byte limit', 'malformed route ID', 'malformed request ID', 'unsafe revision',
    'negative revision', 'NUL command', 'exact multibyte limit', 'above multibyte limit', 'local cookie',
    'secure-context cookie', 'invalid context book', 'invalid context verse', 'valid after rejection', 'sanitized storage error'];
  for (const [index, label] of labels.entries()) await t.test(`B${String(index + 1).padStart(2, '0')} ${label}`, async () => {
    const n = index + 1, f = await fixture(normal, { commandBytes: 8, dailyMs: 100000 }, ['HunRUF']);
    const root = `/api/sessions/${f.session.id}`;
    let url = `${root}/commands`, method = 'POST', body = { requestId: randomUUID(), revision: 0, command: 'help' };
    let options = { keepCookie: false }, status = 400, code = 'invalid_command';
    if (n <= 3) {
      url = root; method = 'GET'; body = undefined; status = 404; code = 'not_found';
      const owner = f.cookie.slice('bibref_owner='.length).split('.')[0];
      const raw = `${owner}.${Date.now() - 1000}`;
      const expired = `${raw}.${createHmac('sha256', 'x'.repeat(48)).update(raw).digest('base64url')}`;
      const token = f.cookie.split('=')[1];
      const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
      options.headers = { Cookie: `bibref_owner=${n === 1 ? expired : n === 2 ? tampered : 'malformed'}` };
    }
    if (n >= 4 && n <= 7) {
      options.headers = { Origin: n === 4 ? null : n === 5 ? 'https://foreign.example' : n === 6 ? 'null' : f.base };
      status = n === 7 ? 200 : 403; code = 'invalid_origin';
    }
    if (n === 8 || n === 9) { options.headers = { 'Content-Type': n === 8 ? 'text/plain' : 'application/json' }; status = n === 8 ? 415 : 200; code = 'invalid_content_type'; }
    if (n === 10) { options.rawBody = '{'; code = 'invalid_json'; }
    if (n === 11) { options.rawBody = JSON.stringify({ data: 'x'.repeat(80 * 1024 + 1) }); status = 413; code = 'input_limit'; }
    if (n === 12) { url = '/api/sessions/not-an-id/commands'; code = 'invalid_id'; }
    if (n === 13) { body.requestId = 'not-an-id'; code = 'invalid_id'; }
    if (n === 14) body.revision = Number.MAX_SAFE_INTEGER + 1;
    if (n === 15) body.revision = -1;
    if (n === 16) body.command = 'a\0b';
    if (n === 17 || n === 18) { body.command = 'é'.repeat(n === 17 ? 4 : 5); status = n === 17 ? 200 : 400; }
    if (n === 19 || n === 20) {
      url = '/api/sessions'; body = {}; status = 201;
      if (n === 20) options.headers = { 'X-Forwarded-Proto': 'https', Origin: f.base.replace('http:', 'https:') };
    }
    if (n === 21 || n === 22) {
      url = `${root}/context`; body = { book: n === 21 ? 'Isaiah\nquit' : 'Isaiah', verse: n === 22 ? '7:14 8:1' : '7:14' }; code = 'invalid_reference';
    }
    if (n === 23) {
      const beforeRejected = await protectedSnapshot(f.store, f.session.id), calls = f.executions;
      const rejected = await f.request(url, method, { ...body, command: 'a\0b' });
      assert.equal(rejected.status, 400); await rejected.text();
      assert.equal(f.executions, calls); assert.deepEqual(await protectedSnapshot(f.store, f.session.id), beforeRejected);
      status = 200;
    }
    const before = await protectedSnapshot(f.store, f.session.id), calls = f.executions;
    const original = f.store.run;
    if (n === 24) { f.store.run = async () => { throw new Error('PRIVATE_STORAGE_SENTINEL internal endpoint'); }; status = 503; code = 'storage_unavailable'; }
    let response, text;
    try { response = await f.request(url, method, body, options); text = await response.text(); }
    finally { f.store.run = original; }
    assert.equal(response.status, status);
    if (status >= 400) {
      assert.equal(JSON.parse(text).code, code); assert.doesNotMatch(text, /PRIVATE_STORAGE_SENTINEL|internal endpoint/);
      assert.equal(f.executions, calls); assert.deepEqual(await protectedSnapshot(f.store, f.session.id), before);
      if (n <= 3) noDisclosure(text, f.session.id);
    } else if (n === 19 || n === 20) {
      const cookie = response.headers.get('set-cookie');
      for (const attr of ['HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${f.store.config.sessionTTL}`]) assert.ok(cookie.includes(attr));
      assert.equal(cookie.includes('; Secure'), n === 20);
      assert.equal(f.executions, calls); assert.deepEqual(await protectedSnapshot(f.store, f.session.id), before);
    } else {
      assert.equal(frames(text).at(-1).type, 'completed'); assert.equal(f.executions, calls + 1);
    }
  });
});

test('G3 N09–N11 actual adapter failures preserve hosted saved state', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibref-hosted-protocol-'));
  const bin = path.join(dir, 'fixture.py');
  fs.writeFileSync(bin, `#!/usr/bin/env python3
import json,sys
r=json.loads(sys.stdin.readline())
if r['command']=='protocol': print(json.dumps({'type':'unknown'}),flush=True)
elif r['command']=='crash':
 print(json.dumps({'type':'result','ok':True,'state':{'text':['UNCOMMITTED','']}}),flush=True)
 sys.exit(7)
`, { mode: 0o755 });
  try {
    for (const [id, command, code] of [['N09', 'protocol', 'engine_protocol'], ['N10', 'crash', 'engine_crash'], ['N11', 'missing', 'engine_unavailable']]) {
      await t.test(`${id} ${code}`, async () => {
        const f = await fixture((input, options) => input.command === 'seed'
          ? Promise.resolve({ ok: true, closed: false, state: { ...input.state, text: ['saved clipboard', 'second clipboard'], textset: [true, true], colors: false, diagram: 'info', maxresults: 7 } })
          : executeNative(input, { ...options, memoryLimit: false }),
          { commandMs: 5000 }, [], { bin: command === 'missing' ? path.join(dir, 'missing') : bin, cwd: dir });
        const root = `/api/sessions/${f.session.id}`, requestId = randomUUID();
        const seeded = await f.request(`${root}/commands`, 'POST', { requestId: randomUUID(), revision: 0, command: 'seed' });
        assert.equal(frames(await seeded.text()).at(-1).type, 'completed');
        const before = await (await f.request(root)).json();
        const response = await f.request(`${root}/commands`, 'POST', { requestId, revision: before.revision, command });
        const terminal = frames(await response.text()).at(-1);
        assert.equal(terminal.type, 'failed'); assert.equal(terminal.code, code);
        const receipt = await (await f.request(`${root}/commands/${requestId}`)).json();
        assert.equal(receipt.status, 'failed'); assert.equal(receipt.record.code, code);
        const saved = await (await f.request(root)).json();
        assert.deepEqual(saved.state, before.state); assert.equal(saved.active, null);
        assert.equal(saved.revision, before.revision + 1); assert.equal(saved.history.length, before.history.length + 1);
        assert.equal(f.executions, 2);
      });
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('disabled Q&A uses no terminal request quota and preserves session state', async () => {
  const { request, session, store } = await fixture(normal);
  const rate = store.rate.bind(store);
  let calls = 0;
  store.rate = async (...args) => { calls++; return rate(...args); };
  const disabled = await request('/api/qa/meta');
  assert.equal((await disabled.json()).enabled, false);
  assert.equal((await request('/api/qa/requests', 'POST', { language: 'en' })).status, 503);
  assert.equal(calls, 0);
  const response = await request('/api/sessions/' + session.id);
  assert.equal(response.status, 200);
  const restored = await response.json();
  assert.equal(restored.revision, session.revision);
  assert.deepEqual(restored.state, session.state);
  assert.ok(calls > 0);
});

test('canonical and failing Q&A routes leave terminal and Python defaults independent', async () => {
  const { createQaRouter } = await import('../qa/api.js');
  const origin = 'https://qa.example.test';
  const qaRouter = createQaRouter({
    config: { enabled: true, origin, price: { expires: Date.now() + 60000 }, keys: { binding: { bytes: Buffer.alloc(32, 3) } } },
    corpus: { manifest: { rightsStatus: 'approved', version: 'fixture', sourceLanguage: 'en' } },
    ledger: { network() { throw new Error('database-password-sentinel'); } },
    // Constructor-only origin injection avoids relying on fetch overriding Host.
    requestOrigin: req => req.get('x-test-qa-origin') === origin ? origin : null,
  });
  const { request, session, store } = await fixture(normal, {}, [], { qaRouter });
  const rate = store.rate.bind(store);
  let calls = 0;
  store.rate = async (...args) => { calls++; return rate(...args); };
  const meta = await (await request('/api/qa/meta')).json();
  assert.equal(meta.enabled, false);
  assert.equal(meta.canonicalUrl, origin + '/qa.html');
  const canonical = { headers: { 'x-test-qa-origin': origin, origin } };
  assert.equal((await (await request('/api/qa/meta', 'GET', undefined, canonical)).json()).enabled, true);
  const failed = await request('/api/qa/requests', 'POST', { language: 'en' }, canonical);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /database-password-sentinel/);
  assert.equal(calls, 0);
  assert.equal((await (await request('/api/meta')).json()).features.python, false);
  const response = await request('/api/sessions/' + session.id);
  assert.equal(response.status, 200);
  const restored = await response.json();
  assert.deepEqual(restored.state, session.state);
  assert.equal(restored.revision, session.revision);
  assert.ok(calls > 0);
});
