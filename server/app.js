import express from 'express';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import path from 'node:path';
import { ApiError, initialState } from './store.js';
import { executeNative } from './engine.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages = {
  rate_limit: 'Too many requests. Please wait before trying again.',
  capacity: 'Both command slots are occupied. Please try again shortly.',
  daily_budget: 'Today’s execution allowance has been used. Commands resume at midnight UTC.',
  stale_revision: 'This session changed in another request. Refresh before continuing.',
  incompatible_version: 'This session uses a different engine version. Its history is available; start a new session to run commands.',
  busy: 'A command is already running in this session.',
  closed: 'This session is closed. Start a new session.',
  not_found: 'Session or command is unavailable or has expired.',
  cancelled: 'Command cancelled. Previous clipboards and settings were retained.',
  timeout: 'Command exceeded its time limit. Previous state was retained.',
  output_limit: 'Command exceeded the output limit. Previous state was retained.',
  storage_unavailable: 'Session storage is unavailable. Please try again later.',
  storage_full: 'Session storage is at capacity. Please try again later.',
};
const publicSession = (s, version) => ({ id: s.id, revision: s.revision, state: s.state, history: s.history,
  createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, closed: s.closed, compatible: s.version === version });
const publicJob = (j) => j ? ({ requestId: j.requestId, command: j.command, startedAt: j.startedAt, deadline: j.deadline }) : null;

