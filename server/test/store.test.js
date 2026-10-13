import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectStore, initialState } from '../store.js';

const clients = [];
async function fixture(config = {}) {
  const ns = `test:${randomUUID()}`;
  const settings = { prefix: ns, global: `${ns}:limits`, commandMs: 10000, dailyMs: 20000, ...config };
  const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' }, settings);
  clients.push(store);
  const owner = randomUUID(), session = await store.create(owner, 'v1');
  return { store, owner, session, settings };
}
after(async () => { for (const store of clients) await store.run.close(); });
const record = (job, status = 'completed') => ({ requestId: job.requestId, command: job.command, status,
  durationMs: 20, events: [{ type: 'output', kind: 'text', text: 'OK\n' }] });

test('ownership, state persistence across clients, revisions and completed-request deduplication', async () => {
  const { store, owner, session, settings } = await fixture();
  await assert.rejects(store.get(session.id, randomUUID()), { code: 'not_found' });
  const id = randomUUID();
  const claim = await store.claim(session.id, owner, 0, id, 'latintext1 abc', 'v1');
  const state = { ...initialState(), text: ['abc', ''], textset: [true, false] };
  await store.finish(session.id, claim.session, claim.job, record(claim.job), state);
  const second = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380' }, settings); clients.push(second);
  const restored = await second.get(session.id, owner);
  assert.equal(restored.session.revision, 1); assert.equal(restored.session.state.text[0], 'abc');
  const duplicate = await second.claim(session.id, owner, 0, id, 'latintext1 abc', 'v1');
  assert.equal(duplicate.status, 'recorded');
  await assert.rejects(store.claim(session.id, owner, 0, randomUUID(), 'help', 'v1'), { code: 'stale_revision' });
  await assert.rejects(store.claim(session.id, owner, 1, id, 'different', 'v1'), { code: 'request_id_reused' });
});

test('atomic per-session/global concurrency and cancellation fence', async () => {
  const { store, owner, session } = await fixture({ dailyMs: 40000 });
  const a = await store.claim(session.id, owner, 0, randomUUID(), 'help', 'v1');
  const same = await store.claim(session.id, owner, 0, a.job.requestId, 'help', 'v1'); assert.equal(same.status, 'running');
  await assert.rejects(store.claim(session.id, owner, 0, randomUUID(), 'help', 'v1'), { code: 'busy' });
  const s2 = await store.create(owner, 'v1'), s3 = await store.create(owner, 'v1');
  const b = await store.claim(s2.id, owner, 0, randomUUID(), 'help', 'v1');
  await assert.rejects(store.claim(s3.id, owner, 0, randomUUID(), 'help', 'v1'), { code: 'capacity' });
  await store.cancel(session.id, owner, a.job.requestId); assert.equal((await store.poll(session.id, a.job)).cancel, true);
  await assert.rejects(store.finish(session.id, a.session, a.job, record(a.job), initialState()), { code: 'cancelled' });
  await store.finish(session.id, a.session, a.job, record(a.job, 'failed'), null);
  assert.equal((await store.get(session.id, owner)).session.revision, 1);
  await store.finish(s2.id, b.session, b.job, record(b.job), initialState());
});

test('budget is reserved atomically and refunds only unused execution time', async () => {
  const { store, owner, session } = await fixture({ commandMs: 1000, dailyMs: 1000 });
  const s2 = await store.create(owner, 'v1');
  const a = await store.claim(session.id, owner, 0, randomUUID(), 'help', 'v1');
  await assert.rejects(store.claim(s2.id, owner, 0, randomUUID(), 'help', 'v1'), { code: 'daily_budget' });
  await store.finish(session.id, a.session, a.job, { ...record(a.job), durationMs: 1000 }, initialState());
  await assert.rejects(store.claim(s2.id, owner, 0, randomUUID(), 'help', 'v1'), { code: 'daily_budget' });
});

test('stale leases recover without replay, late workers cannot overwrite state', async () => {
  const { store, owner, session } = await fixture();
  const a = await store.claim(session.id, owner, 0, randomUUID(), 'help', 'v1');
  await store.run("return redis.call('DEL', KEYS[1])", [store.lock(session.id)], []);
  const recovered = await store.get(session.id, owner);
  assert.equal(recovered.session.history[0].code, 'interrupted');
  const duplicate = await store.claim(session.id, owner, 0, a.job.requestId, 'help', 'v1');
  assert.equal(duplicate.status, 'recorded');
  const next = await store.claim(session.id, owner, 1, randomUUID(), 'help', 'v1');
  await assert.rejects(store.finish(session.id, a.session, a.job, record(a.job), initialState()), { code: 'lease_lost' });
  await store.finish(session.id, next.session, next.job, record(next.job), initialState());
});

test('version mismatch, session expiry, quota admission, rate limits, history trimming', async () => {
  const { store, owner, session } = await fixture({ storageBytes: 2304 * 1024, maxHistory: 2, transcriptBytes: 1000, commandRate: 2 });
  await assert.rejects(store.create(owner, 'v1'), { code: 'storage_full' });
  await assert.rejects(store.claim(session.id, owner, 0, randomUUID(), 'help', 'v2'), { code: 'incompatible_version' });
  await store.rate('ip', 'commands'); await store.rate('ip', 'commands');
  await assert.rejects(store.rate('ip', 'commands'), { code: 'rate_limit' });
  for (let rev = 0; rev < 3; rev++) {
    const a = await store.claim(session.id, owner, rev, randomUUID(), 'help', 'v1');
    await store.finish(session.id, a.session, a.job, record(a.job), initialState());
  }
  assert.equal((await store.get(session.id, owner)).session.history.length, 2);
  await store.remove(session.id, owner); await assert.rejects(store.get(session.id, owner), { code: 'not_found' });
  const exp = await fixture({ sessionTTL: 1 }); await new Promise(r => setTimeout(r, 1100));
  await assert.rejects(exp.store.get(exp.session.id, exp.owner), { code: 'not_found' });
});


test('oversized history keeps an outcome receipt and trimmed failures cannot replay with their old revision', async () => {
  const { store, owner, session } = await fixture({ transcriptBytes: 800, maxHistory: 1 });
  const first = await store.claim(session.id, owner, 0, randomUUID(), 'raw LXX Genesis 0 -1', 'v1');
  const large = { ...record(first.job), events: [{type:'output',kind:'text',text:'x'.repeat(5000)}] };
  await store.finish(session.id, first.session, first.job, large, null);
  const restored = await store.get(session.id, owner);
  assert.equal(restored.session.history[0].historyTruncated, true);
  assert.equal((await store.claim(session.id, owner, 0, first.job.requestId, first.job.command, 'v1')).status, 'recorded');
  const next = await store.claim(session.id, owner, 1, randomUUID(), 'help', 'v1');
  await store.finish(session.id, next.session, next.job, record(next.job, 'failed'), null);
  await assert.rejects(store.claim(session.id, owner, 0, first.job.requestId, first.job.command, 'v1'), {code:'stale_revision'});
});
