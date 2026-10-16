import { randomUUID } from 'node:crypto';
import { ApiError } from './store.js';

// Context jobs use the existing shared quotas, but never commit to the reader's session.
export function installContextApi(app, { store, manifest, owner, ipHash, ensureId, runner, bin, cwd }) {
  app.post('/api/sessions/:id/context', async (req, res) => {
    ensureId(req.params.id);
    const who = owner(req, res);
    await store.get(req.params.id, who);
    const { book, verse } = req.body;
    if (typeof book !== 'string' || !/^[A-Za-z_]{1,40}$/.test(book) || typeof verse !== 'string' || !/^\d{1,3}:\d{1,3}$/.test(verse)) throw new ApiError('invalid_reference');
    if (!(manifest.modules || []).some(m => (typeof m === 'string' ? m : m.name || m.id) === 'HunRUF')) {
      return res.status(422).json({ code: 'module_unavailable', message: 'HunRUF is unavailable. Exact Greek text remains available.' });
    }
    await store.rate(ipHash(req), 'commands');
    const temporary = await store.create(who, manifest.engineVersion);
    const command = `lookup HunRUF ${book} ${verse}`, requestId = randomUUID();
    let claim;
    try {
      claim = await store.claim(temporary.id, who, 0, requestId, command, manifest.engineVersion);
      const { job, session } = claim, controller = new AbortController();
      let text = '', failure, result;
      const abort = () => controller.abort(new ApiError('cancelled', 422));
      res.on('close', abort);
      try {
        result = await runner({ command, state: session.state }, { bin, cwd, deadline: job.deadline,
          outputBytes: store.config.outputBytes, signal: controller.signal, onEvent: event => {
            if (event.kind === 'text') text += event.text;
          } });
        if (!result.ok) failure = new ApiError('context_unavailable', 422);
      } catch (error) { failure = error; }
      finally { res.off('close', abort); }
      const record = { requestId, command, status: failure ? 'failed' : 'completed', startedAt: job.startedAt,
        finishedAt: Date.now(), durationMs: Date.now() - job.startedAt, events: [] };
      await store.finish(temporary.id, session, job, record, null);
      if (failure) throw failure;
      res.json({ module: 'HunRUF', book, verse, text });
    } finally {
      await store.remove(temporary.id, who);
    }
  });
}
