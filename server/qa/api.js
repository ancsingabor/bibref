import express from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { localizedError, validLanguage } from './i18n.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const dayMs = 86_400_000;
const ticketMs = 900_000;
const statuses = { not_found: 404, request_conflict: 409, request_expired: 410,
  daily_limit: 429, network_limit: 429, capacity: 429, budget: 429 };

export function normalizeQuestion(input) {
  if (typeof input !== 'string' || !input.isWellFormed() || input.includes('\0')) return null;
  const value = input.normalize('NFC').trim();
  return value && Buffer.byteLength(value) <= 16000 && [...value].length <= 4000 ? value : null;
}

const mac = (key, scope, value) => createHmac('sha256', key).update(scope + '\0' + value).digest('base64url');
const seal = (key, scope, value) => {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url');
  return encoded + '.' + mac(key, scope, encoded);
};
const open = (key, scope, token) => {
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [encoded, signature] = token.split('.');
  const actual = Buffer.from(signature);
  const expected = Buffer.from(mac(key, scope, encoded));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { return JSON.parse(Buffer.from(encoded, 'base64url').toString()); } catch { return null; }
};
const shape = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) &&
  Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key));

export function createQaRouter({ config, corpus, ledger, answer, fixture = false, now = Date.now,
  requestOrigin = req => req.protocol + '://' + req.get('host'), address = req => req.socket.remoteAddress } = {}) {
  const router = express.Router();
  const origin = config?.origin;
  const canonicalUrl = origin ? origin + '/qa.html' : null;
  const allowedCorpus = () => fixture ? corpus?.manifest.rightsStatus === 'fixture' : corpus?.manifest.rightsStatus === 'approved';
  const enabled = req => Boolean(config?.enabled && allowedCorpus() && requestOrigin(req) === origin &&
    (fixture || now() < config.price.expires));
  const error = (res, code, language, status = statuses[code] ?? 503, retryAt) =>
    res.status(status).json({ ...localizedError(code, language), ...(retryAt && { retryAt }) });

  const readIdentity = req => {
    const cookies = (req.headers.cookie ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith('bibref_qa='));
    const identity = cookies.length === 1 ? open(config.keys.cookie.bytes, 'cookie', cookies[0].slice(10)) : null;
    return identity && uuid.test(identity.id) && identity.version === config.keys.cookie.version && identity.expires > now() ? identity : null;
  };
  const browser = id => mac(config.keys.binding.bytes, 'browser', id);
  const limited = async (req, bucket = 'submit') => {
    const ip = address(req);
    if (!isIP(ip)) return false;
    return ledger.network(config.keys.binding.bytes, ip, bucket);
  };
  const result = (res, value, language) => {
    if (!value) return error(res, 'not_found', language);
    if (value.status === 'running' || value.status === 'uncertain') return res.status(202).json(value);
    if (value.status === 'failed') return res.status(503).json(value);
    if (value.code) return error(res, value.code, language, statuses[value.code], value.retryAt);
    return res.json(value);
  };

  router.use(['/api/qa', '/qa/source', '/qa.html'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/api/qa/meta', (req, res) => {
    const available = enabled(req);
    res.json({ enabled: available, canonicalUrl, languages: ['hu', 'en'], serverTime: new Date(now()).toISOString(),
      limits: { perBrowserUtcDay: 3, monthlyUsd: 10 }, disclosureVersion: 1,
      ...(available && { corpusVersion: corpus.manifest.version, sourceLanguages: [corpus.manifest.sourceLanguage] }) });
  });
  router.use('/api/qa', (req, res, next) => {
    if (req.method === 'POST' && origin && req.get('origin') !== origin) return error(res, 'invalid_origin', null, 403);
    if (!enabled(req)) return error(res, 'unavailable', req.query.language);
    if (req.method !== 'POST') return next();
    if (!req.is('application/json')) return error(res, 'invalid_input', null, 415);
    return next();
  });
  router.use('/api/qa', async (req, res, next) => {
    if (!await limited(req, 'general')) return error(res, 'network_limit', req.query.language);
    next();
  });
  router.use('/api/qa', express.json({ limit: 20 * 1024, strict: true, inflate: false }));
  router.post('/api/qa/requests', async (req, res) => {
    const { language } = req.body ?? {};
    if (!await limited(req)) return error(res, 'network_limit', language);
    if (!shape(req.body, ['language']) || !validLanguage(language)) return error(res, 'invalid_input', language, 400);
    const id = readIdentity(req)?.id ?? randomUUID();
    const identity = seal(config.keys.cookie.bytes, 'cookie', { id, version: config.keys.cookie.version, expires: now() + 7 * dayMs });
    res.set('Set-Cookie', 'bibref_qa=' + identity + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800' + (fixture ? '' : '; Secure'));
    const requestId = randomUUID();
    const corpusVersion = corpus.manifest.version;
    const expires = now() + ticketMs;
    const ticket = seal(config.keys.cookie.bytes, 'ticket', { requestId, browser: browser(id), language, corpusVersion, expires });
    return res.status(201).json({ requestId, ticket, language, corpusVersion, expiresAt: new Date(expires).toISOString() });
  });
  router.post('/api/qa/questions', async (req, res) => {
    const { requestId, ticket, language, question } = req.body ?? {};
    if (!await limited(req)) return error(res, 'network_limit', language);
    const text = normalizeQuestion(question);
    if (!shape(req.body, ['requestId', 'ticket', 'language', 'question']) || !validLanguage(language) ||
        typeof requestId !== 'string' || !uuid.test(requestId) || !text) return error(res, 'invalid_input', language, 400);
    const identity = readIdentity(req);
    const signed = open(config.keys.cookie.bytes, 'ticket', ticket);
    const owner = identity && browser(identity.id);
    if (!owner || !signed || signed.requestId !== requestId || signed.browser !== owner) return error(res, 'not_found', language);
    if (signed.language !== language) return error(res, 'request_conflict', language);
    if (signed.corpusVersion !== corpus.manifest.version) return error(res, 'unavailable', language);
    const binding = mac(config.keys.binding.bytes, 'question', JSON.stringify([language, signed.corpusVersion, text]));
    const request = { id: requestId, browser: owner, binding, language, expires: signed.expires };
    const recovered = await ledger.receipt(request);
    if (recovered) return result(res, recovered, language);
    if (signed.expires <= now()) return error(res, 'request_expired', language);
    const deadline = AbortSignal.timeout(64_000);
    let abort;
    const timeout = new Promise(resolve => {
      abort = () => resolve({ requestId, status: 'uncertain', retryAfter: 2 });
      deadline.addEventListener('abort', abort, { once: true });
    });
    try {
      return result(res, await Promise.race([answer({ ...request, question: text }), timeout]), language);
    } finally {
      deadline.removeEventListener('abort', abort);
    }
  });
  router.get('/api/qa/requests/:id', async (req, res) => {
    const language = req.query.language;
    if (!validLanguage(language)) return error(res, 'invalid_input', language, 400);
    const identity = readIdentity(req);
    if (!identity || !uuid.test(req.params.id)) return error(res, 'not_found', language);
    return result(res, await ledger.receipt({ id: req.params.id, browser: browser(identity.id) }), language);
  });
  router.get('/qa/source/:version/:article', async (req, res) => {
    const article = allowedCorpus() && req.params.version === corpus.manifest.version &&
      corpus.articles.find(item => item.id === req.params.article);
    if (!article || requestOrigin(req) !== origin) return res.sendStatus(404);
    if (!await limited(req, 'general').catch(() => false)) return res.sendStatus(429);
    const sections = article.sections.map(section => ({
      id: section.id, role: section.role, text: section.text, number: section.number,
      respondsTo: section.respondsTo, collectiveReply: section.collectiveReply,
    }));
    const text = [
      article.id + ' · ' + article.editionId, article.questionTitle, article.title,
      ...sections.map(section => section.role + (section.number ? ' ' + section.number : '') +
        (section.respondsTo?.length ? ' (' + section.respondsTo.join(', ') + ')' : '') + '\n' + section.text),
      ...(corpus.manifest.notices ?? []), corpus.manifest.sourceUrl,
    ].filter(Boolean).join('\n\n');
    if (Buffer.byteLength(text) > 256 * 1024) return res.sendStatus(404);
    return res.type('text/plain').send(text);
  });
  router.use('/api/qa', (req, res) => error(res, 'not_found', req.query.language));
  router.use((err, req, res, next) => {
    if (res.headersSent || !req.path.startsWith('/api/qa')) return next(err);
    const language = req.body?.language ?? req.query.language;
    if (err.type === 'entity.too.large') return error(res, 'invalid_input', language, 413);
    if (err.type === 'entity.parse.failed') return error(res, 'invalid_input', language, 400);
    if (err.type === 'encoding.unsupported') return error(res, 'invalid_input', language, 415);
    return error(res, 'unavailable', language);
  });
  return router;
}
