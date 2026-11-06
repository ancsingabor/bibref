# Research: Hosted Aquinas Apologetic Q&A

Date: 2026-11-02. Research is read-only; no paid calls, corpus installation, infrastructure changes or application checks were performed. Sources describe capabilities, not access to the operator’s accounts. Three research agents investigated corpus, accounting and provider constraints; findings were consolidated against local code.

## 1. Existing integration and isolation

**Decision**: Extend the Node >=24 Express application through isolated optional modules; retain native execution and Redis unchanged. Route Q&A around the terminal’s generic rate bucket while preserving shared security middleware.

**Rationale**: `server/app.js` already provides same-origin JSON, no-store API headers and ownership patterns. `server/store.js` separates environment sessions from shared execution limits. `server/engine.js` constructs a restricted subprocess environment. `server/index.js` is the dependency-construction seam. Q&A must not write sessions or inherit command execution behavior. Add only pinned `pg` and a compatible local tokenizer, not an agent framework.

**Alternatives considered**: A new frontend framework, native engine extension, browser provider calls and an independent microservice add complexity or violate privacy/compatibility without improving this bounded feature.

## 2. Initial source and rights

**Decision**: Candidate initial corpus is complete English articles from Summa Theologica Prima Pars I qq.1–26 and 44–49, using the Complete American Edition text identified by Project Gutenberg #17611. Build a versioned allowlist with edition, exact text hashes, roles and source notice. Do not package or serve it until the maintainer records the intended-jurisdiction rights basis and attribution policy. Synthetic fixtures can support implementation beforehand.

