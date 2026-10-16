/* Book navigation and SVG inspection. Only application-owned controls get handlers. */
window.BibrefBookUI = (() => {
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  function button(label, action) { const n = el('button', label); n.type = 'button'; n.addEventListener('click', action); return n; }
  async function copy(text, target) {
    try { await navigator.clipboard.writeText(text); target.textContent = 'Copied'; }
    catch { target.textContent = 'Could not copy; select the text below'; }
  }
  function copyButton(label, text) { let b; b = button(label, () => copy(text, b)); return b; }
  let catalogue, api, getSession;
  async function init(options) {
    ({ api, getSession } = options);
    catalogue = await (await api('/book-examples.json')).json();
    const dialog = document.querySelector('#book-library'), list = document.querySelector('#book-list');
    const search = document.querySelector('#book-search'), filter = document.querySelector('#book-filter');
    const preview = document.querySelector('#book-preview'), trigger = document.querySelector('#book-open');
    let selected, running = false;
    trigger.addEventListener('click', () => { dialog.showModal(); search.focus(); });
    document.querySelector('#book-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => trigger.focus());
    const progress = document.querySelector('#book-progress');
    function select(example) {
      selected = example;
      for (const b of list.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === example.id));
      preview.replaceChildren(el('h2', example.title), el('p', `${example.chapter} · ${example.pageVerified ? 'Page' : 'Near page'} ${example.page}${example.exercise ? ` · Exercise ${example.exercise}` : ''}`));
      preview.append(el('p', `Required editions: ${example.modules.join(', ') || 'None'}`));
      const available = options.modules.map(m => typeof m === 'string' ? m : m.name || m.id);
      const missing = example.modules.filter(m => !available.includes(m));
      const reason = example.unavailable || (missing.length ? `Unavailable editions: ${missing.join(', ')}` : '') || (example.runtime === 'python' && !options.python ? 'Python is not enabled on this server.' : '');
      if (example.kind === 'diagrams') preview.append(el('p', 'Web adaptation: diagram svg is applied automatically.'));
      if (example.prerequisites.length) preview.append(el('p', 'Prerequisite commands are included below.'));
      if (reason) preview.append(el('p', reason, 'book-warning'));
      const actions = el('div', undefined, 'book-actions');
      actions.append(copyButton('Copy', example.source), button('Download', () => {
        const url = URL.createObjectURL(new Blob([example.source], { type: 'text/plain;charset=utf-8' }));
        const a = el('a'); a.href = url; a.download = `${example.id}.${example.runtime === 'python' ? 'py' : example.runtime === 'shell' ? 'sh' : 'txt'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
      const run = button(example.runtime === 'python' ? 'Load in Python editor' : 'Run example', async () => {
        if (running || options.isBusy()) { progress.textContent = 'Wait for the current command to finish.'; return; }
        running = true; run.disabled = true; stop.disabled = false;
        try {
          if (example.runtime === 'python') { await options.loadPython(example.source); dialog.close(); }
          else {
            progress.textContent = 'Starting a fresh terminal session…';
            await options.run(example, message => { progress.textContent = message; });
            progress.textContent = 'Example completed. Close the library to inspect the results.';
          }
        } catch (error) { progress.textContent = `Stopped: ${error.message}`; }
        finally { running = false; run.disabled = !!reason; stop.disabled = true; }
      });
      run.disabled = !!reason; actions.append(run);
      const stop = button('Stop example', () => { if (running) { options.stop(); progress.textContent = 'Stopping example…'; } });
      stop.disabled = !running; actions.append(stop);
      const source = el('pre', example.source); source.tabIndex = 0; source.setAttribute('aria-label', 'Copyable example source');
      preview.append(actions, source);
    }
    function update() {
      const q = search.value.toLocaleLowerCase(); list.replaceChildren(); let group;
      const matches = catalogue.examples.filter(e => (!filter.value || e.kind === filter.value) && `${e.title} ${e.chapter} ${e.page} ${e.exercise || ''} ${e.source}`.toLocaleLowerCase().includes(q));
      for (const example of matches) {
        if (group !== example.chapter) { group = example.chapter; list.append(el('h3', group)); }
        const b = button(`${example.title}\n${example.pageVerified ? 'p.' : 'near p.'} ${example.page} · ${example.kind}`, () => select(example));
        b.dataset.id = example.id; b.setAttribute('aria-pressed', String(example.id === selected?.id)); list.append(b);
      }
      document.querySelector('#book-count').textContent = `${matches.length} examples`;
      if (!matches.length) list.append(el('p', 'No examples found. Try a passage, command, or page number.'));
    }
    search.addEventListener('input', update); filter.addEventListener('change', update); update(); select(catalogue.examples[0]);
  }
  function enhanceDiagram(container, event) {
    const svg = container.querySelector('svg'); if (!svg) return;
    const supplied = Array.isArray(event.fragments) ? event.fragments : [];
    const fragments = supplied.length ? supplied : [...svg.querySelectorAll('g.node')].flatMap((node, i) => {
      const tooltip = node.querySelector('[title]')?.getAttribute('title') || node.querySelector('a')?.getAttribute('xlink:title');
      if (!tooltip?.trim()) return [];
      node.id = `legacy-${i}`;
      return [{ id: node.id, greek: tooltip, matches: [], legacy: true }];
    });
    if (!fragments.length) return;
    container.classList.add('interactive-diagram');
    const inspector = el('section', undefined, 'diagram-inspector'); inspector.setAttribute('aria-label', 'Diagram text');
    inspector.append(el('p', 'Select a diagram block to read its text.'));
    const alternative = el('select'); alternative.setAttribute('aria-label', 'Select diagram text block');
    alternative.add(new Option('Select a text block', ''));
    const nodes = new Map([...svg.querySelectorAll('[id]')].map(n => [n.id, n]));
    // Scope Graphviz IDs (including gradients) to this rendered instance.
    const prefix = `svg-${crypto.randomUUID()}-`;
    for (const node of nodes.values()) node.id = prefix + node.id;
    for (const node of [svg, ...svg.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (attr.value.includes('url(#')) node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${prefix}${id})`));
      }
    }
    const contextCache = new Map();
    let selection = 0;
    async function show(fragment) {
      const version = ++selection;
      for (const node of nodes.values()) node.classList.remove('selected-fragment', 'matched-fragment');
      nodes.get(fragment.id)?.classList.add('selected-fragment');
      for (const id of fragment.matches || []) nodes.get(id)?.classList.add('matched-fragment');
      alternative.value = fragment.id;
      inspector.replaceChildren(el('h3', fragment.legacy ? 'Passage text' : `${fragment.module} ${fragment.book}${fragment.kind ? ` · ${fragment.kind}` : ""}`));
      const reference = fragment.legacy ? 'Reference metadata is unavailable for this older diagram.' : `${fragment.module} ${fragment.book} ${fragment.reference} (book positions ${fragment.start}–${fragment.end}; ${fragment.length} characters)`;
      inspector.append(el('p', reference), el('p', fragment.greek, 'greek-fragment'));
      inspector.append(copyButton(fragment.legacy ? 'Copy text' : 'Copy Greek', fragment.greek));
      if (!fragment.legacy) inspector.append(copyButton('Copy reference', reference));
      for (const id of fragment.matches || []) {
        const other = fragments.find(f => f.id === id);
        if (other) inspector.append(el('h4', `Matched: ${other.module} ${other.book} ${other.reference}`), el('p', other.greek, 'greek-fragment'));
      }
      const context = el('div'); context.append(el('h4', 'Hungarian verse context'));
      inspector.append(context);
      const bounds = fragment.reference?.split(' ').map(v => v.replace(/[+-].*/, '')) || [];
      const [chapter, first] = (bounds[0] || '').split(':').map(Number);
      const [lastChapter, last] = (bounds[1] || bounds[0] || '').split(':').map(Number);
      const verseKeys = chapter === lastChapter && last - first < 20
        ? Array.from({ length: last - first + 1 }, (_, i) => `${chapter}:${first + i}`) : bounds;
      const verses = [...new Set(verseKeys.flatMap(verse => catalogue?.contextMappings?.[`${fragment.module} ${fragment.book} ${verse}`] || []))];
      if (!verses?.length) { context.append(el('p', 'No verified Hungarian verse mapping is available for this block.')); return; }
      context.append(el('p', 'Whole Hungarian verses provide context; they do not represent the exact Greek character interval.'));
      let hungarian = '';
      for (const reference of verses) {
        const [book, verse] = reference.split(' ');
        try {
          const sessionId = getSession().id, key = `${sessionId} ${reference}`;
          if (!contextCache.has(key)) contextCache.set(key, api(`/api/sessions/${sessionId}/context`, 'POST', { book, verse }).then(response => response.json()).catch(error => { contextCache.delete(key); throw error; }));
          const result = await contextCache.get(key);
          if (version !== selection) return;
          hungarian += `${reference}\n${result.text}\n`; context.append(el('p', `HunRUF ${reference}`), el('p', result.text));
        } catch (error) { if (version === selection) context.append(el('p', `Hungarian context unavailable: ${error.message}`)); }
      }
      if (hungarian && version === selection) context.append(copyButton('Copy Hungarian', hungarian));
    }
    for (const fragment of fragments) {
      const node = nodes.get(fragment.id); if (!node) continue;
      node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `${fragment.module || ''} ${fragment.book || 'Passage'} ${fragment.reference || fragment.greek}`);
      node.addEventListener('click', () => { void show(fragment); });
      node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void show(fragment); } });
      alternative.add(new Option(fragment.legacy ? fragment.greek.slice(0, 40) : `${fragment.module} ${fragment.book} ${fragment.reference}`, fragment.id));
    }
    alternative.addEventListener('change', () => { const f = fragments.find(f => f.id === alternative.value); if (f) void show(f); });
    const graph = el('div', undefined, 'diagram-graphic'); svg.before(graph); graph.append(svg, alternative);
    container.append(inspector);
  }
  return { init, enhanceDiagram };
})();
