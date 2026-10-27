/* Browser UI only. All bibref commands execute through the server API. */
(() => {
  const status = document.querySelector('#status'), elapsed = document.querySelector('#elapsed');
  const cancel = document.querySelector('#cancel'), newButton = document.querySelector('#new-session'), recent = document.querySelector('#recent');
  let meta, session, active, term, busy = false, pythonBusy = false, multiline = '', clock;
  let exampleRunning = false, exampleStopped = false, loadPythonExample;
  const escape = text => text.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const notice = text => term.echo(escape(text), { raw: true });
  function safeText(text) {
    let classes = [], html = '', last = 0;
    for (const match of text.matchAll(/\x1b\[([0-9;]*)m/g)) {
      html += `<span class="${classes.join(' ')}">${escape(text.slice(last, match.index))}</span>`;
      for (const code of match[1].split(';').map(Number)) {
        if (code === 0) classes = [];
        else if (code === 1) classes.push('ansi-bold');
        else if (code === 31) classes.push('ansi-red');
        else if (code === 33) classes.push('ansi-yellow');
        else if (code === 36) classes.push('ansi-cyan');
      }
      last = match.index + match[0].length;
    }
    html += `<span class="${classes.join(' ')}">${escape(text.slice(last))}</span>`;
    return html.split('\n').map(line => `<div class="text-line">${line || '<br>'}</div>`).join('');
  }
  function render(event) {
    if (event.kind === 'svg') {
      const svg = DOMPurify.sanitize(event.text, { USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'foreignObject', 'image', 'animate', 'set'], FORBID_ATTR: ['href', 'xlink:href'] });
      const id = `diagram-${crypto.randomUUID()}`;
      term.echo(`<div class="diagram" id="${id}">${svg}</div>`, { raw: true });
      requestAnimationFrame(() => { const node = document.getElementById(id); if (node) window.BibrefBookUI.enhanceDiagram(node, event); });
    } else term.echo(safeText(event.text), { raw: true });
  }
  async function api(url, method = 'GET', body) {
    let response;
    try {
      response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } finally {
      if (method === 'POST' && url.endsWith('/context')) window.dispatchEvent(new Event('bibref-usage-change'));
    }
    if (!response.ok) {
      let problem; try { problem = await response.json(); } catch {}
      const e = new Error(problem?.message || `Request failed (${response.status}).`); e.code = problem?.code; throw e;
    }
    return response;
  }
  function remember(s) {
    sessionStorage.setItem('bibref-session', s.id);
    let saved; try { saved = JSON.parse(localStorage.getItem('bibref-recent') || '[]'); } catch { saved = []; }
    saved = [{ id: s.id, date: new Date().toISOString() }, ...saved.filter(x => x.id !== s.id)].slice(0, 10);
    localStorage.setItem('bibref-recent', JSON.stringify(saved)); showRecent();
  }
  function showRecent() {
    recent.replaceChildren(new Option('Recent sessions', ''));
    let saved; try { saved = JSON.parse(localStorage.getItem('bibref-recent') || '[]'); } catch { saved = []; }
    for (const s of saved) recent.add(new Option(`${s.id.slice(0, 8)} · ${new Date(s.date).toLocaleDateString()}`, s.id));
  }
  function controls() {
    document.querySelector('#terminal-tab').disabled = exampleRunning;
    document.querySelector('#python-tab').disabled = exampleRunning;
    cancel.disabled = !active && !exampleRunning; newButton.disabled = busy || pythonBusy || exampleRunning; recent.disabled = busy || pythonBusy || exampleRunning;
    status.textContent = busy ? 'Running on server' : session?.closed ? 'Session closed' : session?.compatible === false ? 'History only · engine changed' : 'Connected';
  }
  async function resume(id) {
    session = await (await api(`/api/sessions/${id}`)).json();
    active = session.active; remember(session); term.clear();
    notice(`bibref ${meta.version} · server terminal. Type help for commands, or clear to clear the screen.`);
    for (const record of session.history) {
      notice(`> ${record.command}`);
      for (const event of Array.isArray(record.events) ? record.events : []) render(event);
      if (record.status === 'failed') notice(record.message || 'Command failed. Previous state was retained.');
    }
    if (active) {
      busy = true; term.pause(); controls(); notice('A previous command is still running. Waiting for its outcome…');
      await recover(active.requestId);
    }
    controls();
    if (!session.closed && session.compatible !== false) term.resume(); else term.pause();
  }
  async function createSession() {
    if (busy) return;
    session = await (await api('/api/sessions', 'POST', {})).json();
    remember(session); active = null; multiline = ''; term.clear(); term.set_prompt('> '); term.resume();
    notice(`bibref ${meta.version} · server terminal. Type help for commands, or clear to clear the screen.`);
    controls();
  }
  async function recover(requestId) {
    // Do not automatically replay a command whose outcome is uncertain.
    let result;
    for (let i = 0; i < Math.ceil((meta.limits.commandSeconds + 45) / 3); i++) {
      result = await (await api(`/api/sessions/${session.id}/commands/${requestId}`)).json();
      if (result.status !== 'running') break;
      await new Promise(r => setTimeout(r, 3000));
    }
    if (result?.status === 'running') throw new Error('Command outcome is still pending. Refresh to check again.');
    session = await (await api(`/api/sessions/${session.id}`)).json();
    active = null; busy = false; controls();
    if (result.record) {
      notice('Recovered the recorded command outcome:');
      for (const event of Array.isArray(result.record.events) ? result.record.events : []) render(event);
      if (result.record.message) notice(result.record.message);
    }
    sessionStorage.removeItem('bibref-pending');
    return result.record?.status === 'completed';
  }
  async function submit(command, fromExample = false) {
    if (busy || pythonBusy || (exampleRunning && !fromExample)) return false;
    // Clearing the screen is local: leave server history and clipboards intact.
    if (!multiline && command.trim() === 'clear') { term.clear(); return; }
    if (!session || session.closed || session.compatible === false) return;
    if (multiline || /^statement\b/i.test(command.trim())) {
      multiline += (multiline ? '\n' : '') + command;
      if (!multiline.trim().endsWith('.')) { term.set_prompt('… '); return; }
      command = multiline; multiline = ''; term.set_prompt('> ');
    }
    if (!command.trim()) return;
    const requestId = crypto.randomUUID(); active = { requestId, startedAt: Date.now() };
    sessionStorage.setItem('bibref-pending', requestId);
    busy = true; controls();
    clock = setInterval(() => { elapsed.textContent = `${((Date.now() - (active?.startedAt || Date.now())) / 1000).toFixed(1)} s`; }, 200);
    let terminalEvent = false, succeeded = false;
    try {
      const response = await api(`/api/sessions/${session.id}/commands`, 'POST', { command, requestId, revision: session.revision });
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (!frame.startsWith('data: ')) continue;
          const event = JSON.parse(frame.slice(6));
          if (event.type === 'output') render(event);
          if (event.type === 'accepted') active = event;
          if (event.type === 'completed' || event.type === 'failed' || event.type === 'recorded') {
            terminalEvent = true; succeeded = event.type === 'completed' || (event.type === 'recorded' && event.record?.status === 'completed');
            if (event.revision !== undefined) session.revision = event.revision;
            if (event.type === 'failed') notice(event.message || 'Command failed. Previous state was retained.');
            if (event.type === 'recorded') for (const e of Array.isArray(event.record.events) ? event.record.events : []) render(e);
            if (event.closed) { session.closed = true; term.pause(); }
          }
          if (event.type === 'running') { succeeded = await recover(requestId); terminalEvent = true; }
        }
      }
      if (!terminalEvent) succeeded = await recover(requestId);
      sessionStorage.removeItem('bibref-pending');
    } catch (e) {
      notice(e.message);
      if (!e.code) {
        try { succeeded = await recover(requestId); } catch (recoveryError) { notice(recoveryError.message); }
      } else if (e.code === 'stale_revision') {
        session = await (await api(`/api/sessions/${session.id}`)).json();
      }
    } finally {
      clearInterval(clock); elapsed.textContent = ''; active = null; busy = false; controls();
      window.dispatchEvent(new Event('bibref-usage-change'));
    }
    return succeeded;
  }
  cancel.addEventListener('click', async () => {
    exampleStopped = true;
    if (!active) return; cancel.disabled = true;
    try { await api(`/api/sessions/${session.id}/commands/${active.requestId}/cancel`, 'POST', {}); }
    catch (e) { notice(e.message); }
  });
  newButton.addEventListener('click', () => createSession().catch(e => notice(e.message)));
  recent.addEventListener('change', () => { if (recent.value) resume(recent.value).catch(e => notice(e.message)); });
  (async () => {
    meta = await (await api('/api/meta')).json();
    term = $('#terminal').terminal(async command => { await submit(command); }, { checkArity: false, name: 'bibref-server', greetings: '', prompt: '> ',
      completion: (_, callback) => callback([...new Set([...meta.vocabulary, 'clear'])]), clear: false });
    window.bibrefTerminal = term;
    document.querySelector('#workspace-tabs').hidden = false;
    document.querySelector('#python-tab').hidden = !meta.features?.python;
    if (meta.features?.python) {
      const terminalTab = document.querySelector('#terminal-tab'), pythonTab = document.querySelector('#python-tab');
      const workspace = document.querySelector('#python-workspace');
      document.querySelector('#workspace-tabs').hidden = false;
      document.querySelector('#terminal').setAttribute('role', 'tabpanel');
      document.querySelector('#terminal').setAttribute('aria-labelledby', 'terminal-tab');
      let pythonUI;
      async function selectPython(show) {
        document.querySelector('#terminal').hidden = show; workspace.hidden = !show;
        terminalTab.setAttribute('aria-selected', String(!show)); pythonTab.setAttribute('aria-selected', String(show));
        terminalTab.tabIndex = show ? -1 : 0; pythonTab.tabIndex = show ? 0 : -1;
        if (show) {
          term.disable();
          try {
            pythonUI ||= import('/python/ui.js').then(({ initPython }) => initPython({ api, getSession: () => session,
              setBusy: value => { pythonBusy = value; controls(); } }));
            await pythonUI;
          } catch (error) { document.querySelector('#python-status').textContent = `Could not load editor: ${error.message}`; }
        } else { term.enable(); if (!session?.closed && session?.compatible !== false) term.focus(); }
      }
      loadPythonExample = async source => { await selectPython(true); (await pythonUI).load(source); };
      terminalTab.addEventListener('click', () => { void selectPython(false); });
      pythonTab.addEventListener('click', () => { void selectPython(true); });
      document.querySelector('#workspace-tabs').addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const show = event.key === 'End' || (event.key !== 'Home' && pythonTab.getAttribute('aria-selected') !== 'true');
          void selectPython(show); (show ? pythonTab : terminalTab).focus();
        }
      });
    }
    await window.BibrefBookUI.init({ api, getSession: () => session, modules: meta.modules || [], python: !!meta.features?.python,
      isBusy: () => busy || pythonBusy || exampleRunning,
      loadPython: source => loadPythonExample(source),
      stop: () => { exampleStopped = true; cancel.click(); },
      run: async (example, progress) => {
        document.querySelector('#terminal-tab').click();
        exampleRunning = true; exampleStopped = false; controls();
        try {
          await createSession(); term.disable();
          const commands = [...example.prerequisites, ...example.commands];
          for (let i = 0; i < commands.length; i++) {
            if (exampleStopped) throw new Error('Example cancelled.');
            progress(`Running command ${i + 1} of ${commands.length}…`);
            notice(`> ${commands[i]}`);
            if (!await submit(commands[i], true)) throw new Error('Command failed or its outcome is unknown. The remaining commands were not run.');
          }
          if (exampleStopped) throw new Error('Example cancelled.');
        } finally { exampleRunning = false; controls(); if (!session?.closed && session?.compatible !== false) term.enable(); }
      } }).catch(error => { notice(`Book examples unavailable: ${error.message}`); document.querySelector('#book-open').disabled = true; });
    showRecent();
    const id = sessionStorage.getItem('bibref-session');
    if (id) {
      try { await resume(id); }
      catch (e) { if (e.code === 'not_found') await createSession(); else throw e; }
    } else await createSession();
  })().catch(e => { status.textContent = `Unavailable: ${e.message}`; });
})();
