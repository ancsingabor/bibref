import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeQuestion } from '../qa/api.js';

test('normalizes NFC before binding and rejects oversized code point input', () => {
  assert.equal(normalizeQuestion('  a\u0301  '), 'á');
  assert.equal(normalizeQuestion('𐌰'.repeat(4000)).length, 8000);
  assert.equal(normalizeQuestion('𐌰'.repeat(4001)), null);
  assert.equal(normalizeQuestion('a\0b'), null);
  assert.equal(normalizeQuestion('\ud800'), null);
});

import { createServer } from 'node:http';
import { once } from 'node:events';
import { fixtureServer } from './qa-local-server.mjs';

test('origin, receipt owner, ticket binding and malformed JSON are enforced', async t => {
  let handler;
  const server = createServer((req, res) => handler(req, res));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  handler = fixtureServer({ origin });
  const post = (path, body, extra = {}) => fetch(origin + '/api/qa/' + path, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  assert.equal((await post('requests', { language: 'hu' }, { origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await post('requests', '{')).status, 400);
  const ticket = await post('requests', { language: 'hu' });
  assert.equal(ticket.status, 201);
  const cookie = ticket.headers.get('set-cookie').split(';')[0];
  const { requestId, ticket: proof } = await ticket.json();
  const input = { requestId, ticket: proof, language: 'hu', question: 'Mire utalhat a jel?' };
  assert.equal((await post('questions', input)).status, 404);
  assert.equal((await post('questions', { ...input, language: 'en' }, { cookie })).status, 409);
  const answer = await post('questions', input, { cookie });
  assert.equal((await answer.json()).status, 'answered');
  assert.equal((await post('questions', { ...input, question: 'Different' }, { cookie })).status, 409);
  const receipt = '/api/qa/requests/' + requestId + '?language=hu';
  assert.equal((await fetch(origin + receipt)).status, 404);
  assert.equal((await fetch(origin + receipt, { headers: { cookie } })).status, 200);
});

test('accounting outages return localized categories and scrub private details', async t => {
  let handler;
  const server = createServer((req, res) => handler(req, res));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  handler = fixtureServer({ origin, ledger: {
    network: () => { throw new Error('database-password-sentinel'); },
  } });
  const response = await fetch(origin + '/api/qa/requests?language=hu', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"language":"hu"}',
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.code, 'unavailable');
  assert.equal(payload.language, 'hu');
  assert.match(payload.message, /jelenleg nem érhető el/);
  assert.doesNotMatch(JSON.stringify(payload), /database-password-sentinel/);
});
