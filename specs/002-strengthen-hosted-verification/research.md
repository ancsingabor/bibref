# Research: Hosted verification boundaries

Local source inspection only, 2026-11-01, baseline `55f37d22994d52852eef9fa73596697f7126c404`.
No checks or network operations were performed. Decisions are design judgments,
not observed test results or claims of vulnerabilities.

## 1. Reuse fixtures and observe side effects

**Decision**: Extend app.test.js/python-api.test.js with explicit request headers,
two independently issued valid owners, controlled invalid cookies, runner counters
and before/after target snapshots. Use valid payloads when isolating ownership.

**Rationale**: app.js gates ownership in individual handlers; missing cookies alone
do not establish cross-owner enforcement. Rate accounting/cookie renewal can be
legitimate effects. Compare protected session/run state, history and active work,
not total absence of any Redis write. For successful failure recording, compare
clipboard/settings separately from receipt/revision metadata.

**Alternatives considered**: New authorization scanner or broad browser matrix
would duplicate infrastructure and obscure deterministic state observations.

## 2. Boundary oracles derive from existing contracts

**Decision**: Check 404 ownership denials, 403 invalid origins, 415 wrong content
format, 400 malformed JSON/invalid command, 413 parser size limit, and documented
cookie attributes. Use raw body/header controls alongside normal valid requests.

**Rationale**: app.js middleware applies origin/content-type before JSON parsing;
invalid identifiers/payloads can fail before ownership. Keep each failure dimension
isolated. Test proxy-derived secure behavior only as a local simulated context,
not as evidence about production proxy trust configuration.

**Alternatives considered**: Inferring a vulnerability from validation order or
extra cookie fields is unsupported. Unexpected behavior gets a finding and review,
not an invented stricter contract or an application fix in this feature.

## 3. Native protocol and error coverage

**Decision**: Expand existing executable fixture in engine.test.js with explicit
writes for split lines and coalesced lines; test unknown/fatal events, missing
completion, partial trailing data and nonexistent executable. Drive selected actual
executeNative failures through createApp to verify public errors/state retention.

**Rationale**: engine.js currently maps unknown events/non-JSON to engine_protocol,
fatal to engine_error, missing result/trailing data to engine_crash, spawn errors
to engine_unavailable. Stream chunk boundaries are transport details; fixture
writes cannot guarantee OS read chunk boundaries. Tests must establish accepted
incremental framing without claiming exhaustive fragmentation coverage.

**Alternatives considered**: Adding schema rejection for duplicate results or
unexpected result fields would define new application behavior. Record these as
bounded review findings with triggers, unless a documented contract resolves them.
No native source/CLI expansion or real module corpus execution is needed here.

## 4. Supporting coverage and dependency audit

**Decision**: Reuse npm test, Python compatibility, usage-browser and three-engine
Python-runtime-browser plus existing npm audit --omit=dev. Browser coverage remains
mocked/local. Omit full Docker native corpus acceptance, production checks, and
additional broad browser scripts from this bounded proposal.

**Rationale**: .github/workflows/server.yml already names these checks; Python
compatibility uses a fake engine, runtime browser uses a mocked operation bridge,
and usage browser uses a fake runner. They establish contracts/UI behavior rather
than native numerical correctness or isolation of arbitrary user Python.

**Alternatives considered**: Re-running full Docker acceptance expands cost and
claims beyond changed tests. A new scanner adds no justified coverage here.
Audit is time-dependent known-advisory information, not exploitability proof.

## 5. Isolated setup and approval lifecycle

**Decision**: Later prepare a clean local verification copy from the reviewed
baseline plus explicitly enumerated pending changes. Install lockfile dependencies
there with audit disabled, isolated caches/services and browser binaries; obtain
setup authorization separately. Build/locate SpecGuard during setup, never verify.

**Rationale**: Existing private specguard.json/evidence must not be overwritten.
Candidate config, evidence and installation records need fresh destinations.
Final review fingerprints actual installed dependencies/runtime and scripts;
lockfile equality alone is insufficient. Audit network use must be explicitly
approved before the single final attempt. Exact registry/metadata disclosure is
established from installed npm configuration/source during review without auditing.

**Alternatives considered**: Installing into the active checkout risks altering
existing dependencies. Automatically running npm install's audit would mix setup
and check execution. Reusing an old approval/evidence record lacks provenance.
