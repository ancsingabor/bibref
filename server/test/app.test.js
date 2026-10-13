import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectStore, ApiError } from '../store.js';
import { createApp } from '../app.js';

const resources = [];
after(async () => { for (const { server, store } of resources) { await new Promise(r => server.close(r)); await store.run.close(); } });
async function fixture(runner, config = {}) {
  const ns = `test:${randomUUID()}`;
  const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' },
    { prefix: ns, global: `${ns}:limits`, commandMs: 500, dailyMs: 20000, requestRate: 1000, ...config });
  const app = createApp({ store, manifest: { engineVersion: 'v1', vocabulary: [] }, secret: 'x'.repeat(48), runner,
    disconnectMs: 20, pollMs: 10, log: () => {} });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r));
  resources.push({ server, store });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const session = await (await request('/api/sessions', 'POST', {})).json();
  return { request, session, store, base };
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
