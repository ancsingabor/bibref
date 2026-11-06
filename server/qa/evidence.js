import { createHash } from 'node:crypto';
import { message } from './i18n.js';

const roles = new Set(['objection', 'sed_contra', 'respondeo', 'reply']);
const digest = value => createHash('sha256').update(value).digest('hex');
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value);
const prose = value => typeof value === 'string' && value.trim() && value.length <= 6000;
const bounded = (value, max) => Array.isArray(value) && value.length <= max;

export function validateCandidate(draft, articles, version, language) {
  if (!bounded(draft?.claims, 6) || !bounded(draft.citations, 12) ||
      !bounded(draft.translations, 3) || typeof draft.partial !== 'boolean') return null;
  const sources = new Map();
  for (const citation of draft.citations) {
    if (!identifier(citation?.id) || sources.has(citation.id) ||
        !bounded(citation.spans, 6) || !citation.spans.length) return null;
    const article = articles.find(item => item.id === citation.articleId);
    const section = article?.sections.find(item => item.id === citation.sectionId);
    if (!article || article.editionId !== citation.editionId || !section || !roles.has(section.role) ||
        section.hash !== citation.hash || digest(section.text) !== section.hash ||
        !article.sections.some(item => item.role === 'respondeo')) return null;
    const chars = [...section.text];
    let previousEnd = 0;
    const spans = [];
    for (const span of citation.spans) {
      if (!Number.isInteger(span?.start) || !Number.isInteger(span.end) ||
          span.start < previousEnd || span.end <= span.start || span.end > chars.length) return null;
      const text = chars.slice(span.start, span.end).join('');
      if (Object.hasOwn(span, 'text') && span.text !== text) return null;
      spans.push({ start: span.start, end: span.end, text });
      previousEnd = span.end;
    }
    sources.set(citation.id, {
      id: citation.id, articleId: article.id, editionId: article.editionId,
      sectionId: section.id, sectionRole: section.role, number: section.number,
      respondsTo: section.respondsTo, collectiveReply: section.collectiveReply, spans,
      sourceLanguage: article.sourceLanguage ?? 'en',
      articleUrl: '/qa/source/' + encodeURIComponent(version) + '/' + encodeURIComponent(article.id),
    });
  }
  const claims = new Map();
  const used = new Set();
  for (const claim of draft.claims) {
    if (!identifier(claim?.id) || claims.has(claim.id) || !prose(claim.text) ||
        !['attribution', 'synthesis'].includes(claim.kind) || !bounded(claim.citations, 12) ||
        !claim.citations.length || new Set(claim.citations).size !== claim.citations.length) return null;
    const evidence = claim.citations.map(id => sources.get(id));
    if (evidence.some(item => !item) || !evidence.some(item => ['respondeo', 'reply'].includes(item.sectionRole))) return null;
    for (const item of evidence) {
      if (item.sectionRole === 'objection' && !evidence.some(reply => reply.articleId === item.articleId &&
          reply.sectionRole === 'reply' && reply.respondsTo?.includes(item.number))) return null;
      used.add(item.id);
    }
    claims.set(claim.id, { id: claim.id, text: claim.text, kind: claim.kind, citations: claim.citations });
  }
  const translated = new Set();
  const translations = [];
  for (const item of draft.translations) {
    if (!used.has(item?.citationId) || translated.has(item.citationId) || !prose(item.text) || item.language !== language) return null;
    translated.add(item.citationId);
    translations.push({ citationId: item.citationId, text: item.text, language, kind: 'generated_translation' });
  }
  return {
    language,
    answer: { claims: [...claims.values()], limitations: draft.partial ? [message('partial', language)] : [] },
    citations: [...used].map(id => sources.get(id)),
    translations,
  };
}

export function verifiedAnswer(candidate, verdict) {
  if (!candidate?.answer.claims.length || verdict?.language !== candidate.language) return false;
  const complete = (actual, expected, key, flag) => Array.isArray(actual) && actual.length === expected.length &&
    expected.every(item => actual.some(check => check?.[key] === item[key] &&
      check.verdict === 'supported' && check[flag] === true));
  return complete(verdict.claims, candidate.answer.claims, 'id', 'roleCorrect') &&
    complete(verdict.translations, candidate.translations, 'citationId', 'faithful');
}
