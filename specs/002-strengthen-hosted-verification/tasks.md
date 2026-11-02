# Tasks: Strengthen hosted-server verification

**Input**: `specs/002-strengthen-hosted-verification/` design artifacts.
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/verification.md, quickstart.md.
**Tests**: Explicitly requested; tests are the deliverable. No runtime behavior changes.
**Status**: Generated only; no task below has been executed or approved by generation.

## Format and Paths

Tasks use `- [ ] Tnnn [P?] [USn?] description with path`.
Repository paths are relative to the application root. `PRIVATE_ROOT` means a
maintainer-selected absolute directory outside public checkouts; `VERIFY_ROOT`
means the separately authorized isolated copy. They are role names, not executable
shell values: resolve actual paths in T001 before creating records. Never write
private records under this feature directory or overwrite existing specguard.json.

## Phase 1: Setup — Define Scope Without Execution

**Goal**: Establish record destinations and a finite inventory without installation or checks.

- [X] T001 Resolve fresh absolute PRIVATE_ROOT and VERIFY_ROOT destinations with the maintainer and document scope, existing-evidence preservation and cleanup ownership in PRIVATE_ROOT/setup-record.md; enforce “No setup audit; no production endpoints; no assumed availability”.
- [X] T002 Build the finite case inventory in PRIVATE_ROOT/case-inventory.md from specs/002-strengthen-hosted-verification/contracts/verification.md: 40 G1 cases, B01–B24 and N01–N11, requirement IDs, source-backed oracles and positive controls; enforce “Unique ID; one primary failure dimension; source-backed oracle; no secret values in public descriptions” and “At most three improved groups; existing regression checks do not count as added groups”.

## Phase 2: Foundational — Mandatory Pre-Implementation Gate

**Goal**: Obtain actual evidence agreement before any test implementation.

- [X] T003 Invoke the installed speckit-specguard-prepare workflow and draft PRIVATE_ROOT/acceptance-evidence.md using .specify/extensions/specguard/templates/acceptance-evidence.md; pin spec/plan/tasks and case-inventory digests, FR-001–011 mappings, E1–E3, six entries, 750-second summed limits plus 90-second overhead, 256 KiB per entry, one 30-minute assessment, omissions and required closure criteria.
- [X] T004 Obtain actual maintainer evidence-plan agreement in PRIVATE_ROOT/acceptance-evidence.md before implementation; enforce “Pending until real maintainer agreement; immutable original plus linked amendments”; stop if pending or declined, and never infer agreement from tasks/implement invocation.

**Checkpoint**: T004 blocks every test edit. Agreement is not setup or execution permission.

## Phase 3: User Story 2 — Agree Bounded Evidence and Separate Permissions (P1)

**Goal**: Materialize the approval lifecycle early because US1 implementation depends on it.
**Independent test**: Inspect distinct agreement, setup and selection records without
application execution; pending decisions must block their dependent actions.

- [X] T005 [US2] Obtain the separate isolated-setup decision in PRIVATE_ROOT/setup-record.md covering exact local Linux environment, loopback Redis, npm/browser downloads, caches, possible image pulls and cleanup; use specs/002-strengthen-hosted-verification/quickstart.md setup steps and keep audit/check execution excluded.
- [X] T006 [US2] Prepare VERIFY_ROOT/server dependencies and local services only within T005 authority; record Node 24, Python, Redis, browsers, runner identities, baseline/copy provenance and lifecycle-script needs in PRIVATE_ROOT/setup-record.md; preserve “Cookies are local test-only; valid controls; never production secrets; cleanup only owned keys/resources”; stop on missing prerequisites rather than enabling scripts or broader network automatically.
- [X] T007 [US2] Document approval-gate negative scenarios in PRIVATE_ROOT/approval-gate-review.md: no agreement, setup-only approval, selection-only approval, changed context and consumed authority; inspect templates only, do not invoke checks or reserve an attempt; enforce “Selection-only is not execution; changed/uncertain conditions require review; preserve existing config”.

**Checkpoint**: Setup readiness can be reviewed independently. Final exact selection
approval is T022 after delivery; it cannot honestly be obtained against unfinished tests.

## Phase 4: User Story 1 — Risk-Selected Check Groups (P1)

**Goal**: Deliver G1–G3 using existing fixtures, with claims and limits.
**Independent test**: Source-review each case's requirement/oracle/control/limit;
later approved execution verifies denial and side effects. Missing assertions are
coverage gaps, not proof of bugs. Do not execute tests to demonstrate a red/green
cycle without separate concrete development-check approval.

### Tests and Test Infrastructure

