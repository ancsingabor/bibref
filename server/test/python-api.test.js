import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectStore, ApiError } from '../store.js';
import { PythonStore } from '../python-store.js';
import { pythonOperation } from '../python-operations.js';
import { createApp } from '../app.js';

const resources = [];
after(async () => { for (const { server, store } of resources) { await new Promise(r => server.close(r)); await store.run.close(); } });
async function fixture(runner, config = {}, enabled = true) {
  const ns = `test:python:${randomUUID()}`;
  const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' },
    { prefix: ns, global: `${ns}:limits`, commandMs: 500, dailyMs: 20000, requestRate: 1000, ...config });
  let executions = 0;
  const app = createApp({ store, manifest: { engineVersion: 'v1', modules: [{ name: 'LXX' }, { name: 'SBLGNT' }] },
    secret: 'x'.repeat(48), runner: (...args) => { executions++; return runner(...args); }, pythonEnabled: enabled, disconnectMs: 20, pollMs: 10, log: () => {} });
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
  const root = `/api/sessions/${session.id}/python-runs`;
  const start = async (revision = 0) => (await request(root, 'POST', { revision })).json();
  return { request, session, store, base, root, start, get cookie() { return cookie; }, get executions() { return executions; } };
}
const frames = text => text.trim().split('\n\n').map(x => JSON.parse(x.slice(6)));
const normal = async ({ command, state }, { onEvent }) => {
  let output = 'Stored.\n';
  if (command.startsWith('text') || command.startsWith('lookup')) output = 'Stored internally as farec.\n';
  if (command.startsWith('maxresults')) output = 'Set to 10000.\n';
  if (command.startsWith('find')) output = 'Found in Genesis 1:1+1 1:1-2 (book position 2-5)\n1 occurrences.\n';
  if (command === 'jaccard12') output = 'Jaccard distance is 0.123456.\n';
  if (command === 'nearest12') output = 'Nearest Jaccard distance is 0.250000 with substring abc.\n';
  if (command.startsWith('getrefs')) output = 'match (length=12, pos1=3)\nmatch (length=23, pos1=4)\nFinished\n';
  onEvent({ type: 'output', kind: 'text', text: output });
  return { ok: true, state: { ...state, text: ['farec', ''], textset: [true, false] }, closed: false };
};

test('Python operations preserve wrapper values, deduplicate, and leave terminal state/revision untouched', async () => {
  let count = 0;
  const f = await fixture((...args) => { count++; return normal(...args); });
  const run = await f.start(), url = `${f.root}/${run.id}/operations`;
  assert.equal((await f.request(`/api/sessions/${run.id}`)).status, 404, 'private runs are outside terminal namespace');
  const cases = [
    ['maxresults', [10000], 10000], ['text_n', [1, 'Farec'], 'farec'],
    ['latintext_n', [2, 'abc'], null], ['lookup_n', [1, 'LXX Genesis 1:1'], 'farec'],
    ['raw_n', [1, 'LXX', 'Genesis', 1, -1], null],
    ['find_n', [1, 'LXX'], [['Genesis 1:1+1 1:1-2', 2, 5]]],
    ['jaccard12', [], 12.3456], ['nearest12', [], [25, 'abc']],
    ['getrefs_maxlength', ['SBLGNT LXX Psalms 2'], '23'],
  ];
  for (const [sequence, [operation, args, value]] of cases.entries()) {
    const body = { requestId: randomUUID(), sequence, operation, args };
    const response = await f.request(url, 'POST', body);
    assert.equal(response.status, 200);
    assert.deepEqual(frames(await response.text()).at(-1).record.value, value);
    const replay = await f.request(url, 'POST', body);
    assert.equal(frames(await replay.text())[0].type, 'recorded');
    const status = await (await f.request(`${url}/${body.requestId}`)).json();
    assert.equal(status.status, 'completed');
  }
  assert.equal(count, cases.length);
  const terminal = await (await f.request(`/api/sessions/${f.session.id}`)).json();
  assert.deepEqual(terminal.state, f.session.state); assert.equal(terminal.revision, 0); assert.deepEqual(terminal.history, []);
  assert.equal((await f.request(`${f.root}/${run.id}/end`, 'POST', {})).status, 200);
  assert.ok((await f.start()).id);
});

test('Python run ownership, stale revisions, singleton and validation fail before execution', async () => {
  let executions = 0;
  const f = await fixture((...args) => { executions++; return normal(...args); });
  assert.equal((await f.request(f.root, 'POST', { revision: 1 })).status, 409);
  const run = await f.start();
  assert.equal((await f.request(f.root, 'POST', { revision: 0 })).status, 409);
  const url = `${f.root}/${run.id}/operations`;
  const invalid = [ ['find_n', [1, 'unknown']], ['text_n', [1, 'abc\nquit']], ['text_n', [3, 'abc']], ['maxresults', [10001]], ['maxresults', [true]], ['spawn_bibref', []], ['text_n', [1, 'a#quit']], ['lookup_n', [1, 'unknown Genesis 1:1']] ];
  invalid.push(['raw_n', [1, 'LXX', 'Genesis', 2, 2147483647]], ['raw_n', [1, 'LXX', 'Genesis', 2, -1]]);
  for (const [operation, args] of invalid) assert.equal((await f.request(url, 'POST', { requestId: randomUUID(), sequence: 0, operation, args })).status, 400);
  const foreign = await fetch(f.base + url, { method: 'POST', headers: { Origin: f.base, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), sequence: 0, operation: 'maxresults', args: [100] }) });
  assert.equal(foreign.status, 404); assert.equal(executions, 0);
});

