---
description: "Implementation tasks for Hosted Aquinas Apologetic Q&A"
---

# Tasks: Hosted Aquinas Apologetic Q&A

**Input**: [Spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [quickstart](quickstart.md)
**Tests**: Required by FR-019 and SC-001–008. Write contract cases before implementation. Run application checks only in the agreed and explicitly approved SpecGuard selection.
**Paths**: Repository-relative. Each story has its own fixture oracle.

## Phase 1: Setup

- [X] T001 Invoke mandatory SpecGuard prepare and obtain agreement on the finite cases, budgets, private evidence location and stopping rule in `specs/003-aquinas-apologetic-qa/contracts/verification.md` before implementation.
- [X] T002 Pin the PostgreSQL driver and reviewed local tokenizer in `server/package.json` and `server/package-lock.json`. Preserve default test discovery and keep live and PostgreSQL integration suites opt-in.
- [X] T003 [P] Create synthetic article, fake transport and clock fixtures in `server/test/fixtures/qa/` with hu/en cases, collective replies and poisoned text. Keep them ineligible for hosted activation.

## Phase 2: Foundation

- [X] T004 [P] Implement default-disabled activation and versioned price configuration in `server/qa/config.js` and `server/qa/prices.json`. Require canonical HTTPS origin, approved corpus, schema and epoch agreement, separate server secrets and reviewed prices expiring within 24 hours. Fail closed if any bound is missing.
- [X] T005 [P] Implement private schema and least-privilege roles in `server/qa/migrations/001-qa.sql`. Establish one Control row, text-free financial records, original UTC periods, integer nano-USD and checks for “nonnegative values, fixed ceiling <=$10, `reserved+settled<=ceiling`.” Enforce unique operation and stage keys, “completed+reserved<=3, unique active browser,” and language `hu|en`.
- [X] T006 [P] Define localized errors and fixed labels in `server/qa/i18n.js` and injectable fixture server construction in `server/test/qa-local-server.mjs`. Keep transport and clock overrides constructor-only.

## Phase 3: User Story 1 — Receive a grounded bilingual answer (P1)

**Independent test**: Using a fake provider and isolated admission double, submit supported and unsupported questions in both languages. Check explicit selection, exact quotes, article roles, translation labels and abstention.

### Tests

- [X] T007 [P] [US1] Write evidence/provider contract fixtures in `server/test/qa-evidence.test.js` for wrong edition/hash, invalid Unicode spans, objection reversal, collective replies, absent context, withdrawn corpus and unsupported claims.
- [X] T008 [P] [US1] Write the fixture browser flow against the fixture API adapter from T012 in `server/test/qa-browser.mjs` for language selection, switching, original quotations, source expansion, labels, partial answers and abstention.

### Implementation

T009 was reopened for the selected Gutenberg edition and is complete for the private E5 bundle. The bundle contains 181 articles. The unmatched reply in ST.I.q24.a1 remains excluded pending source review. See research.md.

- [X] T009 [P] [US1] Build the offline importer in `server/scripts/build-aquinas-corpus.py` and manifest shape in `server/qa/corpus/manifest.json`. Enforce rights status `fixture|approved|disabled`, allowlist, source and topic hashes, edition/notices, complete article roles `objection|sed_contra|respondeo|reply`, valid reply references, “<=8 MiB for the initial allowlist” and “<=256 KiB” per served article.
- [X] T010 [P] [US1] Implement lexical retrieval and reviewed hu/en aliases in `server/qa/retrieval.js` and `server/qa/corpus/topics.json`. Use at most three packs and drop packs whose required main answer or replies cannot fit.
- [X] T011 [P] [US1] Implement evidence validation and safe composition in `server/qa/evidence.js`. Require “start/end Unicode code-point offsets into the immutable section text (half-open),” valid hashes and roles, at most six claims, twelve citations and three translations, and verdicts `supported|unsupported|unknown` for each item. Slice original text and withhold unsupported prose.
- [X] T012 [US1] Build fixture-driven retrieval, generation and separate verification orchestration in `server/qa/service.js` using injected admission and provider interfaces. Abstain on weak evidence, invalid attribution or failed semantic checks. Commit verified output before display. Add a fixture-only API adapter in `server/test/qa-local-server.mjs` for metadata, tickets, submissions, receipts and source inspection, using the production contract shapes. T008 can be authored in parallel and runs against this adapter after T012 and T013.
- [X] T013 [US1] Implement standalone selection, answer display and article inspection in `server/public/qa.html`, `server/public/qa.js` and `server/public/qa.css`. Render plain text with explicit attribution, synthesis and generated translation labels.

## Phase 4: User Story 2 — Keep shared use affordable and fair (P1)

**Independent test**: Use two fixture servers against one disposable PostgreSQL ledger. Race near the monthly ceiling, replay duplicate requests and cross UTC boundaries while observing fake dispatch counters.

### Tests

- [X] T014 [P] [US2] Write the accounting contract suite in `server/test/qa-integration/store.mjs` for 50 concurrent requests, ten same-browser requests, exact fit and overflow, rollover, uncertain commits, stale fences, duplicate settlement, crash and reconciliation.
- [X] T015 [P] [US2] Write operation lifecycle cases in `server/test/qa-service.test.js` for idempotent dispatch, known and unknown failures, disconnects, late completion and timeout without an unreserved retry.

### Implementation

- [X] T016 [US2] Implement atomic admission in `server/qa/store.js` under a Control-first lock. Reserve the full two-stage cost, daily slot, receipt and occupancy together. Enforce “10,000,000,000 units ($10),” one active operation per browser and two globally. Use database UTC time and reject missing control or ambiguous commit state.
- [X] T017 [US2] Add fenced dispatch and settlement in `server/qa/store.js`. Use stages `generation|verification` and states `prepared|sent|confirmed|uncertain`. Preserve original-period accounting and withhold refunds and capacity release until supported by confirmed evidence. Halt before unresolved browser identity expires.
- [X] T018 [US2] Add owned encrypted receipts and cleanup in `server/qa/store.js`. Apply “64 KiB” per receipt and “at most 1,000 receipt slots (64 MiB worst-case).” Expire completed payload/binding at 24 hours, uncertain binding by admission +24 hours and browser data at “UTC day start +48 hours.” Preserve text-free tombstones and fence restore.
- [X] T019 [US2] Connect the ledger to `server/qa/service.js` and add receipt recovery and limit states in `server/public/qa.js`. Make a committed fence the only path to each send. Report uncertain outcomes without replaying a dispatch.

## Phase 5: User Story 3 — Handle hostile input and unavailable dependencies (P1)

**Independent test**: Exercise forged origin and ownership, poisoned content, hostile destinations, malformed provider output, secret sentinels and accounting outages using fake transport.

### Tests

- [X] T020 [P] [US3] Write the API contract suite in `server/test/qa-api.test.js` for origin and cookie denials, replay ownership, malformed JSON, Unicode limits, rolling network windows across midnight and safe localized errors.
- [X] T021 [P] [US3] Write transport and privacy contract tests in `server/test/qa-provider.test.js` for injection, redirects, DNS rejection, oversized bodies, refusal, malformed schema, deadline, token exhaustion and forbidden logging.

### Implementation

- [X] T022 [P] [US3] Implement fixed-endpoint bounded transport in `server/qa/provider.js`. Enforce input allocations 7,000 and 5,000, output allocations 1,200 and 300, 1 MiB upstream body per call, 30/20-second stage limits and 60 seconds overall. Include wrapper tokens, reserve reviewed worst-case rates, disable storage/tools/retries/redirects, block unsafe destinations and sanitize errors.
- [X] T023 [US3] Implement `/api/qa/meta`, ticket issuance, question submission, owned receipts and source inspection in `server/qa/api.js`. Require exact canonical origin, signed host-only HttpOnly identity and 15-minute ticket. Enforce NFC, “<=4,000 Unicode code points and <=16,000 UTF-8 bytes,” no NUL and 20 KiB JSON. Bind language, question and corpus and serve only approved locators.
- [X] T024 [US3] Add the atomic network window in `server/qa/store.js` and wire it in `server/qa/api.js`. Enforce “60-second sliding window of submission timestamps, at most ten,” include both HMAC keys across rotation and “Expire within 24 hours.” Derive addresses only through trusted proxy hops.
- [X] T025 [US3] Harden the complete request path in `server/qa/api.js`, `server/qa/service.js` and `server/public/qa.js`. Enforce no-store, owned safe receipt responses, text-only rendering, category-only telemetry and safe failure within 65 seconds.

## Phase 6: User Story 4 — Preserve existing workflows (P2)

**Independent test**: Compare existing terminal and Python behavior with Q&A disabled, enabled under fixtures, exhausted and failing. Review native and WASM defaults against the baseline.

### Tests

- [X] T026 [P] [US4] Extend `server/test/app.test.js` and `server/test/qa-browser.mjs` with startup isolation, canonical link, unchanged terminal request quotas and session state, and failure isolation. Reuse the existing Python compatibility and usage suites.

### Implementation

- [X] T027 [US4] Wire optional dependencies and canonical routing in `server/index.js` and `server/app.js`. Mount Q&A behind shared security middleware outside terminal rate buckets. Preserve default Python setting and native subprocess credential isolation.
- [X] T028 [US4] Package only approved private corpus inputs in `Dockerfile.vercel` and document disabled startup and isolated operation in `server/README.md`. Review build and module diffs against the constitution.

## Phase 7: Polish and cross-cutting concerns

- [X] T029 [P] Implement the opt-in runner in `server/test/qa-live.mjs` using frozen private cases, the same ledger, <=70 operations, <=140 provider calls and <=$0.70 reserved. Keep it outside default discovery.
- [X] T030 [P] Document receipt, backup, provider retention and reconciliation procedures in `server/README.md`. Record evidence requirements for rights, canonical HTTPS, durable commits, restore fencing and provider bounds in `specs/003-aquinas-apologetic-qa/quickstart.md`.
- [X] T031 Prepare the concrete private SpecGuard review selection using `specs/003-aquinas-apologetic-qa/contracts/verification.md`. Obtain approval of the exact selection, including commands, fixtures, environment and any paid provider use. Record a separate explicit decision authorizing execution of that selection for one attempt.
- [X] T032 Dispatch mandatory SpecGuard verify for the approved selection, using `specs/003-aquinas-apologetic-qa/quickstart.md` and the frozen private evidence plan. Record one bounded assessment and stop on every outcome. Missing required evidence blocks activation. Deployment requires explicit authorization.

## Dependencies and execution order

Setup → Foundation → story work → integrated review and verification. US1 can use a fake admission/provider, US2 a fake provider, and US3 a fixture service. US4 can develop regression cases independently. Complete T012 before T019, T016–T018 before T024, T019 and T022–T025 before T027, and T027 before T028. T031 follows implementation and acceptance-runner preparation. T032 requires both T031 decisions and executes through the hook once. Selection-only approval leaves execution pending.

### Parallel opportunities

- US1: T007 and T008 write separate suites. T009–T011 use separate modules against the frozen evidence contract.
- US2: T014 and T015 cover storage and service independently. Ledger mutations T016–T018 are sequential.
- US3: T020 and T021 can be authored together. Transport T022 is independent of route code.
- US4: T026 can overlap foundationally independent story work but waits for T008 before changing the same browser suite. T027 follows the route and service integration.

## Implementation strategy

Start with US1 as a fixture-only MVP, then demonstrate accounting and hostile-input handling independently. Enable real provider dispatch only after the three P1 stories, compatibility checks and operational gates pass. Finish with the agreed finite verification attempt. PostgreSQL provisioning, if separately authorized through Supabase, is direct in the maintainer’s existing Supabase organization (identifier kept in private provisioning configuration).

## Notes

[P] marks separate-file work that can proceed once its prerequisites are complete. Acceptance scripts and cases are implementation deliverables. Execution, evidence assessment and release follow the constitution and SpecGuard workflow.


## Acceptance follow-up — 2026-11-06

T031–T032 record completed review/execution activities, not acceptance. The first bounded attempt failed; the explicitly authorized additional attempt passed all seven enabled local checks with paid E5 disabled/skipped. Both attempts and their decisions/assessments are retained privately. No release criteria have been waived.

- [ ] T033 Reconcile the agreed acceptance inventory against implemented cases and complete missing accounting/expiry/crash/quota, hostile-input and browser recovery/limit cases. Keep real PostgreSQL and paid checks outside default discovery.
- [ ] T034 Prepare the private live-evaluation prerequisites: authorized corpus use, frozen bounded cases and reviewed adapter, provider/token/pricing envelope within the agreed $0.70 cap, controlled identities and competent Hungarian/English Aquinas reviewer. Do not execute provider calls during preparation.
- [ ] T035 Review the exact remaining selection and obtain explicit additional-attempt authority with fresh private paths and an agreed additional-attempt budget; perform only that bounded selection and assessment, stopping on every outcome.
- [ ] T036 Establish operational activation evidence: corpus serving rights, canonical origin/proxy, shared durable ledger and restore fencing, provider retention/credentials, and receipt/backup retention. Keep actual identifiers, secrets and private records outside the public repository.
- [ ] T037 Compare all required evidence with the preserved agreed criteria and record the maintainer’s actual acceptance decision. Missing/adverse evidence blocks closure; deployment/activation require separate authorization.
