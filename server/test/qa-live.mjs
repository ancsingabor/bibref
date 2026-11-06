import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProvider } from '../qa/provider.js';
import { retrieve } from '../qa/retrieval.js';
import { createService } from '../qa/service.js';
import { normalizeQuestion } from '../qa/api.js';
import { randomUUID, createHmac } from 'node:crypto';

const limit = 700_000_000n;
const ceiling = Object.freeze({ generation: { input: 7000, output: 1200 }, verification: { input: 5000, output: 300 } });

export function preflight(cases, price, corpus) {
  if (!Array.isArray(cases) || cases.length < 60 || cases.length > 70) throw new Error('evaluation_case_count');
  const ids = new Set();
  const counts = { supported: 0, objection: 0, unsupported: 0 };
  const pairs = new Map();
  let reserved = 0n;
  let paid = 0;
  const full = createProvider({ price });
  for (const item of cases) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        !['hu', 'en'].includes(item.language) || !normalizeQuestion(item.question) ||
        !Object.hasOwn(counts, item.category)) throw new Error('evaluation_case_shape');
    ids.add(item.id);
    counts[item.category]++;
    if (item.category === 'supported') {
      if (typeof item.pair !== 'string' || !item.pair) throw new Error('evaluation_pair_shape');
      const languages = pairs.get(item.pair) ?? new Set();
      if (languages.has(item.language)) throw new Error('evaluation_pair_shape');
      languages.add(item.language);
      pairs.set(item.pair, languages);
    }
    const data = { question: normalizeQuestion(item.question), language: item.language };
    if (item.zeroCost === true) {
      if (item.category !== 'unsupported' || item.bounds ||
          retrieve(data.question, data.language, corpus, articles =>
            full.fits('generation', { ...data, articles })).length) throw new Error('evaluation_zero_cost');
      continue;
    }
    paid++;
    for (const [stage, max] of Object.entries(ceiling)) {
      const bounds = item.bounds?.[stage];
      if (!Number.isInteger(bounds?.input) || bounds.input <= price.stages[stage].wrapper || bounds.input > max.input ||
          !Number.isInteger(bounds.output) || bounds.output <= 0 || bounds.output > max.output) throw new Error('evaluation_token_bounds');
      reserved += BigInt(bounds.input) * price.inputNanoUsdPerToken + BigInt(bounds.output) * price.outputNanoUsdPerToken;
    }
  }
  if (counts.supported < 40 || counts.objection < 10 || counts.unsupported < 10 ||
      [...pairs.values()].filter(languages => languages.size === 2).length < 20) throw new Error('evaluation_coverage');
  if (reserved > limit) throw new Error('evaluation_budget');
  return { operations: cases.length, calls: paid * 2, reservedNanoUsd: String(reserved) };
}

export async function runEvaluation({ cases, evidence, adapter }) {
  const root = resolve(import.meta.dirname, '../..');
  for (const path of [cases, evidence, adapter]) {
    if (!isAbsolute(path) || !relative(root, path).startsWith('../')) throw new Error('evaluation_private_paths');
  }
  const frozen = JSON.parse(await readFile(cases, 'utf8'));
  // The reviewed adapter supplies the shared ledger and controlled browser identities.
  // The runner owns provider construction and applies the preflighted limits directly.
  const { price, createEvaluation } = await import(pathToFileURL(adapter));
  await mkdir(evidence, { mode: 0o700 });
  const evaluation = await createEvaluation();
  const results = [];
  const stop = Date.now() + 1_190_000;
  let bounds;
  try {
    bounds = preflight(frozen, price, evaluation.corpus);
    for (const item of frozen) {
      if (Date.now() >= stop || Date.now() >= price.expires) throw new Error('evaluation_deadline');
      const provider = createProvider({ price, key: evaluation.providerKey, bounds: item.bounds,
        ...(item.zeroCost && { transport: () => { throw new Error('evaluation_zero_cost_dispatch'); } }) });
      const question = normalizeQuestion(item.question);
      const browser = await evaluation.browserDigest(item);
      const binding = createHmac('sha256', evaluation.bindingKey)
        .update(JSON.stringify([item.language, evaluation.corpus.manifest.version, question])).digest('base64url');
      const answer = createService({ corpus: evaluation.corpus, admission: evaluation.ledger, provider });
      const result = await answer({ id: randomUUID(), browser, binding, language: item.language,
        question, expires: Math.min(stop, Date.now() + 900000) });
      results.push({ id: item.id, result });
      if (result.status === 'uncertain' || result.status === 'failed' || result.code) throw new Error('evaluation_stopped');
    }
  } finally {
    try {
      await writeFile(resolve(evidence, 'results.json'), JSON.stringify({ bounds, results }, null, 2), { flag: 'wx', mode: 0o600 });
    } finally {
      await evaluation.close();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { cases: { type: 'string' }, evidence: { type: 'string' }, adapter: { type: 'string' } } });
  try {
    await runEvaluation(values);
  } catch {
    process.stderr.write('Q&A evaluation stopped. Inspect private evidence.\n');
    process.exitCode = 1;
  }
}