test('Python cancellation kills work, discards state, retains failure receipt and releases global admission', async () => {
  const f = await fixture(async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })), { concurrency: 1 });
  const run = await f.start(), id = randomUUID(), url = `${f.root}/${run.id}`;
  const running = await f.request(`${url}/operations`, 'POST', { requestId: id, sequence: 0, operation: 'jaccard12', args: [] });
  assert.equal((await f.request(`${url}/operations`, 'POST', { requestId: randomUUID(), sequence: 0, operation: 'jaccard12', args: [] })).status, 409);
  await f.request(`${url}/end`, 'POST', {});
  assert.equal(frames(await running.text()).at(-1).record.code, 'cancelled');
  const recovered = await (await f.request(`${url}/operations/${id}`)).json();
  assert.equal(recovered.record.status, 'failed');
  const saved = await f.store.eval("return redis.call('GET', KEYS[1])", [f.store.key(f.session.id)]);
  const privateRun = await new PythonStore(f.store).getRun(run.id, f.session.id, saved.owner);
  assert.deepEqual(privateRun.session.state, f.session.state);
  assert.ok((await f.start()).id);
});

test('Python runs share terminal global slots and daily budget; limits and failures close safely', async () => {
  const f = await fixture(normal, { concurrency: 1, dailyMs: 500 });
  const run = await f.start();
  const raw = await f.store.eval("return redis.call('GET', KEYS[1])", [f.store.key(f.session.id)]);
  const lease = await f.store.claim(f.session.id, raw.owner, 0, randomUUID(), 'help', 'v1');
  const body = { requestId: randomUUID(), sequence: 0, operation: 'find_n', args: [1, 'LXX'] };
  const blocked = await f.request(`${f.root}/${run.id}/operations`, 'POST', body);
  assert.equal(blocked.status, 429); assert.equal((await blocked.json()).code, 'capacity');
  await f.store.finish(f.session.id, lease.session, lease.job, { requestId: lease.job.requestId, command: 'help', durationMs: 500, events: [] }, null);
  assert.equal((await (await f.request(`${f.root}/${run.id}/operations`, 'POST', body)).json()).code, 'daily_budget');
  const privateStore = new PythonStore(f.store);
  await f.store.eval("local s=cjson.decode(redis.call('GET',KEYS[1])); s.revision=256; redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL'); return '{}'", [privateStore.key(run.id)]);
  assert.equal((await (await f.request(`${f.root}/${run.id}/operations`, 'POST', { ...body, sequence: 256 })).json()).code, 'operation_limit');
});

test('Python feature is disabled by default and parser refuses malformed output', async () => {
  const f = await fixture(normal, {}, false);
  assert.equal((await f.request(f.root, 'POST', { revision: 0 })).status, 404);
  assert.equal((await (await f.request('/api/meta')).json()).features.python, false);
  assert.throws(() => pythonOperation('find_n', [1, 'LXX'], ['LXX']).parse('garbage'), /engine_protocol/);
  const broken = await fixture(async () => { throw new ApiError('engine_crash'); });
  const run = await broken.start();
  const response = await broken.request(`${broken.root}/${run.id}/operations`, 'POST', { requestId: randomUUID(), sequence: 0, operation: 'jaccard12', args: [] });
  assert.equal(frames(await response.text()).at(-1).record.code, 'engine_crash');
});

test('Python absolute deadlines and aggregate output limits are enforced on the server', async () => {
  let executions = 0;
  const f = await fixture((...args) => { executions++; return normal(...args); });
  const run = await f.start(), privateStore = new PythonStore(f.store);
  const body = { requestId: randomUUID(), sequence: 0, operation: 'find_n', args: [1, 'LXX'] };
  const operation = `${f.root}/${run.id}/operations`;
  await f.store.eval("local s=cjson.decode(redis.call('GET',KEYS[1])); s.python.deadline=1; redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL'); return '{}'", [privateStore.key(run.id)]);
  assert.equal((await (await f.request(operation, 'POST', body)).json()).code, 'timeout');
  assert.equal(executions, 0);
  await f.request(`${f.root}/${run.id}/end`, 'POST', {});
  const second = await f.start();
  await f.store.eval("local s=cjson.decode(redis.call('GET',KEYS[1])); s.python.bytes=2097150; redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL'); return '{}'", [privateStore.key(second.id)]);
  const result = await f.request(`${f.root}/${second.id}/operations`, 'POST', { ...body, requestId: randomUUID() });
  assert.equal(frames(await result.text()).at(-1).record.code, 'output_limit');
  assert.deepEqual((await (await f.request(`/api/sessions/${f.session.id}`)).json()).state, f.session.state);
});

