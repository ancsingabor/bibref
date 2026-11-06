import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const denied = code => ({ code });
const DAY = 86_400_000;
const receiptAad = row => Buffer.from(JSON.stringify([row.id, row.browser, row.corpus_version]));

function encrypt(payload, row, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(receiptAad(row));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(data, row, key) {
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAAD(receiptAad(row));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]));
}


export function createLedger(pool, config) {
  const { epoch, corpusVersion, origin, price, keys } = config;
  const context = {
    epoch, origin, corpus: corpusVersion, price: price.version, model: price.model,
    expires: new Date(price.expires).toISOString(),
  };

  async function call(sql, args) {
    try {
      const { rows: [row] } = await pool.query(sql, args);
      return row?.result;
    } catch {
      // A lost commit acknowledgement must never authorize a provider send.
      throw new Error('accounting_unavailable');
    }
  }

  function unpack(result, request) {
    if (!result?.ciphertext) return result;
    if (result.keyVersion !== keys.receipt.version) return denied('not_found');
    const owner = { id: request.id, browser: request.browser, corpus_version: corpusVersion };
    const payload = decrypt(Buffer.from(result.ciphertext, 'hex'), owner, keys.receipt.bytes);
    return { ...payload, allowance: result.allowance };
  }

  return {
    async receipt({ id, browser, binding }) {
      const request = { id, browser, binding };
      return unpack(await call('SELECT qa.runtime_receipt($1,$2) result', [request, corpusVersion]), request);
    },
    async admit({ id, browser, binding, language, expires }, stages) {
      const request = { id, browser, binding, language, expires: new Date(expires).toISOString() };
      const bounds = {};
      let maximum = 0n;
      for (const [stage, value] of Object.entries(stages)) {
        if (!['generation', 'verification'].includes(stage) ||
            typeof value.maximumCost !== 'bigint' || value.maximumCost < 0n) return denied('unavailable');
        maximum += value.maximumCost;
        bounds[stage] = { input: value.input, output: value.output, maximumCost: String(value.maximumCost) };
      }
      if (maximum > price.maximumCost) return denied('unavailable');
      const result = unpack(await call('SELECT qa.runtime_admit($1,$2,$3) result', [request, context, bounds]), request);
      return result?.fence ? { ...result, browser, deadline: Date.parse(result.deadline) } : result;
    },
    dispatch: (operation, stage) =>
      call('SELECT qa.runtime_dispatch($1,$2,$3,$4) result', [operation.id, operation.fence, stage, context]),
    confirm: (operation, stage, token, cost) =>
      call('SELECT qa.runtime_observe($1,$2,$3,$4,$5,$6) result',
        [operation.id, operation.fence, stage, token, typeof cost === 'bigint' ? cost : -1n, epoch]),
    uncertain: (operation, stage, token) =>
      call('SELECT qa.runtime_observe($1,$2,$3,$4,NULL,$5) result', [operation.id, operation.fence, stage, token, epoch]),
    async finish(operation, payload) {
      const owner = { id: operation.id, browser: operation.browser, corpus_version: corpusVersion };
      const ciphertext = encrypt(payload, owner, keys.receipt.bytes);
      const allowance = ciphertext.length <= 65536 && await call(
        'SELECT qa.runtime_finish($1,$2,$3,$4,$5,$6) result',
        [operation.id, operation.fence, epoch, payload.status, ciphertext, keys.receipt.version]);
      return allowance ? { ...payload, allowance } : { requestId: operation.id, status: 'uncertain', retryAfter: 2 };
    },
    async network(key, ip, bucket = 'submit') {
      // PostgreSQL samples UTC under its lock. Retry only a day mismatch,
      // which records no submission.
      for (let attempt = 0; attempt < 2; attempt++) {
        const day = Number(await call('SELECT floor(extract(epoch FROM clock_timestamp())/86400)::bigint result'));
        const digests = [day, day - 1].map(value =>
          createHmac('sha256', key).update(`network\0${bucket}\0${value}\0${ip}`).digest('base64url'));
        const allowed = await call('SELECT qa.runtime_network($1,$2,$3,$4) result', [...digests, day, bucket === 'general']);
        if (allowed !== null) return allowed;
      }
      return false;
    },
    cleanup: () => call('SELECT qa.runtime_cleanup() result'),
  };
}
