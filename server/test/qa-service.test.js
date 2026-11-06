import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createService } from '../qa/service.js';
import { article } from './fixtures/qa/article.js';

test('unknown transport outcome preserves the fence and duplicate never dispatches', async () => {
  let admitted = false;
  let sent = 0;
  let uncertain = 0;
  const answer = createService({
    corpus: { articles: [article], topics: { [article.id]: { en: ['sign'] } }, manifest: { version: 'fixture', rightsStatus: 'fixture' } },
    admission: {
      admit() {
        if (admitted) return { status: 'uncertain' };
        admitted = true;
        return { fence: 'fixture', deadline: Date.now() + 60000 };
      },
      dispatch: () => 'fixture-token',
      uncertain() { uncertain++; },
      finish() { assert.fail('uncertain work cannot finish'); },
    },
    provider: {
      stages: { generation: {}, verification: {} },
      fits: () => true,
      invoke() { sent++; throw new Error('timeout'); },
    },
  });
  const request = { id: 'fixture', language: 'en', question: 'Can a sign refer beyond itself?' };
  assert.equal((await answer(request)).status, 'uncertain');
  assert.equal((await answer(request)).status, 'uncertain');
  assert.equal(sent, 1);
  assert.equal(uncertain, 1);
});

test('known generation refusal settles as a failure and skips verification', async () => {
  const stages = [];
  const answer = createService({
    corpus: { articles: [article], topics: { [article.id]: { en: ['sign'] } },
      manifest: { version: 'fixture', rightsStatus: 'fixture' } },
    admission: {
      admit: () => ({ fence: 'fixture', deadline: Date.now() + 60000 }),
      dispatch: (_operation, stage) => { stages.push(stage); return stage; },
      confirm: (_operation, _stage, _token, cost) => { assert.equal(cost, 7n); return true; },
      finish: (_operation, payload) => payload,
    },
    provider: { stages: {}, fits: () => true, invoke: () => ({ cost: 7n, failed: true }) },
  });
  const result = await answer({ id: 'fixture', language: 'en', question: 'Can a sign refer beyond itself?' });
  assert.equal(result.status, 'failed');
  assert.deepEqual(stages, ['generation']);
});

test('late completion after disconnect cannot publish or trigger another dispatch', async () => {
  let complete;
  let started;
  const sent = new Promise(resolve => { started = resolve; });
  const late = new Promise(resolve => { complete = resolve; });
  let dispatches = 0;
  let admitted = false;
  const answer = createService({
    corpus: { articles: [article], topics: { [article.id]: { en: ['sign'] } },
      manifest: { version: 'fixture', rightsStatus: 'fixture' } },
    admission: {
      admit() {
        if (admitted) return { status: 'running' };
        admitted = true;
        return { fence: 'fixture', deadline: Date.now() + 10000 };
      },
      dispatch() { dispatches++; return 'token'; },
      confirm: () => false,
      finish: () => assert.fail('late result was published'),
    },
    provider: { stages: {}, fits: () => true, invoke() { started(); return late; } },
  });
  const request = { id: 'fixture', language: 'en', question: 'Can a sign refer beyond itself?' };
  const disconnected = new AbortController();
  const client = Promise.race([answer(request), new Promise(resolve => {
    disconnected.signal.addEventListener('abort', () => resolve('disconnected'), { once: true });
  })]);
  await sent;
  disconnected.abort();
  assert.equal(await client, 'disconnected');
  assert.equal((await answer(request)).status, 'running');
  complete({ cost: 1n, value: {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dispatches, 1);
});
