import assert from 'node:assert/strict';
import { test } from 'node:test';
import { article } from './fixtures/qa/article.js';
import { validateCandidate, verifiedAnswer } from '../qa/evidence.js';

const main = article.sections.find(section => section.role === 'respondeo');
const citation = { id: 'e1', articleId: article.id, editionId: article.editionId, sectionId: main.id, hash: main.hash, spans: [{ start: 0, end: 6 }] };
const draft = { claims: [{ id: 'c1', text: 'A sign may refer beyond itself.', kind: 'attribution', citations: ['e1'] }], citations: [citation], translations: [], partial: false };

test('renders original Unicode code points', () => {
  const index = [...main.text].indexOf('𐌰');
  const answer = validateCandidate({ ...draft, citations: [{ ...citation, spans: [{ start: index, end: index + 1 }] }] }, [article], 'version', 'en');
  assert.equal(answer.citations[0].spans[0].text, '𐌰');
});

for (const patch of [{ editionId: 'wrong' }, { hash: 'wrong' }, { spans: [{ start: 0, end: 9999 }] }]) {
  test('rejects mismatched source metadata or bounds', () => {
    assert.equal(validateCandidate({ ...draft, citations: [{ ...citation, ...patch }] }, [article], 'version', 'en'), null);
  });
}

test('rejects an objection cited without its collective reply', () => {
  const objection = article.sections[0];
  const objectionCitation = { ...citation, sectionId: objection.id, hash: objection.hash };
  assert.equal(validateCandidate({ ...draft, citations: [objectionCitation] }, [article], 'version', 'en'), null);
  const reply = article.sections.at(-1);
  const answer = validateCandidate({
    ...draft,
    claims: [{ ...draft.claims[0], citations: ['e1', 'e2'] }],
    citations: [objectionCitation, { ...citation, id: 'e2', sectionId: reply.id, hash: reply.hash }],
  }, [article], 'version', 'en');
  assert.deepEqual(answer.citations[1].respondsTo, [1, 2]);
  assert.equal(verifiedAnswer(answer, { language: 'en', claims: [{ id: 'c1', verdict: 'unsupported', roleCorrect: true }], translations: [] }), false);
});

test('rejects absent main-answer context and invalid translation verdict', () => {
  assert.equal(validateCandidate(draft, [{ ...article, sections: article.sections.filter(section => section.id !== main.id) }], 'version', 'en'), null);
  const candidate = validateCandidate({ ...draft, translations: [{ citationId: 'e1', language: 'hu', text: 'Egy jel utalhat valamire.' }] }, [article], 'version', 'hu');
  const verdict = { language: 'hu', claims: [{ id: 'c1', verdict: 'supported', roleCorrect: true }],
    translations: [{ citationId: 'e1', verdict: 'unknown', faithful: false }] };
  assert.equal(verifiedAnswer(candidate, verdict), false);
  assert.equal(verifiedAnswer(candidate, { ...verdict, translations: [{ citationId: 'e1', verdict: 'supported', faithful: true }] }), true);
});

test('withdrawn corpus does not admit or dispatch', async () => {
  const { createService } = await import('../qa/service.js');
  const service = createService({ corpus: { manifest: { version: 'version', rightsStatus: 'disabled' } },
    admission: { admit: () => assert.fail('withdrawn corpus was admitted') }, provider: {} });
  assert.deepEqual(await service({ language: 'en', question: 'A sign?', id: 'fixture' }), { code: 'unavailable' });
});

test('specific bilingual aliases outrank broad matches without dropping article context', async () => {
  const { retrieve } = await import('../qa/retrieval.js');
  const distractor = { ...article, id: 'fixture.general', title: 'Divine providence' };
  const corpus = { articles: [article, distractor], topics: {
    [article.id]: { hu: ['gondviselés bizonyossága'], en: ['providence and necessity'] },
    [distractor.id]: { hu: ['gondviselés'], en: ['providence'] },
  } };
  for (const [language, question] of [
    ['hu', 'Mit jelent a gondviselés bizonyossága?'],
    ['en', 'How does Aquinas relate providence and necessity?'],
  ]) {
    assert.deepEqual(retrieve(question, language, corpus, () => true), [article]);
    assert.deepEqual(retrieve(question, language, corpus, () => false), []);
  }
  assert.deepEqual(retrieve('Who caused a power outage?', 'en', corpus, () => true), []);
});
