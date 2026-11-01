# Feature Specification: Strengthen hosted-server verification

**Feature Branch**: `feat/server-web-vercel` (specification only; no branch hook registered)

**Created**: 2026-11-01

**Status**: Draft — awaiting maintainer review; implementation not authorized

**Input**: Strengthen hosted-server verification with at most three new or materially
improved check groups selected from concrete risk/coverage gaps. Reuse existing
coverage, document claims and limits, and require bounded evidence agreement and
separate execution approval before one final SpecGuard attempt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review checks selected by risk (Priority: P1)

As maintainer, I can see which hosted trust boundaries need stronger evidence and
why each selected group earns its place within a three-group limit.

**Why this priority**: Ownership and process boundaries protect private session
state; broad test growth does not by itself establish those protections.

**Independent Test**: Review each group's source-backed gap, claim, negative and
positive cases, and limitations without executing any checks.

**Acceptance Scenarios**:

1. **Given** existing coverage, **When** groups are selected, **Then** each maps to
   a concrete gap and requirement rather than asserting that missing tests prove a bug.
2. **Given** an unauthorized request, **When** ownership checks are exercised later,
   **Then** evidence addresses both denial and absence of execution or protected state changes.
3. **Given** an authorized valid request or valid native response, **When** checks
   run later, **Then** positive controls distinguish rejection of bad cases from universal failure.

### User Story 2 - Agree bounded evidence before implementation (Priority: P1)

As maintainer, I agree a finite requirement-linked evidence plan and stopping rule,
then separately decide whether a concrete execution is allowed.

**Why this priority**: Setup and network access must not silently become permission
to run application checks or expand verification indefinitely.

**Independent Test**: Inspect plan agreement, isolated dependency preparation record,
and execution decision as three distinct records.

**Acceptance Scenarios**:

1. **Given** no agreed evidence plan, **When** implementation is proposed, **Then**
   preparation stops and records missing agreement.
2. **Given** dependencies are prepared, **When** execution is considered, **Then**
   exact checks, baseline, environment, network use, time/output budgets and fresh
   private destinations still require concrete approval.
3. **Given** dependency auditing uses an advisory service, **When** approval is
   requested, **Then** the service and dependency metadata sent are disclosed first.

### User Story 3 - Receive an honest final assessment (Priority: P2)

As maintainer, I receive one final attempt record and a bounded assessment that
supports a closure decision without replacing my acceptance.

**Why this priority**: Failures, incomplete evidence and uncertainties must remain visible.

**Independent Test**: Review a simulated incomplete or failed record against the
assessment requirements without running the application.

**Acceptance Scenarios**:

1. **Given** an approved final attempt, **When** it passes, fails, times out or is
   interrupted, **Then** its outcomes are preserved and no automatic retry or repair follows.
2. **Given** additional findings, **When** assessment is written, **Then** each is
   classified with rationale and a concrete revisit trigger; observations and agent
   judgments remain separate.
3. **Given** missing required evidence, **When** closure is assessed, **Then** the
   recommendation is blocked with reasons, and maintainer acceptance stays separate.

### Edge Cases

- A different valid owner must be denied, not just a request without any cookie.
- Expired, malformed and tampered cookies must not establish ownership; denial
  must not expose another owner's state or receipt.
- Absent, foreign and null origins, wrong content types, malformed/oversized JSON,
  invalid identifiers, unsafe revisions, embedded NUL and multibyte size boundaries
  need explicit expected outcomes and positive boundary controls.
- Native output may arrive in split chunks or multiple lines, contain unknown or
  fatal events, omit completion, leave trailing partial data, or fail to spawn.
- Duplicate or structurally unexpected terminal records require a documented
  protocol expectation before adding an assertion; current acceptance is not proof of safety or a bug.
- Setup failure, unavailable isolated services, changing advisory data or partial
  attempt evidence must be reported as such, never silently converted to success.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Select no more than three new or materially improved check groups,
  using the three groups below. Each MUST document the risk, source-backed gap,
  observable claim, positive control, limitations and requirement mapping.
- **FR-002**: Group G1 MUST strengthen HTTP ownership coverage across session
  reads/deletion, command submission/receipts/cancellation, context lookup and
  enabled Python run operations/receipts/end. Exercise another valid owner and
  missing/invalid ownership; establish denial without protected data disclosure,
  unauthorized runner calls or changes to the target state, history or active work.
- **FR-003**: Group G2 MUST strengthen cookie, origin and input boundaries. Cover
  the edge cases above, issued cookie protections under local and secure-request
  contexts, sanitized error responses, and valid request controls. Rejection cases
  MUST establish no native execution or protected state mutation. Expectations
  MUST follow documented contracts; ambiguous behavior is recorded for review.
- **FR-004**: Group G3 MUST strengthen hosted native-process protocol/error
  coverage: valid split/coalesced framing, unknown/fatal events, incomplete output,
  missing completion, spawn failure and error propagation. Reuse crash, deadline,
  cancellation, output-limit and credential-isolation coverage. Verify relevant
  failure categories and preservation of the preceding saved state through the
  hosted integration boundary; do not assert unsupported native protocol rules.
- **FR-005**: Reuse existing server/store, Python compatibility/API, browser and
  dependency-audit coverage as supporting evidence with explicit omissions. These
  reused checks do not create extra improvement groups. Add no scanner, broad lint
  framework or replacement suite. Document what each reused check actually establishes.
- **FR-006**: Before implementation, use SpecGuard preparation to obtain agreement
  on a finite requirement-linked evidence set, check/review counts, time/output
  budgets, permitted omissions and stopping rule. Every requirement MUST map to
  evidence or an explicit gap; required gaps block closure. This spec is not that agreement.