- [X] T008 [US1] Extend test-only request/fixture support in server/test/app.test.js with explicit cookies/raw headers/bodies, independent A/B ownership, runner counters and protected snapshots; enforce “Exact denied-request comparison; failure receipts/revisions distinguished from saved-state changes”; do not edit server/app.js or server/store.js.
- [X] T009 [P] [US1] Extend test-only ownership/run controls in server/test/python-api.test.js with independent owners, receipt fixtures and paused active work; preserve target run state/history/active work on denials and avoid rate/quota interference.
- [X] T010 [P] [US1] Add N01–N08 native fixture modes and adapter assertions in server/test/engine.test.js for split/coalesced valid framing, unknown/fatal events, missing completion, trailing data, spawn failure and nonzero exit after result; retain existing failure/credential tests and disclose OS chunking and disabled-memory-limit limitations.
- [X] T011 [US1] Add the 24 G1 cases for six terminal/context route families in server/test/app.test.js using owning/other/missing/malformed-cookie conditions; assert denial status, no protected data, zero extra runner calls and unchanged protected snapshots, with fresh owner controls for destructive routes.
- [X] T012 [US1] Add the 16 G1 cases for four Python route families in server/test/python-api.test.js using the same four ownership conditions; check run creation/operation/receipt/end controls, including inability to end another owner's active work.
- [X] T013 [US1] Add B01–B20 boundary cases in server/test/app.test.js with isolated failure dimensions, correctly signed expired-cookie control, origin/type/parser/identifier/revision/NUL/byte-limit cases and local/secure issuance attributes; assert contract statuses and absence of protected effects on rejection.
- [X] T014 [US1] Add B21–B24 context rejection, post-rejection valid control and sanitized storage-error cases in server/test/app.test.js; restore injected storage failures for cleanup and never leak sentinel details in public errors.
- [X] T015 [US1] Add N09–N11 hosted propagation cases in server/test/app.test.js using actual executeNative controlled fixtures for protocol/crash/unavailable outcomes; assert failure receipts/categories, retained clipboard/settings and released active work while allowing documented revision/history updates.

### Integration and Claims

- [X] T016 [US1] Review duplicate terminal/schema/metadata-completion questions once in PRIVATE_ROOT/protocol-review.md using server/engine.js and documented protocol references; record unsupported expectations as findings with triggers, never invent rejection assertions or remediate runtime code.
- [X] T017 [US1] Document G1–G3 and reused server/store/Python/browser/audit claims and limits in server/README.md, linking specs/002-strengthen-hosted-verification/contracts/verification.md; disclose omitted real-corpus, production proxy and Linux resource-limit acceptance.
- [X] T018 [US1] Reconcile delivered named cases with PRIVATE_ROOT/case-inventory.md and review the feature diff against FR-001–005/011; preserve the 75-case budget or seek an explicit linked agreement amendment before any inventory change; record source-review conclusions as judgments, not passing test outcomes.

**Checkpoint**: Reviewable tests and scope documentation exist. No application
remediation, scanner, broad lint, dependency upgrade or deployment is authorized.

## Phase 5: Polish and Cross-Cutting Preparation — Before Final Attempt

**Goal**: Finish all edits and prerequisites before terminal verification.

- [X] T019 Synchronize the reviewed baseline plus explicitly enumerated test/doc changes into VERIFY_ROOT and record fingerprints/provenance in PRIVATE_ROOT/setup-record.md; bind VERIFY_ROOT/server/test-results to a fresh private attempt artifact destination, verify local namespace/cwd configuration by inspection, and complete setup before verify; set VERIFY_ROOT as SpecGuard's canonical --repo root, locally exclude VERIFY_ROOT/.verification/ from Git before creating VERIFY_ROOT/.verification/specguard.json, and document that runnable configuration location without altering existing private configuration.
- [X] T020 Review installed npm configuration/audit implementation and record exact registry endpoint, transmitted dependency metadata, production-only scope and advisory limitations in PRIVATE_ROOT/audit-disclosure.md without issuing an audit request; block that check if endpoint/payload remains uncertain.
- [X] T021 Review specs/002-strengthen-hosted-verification/quickstart.md against actual setup and finalize PRIVATE_ROOT/closure-review.md with scope diff, immutable baseline links, all FR mappings, omitted coverage and acceptance criteria; finish all source/doc/config changes before T022 and do not relax criteria based on results.

## Phase 6: User Story 3 — One Final Attempt and Honest Assessment (P2)

**Goal**: Obtain exact execution authority, preserve every outcome and stop.
**Independent test**: Inspect an incomplete-evidence scenario in the assessment
criteria and ensure it yields Blocked, then inspect the one real approved attempt
without additional checks. A recommendation is not maintainer acceptance.

