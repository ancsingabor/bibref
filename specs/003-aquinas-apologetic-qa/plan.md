# Implementation Plan: Hosted Aquinas Apologetic Q&A

**Branch**: `feat/server-web-vercel` (actual Git branch) | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/003-aquinas-apologetic-qa/spec.md`

Setup returned `003-aquinas-apologetic-qa` as its feature identifier/BRANCH fallback from feature.json; actual Git branch remains `feat/server-web-vercel`. No branch was created or switched.

## Summary

Add an optional, isolated hosted Q&A page with explicit Hungarian/English selection, local evidence retrieval, structured generation, deterministic citation/quotation validation, a separate claim-support review, and conservative abstention. Preserve complete Aquinas article relationships. Add an authoritative PostgreSQL admission ledger for the shared $10 monthly ceiling, three daily responses per browser, deduplication, and concurrency. Keep the existing Redis-backed terminal/Python paths unchanged.

Use a single configured canonical Q&A origin for all paid browser entry points. Other deployment origins expose only a link there, preventing independent host cookies from multiplying one browser’s allowance. Use one shared ledger and dedicated provider credentials across every enabled backend. Nothing is provisioned or deployed by this plan.

Phase 1 design is complete. Enabled release is blocked until corpus serving rights, durable ledger operation, provider pricing/token bounds, bilingual quality, canonical origin, and exact verification authorization satisfy the gates below. These are explicit operational activation conditions, not assumed available infrastructure. Fixture-based implementation can be planned without weakening them.

## Technical Context

**Language/Version**: JavaScript ES modules on existing Node >=24; SQL migrations for PostgreSQL 17 or newer; Python 3 only for an offline deterministic corpus importer if helpful.

**Primary Dependencies**: Existing Express 5, node:test, Playwright, Redis clients and DOMPurify. Add a pinned `pg` driver and a model-compatible local tokenizer only after compatibility review; use native server fetch for the provider to avoid implicit SDK retries. OpenAI Responses uses the approved candidate snapshot `gpt-5.4-mini-2026-03-17` for both stages, with `js-tiktoken` and `o200k_base`. Account availability and wrapper overhead require verification before activation. No AI SDK, vector service, Supabase browser SDK, or new client framework is required.

**Storage**: Existing Redis for existing clients only. Q&A uses one authoritative PostgreSQL primary with transactions and durable acknowledged commits; no financial decisions from replicas. Private versioned corpus bundle/index on server disk. Expiring encrypted response receipts in PostgreSQL; no durable raw questions or prompt logs. Local validation uses isolated disposable PostgreSQL plus existing isolated Redis.

**Testing**: Existing node:test/assert and Playwright conventions, deterministic provider/clock/transport doubles, real disposable PostgreSQL concurrency tests, and separately authorized live bilingual review. Fixture evidence cannot establish live language quality, provider billing, or infrastructure durability.

**Target Platform**: Existing hosted Linux container and modern browsers; optional Q&A initialization must not prevent terminal startup. No native engine/module changes. Add private corpus bundle and Node modules to container inputs only when approved data exist.

**Project Type**: Optional hosted web-service feature with an offline corpus-preparation tool.

**Performance Goals**: A terminal Q&A outcome within 65 seconds, 60-second server work deadline; one active paid operation per browser and two globally, no queue. This is a small shared-budget service, not a high-throughput chatbot.

**Constraints**: Fixed $10 USD provider spend ceiling and three completed responses/browser/UTC day. Across a complete answer operation: <=12,000 provider input tokens, <=1,500 output tokens, 4,000 Unicode question characters, 1 MiB upstream body per call. Two bounded calls maximum, no automatic paid retry, no tools, no paid embeddings, no provider-hosted retrieval. Preserve existing quotas, state, module notices and Python-disabled default.

**Scale/Scope**: Single-turn anonymous Q&A. Candidate corpus: English Summa Theologica Prima Pars I qq.1–26 and 44–49; complete articles only, license approval required. Hungarian access uses prose and labeled generated translations, never an assumed licensed Hungarian edition. Offline bilingual topic aliases and lexical retrieval keep retrieval free.

## Constitution Check

Pre-research and post-design checks pass for the design, with activation gates retained:

- I: Hosted-only additive routes/assets; CLI, Qt, WASM, BIBREF_JSON defaults, module pins and native manifests unchanged. No source corpus enters public assets.
- II: Separate signed HttpOnly Q&A identity, same-origin JSON, receipt ownership, no provider/DB credentials in browser or native subprocess environment. Existing ownership behavior remains unchanged.
- III: Q&A has no clipboard/settings/session writes. Fenced receipts and dispatch records reconcile unknown outcomes without redispatch.
- IV: PostgreSQL admission serializes cost, quota, deduplication and capacity globally; no Redis flush, paid Redis upgrade, automatic resource provisioning, or unrelated team protection change.
- V: No question/source/answer bodies in operational or provider SDK logs; encrypted short-lived answer receipts; minimal financial tombstones. Private SpecGuard evidence remains outside public checkouts.
- Delivery: Corpus access does not establish serving permission. Q&A remains disabled until serving rights and provider/data controls are recorded. Deployment requires a separate explicit request.
- Governance: No constitutional amendment. Mandatory SpecGuard prepare must agree finite evidence before implementation; final concrete checks require separate selection approval and one attempt plus one bounded assessment.

**Activation gates**: corpus license/provenance accepted for intended jurisdictions; canonical HTTPS origin configured; dedicated restricted provider key and reviewed expiring price/token manifest; PostgreSQL acknowledged-write durability and restore fencing established; bilingual/source quality thresholds met; provider retention disclosure accepted; approved evidence available. A missing gate disables Q&A and does not disable existing clients. Never claim a provider’s actual invoice is guaranteed against billing errors or unannounced pricing changes by an application ledger alone.

## Project Structure

### Documentation (this feature)

```text
specs/003-aquinas-apologetic-qa/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── qa-api.md
│   ├── evidence-provider.md
│   └── verification.md
└── checklists/requirements.md
```

`tasks.md` is deliberately left to `$speckit-tasks`.

### Source Code (repository root)

Proposed paths; none of these feature modules are implemented by planning:

```text
server/index.js                       # optional Q&A dependency construction
server/app.js                         # mount feature before static/error fallback
server/qa/api.js                       # origin, identity, routes, localized failures
server/qa/store.js                     # PostgreSQL transactional admission/settlement
server/qa/migrations/001-qa.sql         # private schema, roles, constraints
server/qa/service.js                   # bounded lifecycle and dispatch fencing
server/qa/retrieval.js                 # local bilingual lexical retrieval
server/qa/evidence.js                  # article context, spans and claim checks
server/qa/provider.js                  # trusted endpoint, token/cost/response bounds
server/qa/config.js                    # fail-closed config/price/corpus gates
server/qa/i18n.js                      # curated Hungarian/English UI strings
server/qa/corpus/manifest.json          # provenance/rights/version, no credentials
server/qa/corpus/articles.jsonl         # approved private source bundle
server/qa/corpus/topics.json           # reviewed bilingual retrieval aliases
server/qa/prices.json                  # reviewed expiring worst-case rate manifest
server/scripts/build-aquinas-corpus.py # offline import/role/span validation
server/public/qa.html                  # explicit language selection and source view
server/public/qa.js                    # safe text rendering and receipt recovery
server/public/qa.css                   # scoped styles, existing terminal unaffected
server/test/qa-*.test.js               # fake store/service/evidence/transport/API tests
server/test/qa-integration/store.mjs   # opt-in real PostgreSQL, outside npm wildcard
server/test/qa-browser.mjs             # fixture browser flow
server/test/qa-local-server.mjs        # isolated deterministic QA server fixture
server/test/qa-live.mjs                # private-case opt-in runner, never npm test
server/test/fixtures/qa/               # synthetic sources, provider doubles, clocks
server/README.md                       # operation, privacy and limitations
server/package.json                   # pinned driver/tokenizer; explicit QA commands
Dockerfile.vercel                      # approved private bundle, no secrets
```

**Structure Decision**: Reuse Express and static browser conventions. Keep Q&A modules separate from native session state and existing Redis keys. Mount Q&A-specific middleware before the existing catch-all API limiter so Q&A traffic cannot consume existing terminal request allowances; keep existing security middleware applied. Optional construction errors produce Q&A unavailable status, never a terminal startup failure. One canonical Q&A URL is configurable, never derived from arbitrary Host headers.

## Phase 0 — Research

Completed three focused research-agent investigations plus local source review. Decisions, alternatives, primary sources and limits are in [research.md](research.md). No unresolved technical clarification markers remain. Real rights/account/durability approvals remain activation conditions and are not fabricated research outcomes.

## Phase 1 — Design

- [data-model.md](data-model.md): private corpus schema, ledger, token-fenced lifecycle and expiry.
- [contracts/qa-api.md](contracts/qa-api.md): hosted browser identity and request/response semantics.
- [contracts/evidence-provider.md](contracts/evidence-provider.md): retrieval, citation/claim verification and bounded provider transport.
- [contracts/verification.md](contracts/verification.md): finite acceptance inventory and outcome oracles.
- [quickstart.md](quickstart.md): proposed setup and runnable post-implementation validation commands, subject to separate authorization.

## Implementation Sequence

1. Establish fixture corpus/rights manifest format and provider-independent evidence checks.
2. Implement PostgreSQL schema and admission/settlement state machine with injected clock/provider doubles.
3. Implement local retrieval and two-stage bounded provider adapter with fake transport first.
4. Add isolated API and canonical-origin browser UI, preserving existing route/quota behavior.
5. Prepare approved source bundle, current price manifest and private acceptance cases; keep disabled until activation gates pass.
6. Execute only the separately approved finite verification selection, assess once, and stop. Deployment is a later explicit action.

## Proposed Acceptance Evidence Budget — Not Yet Agreed

E1: deterministic corpus/evidence/provider/API tests, including bilingual fixtures and hostile inputs, at most 180 seconds. E2: real PostgreSQL atomicity/concurrency and expiry tests, at most 180 seconds. E3: fixture Chromium Q&A flow, at most 180 seconds. E4: existing server, Python compatibility and usage regressions affected by route wiring, at most 300 seconds. E5: separately approved live quality batch: 20 paired supported questions, ten objection/reply traps, ten unsupported questions, at most 70 logical operations, 140 provider calls, 20 minutes and $0.70 worst-case total reserved from the same shared $10 ceiling. E6: source/configuration/privacy/diff review, at most 30 minutes. Freeze the finite case files and exact commands/hashes in private SpecGuard preparation; no retries, automatic fixes or post-result target relaxation.

Budgeting live checks does not authorize them. A reviewer competent in Hungarian, English and Aquinas must record semantic judgments against SC-001–003. Failure, missing live evidence, rights/durability gaps or unmet required regressions block release. Fixture success does not waive those gates.

## Complexity Tracking

No constitutional violations require an exception. Adding PostgreSQL is justified by the hard monetary/concurrency invariant; the existing eventually consistent Redis is retained for existing clients but is not selected as the financial authority. No Supabase project is provisioned. If future authorization selects Supabase, provision only directly in the maintainer’s existing Supabase organization (identifier kept in private provisioning configuration), never via Vercel Marketplace.


## Current implementation status — 2026-11-06

The drafting and proposed-path statements above are preserved as historical design context. Current branch: `codex/003-aquinas-apologetic-qa`. Implementation tasks T001–T030 are marked complete and checkpointed in `f9b25dd`; T031 selection review and T032 authorized verification remain pending. Application modules and acceptance entry points now exist. Implementation completion does not establish acceptance, live quality, operational activation readiness or deployment authorization. The private agreed acceptance plan and its dated amendments govern evidence; the original $0.50 E5 budget was amended to $0.70 on 2026-11-04.


## Draft PR checkpoint — 2026-11-06

The local implementation and verification corrections are ready for code review. SpecGuard selection and verification activities T031–T032 have been performed. The initial attempt failed migration loading and two isolation assertions; the authorized follow-up corrected SQL CASE parsing, bound rate spies to their store, and made constructor-only origin injection explicit. All seven enabled checks passed in the second attempt, including PostgreSQL and all 112 server regression tests. Paid live evaluation was disabled, so the overall runner result was skipped rather than all-passed. Private configurations, decisions, source bundles and raw evidence remain outside this repository.

Feature acceptance and activation remain blocked on live bilingual review, omitted acceptance cases and operational evidence. This draft does not authorize deployment or activation. The default corpus and price manifests remain disabled/incomplete. See tasks.md for the remaining acceptance work.