- **FR-007**: Prepare isolated local test dependencies as a separate, recorded
  prerequisite phase. Record versions, local service endpoints/namespaces, setup
  network needs and cleanup ownership; use no production credentials, shared
  production services or Redis flush. Setup grants no check-execution approval.
- **FR-008**: Before executing checks, obtain explicit approval of the exact
  selection, baseline, context, budgets, network access and fresh private evidence
  destinations. Dependency auditing MUST disclose advisory-service network use
  and transmitted dependency metadata. No automatic dependency upgrades are allowed.
- **FR-009**: After implementation, use SpecGuard for one final approved attempt
  and one bounded artifact assessment, then stop on every outcome. Preserve pass,
  fail, timeout, interruption, unavailable and not-run outcomes without rewriting
  prior evidence, automatic retry, remediation or execution beyond approval.
- **FR-010**: Assessment MUST distinguish deterministic observations (commands,
  versions, outcomes, evidence references) from agent judgments (claim sufficiency,
  limitations and risk). Map each agreed requirement once; classify additional
  findings as blockers, accepted limitations or deferred improvements, with rationale
  and revisit triggers. Record lessons and recommend “good enough to close” or
  “blocked”; a recommendation does not constitute maintainer acceptance.
- **FR-011**: Exclude native CLI/Qt/WASM expansion, production scanning,
  deployment, automatic upgrades and unrelated application remediation. Any
  demonstrated application defect is recorded for a separate authorized decision;
  this feature strengthens verification, not application behavior.

### Key Entities

- **Check group**: bounded risk area, gap, cases, observable claims and limitations.
- **Evidence plan**: agreed requirements baseline, finite evidence budget, omissions
  and stopping rule; distinct from execution authorization.
- **Setup record**: isolated dependency/service state and setup network activity.
- **Attempt and assessment**: immutable observed outcomes, separate judgments,
  finding classifications/triggers, lessons and closure recommendation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Between one and three improved groups are delivered; 100% have a
  concrete gap, requirement mapping, positive control, claim and stated limitation.
- **SC-002**: Every selected denial/failure case records its expected outcome and
  applicable evidence that protected state or execution was not affected.
- **SC-003**: 100% of agreed requirements have evidence or a disclosed gap;
  zero missing required evidence items are represented as passing.
- **SC-004**: Implementation begins only after recorded evidence-plan agreement;
  all executed checks fall within a separate concrete approval, including network use.
- **SC-005**: Exactly one final authorized attempt and at most one bounded
  assessment occur; all nonpassing outcomes remain visible and no automatic retry occurs.
- **SC-006**: The final review contains findings with revisit triggers, lessons,
  explicit limitations and one closure recommendation, with acceptance reserved to the maintainer.

## Assumptions

- This is a new feature following `001-hosted-server-verification`; that workflow
  baseline remains intact. Constitution 1.0.0 applies without amendment.
- This invocation creates specification artifacts only. It does not install
  dependencies, audit dependencies, run application checks, agree evidence or authorize implementation.
- G1–G3 are the selected improvement areas. Exact case counts, commands, protocol
  expectations and supporting regression selection are bounded during planning and
  agreed before implementation; no unresolved principle is assumed.
- Python remains disabled by default; enabled-path checks use isolated local fixtures.
- Existing private configuration/evidence remains unchanged; later evidence belongs
  outside the public checkout in fresh approved locations.

## Selection Rationale and Existing Coverage

Source inspection only, on 2026-11-01; no tests or audits executed and no current
pass/fail or vulnerability claims made.

- **G1 — HTTP ownership (FR-002):** `server/test/app.test.js` tests missing-cookie
  read denial and another browser's session read denial; `python-api.test.js` tests
  a missing-cookie operation denial. Coverage is narrower than the route surface
  in `app.js`, `context-api.js` and `python-api.js`. The improved group establishes
  sampled route-level isolation and absence of side effects. It does not prove
  all authorization paths, concurrency schedules or deployment behavior safe.
- **G2 — Cookie/origin/input boundaries (FR-003):** `app.test.js` covers missing
  origin on creation, foreign origin on activity, oversized commands and selected
  context inputs; `python-api.test.js` covers operation validation. Cookie expiry,
  signature/shape, issued attributes and broader parser/boundary cases lack an
  explicit matrix in these tests. Improved evidence establishes local boundary
  behavior, not browser-policy enforcement or reverse-proxy configuration in production.
- **G3 — Native protocol/errors (FR-004):** `engine.test.js` covers valid output,
  crash, non-JSON output, output limits, timeout, cancellation and two credential
  sentinels. Its fixture does not deliberately exercise split/coalesced framing,
  fatal/unknown records, incomplete completion or spawn failure. Improved fixtures
  establish adapter behavior and hosted failure preservation; they do not establish
  correctness of real corpus results or every operating-system process failure.
- **Reused supporting coverage (FR-005):** `store.test.js` supports state/admission
  invariants; `python-api.test.js` and `python-compat.py` support operation boundaries
  and wrapper contracts, not arbitrary Python safety or native numerical correctness.
  Existing browser entrypoints support actual UI/runtime flows only in the browsers
  and fixtures exercised; mocked runners are not native acceptance. Reuse focused
  coverage rather than adding a new browser suite.
- **Existing dependency audit (FR-005/008):** `.github/workflows/server.yml` already
  invokes `npm --prefix server audit --omit=dev`. Reuse it if approved, disclose its
  advisory-service network request, and record tool/version/time/scope. It reports
  known advisories for that dependency scope and time, excludes development-only
  dependencies, and proves neither exploitability nor absence of vulnerabilities.
