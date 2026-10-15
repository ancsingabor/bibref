import { ApiError } from './store.js';
import { PythonStore } from './python-store.js';
import { pythonOperation } from './python-operations.js';

export function installPythonApi(app, { store, manifest, owner, ipHash, ensureId, runner, bin, cwd, pollMs, disconnectMs, log }) {
  const runs = new PythonStore(store);
  const root = '/api/sessions/:id/python-runs';
  const identify = req => { for (const key of ['id', 'runId', 'requestId']) if (req.params[key] !== undefined) ensureId(req.params[key]); };
  const modules = (manifest.modules || []).map(m => typeof m === 'string' ? m : m.name || m.id);
  app.post(root, async (req, res) => {
    identify(req);
    const who = owner(req, res), { revision } = req.body;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new ApiError('stale_revision', 409);
    await store.rate(ipHash(req), 'pythonStarts');
    const run = await runs.createRun(req.params.id, who, revision, manifest.engineVersion);
    res.status(201).json({ ...run, sequence: 0 });
  });
  app.post(`${root}/:runId/end`, async (req, res) => {
    identify(req);
    await runs.endRun(req.params.runId, req.params.id, owner(req, res));
    res.json({ ok: true });
  });
  app.get(`${root}/:runId/operations/:requestId`, async (req, res) => {
    identify(req);
    const { session, active } = await runs.getRun(req.params.runId, req.params.id, owner(req, res));
    const record = session.history.find(h => h.requestId === req.params.requestId);
    if (record) return res.json({ status: record.status, record });
    if (active?.requestId === req.params.requestId) return res.json({ status: 'running' });
    throw new ApiError('not_found', 404);
  });
  app.post(`${root}/:runId/operations`, async (req, res) => {
    identify(req);
    const who = owner(req, res), { requestId, sequence, operation, args } = req.body;
    ensureId(requestId);
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new ApiError('invalid_operation');
    const spec = pythonOperation(operation, args, modules);
    await store.rate(ipHash(req), 'pythonOperations');
    const current = await runs.getRun(req.params.runId, req.params.id, who);
    const signature = JSON.stringify({ operation, args });
    const claim = await runs.claim(req.params.runId, who, sequence, requestId, signature,
      manifest.engineVersion, current.session.python.deadline);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = event => { if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };
    if (claim.status === 'recorded') { send({ type: 'recorded', record: claim.record }); return res.end(); }
    if (claim.status === 'running') { send({ type: 'running' }); return res.end(); }
    const { session, job } = claim, controller = new AbortController();
    send({ type: 'accepted', requestId });
    let finished = false, polling = false, disconnectTimer, text = '', used = 0;
    const remaining = 2097152 - session.python.bytes;
    const abort = code => controller.abort(new ApiError(code, 422));
    const timer = setTimeout(() => abort('timeout'), Math.max(1, job.deadline - Date.now()));
    const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 10000);
    const poll = setInterval(async () => {
      if (polling || finished) return;
      polling = true;
      try { if ((await runs.poll(req.params.runId, job)).cancel) abort('cancelled'); }
      catch { abort('storage_unavailable'); }
      finally { polling = false; }
    }, pollMs);
    res.on('close', () => { if (!finished) disconnectTimer = setTimeout(() => abort('cancelled'), disconnectMs); });
    let result, value, failure;
    try {
      result = await runner({ command: spec.command, state: session.state }, {
        bin, cwd, deadline: job.deadline, outputBytes: remaining, signal: controller.signal,
        onEvent: event => {
          used += Buffer.byteLength(JSON.stringify(event));
          if (used > remaining) { abort('output_limit'); return; }
          if (event.kind !== 'text' || typeof event.text !== 'string') { abort('engine_protocol'); return; }
          text += event.text;
        } });
      if (controller.signal.aborted) throw controller.signal.reason;
      if (!result.ok || result.closed) throw new ApiError('command_error', 422);
      value = spec.parse(text);
      used += Buffer.byteLength(JSON.stringify(value));
      if (used > remaining) throw new ApiError('output_limit', 422);
    } catch (error) { failure = error instanceof ApiError ? error : new ApiError('engine_error', 422); }
    clearTimeout(timer); clearInterval(heartbeat); clearInterval(poll); clearTimeout(disconnectTimer);
    session.python.bytes += Math.min(remaining, used);
    const record = { requestId, command: signature, sequence, status: failure ? 'failed' : 'completed',
      startedAt: job.startedAt, finishedAt: Date.now(), durationMs: Date.now() - job.startedAt, events: [],
      ...(failure ? { code: failure.code, message: `bibref operation failed (${failure.code}). Run stopped.` } : { value }) };
    try {
      try { await runs.finish(req.params.runId, session, job, record, failure ? null : result.state); }
      catch (error) {
        if (error.code !== 'cancelled') throw error;
        failure = new ApiError('cancelled', 422);
        Object.assign(record, { status: 'failed', code: 'cancelled', message: 'Run stopped.' }); delete record.value;
        await runs.finish(req.params.runId, session, job, record, null);
      }
      finished = true;
      send({ type: record.status, record });
      if (failure) await runs.sealRun(req.params.runId, req.params.id, who);
      log(JSON.stringify({ event: 'python_operation', status: record.status, code: failure?.code, durationMs: record.durationMs }));
    } catch {
      finished = true;
      send({ type: 'failed', record: { status: 'failed', code: 'storage_unavailable', message: 'Run stopped because storage is unavailable.' } });
    }
    res.end();
  });
}
