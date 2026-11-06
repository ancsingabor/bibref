import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function checkConcurrentAdmission(first, second, request, stages) {
  const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
    (index % 2 ? first : second).admit({ ...request, id: randomUUID(), browser: randomUUID() }, stages)));
  assert.equal(results.filter(item => item.fence).length, 1, 'fixture ledger must have room for exactly one reservation');
  assert.ok(results.filter(item => !item.fence).every(item => item.code === 'budget'));
}

export async function checkDuplicateAdmission(first, second, request, stages) {
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) =>
    (index % 2 ? first : second).admit(request, stages)));
  assert.equal(results.filter(item => item.fence).length, 1);
}

async function runIntegration() {
  const { Pool } = await import('pg');
  const { createLedger } = await import('../../qa/store.js');
  const { readFile } = await import('node:fs/promises');
  const url = new URL(process.env.QA_TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/bibref_qa_test_[a-f0-9]{16,}$/.test(url.pathname)) throw new Error('Use a fresh, dedicated local fixture database');
  const primary = new Pool({ connectionString: url.href, max: 3 });
  const secondary = new Pool({ connectionString: url.href, max: 3, options: '-c role=bibref_qa_runtime' });
  try {
    const { rows: [existing] } = await primary.query("SELECT to_regnamespace('qa') AS schema");
    if (existing.schema) throw new Error('Fixture database must be empty');
    for (const migration of ['001-qa.sql', '002-runtime.sql']) {
      const ddl = await readFile(new URL('../../qa/migrations/' + migration, import.meta.url), 'utf8');
      await primary.query(ddl);
    }
    await assert.rejects(secondary.query('UPDATE qa.control SET enabled=false'), { code: '42501' });
    await assert.rejects(secondary.query('SELECT qa.reconcile(gen_random_uuid())'), { code: '42501' });
    assert.equal((await secondary.query('SELECT count(*) FROM qa.runtime_control()')).rows[0].count, '0');
    const config = {
      epoch: randomUUID(), corpusVersion: 'fixture', origin: 'https://fixture.invalid',
      price: { version: 'fixture', expires: Date.now() + 180000, maximumCost: 10n, model: 'fixture' },
      keys: { receipt: { version: 1, bytes: Buffer.alloc(32, 3) } },
    };
    await primary.query(`INSERT INTO qa.control(id,enabled,epoch,schema_version,canonical_origin,corpus_version,price_version)
      VALUES (1,true,$1,1,$2,$3,$4)`, [config.epoch, config.origin, config.corpusVersion, config.price.version]);
    await primary.query(`INSERT INTO qa.month_ledger(month,epoch,ceiling)
      VALUES (date_trunc('month', now() AT TIME ZONE 'UTC')::date,$1,10)`, [config.epoch]);
    const first = createLedger(primary, config);
    const second = createLedger(secondary, config);
    const request = { id: randomUUID(), browser: randomUUID(), binding: 'fixture', language: 'hu', expires: Date.now() + 900000 };
    const stages = { generation: { input: 1, output: 1, maximumCost: 10n } };
    await checkConcurrentAdmission(first, second, request, stages);
    const { rows: [month] } = await primary.query('SELECT reserved,settled FROM qa.month_ledger');
    assert.equal(BigInt(month.reserved), 10n);
    assert.equal(BigInt(month.settled), 0n);
    const { rows: [winner] } = await primary.query('SELECT id,browser,fence FROM qa.operation');
    const operation = { id: winner.id, fence: winner.fence };
    assert.equal(await first.dispatch({ ...operation, fence: randomUUID() }, 'generation'), null);
    const token = await first.dispatch(operation, 'generation');
    assert.ok(token);
    assert.equal(await second.dispatch(operation, 'generation'), null);
    await first.uncertain(operation, 'generation', token);
    assert.equal((await second.receipt({ id: winner.id, browser: winner.browser })).status, 'uncertain');
    assert.equal(await second.confirm(operation, 'generation', token, 5n), false);
    assert.equal(await second.confirm(operation, 'generation', token, 5n), false);
    const { rows: [retained] } = await primary.query('SELECT reserved,settled FROM qa.month_ledger');
    assert.equal(BigInt(retained.reserved), 10n);
    assert.equal(BigInt(retained.settled), 0n);
    await primary.query("UPDATE qa.operation SET deadline_at=now()-interval '1 second' WHERE id=$1", [winner.id]);
    assert.equal((await primary.query('SELECT qa.reconcile($1) result', [winner.id])).rows[0].result, true);
    assert.equal((await primary.query('SELECT qa.reconcile($1) result', [winner.id])).rows[0].result, false);
    const { rows: [reconciled] } = await primary.query('SELECT reserved,settled FROM qa.month_ledger');
    assert.deepEqual([reconciled.reserved, reconciled.settled], ['0', '5']);

    const duplicate = { ...request, id: randomUUID() };
    const cheap = { generation: { input: 1, output: 1, maximumCost: 5n } };
    await checkDuplicateAdmission(first, second, duplicate, cheap);
    const other = { ...request, id: randomUUID(), browser: randomUUID() };
    assert.equal((await second.admit(other, cheap)).code, 'budget');

    // Drop the acknowledgment after the primary executed the autocommitted call.
    const ambiguousPool = { async query(sql, parameters) {
      await secondary.query(sql, parameters);
      throw new Error('lost acknowledgment');
    } };
    const zero = { ...other, id: randomUUID() };
    const ambiguous = createLedger(ambiguousPool, config);
    await assert.rejects(ambiguous.admit(zero, {}), { message: 'accounting_unavailable' });
    assert.equal((await second.admit(zero, {})).status, 'running');
    const { rows: [crashed] } = await primary.query('SELECT id FROM qa.operation WHERE id=$1', [zero.id]);
    await primary.query("UPDATE qa.operation SET deadline_at=now()-interval '1 second' WHERE id=$1", [crashed.id]);
    assert.equal((await primary.query('SELECT qa.reconcile($1) result', [crashed.id])).rows[0].result, true);

    // Recreate an original-period reservation, then settle while today's month
    // remains current. This verifies settlement never charges the new period.
    const { rows: [dates] } = await primary.query(`SELECT date_trunc('month',now() AT TIME ZONE 'UTC')::date::text current,
      (date_trunc('month',now() AT TIME ZONE 'UTC')-interval '1 month')::date::text previous`);
    await primary.query('INSERT INTO qa.month_ledger(month,epoch,reserved) VALUES($1,$2,5)', [dates.previous, config.epoch]);
    await primary.query('UPDATE qa.month_ledger SET reserved=0 WHERE month=$1', [dates.current]);
    await primary.query("UPDATE qa.operation SET month=$2,deadline_at=now()-interval '1 second' WHERE id=$1", [duplicate.id, dates.previous]);
    assert.equal((await primary.query('SELECT qa.reconcile($1) result', [duplicate.id])).rows[0].result, true);
    assert.equal((await primary.query('SELECT reserved FROM qa.month_ledger WHERE month=$1', [dates.previous])).rows[0].reserved, '0');

    const address = '192.0.2.10';
    const key = Buffer.alloc(32, 4);
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).network(key, address)));
    assert.equal(results.filter(Boolean).length, 10);
    const { rows: [{ utc_day: day }] } = await primary.query('SELECT floor(extract(epoch FROM clock_timestamp())/86400)::bigint utc_day');
    await primary.query(`INSERT INTO qa.network_window(digest,seen_at)
      SELECT 'previous-day-fixture',clock_timestamp()-interval '1 second' FROM generate_series(1,10)`);
    assert.equal((await secondary.query('SELECT qa.runtime_network($1,$2,$3,false) result',
      ['current-day-fixture', 'previous-day-fixture', day])).rows[0].result, false);
    await primary.query("UPDATE qa.network_window SET seen_at=clock_timestamp()-interval '61 seconds' WHERE digest='previous-day-fixture'");
    assert.equal((await secondary.query('SELECT qa.runtime_network($1,$2,$3,false) result',
      ['current-day-fixture', 'previous-day-fixture', day])).rows[0].result, true);
  } finally {
    await Promise.all([primary.end(), secondary.end()]);
  }
}

if (process.argv[1] && process.argv[1].endsWith('/qa-integration/store.mjs')) await runIntegration();
