export const MODEL = 'gpt-5.4-mini-2026-03-17';
export const ENCODING = 'o200k_base';
export const SCHEMA_VERSION = 1;
export const MONTHLY_CAP = 10_000_000_000n;
export const STAGES = Object.freeze({
  generation: Object.freeze({ input: 7000, output: 1200 }),
  verification: Object.freeze({ input: 5000, output: 300 }),
});

function canonicalOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value ? value : null;
  } catch {
    return null;
  }
}

function date(value) {
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

function versionedKey(value) {
  if (typeof value !== 'string') return null;
  const match = /^([1-9][0-9]{0,8}):([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== match[2]) return null;
  return { version: Number(match[1]), bytes };
}

export function reviewedPrices(prices, now = Date.now()) {
  const reviewed = date(prices?.reviewedAt);
  const expires = date(prices?.expiresAt);
  if (!(reviewed <= now && now < expires && expires - reviewed <= 86_400_000)) return null;
  if (prices.formatVersion !== 1 || prices.model !== MODEL || prices.encoding !== ENCODING ||
      typeof prices.version !== 'string' || !prices.version.trim()) return null;

  const { inputNanoUsdPerToken: input, outputNanoUsdPerToken: output } = prices;
  if (!Number.isSafeInteger(input) || input < 750 || !Number.isSafeInteger(output) || output < 4500) return null;
  const stages = {};
  let maximumCost = 0n;
  for (const [name, limit] of Object.entries(STAGES)) {
    const wrapper = prices.wrapperTokens?.[name];
    if (!Number.isSafeInteger(wrapper) || wrapper <= 0 || wrapper >= limit.input) return null;
    const cost = BigInt(limit.input) * BigInt(input) + BigInt(limit.output) * BigInt(output);
    stages[name] = Object.freeze({ ...limit, wrapper, maximumCost: cost });
    maximumCost += cost;
  }
  if (maximumCost > MONTHLY_CAP) return null;
  return Object.freeze({
    version: prices.version, model: MODEL, encoding: ENCODING, expires,
    inputNanoUsdPerToken: BigInt(input), outputNanoUsdPerToken: BigInt(output),
    stages: Object.freeze(stages), maximumCost,
  });
}

// Callers supply a validated immutable bundle and a fresh primary-ledger Control row.
export function activation({ env = process.env, corpus, prices, control, now = Date.now() } = {}) {
  const origin = canonicalOrigin(env.BIBREF_QA_ORIGIN);
  const disabled = { enabled: false, origin };
  if (env.BIBREF_QA_ENABLED !== '1' || !origin) return disabled;
  if (corpus?.rightsStatus !== 'approved' || !/^[a-f0-9]{64}$/.test(corpus.version ?? '') ||
      !corpus.rightsEvidenceRef || !(date(corpus.approvedAt) <= now)) return disabled;

  const price = reviewedPrices(prices, now);
  const epoch = env.BIBREF_QA_EPOCH;
  if (!price || !epoch || control?.enabled !== true || control.haltReason ||
      control.epoch !== epoch || control.schemaVersion !== SCHEMA_VERSION ||
      control.canonicalOrigin !== origin || control.corpusVersion !== corpus.version ||
      control.priceVersion !== price.version) return disabled;

  const cookie = versionedKey(env.BIBREF_QA_COOKIE_SECRET);
  const binding = versionedKey(env.BIBREF_QA_BINDING_SECRET);
  const receipt = versionedKey(env.BIBREF_QA_RECEIPT_KEY);
  const keys = [cookie, binding, receipt];
  if (keys.some(key => !key) || new Set(keys.map(key => key.bytes.toString('hex'))).size !== keys.length ||
      !env.BIBREF_QA_DATABASE_URL?.trim() || !env.BIBREF_QA_PROVIDER_KEY?.trim()) return disabled;

  return { enabled: true, origin, epoch, corpusVersion: corpus.version, price, keys: { cookie, binding, receipt } };
}
