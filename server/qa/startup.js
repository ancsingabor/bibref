import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { activation } from './config.js';
import { createQaRouter } from './api.js';

const sortedJson = value => {
  if (Array.isArray(value)) return '[' + value.map(sortedJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + sortedJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
};

async function boundedJson(path, limit) {
  const file = await open(path, 'r');
  try {
    const data = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < data.length) {
      const { bytesRead } = await file.read(data, offset, data.length - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > limit) throw new Error('file_limit');
    return JSON.parse(data.subarray(0, offset).toString('utf8'));
  } finally {
    await file.close();
  }
}

export async function startupQa(env = process.env) {
  const disabled = createQaRouter({ config: activation({ env }) });
  if (env.BIBREF_QA_ENABLED !== '1') return disabled;
  let pool;
  try {
    const peers = new Set((env.BIBREF_QA_TRUSTED_PROXY_IPS ?? '').split(',').map(value => value.trim()).filter(isIP));
    if (!peers.size || env.BIBREF_QA_OPERATIONAL_APPROVAL !== '1') return disabled;
    const [{ Pool }, { createLedger }, { createProvider }, { createService }] = await Promise.all([
      import('pg'), import('./store.js'), import('./provider.js'), import('./service.js'),
    ]);
    const corpus = await boundedJson(env.BIBREF_QA_CORPUS_PATH, 8 * 1024 * 1024);
    const { version, ...manifest } = corpus.manifest;
    if (createHash('sha256').update(sortedJson({ ...corpus, manifest })).digest('hex') !== version ||
        corpus.manifest.rightsStatus !== 'approved' || !Array.isArray(corpus.articles) || !corpus.articles.length) return disabled;
    const prices = await boundedJson(env.BIBREF_QA_PRICE_PATH, 64 * 1024);
    const database = new URL(env.BIBREF_QA_DATABASE_URL);
    if (!['postgresql:', 'postgres:'].includes(database.protocol) ||
        ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl'].some(key => database.searchParams.has(key))) return disabled;
    pool = new Pool({ connectionString: database.href, ssl: { rejectUnauthorized: true },
      max: 4, connectionTimeoutMillis: 1500, query_timeout: 2500, statement_timeout: 1800, lock_timeout: 1500 });
    pool.on('error', () => {});
    const { rows: [row] } = await pool.query(`SELECT enabled,epoch,schema_version AS "schemaVersion",
      canonical_origin AS "canonicalOrigin",corpus_version AS "corpusVersion",
      price_version AS "priceVersion",halt_reason AS "haltReason" FROM qa.runtime_control()`);
    const config = activation({ env, corpus: corpus.manifest, prices, control: row });
    if (!config.enabled) {
      await pool.end();
      return disabled;
    }
    const ledger = createLedger(pool, config);
    await ledger.cleanup();
    const cleanup = setInterval(() => ledger.cleanup().catch(() => {}), 15_000);
    cleanup.unref();
    const provider = createProvider({ price: config.price, key: env.BIBREF_QA_PROVIDER_KEY });
    const answer = createService({ corpus, admission: ledger, provider });
    const trusted = req => peers.has(req.socket.remoteAddress);
    const address = req => trusted(req) ? req.get('x-forwarded-for') : null;
    const requestOrigin = req => trusted(req) && req.get('x-forwarded-proto') === 'https'
      ? 'https://' + req.get('host') : null;
    return createQaRouter({ config, corpus, ledger, answer, address, requestOrigin });
  } catch {
    await pool?.end().catch(() => {});
    return disabled;
  }
}