**Rationale**: The [catalog](https://www.gutenberg.org/ebooks/17611) identifies the English work and edition. The [source text](https://www.gutenberg.org/cache/epub/17611/pg17611-images.html) has explicit article sections; preserve full articles and collective replies where applicable. Topics outside this bounded selection abstain. Hungarian support initially uses generated translations beside English source wording rather than an unverified Hungarian digital edition.

**Rights limitation**: The [Project Gutenberg license](https://www.gutenberg.org/policy/license.html) requires checking applicable law outside the US and distinguishes text rights from trademark/license obligations. This research makes no legal conclusion about Hungarian/EU serving permission. Rights approval is a release gate, not inferred from free access.

**Alternatives considered**: [New Advent](https://www.newadvent.org/summa/1002.htm) is a useful structural reference, but its site notice is not a rehosting license. [Corpus Thomisticum](https://www.corpusthomisticum.org/iopera.html) offers Latin works; no applicable permissive serving basis was established. No published Hungarian corpus is selected without separate permission.

## 3. Retrieval and semantic support

**Decision**: Offline normalized lexical/BM25-style search over article sections, titles and reviewed bilingual topic aliases. Keep original text untouched and derive a separate search form. Retrieve at most three complete article evidence packs within the token allocation; if required main-answer/reply context cannot fit, omit the article or abstain. No embeddings or live fetches.

**Rationale**: Small bounded corpus and cost ceiling favor deterministic free retrieval. Hungarian aliases are curated, never provider-generated per question. Model output names only offered evidence IDs/spans. Server-rendered quotes establish textual fidelity. A separate bounded verifier assesses every claim and translation in article context; unknown/support failure causes whole-answer abstention, not another generation attempt. Human bilingual/source review is mandatory: semantic verification is fallible and passing a model check is not proof of theological truth.

**Alternatives considered**: Paid embeddings, runtime web search and model-only citation checks increase attack surface or cost. Exact reference/span checks alone do not establish entailment. Fully extractive responses simplify attribution but cannot meet all explanatory bilingual goals.

## 4. Financial authority and consistency

**Decision**: PostgreSQL is the authoritative Q&A ledger, separate from existing Redis. Serialize short transactions through one control row, with row locks and unique operation/settlement constraints. Release locks before network work. Require acknowledged commits that survive the selected deployment’s permitted failovers, and fence restore/rollback before enabling dispatch.

**Rationale**: [Upstash consistency documentation](https://upstash.com/docs/redis/features/consistency) describes asynchronous replication and last-writer-wins recovery. Lua atomicity alone therefore does not establish the desired cross-failure spend ceiling. [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html) support mutually exclusive admission updates until transaction completion. SQL transactions still require operational durability; simply naming PostgreSQL or Supabase is not proof of zero lost acknowledged writes.

**Alternatives considered**: Existing Redis Lua is attractive for local atomic admission but insufficient as the sole authority for this invariant under documented failures. A PostgreSQL service is a future configured dependency; no database or Supabase project is created by planning. Supabase, if authorized later, must be provisioned directly in the existing specified organization.

## 5. Browser identity across environments

**Decision**: Serve paid browser Q&A exclusively at one configured canonical HTTPS origin. Preview and production pages outside that origin link there; they never issue local paid Q&A requests. One server-issued host-only signed HttpOnly cookie controls the quota; no localStorage identity or cross-site identity exchange.

**Rationale**: Existing `bibref_owner` is host-only and cannot establish a single browser identity across independent Vercel hosts. One origin solves that scope mismatch without tracking people or trusting client IDs. Browser-data deletion remains an explicit anonymous-identity limitation.

**Alternatives considered**: Parent-domain cookies require controlled custom domains and broaden cookie trust; authenticated identity changes feature scope; client-supplied UUIDs are trivially rotated. Public paid candidate previews outside the canonical origin are excluded. Fixture tests can run distinct backend instances against one ledger and a shared validated identity.

## 6. Provider candidate and cost envelope

**Decision (maintainer approved in Codex chat, 2026-11-03)**: Use OpenAI Responses snapshot `gpt-5.4-mini-2026-03-17` for both stages. Preserve foreground nonstreaming structured output, reasoning effort none, and disable tools, background/conversation, fallback and retry. The [model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini) confirms these capabilities. [OpenAI's tokenizer mapping](https://github.com/openai/tiktoken/blob/main/tiktoken/model.py) assigns GPT-5 to `o200k_base`. Pin `js-tiktoken` at 1.0.21. Wrapper overhead still requires activation evidence.

**Pricing basis**: Published standard rates are $0.75/M uncached input and $4.50/M output. At full allocations, standard pricing implies $0.01575 per operation before any applicable surcharge or cache-write rate. Sixty full-size reservations total $0.945, above the approved $0.50 evaluation cap. Preflight tighter enforceable per-case bounds under the reviewed rates. If all required cases cannot fit, block live verification pending a separately agreed amendment. The original baseline remains in commit `30c588e`.

**Rationale**: Use integer nano-USD and upward rounding per call. Expire the reviewed price manifest after at most 24 hours; stale/unverified prices disable new paid admission. Reserve the full two-call envelope before either call, including verification. Input allocation is 7,000 generation and 5,000 verification; outputs 1,200 and 300 respectively. Every serialized instruction/schema/role wrapper must fit the token bound. Verified local counting plus a conservative documented overhead envelope is required; if the selected model’s bound cannot be established, do not enable it. Do not silently increase bounds or bill a paid token-counting operation outside the reservation.

**Alternatives considered**: A larger model might improve theology/language quality but is not presumed necessary; quality failure requires an explicit revised decision, not automatic escalation. Provider-hosted tools, caching writes beyond the reviewed envelope and hidden retry layers are prohibited. A dedicated feature key/project avoids unrelated usage bypassing the ledger. An application can guarantee its admission math under its declared prices and durability assumptions, not correct arbitrary provider invoices or surprise pricing changes; discrepancies suspend admission and require reconciliation.

## 7. Output and privacy controls

**Decision**: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrain shape, not factual correctness; deterministic citation checks and separate semantic review remain required. Refusal, incomplete output and schema failures never render an answer. Native fetch uses explicit time/body bounds and no redirect following.

**Data policy**: Use `store=false`, no conversation IDs, no prompt tracing and no question-bearing HTTP logs. [Provider data controls](https://developers.openai.com/api/docs/guides/your-data) distinguish response storage from abuse monitoring; store=false is not a zero-retention promise. Standard provider abuse monitoring may retain content for up to 30 days; more restrictive controls require eligibility/configuration. Record actual account policy and disclose processing before enabling. Cache retention is also subject to the selected documented configuration.

**Alternatives considered**: A zero-provider-retention claim without verified controls would be false. Storing raw questions or provider payloads for debugging is unnecessary. Keep questions only in request memory, use a keyed HMAC for content binding, encrypt short-lived answer receipts, and retain text-free financial records for reconciliation.

## 8. Resolved design versus activation evidence

All technical design decisions are selected above. No claim is made that rights, provider access, canonical DNS, database durability, compatible token counting or bilingual quality have been operationally established. Default-disabled behavior is the resolution for missing activation evidence. Application checks and live evaluation require the constitution’s separate finite SpecGuard agreement/selection; deployment needs an explicit request. This plan does not weaken the specification’s hard limits to accommodate missing infrastructure.


## Gutenberg #17611 heading correction

The pinned plain-text source (SHA-256 `c9443221a31768991db4bbe37e6ed035b278143a6728af64dc8ba0cf8e79154d`) lists both the eighth and ninth articles of Prima Pars question 19 as `Art. 8`. The exact heading `NINTH ARTICLE [I, Q. 19, Art. 8]` maps to `ST.I.q19.a9` only for that source digest. The source text stays intact and other duplicate locators stop extraction. None of the frozen E5 cases uses either locator.


The private evaluation bundle includes 181 articles. It excludes `ST.I.q24.a1`
because the source prints a fourth reply but only three numbered objections.
That article is outside the frozen cases. Public-serving eligibility remains
pending. Three articles have no separately headed contrary section
(`ST.I.q10.a1`, `ST.I.q19.a12`, `ST.I.q48.a5`). The extractor accepts those
edition-specific structures and preserves the numbered contrary argument in
q48 a5. The closing collective replies in q1 a4, q6 a4 and q16 a2 are retained.
