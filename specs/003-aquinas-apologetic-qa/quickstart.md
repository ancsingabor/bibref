# Q&A Setup and Validation Guide

This guide describes the target after implementation. Q&A files/commands below do not exist yet; planning did not install packages, provision services, import source text, execute checks, or call a provider. Do not treat these commands as current working scripts or execution approval.

## Preconditions and approval boundaries

1. Run `$speckit-tasks` to generate implementation tasks from this design. Mandatory SpecGuard prepare must agree the finite acceptance set and stopping rule before implementation.
2. Prepare an isolated `VERIFY_ROOT` application copy and fresh `PRIVATE_ROOT` outside public checkouts. Preserve existing private configuration/evidence. Record runtime, source and dependency fingerprints in the separate setup record.
3. Use disposable PostgreSQL and isolated Redis with unique fixture namespaces; no shared-service flushing. Test configuration uses fake provider and synthetic approved-for-fixture corpus. Existing application native manifest/bin prerequisites remain as documented in `server/README.md`.
4. Live source evaluation additionally requires approved corpus serving/use basis, exact source hashes and bilingual expected-answer review, dedicated provider key, current reviewed price/token manifest, canonical HTTPS origin and durable shared PostgreSQL. No new Supabase project is created here; any later authorized creation must be directly in the maintainer’s existing Supabase organization (identifier kept in private provisioning configuration).
5. Exact final commands/environment/private paths, fixtures and network/paid use must be selected and explicitly approved through SpecGuard review. A plan is not that approval. No deployment is included.

## Configuration contract

Existing terminal configuration remains unchanged. Planned Q&A settings:

- `BIBREF_QA_ENABLED=0` by default; require literal `1` and complete valid activation configuration to enable.
- `BIBREF_QA_ORIGIN`: exact canonical HTTPS origin; other deployments link to it and deny local paid endpoints.
- `BIBREF_QA_DATABASE_URL`: private PostgreSQL primary/TLS connection, never a public browser variable; fixture database uses a separate unique schema/role.
- `BIBREF_QA_COOKIE_SECRET`, `BIBREF_QA_BINDING_SECRET`, `BIBREF_QA_RECEIPT_KEY`: separate strong private keys with explicit key versions. Do not place secrets in command arguments, screenshots, tracked files or logs.
- `BIBREF_QA_PROVIDER_KEY`: dedicated feature-only provider credential, available only to server provider transport.
- `BIBREF_QA_CORPUS_PATH`, `BIBREF_QA_PRICE_PATH`: server-only validated manifest/bundle paths, never user-supplied URLs.
- Local test helpers inject fake transport/clock/corpus through constructors, not an unsafe remotely switchable production mode. No test host can use the live provider key.

Secrets are populated via the separately authorized environment mechanism, not printed by this guide. Loading disabled/missing Q&A config must leave terminal startup intact. Price manifest expires <=24h; updating it is a reviewed operating action, not an automatic monthly top-up.

## Proposed post-implementation commands

Commands run from `VERIFY_ROOT/server` unless otherwise noted. They are target entry points for implementation, not claims that those files already exist. Dependency preparation (`npm ci`), schema migration and corpus import belong to separately approved setup, not a hidden final test preflight. Docker/local service lifecycle must be prepared separately without changing the operator’s existing services.

```sh
# E1: deterministic API, source, provider and privacy fixtures
node --test test/qa-api.test.js test/qa-evidence.test.js test/qa-provider.test.js test/qa-service.test.js

# E2: disposable PostgreSQL; QA_TEST_DATABASE_URL is supplied privately
node --test test/qa-integration/store.mjs

# E3: fixture-only local app; requires installed Chromium
node test/qa-browser.mjs

# E4: existing regression suite and compatibility/usage checks
npm test
python3 test/python-compat.py
node test/usage-browser.mjs
```

The implementation must preserve existing test discovery: fake Q&A tests can join `npm test`, but live provider calls and real PostgreSQL integration tests never do. Keep the latter outside `test/*.test.js`, using the explicit E2 path above. PostgreSQL integration cases require the isolated test URL and fail clearly when selected without it; they must not silently skip and report success. The final selection may use an explicit existing-test file list instead of repeating Q&A tests through npm test, with exact discovery frozen in private review. The Python compatibility script requires Python and uses a fake engine/stubbed bridges; it is synthetic compatibility coverage, not real-engine/native-corpus acceptance.

Offline source import command, from the repository root after importer implementation:

