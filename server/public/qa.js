const form = document.querySelector('form');
const language = document.querySelector('#language');
const question = document.querySelector('#question');
const status = document.querySelector('#status');
const answer = document.querySelector('#answer');
const button = form.querySelector('button');
const canonical = document.querySelector('#canonical');
const copy = {
  en: {
    question: 'Question', ask: 'Ask', pending: 'Checking sources…', unavailable: 'Q&A is currently unavailable.',
    uncertain: 'The answer is pending. The request may still be processing.', source: 'Read article context',
    synthesis: 'Synthesis', generated_translation: 'Generated translation', objection: 'Objection',
    sed_contra: 'On the contrary', respondeo: 'Aquinas’s main answer', reply: 'Aquinas’s reply',
    disclosure: 'Answers use a limited source collection and may contain errors. OpenAI processes your question and excerpts. The app keeps an encrypted answer receipt for up to 24 hours. Three answers per browser per UTC day, subject to a shared monthly budget.',
  },
  hu: {
    question: 'Kérdés', ask: 'Kérdezés', pending: 'Források ellenőrzése…', unavailable: 'A szolgáltatás jelenleg nem érhető el.',
    uncertain: 'A kérés feldolgozása még folyamatban lehet.', source: 'A szakasz teljes szövege',
    synthesis: 'Összegzés', generated_translation: 'Generált fordítás', objection: 'Ellenvetés',
    sed_contra: 'Ezzel szemben', respondeo: 'Aquinói Tamás fő válasza', reply: 'Aquinói Tamás válasza',
    disclosure: 'A válaszok korlátozott forrásanyagra épülnek, és tévedhetnek. A kérdést és a forrásrészleteket az OpenAI dolgozza fel. Az alkalmazás a titkosított válasznyugtát legfeljebb 24 óráig őrzi. Naponta három válasz kérhető böngészőnként, UTC szerint, a közös havi keret erejéig.',
  },
};
let enabled = false;
let pending = false;
const add = (parent, tag, text) => {
  const child = document.createElement(tag);
  child.textContent = text;
  parent.append(child);
  return child;
};
const request = async (url, data) => {
  const response = await fetch(url, {
    cache: 'no-store', signal: AbortSignal.timeout(65_000),
    ...(data && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  });
  return response.json();
};

function render(payload, selected) {
  const words = copy[selected];
  answer.replaceChildren();
  answer.lang = selected;
  status.textContent = payload.message ?? '';
  const sources = new Map(payload.citations?.map(item => [item.id, item]));
  for (const claim of payload.answer?.claims ?? []) {
    const paragraph = add(answer, 'p', (claim.kind === 'synthesis' ? words.synthesis + ' — ' : '') + claim.text);
    for (const id of claim.citations) add(paragraph, 'sup', ' [' + id + ']');
  }
  for (const limitation of payload.answer?.limitations ?? []) add(answer, 'p', limitation);
  for (const citation of sources.values()) {
    const details = add(answer, 'details', '');
    details.open = true;
    add(details, 'summary', citation.id + ' · ' + citation.articleId + ' · ' + words[citation.sectionRole]);
    add(details, 'blockquote', citation.spans.map(span => span.text).join(' […] ')).lang = citation.sourceLanguage;
    for (const translation of payload.translations.filter(item => item.citationId === citation.id)) {
      add(details, 'p', words.generated_translation + ' — ' + translation.text);
    }
    if (/^\/qa\/source\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(citation.articleUrl)) {
      add(details, 'a', words.source).href = citation.articleUrl;
    }
  }
  if (payload.allowance) {
    const reset = new Date(payload.allowance.resetAt).toLocaleString(selected, { timeZoneName: 'short' });
    add(answer, 'p', selected === 'hu'
      ? `Hátralévő válaszok: ${payload.allowance.remaining} · Új időszak: ${reset}`
      : `Answers remaining: ${payload.allowance.remaining} · Resets: ${reset}`);
  }
}
function update() {
  const words = copy[language.value];
  if (words) {
    document.documentElement.lang = language.value;
    document.querySelector('#question-label').textContent = words.question;
    document.querySelector('#disclosure').textContent = words.disclosure;
    button.textContent = words.ask;
  }
  button.disabled = !enabled || !words || pending;
}
language.addEventListener('change', update);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = language.value;
  const words = copy[selected];
  if (!enabled || pending || !words) return;
  pending = true;
  update();
  status.textContent = words.pending;
  let ticket;
  try {
    ticket = await request('/api/qa/requests', { language: selected });
    if (!ticket.ticket) return render(ticket, selected);
    let result = await request('/api/qa/questions', {
      requestId: ticket.requestId, ticket: ticket.ticket, language: selected, question: question.value,
    }).catch(() => ({ status: 'uncertain' }));
    const deadline = Date.now() + 65_000;
    while (['running', 'uncertain'].includes(result.status) && Date.now() < deadline && !document.hidden) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (document.hidden) break;
      result = await request('/api/qa/requests/' + encodeURIComponent(ticket.requestId) + '?language=' + selected);
    }
    if (['running', 'uncertain'].includes(result.status)) status.textContent = words.uncertain;
    else render(result, selected);
  } catch {
    status.textContent = ticket?.ticket ? words.uncertain : words.unavailable;
  } finally {
    pending = false;
    update();
  }
});
try {
  const meta = await request('/api/qa/meta');
  enabled = meta.enabled === true;
  if (!enabled && meta.canonicalUrl) {
    const url = new URL(meta.canonicalUrl);
    if (url.protocol === 'https:' && url.origin !== location.origin) {
      canonical.href = url.href;
      canonical.hidden = false;
    }
  }
} catch {
  status.textContent = copy.en.unavailable;
}
update();
