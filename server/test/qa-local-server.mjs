import express from 'express';
import { createQaRouter } from '../qa/api.js';
import { createService } from '../qa/service.js';
import { article, manifest, poisonedArticle, fixtureProvider } from './fixtures/qa/article.js';
import { fakeClock, fakeTransport, fixtureLedger } from './fixtures/qa/doubles.js';

export function fixtureServer({ origin, clock = fakeClock(), ledger = fixtureLedger(clock), provider = fixtureProvider(), transport = fakeTransport() }) {
  const app = express();
  const config = { enabled: true, origin, keys: {
    cookie: { version: 1, bytes: Buffer.alloc(32, 1) },
    binding: { version: 1, bytes: Buffer.alloc(32, 2) },
  } };
  const corpus = { manifest, articles: [article, poisonedArticle], topics: {
    [article.id]: { hu: ['jel'], en: ['sign'] },
  } };
  const adapter = typeof provider === 'function' ? provider({ transport, clock }) : provider;
  app.use(createQaRouter({
    config, corpus, ledger, answer: createService({ corpus, admission: ledger, provider: adapter }),
    now: clock.now, fixture: true,
  }));
  app.use(express.static(new URL('../public', import.meta.url).pathname, { index: false }));
  return app;
}