- [X] T022 [US3] Follow speckit-specguard-review and create PRIVATE_ROOT/selection-review.md plus runnable VERIFY_ROOT/.verification/specguard.json and immutable PRIVATE_ROOT/approved-selection.json; record matching bytes/SHA-256 for the runnable configuration and approval snapshot, use VERIFY_ROOT as --repo and the repository-contained runnable file as --config, and resolve the six plan entries to exact executable/args, repository-relative configuration cwd (such as . or server), resolved absolute cwd, fingerprints, dependencies, network, time/output limits and fresh destinations; obtain real approval for selection and one future attempt with provenance, leaving pending until given.
- [X] T023 [US3] Follow speckit-specguard-verify using PRIVATE_ROOT/selection-review.md and PRIVATE_ROOT/attempt-ID/verification-attempt.md; enforce “Fresh private paths; persisted consumption before invocation; no reset or overwrite”; reserve and invoke the already built runner exactly once, retaining preflight failures and all per-check outcomes, with no setup/repair/retry here.
- [X] T024 [US3] Produce PRIVATE_ROOT/attempt-ID/verification-summary.md and PRIVATE_ROOT/attempt-ID/delivery-assessment.md using installed templates in one at-most-30-minute assessment; compare FR-001–011 once, separate observations/judgments, classify findings with rationale and triggers, record lessons, enforce “Missing acceptance remains pending; unmet closure cannot be deferred to manufacture closure”, and recommend Good enough to close or Blocked.
- [X] T025 [US3] Record the terminal stop and separate pending/actual maintainer acceptance in PRIVATE_ROOT/attempt-ID/delivery-assessment.md; provide safe artifact references and budget used, preserve originals, and perform no further edits, tests, remediation or retries as part of this attempt.

## Dependencies and Execution Order

```text
T001 → T002 → T003 → T004 (real agreement)
  → T005 → T006 → T007
After T007:
  T008 → T011 → T013 → T014
  T009 → T012
  T010
T014 + T012 + T010 → T015
T008–T015 → T016 → T017 → T018
  → T019 → T020 → T021 → T022 (real concrete execution approval)
  → T023 (one final attempt) → T024 → T025 (terminal stop)
```

The branches after T007 are independent file work. T010/T012 must be complete
before T015 uses the final fixtures and before T018 reconciliation. US2 is deliberately
placed before US1 despite their specification numbering: both are P1 and agreement
must precede implementation. US3 depends on delivered US1 plus valid US2 records.
Foundation T003/T004 implements the pre-implementation agreement portion of US2;
T022 implements the later approval portion, avoiding circular approval dependencies.

## Parallel Examples

- **US1**: After T008, T009 (python-api.test.js) and T010 (engine.test.js) may proceed
  while T011 works on app.test.js; T012 follows T009. Never edit app.test.js from
  multiple tasks concurrently. Fixture dependencies precede their consumers.
- **US2**: No parallel marked tasks: authorization → setup → gate review is serial.
  Independent review of existing templates may accompany setup only without execution.
- **US3**: No parallel execution: one approval owner serializes decision, consumption,
  invocation and assessment. No agent may race or reuse authority.

## Implementation Strategy

The smallest useful increment is US2's real evidence agreement and setup records,
then US1's reviewable three-group test/documentation delivery. This is the MVP;
it is not closure or a claim of passing verification. G1/G2/G3 may be implemented
incrementally within the agreed inventory, without running checks by implication.
Complete polish before the final review. Development test runs, if desired, need
their own concrete approval and cannot consume/reuse final-attempt authority.

Once delivery is ready, US3 executes the agreed selection once and assesses it.
Do not add a post-attempt polish phase, automatic fixes or deployment. Additional
work and attempts require separate maintainer decisions under existing rules.

## Requirement Coverage and Task Counts

| Requirements | Tasks |
| --- | --- |
| FR-001 | T002, T018 |
| FR-002 | T008, T009, T011, T012 |
| FR-003 | T013, T014 |
| FR-004 | T010, T015, T016 |
| FR-005 | T017, T020, T022–T024 |
| FR-006 | T003, T004 |
| FR-007 | T001, T005, T006, T019 |
| FR-008 | T007, T020, T022 |
| FR-009 | T023, T025 |
| FR-010 | T024, T025 |
| FR-011 | T018, T021 |

25 tasks: US1 11; US2 3; US3 4; setup/foundation/polish 7.
All checkboxes remain unchecked until actual work and, where required, real
maintainer decisions exist. Task generation authorizes none of the gated actions.
