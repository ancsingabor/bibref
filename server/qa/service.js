import { message } from './i18n.js';
import { retrieve } from './retrieval.js';
import { validateCandidate, verifiedAnswer } from './evidence.js';

export function createService({ corpus, admission, provider }) {
  const version = corpus.manifest.version;
  return async function answer(request) {
    const { language, question, id } = request;
    if (!['approved', 'fixture'].includes(corpus.manifest.rightsStatus)) return { code: 'unavailable' };
    const data = { question, language };
    const packs = retrieve(question, language, corpus, articles => provider.fits('generation', { ...data, articles }));
    const operation = await admission.admit(request, packs.length ? provider.stages : {});
    if (!operation.fence) return operation;
    const base = { requestId: id, language, corpusVersion: version };
    const abstention = { ...base, status: 'abstained', answer: { claims: [], limitations: [message('unsupported', language)] }, citations: [], translations: [] };
    const failed = { ...base, status: 'failed', code: 'provider_failure', message: message('provider_failure', language) };
    const finish = payload => admission.finish(operation, payload);
    const invoke = async (stage, input) => {
      const token = await admission.dispatch(operation, stage);
      if (!token) return null;
      let result;
      try {
        result = await provider.invoke(stage, input, operation.deadline);
      } catch {
        await admission.uncertain(operation, stage, token);
        return null;
      }
      if (!await admission.confirm(operation, stage, token, result.cost)) return null;
      return result;
    };

    if (!packs.length) return finish(abstention);
    const input = { ...data, articles: packs };
    const generated = await invoke('generation', input);
    if (!generated) return { requestId: id, status: 'uncertain', retryAfter: 2 };
    if (generated.failed) return finish(failed);
    const candidate = validateCandidate(generated.value, packs, version, language);
    if (!candidate?.answer.claims.length) return finish(abstention);
    const cited = new Set(candidate.citations.map(citation => citation.articleId));
    const verification = {
      ...data,
      articles: packs.filter(article => cited.has(article.id)),
      candidate,
    };
    if (!provider.fits('verification', verification)) return finish(abstention);
    const verdict = await invoke('verification', verification);
    if (!verdict) return { requestId: id, status: 'uncertain', retryAfter: 2 };
    if (verdict.failed) return finish(failed);
    return finish(verifiedAnswer(candidate, verdict.value)
      ? { ...base, status: 'answered', ...candidate }
      : abstention);
  };
}