export function createApp({ store, manifest, secret, bin, cwd, runner = executeNative, publicDir = path.join(import.meta.dirname, 'public'), log = console.log, disconnectMs = 10000, pollMs = 2000, pythonEnabled = false }) {
  if (!secret || secret.length < 32) throw new Error('A strong BIBREF_COOKIE_SECRET is required');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const sign = (v) => createHmac('sha256', secret).update(v).digest('base64url');
  function owner(req, res, create = false) {
    const token = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('bibref_owner='))?.slice(13);
    if (token) {
      const [id, expiry, signature] = token.split('.');
      const expected = sign(`${id}.${expiry}`);
      if (uuid.test(id || '') && Number(expiry) > Date.now() && signature?.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        issueCookie(req, res, id); return id;
      }
    }
    if (!create) throw new ApiError('not_found', 404);
    const id = randomUUID(); issueCookie(req, res, id); return id;
  }
  function issueCookie(req, res, id) {
    const raw = `${id}.${Date.now() + store.config.sessionTTL * 1000}`;
    const secure = req.secure || process.env.VERCEL || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `bibref_owner=${raw}.${sign(raw)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${store.config.sessionTTL}${secure ? '; Secure' : ''}`);
  }
  const ipHash = (req) => sign(req.ip || 'unknown').slice(0, 24);
  const ensureId = (id) => { if (!uuid.test(id || '')) throw new ApiError('invalid_id'); };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (pythonEnabled) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }
    if (req.path === '/python/worker.js') {
      const origin = `${req.protocol}://${req.get('host')}`;
      res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'wasm-unsafe-eval' ${origin}/vendor/pyodide/ ${origin}/python/worker.js; connect-src ${origin}/vendor/pyodide/ ${origin}/python/tools.py; worker-src 'none'; object-src 'none'`);
    }
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Trust only the deployment's own origin; protect anonymous owner cookies against CSRF.
      const origin = req.headers.origin;
      if (!origin || origin !== `${req.protocol}://${req.get('host')}`) return next(new ApiError('invalid_origin', 403));
      if (!req.is('application/json')) return next(new ApiError('invalid_content_type', 415));
    }
    next();
  });
  app.use('/api', async (req, res, next) => {
    try { await store.rate(ipHash(req), 'requests'); next(); }
    catch (e) { next(e); }
  });
  app.use(express.json({ limit: '80kb', strict: true }));
  app.get('/api/meta', (req, res) => res.json({ ...manifest, features: { python: pythonEnabled }, limits: {
    commandBytes: store.config.commandBytes, outputBytes: store.config.outputBytes,
    commandSeconds: store.config.commandMs / 1000, sessionDays: store.config.sessionTTL / 86400 } }));
  app.get('/api/health', (req, res) => res.json({ ok: true, engineVersion: manifest.engineVersion }));
  app.post('/api/sessions', async (req, res) => {
    await store.rate(ipHash(req), 'sessions');
    const s = await store.create(owner(req, res, true), manifest.engineVersion);
    res.status(201).json(publicSession(s, manifest.engineVersion));
  });
  app.get('/api/sessions/:id', async (req, res) => {
    ensureId(req.params.id);
    const { session, active } = await store.get(req.params.id, owner(req, res));
    res.json({ ...publicSession(session, manifest.engineVersion), active: publicJob(active) });
  });
  app.delete('/api/sessions/:id', async (req, res) => {
    ensureId(req.params.id); await store.remove(req.params.id, owner(req, res)); res.json({ ok: true });
  });
  app.get('/api/sessions/:id/commands/:requestId', async (req, res) => {
    ensureId(req.params.id); ensureId(req.params.requestId);
    const { session, active } = await store.get(req.params.id, owner(req, res));
    const record = session.history.find(h => h.requestId === req.params.requestId);
    if (record) return res.json({ status: record.status, record, revision: session.revision });
    if (active?.requestId === req.params.requestId) return res.json({ status: 'running', active: publicJob(active) });
    throw new ApiError('not_found', 404);
  });
  app.post('/api/sessions/:id/commands/:requestId/cancel', async (req, res) => {
    ensureId(req.params.id); ensureId(req.params.requestId);
    await store.cancel(req.params.id, owner(req, res), req.params.requestId); res.json({ ok: true });
  });
  app.post('/api/sessions/:id/commands', async (req, res) => {
    const id = req.params.id, { requestId, revision, command } = req.body;
    ensureId(id); ensureId(requestId);
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof command !== 'string' || command.includes('\0') || Buffer.byteLength(command) > store.config.commandBytes) throw new ApiError('invalid_command');
    await store.rate(ipHash(req), 'commands');
    const claim = await store.claim(id, owner(req, res), revision, requestId, command, manifest.engineVersion);
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (event) => { if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };
    if (claim.status === 'recorded') { send({ type: 'recorded', record: claim.record, revision: claim.revision }); return res.end(); }
    if (claim.status === 'running') { send({ type: 'running', active: publicJob(claim.active) }); return res.end(); }
    const { session, job } = claim;
    send({ type: 'accepted', ...publicJob(job) });
    const controller = new AbortController();
    const events = [];
    let finished = false, disconnectTimer, polling = false;
    res.on('close', () => {
      if (!finished) disconnectTimer = setTimeout(() => controller.abort(new ApiError('cancelled')), disconnectMs);
    });
    const heartbeat = setInterval(() => send({ type: 'heartbeat', elapsedMs: Date.now() - job.startedAt }), 10000);
    const cancelPoll = setInterval(async () => {
      if (polling || finished) return; polling = true;
      try { if ((await store.poll(id, job)).cancel) controller.abort(new ApiError('cancelled')); }
      catch { controller.abort(new ApiError('storage_unavailable', 503)); }
      finally { polling = false; }
    }, pollMs);
    let result, failure;
    try {
      result = await runner({ command: command.trim(), state: session.state }, {
        bin, cwd, deadline: job.deadline, outputBytes: store.config.outputBytes,
        signal: controller.signal, onEvent: event => { events.push(event); send(event); } });
      if (!result.ok) failure = new ApiError('command_error', 422);
    } catch (e) { failure = e instanceof ApiError ? e : new ApiError('engine_error', 422); }
    clearInterval(heartbeat); clearInterval(cancelPoll); clearTimeout(disconnectTimer);
    const record = { requestId, command, status: failure ? 'failed' : 'completed',
      startedAt: job.startedAt, finishedAt: Date.now(), durationMs: Math.max(0, Date.now() - job.startedAt), events,
      ...(failure ? { code: failure.code, message: messages[failure.code] || 'Command failed. Previous state was retained.' } : {}) };
    try {
      let done;
      try { done = await store.finish(id, session, job, record, failure ? null : result.state, result?.closed); }
      catch (e) {
        if (e.code !== 'cancelled') throw e;
        failure = new ApiError('cancelled'); record.status = 'failed'; record.code = 'cancelled'; record.message = messages.cancelled;
        done = await store.finish(id, session, job, record, null);
      }
      finished = true;
      send({ type: failure ? 'failed' : 'completed', ...record, revision: done.revision, closed: !failure && result.closed });
      log(JSON.stringify({ event: 'command', status: record.status, code: failure?.code, durationMs: record.durationMs }));
    } catch {
      finished = true; send({ type: 'failed', code: 'storage_unavailable', message: messages.storage_unavailable });
      log(JSON.stringify({ event: 'command', status: 'storage_error', durationMs: record.durationMs }));
    }
    res.end();
  });
  app.use(express.static(publicDir, { dotfiles: 'deny', index: 'index.html', maxAge: '1h' }));
  app.use((req, res) => res.status(404).json({ code: 'not_found' }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return res.end();
    const status = err instanceof ApiError ? err.status : err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 503;
    const code = err instanceof ApiError ? err.code : status === 413 ? 'input_limit' : status === 400 ? 'invalid_json' : 'storage_unavailable';
    if (status === 429) res.setHeader('Retry-After', '60');
    res.status(status).json({ code, message: messages[code] || 'Request could not be processed.' });
  });
  return app;
}