test('Python operation deadlines abort work and run creation is limited to five/hour/IP', async () => {
  const f = await fixture(async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })), { commandMs: 20 });
  const run = await f.start();
  const response = await f.request(`${f.root}/${run.id}/operations`, 'POST', { requestId: randomUUID(), sequence: 0, operation: 'jaccard12', args: [] });
  assert.equal(frames(await response.text()).at(-1).record.code, 'timeout');
  for (let i = 1; i < 5; i++) {
    const next = await f.start(); assert.ok(next.id);
    await f.request(`${f.root}/${next.id}/end`, 'POST', {});
  }
  assert.equal((await f.request(f.root, 'POST', { revision: 0 })).status, 429);
});

// Denials compare raw parent/run state, active/cancel keys and the parent-run link.
// Rate counters, TTL changes and renewed cookies are deliberately outside this claim.
async function pythonSnapshot(f, runId) {
  const runs = new PythonStore(f.store);
  const keys = [f.store.key(f.session.id), f.store.lock(f.session.id),
    runs.link(f.session.id), runs.key(runId), runs.lock(runId), runs.cancelKey(runId)];
  return f.store.eval("local values={}; for i,key in ipairs(KEYS) do values[i]=redis.call('GET',key) end; return cjson.encode(values)", keys);
}

test('G1 enabled Python ownership matrix (16 cases)', async t => {
  const routes = ['create', 'operation', 'receipt', 'end'];
  const owners = ['owning', 'other', 'missing', 'malformed'];
  for (const [routeIndex, route] of routes.entries()) for (const [ownerIndex, condition] of owners.entries()) {
    const caseId = `G1-${String(25 + routeIndex * 4 + ownerIndex).padStart(2, '0')}`;
    await t.test(`${caseId} Python ${route}: ${condition}`, async () => {
      const f = await fixture(normal, { commandMs: 5000, dailyMs: 100000 });
      const otherResponse = await f.request('/api/sessions', 'POST', {}, { headers: { Cookie: null }, keepCookie: false });
      assert.equal(otherResponse.status, 201); await otherResponse.json();
      const other = otherResponse.headers.get('set-cookie').split(';')[0];
      const run = route === 'create' ? { id: randomUUID() } : await f.start();
      assert.ok(run.id);
      const runs = new PythonStore(f.store), requestId = randomUUID(), url = `${f.root}/${run.id}`;
      const operation = { requestId, sequence: 0, operation: 'maxresults', args: [10000] };
      if (route === 'receipt') {
        const response = await f.request(`${url}/operations`, 'POST', operation);
        assert.equal(frames(await response.text()).at(-1).type, 'completed');
      }
      if (route === 'end') {
        const saved = await f.store.eval("return redis.call('GET',KEYS[1])", [runs.key(run.id)]);
        await runs.claim(run.id, saved.owner, 0, requestId, JSON.stringify({ operation: 'maxresults', args: [10000] }), 'v1', saved.python.deadline);
      }
      const before = await pythonSnapshot(f, run.id), calls = f.executions;
      const cookie = condition === 'owning' ? f.cookie : condition === 'other' ? other : condition === 'missing' ? null : 'bibref_owner=malformed';
      const paths = {
        create: [f.root, 'POST', { revision: 0 }], operation: [`${url}/operations`, 'POST', operation],
        receipt: [`${url}/operations/${requestId}`, 'GET'], end: [`${url}/end`, 'POST', {}],
      };
      const [target, method, body] = paths[route];
      const response = await f.request(target, method, body, { headers: { Cookie: cookie }, keepCookie: false });
      const text = await response.text();
      if (condition !== 'owning') {
        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(text), { code: 'not_found', message: 'Session or command is unavailable or has expired.' });
        assert.doesNotMatch(text, /"(?:state|history|active|record|owner|command)"/);
        assert.ok(!text.includes(run.id)); assert.ok(!text.includes(f.session.id));
        assert.equal(f.executions, calls); assert.deepEqual(await pythonSnapshot(f, run.id), before);
      } else {
        assert.equal(response.status, route === 'create' ? 201 : 200);
        if (route === 'create') {
          const created = JSON.parse(text); assert.match(created.id, /^[0-9a-f-]{36}$/);
          const parent = await f.store.eval("return redis.call('GET',KEYS[1])", [f.store.key(f.session.id)]);
          const privateRun = await runs.getRun(created.id, f.session.id, parent.owner);
          assert.deepEqual(privateRun.session.state, f.session.state);
        }
        if (route === 'operation') { assert.equal(frames(text).at(-1).record.value, 10000); assert.equal(f.executions, calls + 1); }
        if (route === 'receipt') assert.equal(JSON.parse(text).record.requestId, requestId);
        if (route === 'end') {
          const after = await pythonSnapshot(f, run.id);
          assert.equal(JSON.parse(after[3]).python.ended, true); assert.equal(after[5], '1');
          assert.equal(after[0], before[0], 'ending private work leaves terminal state unchanged');
        }
      }
    });
  }
});
