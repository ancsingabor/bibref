import { createEditor } from '/vendor/editor.js';
import { startPython, supported } from './runtime.js';
import { examples } from './examples.js';

export function initPython({ api, getSession, setBusy }) {
  const $ = selector => document.querySelector(selector);
  const runButton = $('#python-run'), stopButton = $('#python-stop'), status = $('#python-status');
  const output = $('#python-output'), traceback = $('#python-traceback');
  let active, editor, draft, outputBytes = 0;
  try { draft = localStorage.getItem('bibref-python-draft'); } catch {}
  const state = value => { status.textContent = value; };
  const append = text => {
    const bytes = new TextEncoder().encode(text), remaining = 2097152 - outputBytes;
    if (remaining <= 0) return;
    const displayed = bytes.length <= remaining ? text : new TextDecoder().decode(bytes.subarray(0, remaining));
    outputBytes += Math.min(bytes.length, remaining);
    output.append(document.createTextNode(displayed)); output.scrollTop = output.scrollHeight;
  };
  const controls = () => { runButton.disabled = !!active || !supported(); stopButton.disabled = !active;
    $('#python-examples').disabled = !!active; setBusy(!!active); };
  async function end(task) {
    if (task.runId) {
      try { await api(`${task.root}/${task.runId}/end`, 'POST', {}); }
      catch (error) { if (error.code !== 'not_found') append('\nCleanup could not be confirmed; server limits will expire the run.\n'); }
    }
  }
  async function finish(task, message, error) {
    if (active !== task || task.finished) return;
    task.finished = true; task.stopped = true; task.runtime?.stop(); task.abort.abort();
    clearInterval(task.clock);
    await end(task);
    if (error) {
      append(`\n${error.message}\n`);
      const lines = [...new Set([...error.message.matchAll(/File "<script>", line (\d+)/g)].map(m => Number(m[1])))];
      for (const line of lines) {
        const button = document.createElement('button'); button.textContent = `Go to line ${line}`;
        button.addEventListener('click', () => editor.line(line)); traceback.append(button);
      }
    }
    state(message); active = null; controls();
  }
  const wait = (task, milliseconds) => new Promise((resolve, reject) => {
    if (task.abort.signal.aborted) return reject(new Error('Run stopped'));
    const abort = () => { clearTimeout(timer); reject(new Error('Run stopped')); };
    const timer = setTimeout(() => { task.abort.signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    task.abort.signal.addEventListener('abort', abort, { once: true });
  });
  async function request(task, url, method, body) {
    const response = await fetch(url, { method, credentials: 'same-origin', signal: task.abort.signal,
      headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) {
      let problem; try { problem = await response.json(); } catch {}
      const error = new Error(problem?.message || `Request failed (${response.status})`);
      error.code = problem?.code || 'request_failed'; throw error;
    }
    return response;
  }
  const value = record => { if (record.status !== 'completed') throw Object.assign(new Error(record.message || 'bibref operation failed'), { code: record.code }); return record.value; };
  async function recover(task, url) {
    while (!task.stopped) {
      const response = await request(task, url, 'GET');
      const result = await response.json();
      if (result.status !== 'running') return value(result.record);
      state('Checking operation outcome'); await wait(task, 3000);
    }
    throw new Error('Run stopped');
  }
  async function operation(task, operation, args, sequence) {
    const requestId = crypto.randomUUID(), url = `${task.root}/${task.runId}/operations`;
    let delay = 2000;
    while (!task.stopped) {
      try {
        const response = await request(task, url, 'POST', { requestId, sequence, operation, args });
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', record;
        state('Running');
        while (true) {
          const { done, value: chunk } = await reader.read(); if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          if (buffer.length > 2097152 + 65536) throw new Error('Operation response exceeds its limit');
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!frame.startsWith('data: ')) continue;
            const event = JSON.parse(frame.slice(6));
            if (['completed', 'failed', 'recorded'].includes(event.type)) record = event.record;
          }
        }
        return record ? value(record) : await recover(task, `${url}/${requestId}`);
      } catch (error) {
        if (task.stopped) throw error;
        if (error.code === 'capacity' || error.code === 'rate_limit') {
          state(error.code === 'capacity' ? 'Waiting for capacity' : 'Waiting for request allowance');
          await wait(task, error.code === 'rate_limit' ? 60000 : delay); delay = Math.min(delay * 2, 10000); continue;
        }
        if (!error.code) return recover(task, `${url}/${requestId}`);
        throw error;
      }
    }
    throw new Error('Run stopped');
  }
  async function run() {
    if (active || !supported()) return;
    const session = getSession();
    if (!session || session.closed || session.compatible === false) { state('Start a compatible terminal session first'); return; }
    const source = editor.get();
    if (new TextEncoder().encode(source).length > 65536) { state('Script exceeds 64 KiB'); return; }
    const task = { root: `/api/sessions/${session.id}/python-runs`, abort: new AbortController(), stopped: false };
    active = task; controls(); output.replaceChildren(); outputBytes = 0; traceback.replaceChildren(); state('Starting run');
    try {
      const current = await (await api(`/api/sessions/${session.id}`)).json();
      if (task.stopped) return;
      const created = await (await api(task.root, 'POST', { revision: current.revision })).json();
      task.runId = created.id;
      if (task.stopped) { await end(task); return; }
      task.deadline = created.deadline;
      task.clock = setInterval(() => { if (Date.now() >= task.deadline) finish(task, 'Stopped', new Error('Run exceeded its 12-minute limit')); }, 500);
      task.runtime = startPython(source, { operation: (op, args, sequence) => operation(task, op, args, sequence), output: append, state,
        completed: () => { void finish(task, 'Completed'); }, failed: error => { void finish(task, 'Failed', error); } });
    } catch (error) { await finish(task, 'Failed', error); }
  }
  editor = createEditor($('#python-editor'), { value: draft ?? examples.names,
    onChange: text => { try { localStorage.setItem('bibref-python-draft', text); } catch {} }, onRun: () => { void run(); } });
  runButton.addEventListener('click', () => { void run(); });
  stopButton.addEventListener('click', () => { if (active) void finish(active, 'Stopped'); });
  $('#python-examples').addEventListener('change', event => {
    if (examples[event.target.value] !== undefined) editor.set(examples[event.target.value]);
    event.target.value = ''; editor.focus();
  });
  $('#python-download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([editor.get()], { type: 'text/x-python;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bibref-script.py'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#python-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output.textContent); $('#python-copy').textContent = 'Copied'; }
    catch { $('#python-copy').textContent = 'Select output to copy'; }
    setTimeout(() => { $('#python-copy').textContent = 'Copy output'; }, 2000);
  });
  window.addEventListener('pagehide', () => {
    if (!active) return;
    active.stopped = true; active.runtime?.stop(); active.abort.abort();
    if (active.runId) void fetch(`${active.root}/${active.runId}/end`, { method: 'POST', keepalive: true,
      credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  });
  if (!supported()) state('Python needs HTTPS and a browser supporting cross-origin isolation. Terminal is available.');
  controls();
  return { focus: () => editor.focus(), load: source => { if (active) throw new Error("Stop the current Python run first."); editor.set(source); editor.focus(); } };
}