```sh
python3 server/scripts/build-aquinas-corpus.py --source /absolute/approved/source.txt --manifest /absolute/approved/manifest.json --output /absolute/private/qa-corpus
```

Expected: fail on unclassified article roles, invalid references/offsets, source checksum mismatch or missing rights metadata. Output is an immutable private bundle plus index/provenance, not public browser assets. Synthetic fixture mode is explicit and cannot satisfy production approval.

A proposed private live runner entry point is `node test/qa-live.mjs --cases /absolute/private/frozen-cases.json --evidence /absolute/private/new-attempt-directory --adapter /absolute/private/reviewed-adapter.mjs`; it is not a default npm script. It must preflight <=70 operations, <=140 calls and <=$0.70 maximum reservation under active rates, then use the same shared $10 ledger and daily/concurrency limits. Never simulate many browsers on public production to bypass controls. If 60 required cases cannot run under the three-response/day identity limit in the approved fixture/evaluation topology, schedule them across approved controlled browser identities/days with explicit review; no hidden quota override. No runner execution is authorized here.

## Expected observations

Use [API](contracts/qa-api.md), [evidence/provider](contracts/evidence-provider.md), [verification inventory](contracts/verification.md) and [data model](data-model.md) as the source of exact expected outcomes:

- Language selection required; supported hu/en answers cite correct article roles, source quotes match, translations labeled; insufficient support abstains.
- Concurrent admission/settlement preserves all monthly/day/active invariants, including lost commits, late results and rollover.
- Hostile question/source/provider text cannot trigger actions, arbitrary network access, script execution, credential disclosure or prompt logging.
- Provider/DB failures end safely; uncertain execution retains money and capacity without retry. Missing infrastructure/config returns Q&A unavailable and preserves terminal use.
- Canonical origin owns identity; other deployments link there. Existing session/native/Python boundaries and quotas are unchanged.

Record outcomes and limitations once in the private evidence set. Live bilingual semantic review and cloud durability/retention configuration require their own evidence; local fixtures cannot supply it. Complete one bounded final assessment and stop, including on failures or missing prerequisites. No automatic remediation, rerun, paid escalation, provisioning or deployment.

### Activation evidence

Before requesting authorization, attach privately reviewed corpus serving rights
and source checksums, canonical HTTPS and trusted proxy configuration, provider
request-wrapper and rate bounds, and database acknowledged-write durability.
The restore drill must demonstrate a disabled new epoch and reconciliation of
financial records before reactivation. Record provider retention and confirm
prompt/body logging is disabled throughout the request path.

GPT-5.4 mini uses the pinned snapshot and tokenizer documented in research.
The private live-run adapter and frozen case set must establish enforced
per-case limits and the shared-ledger topology before the attempt is selected.
Do not raise the approved evaluation cap to accommodate the model change.


### Proposed E1 corpus regression

Include `python3 test/qa-corpus.py` from the `server` directory in the proposed
E1 selection within its existing 180-second budget. The regression checks the
checksum-bound q19 correction, preservation of the printed heading, and
rejection of unrecognized duplicate locators. Execution requires the separate
SpecGuard selection and one-attempt authorization.


## Current implementation status — 2026-11-06

The drafting and proposed-path statements above are preserved as historical design context. Current branch: `codex/003-aquinas-apologetic-qa`. Implementation tasks T001–T030 are marked complete and checkpointed in `f9b25dd`; T031 selection review and T032 authorized verification remain pending. Application modules and acceptance entry points now exist. Implementation completion does not establish acceptance, live quality, operational activation readiness or deployment authorization. The private agreed acceptance plan and its dated amendments govern evidence; the original $0.50 E5 budget was amended to $0.70 on 2026-11-04.


## Draft PR checkpoint — 2026-11-06

The local implementation and verification corrections are ready for code review. SpecGuard selection and verification activities T031–T032 have been performed. The initial attempt failed migration loading and two isolation assertions; the authorized follow-up corrected SQL CASE parsing, bound rate spies to their store, and made constructor-only origin injection explicit. All seven enabled checks passed in the second attempt, including PostgreSQL and all 112 server regression tests. Paid live evaluation was disabled, so the overall runner result was skipped rather than all-passed. Private configurations, decisions, source bundles and raw evidence remain outside this repository.

Feature acceptance and activation remain blocked on live bilingual review, omitted acceptance cases and operational evidence. This draft does not authorize deployment or activation. The default corpus and price manifests remain disabled/incomplete. See tasks.md for the remaining acceptance work.
