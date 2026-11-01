# Feature Specification: Risk-based hosted-server verification

**Feature Branch**: `codex/specguard-setup`

**Created**: 2026-11-01

**Status**: Draft — ready for planning; evidence-plan agreement required before implementation

**Input**: Prepare a small, risk-based hosted-server verification feature using
Spec Kit and the local SpecGuard checkout, preserving private evidence and running
no application checks during prerequisite repair.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review a bounded selection (Priority: P1)

As maintainer, I can review a small verification selection tied to the hosted
server change and its highest risks before authorizing any execution.

**Why this priority**: A broad suite can consume shared resources and obscure gaps.

**Independent Test**: Inspect a proposed selection without executing it; every
selected item has a claim, expected observation and stated limitation.

**Acceptance Scenarios**:

1. **Given** a hosted change, **When** selection is prepared, **Then** each affected
   requirement maps to a selected check, bounded review question or explicit gap.
2. **Given** an existing configuration, **When** it is discovered, **Then** its
   existence alone grants no execution approval and its prior evidence is retained.

### User Story 2 - Decide on evidence and stop (Priority: P2)

As maintainer, I can agree the evidence budget before implementation and later
approve one concrete attempt, receiving an honest assessment on every outcome.

**Why this priority**: A finite stopping rule prevents repeated verification work.

**Independent Test**: Inspect the decision records and an assessment for missing,
failed or successful evidence; no unsupported claim of closure is permitted.

**Acceptance Scenarios**:

1. **Given** no evidence-plan agreement, **When** implementation is requested,
   **Then** preparation reports blocked and records the missing agreement.
2. **Given** one approved attempt, **When** it completes or is interrupted,
   **Then** the attempt is consumed and no retry occurs without new authority.
3. **Given** absent required evidence, **When** assessment is written,
   **Then** closure is blocked with concrete reasons.

### Edge Cases

- Missing, disabled, conditional or duplicate hooks are disclosed as integration gaps.
- Existing evidence cannot establish a retrospective pre-implementation agreement.
- Changed configuration, scope or execution context invalidates prior attempt authority.
- An unavailable runner or environment produces a blocked assessment, not a pass.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Selection MUST cover affected hosted-server requirements and state
  omissions; engine, CLI, Qt, WASM and deployment verification are excluded unless
  the affected change crosses those boundaries and the scope is explicitly revised.
- **FR-002**: The initial proposal MUST contain at most three evidence items, each
  with risk rationale, expected observation, limits and closure consequences.
- **FR-003**: Preparation MUST record the agreed requirements baseline, finite
  evidence budget and stopping rule before implementation. Pending agreement blocks readiness.
- **FR-004**: Execution MUST require a separate explicit decision covering the
  exact selection and context for one attempt; discovery and plan agreement grant none.
- **FR-005**: Private configuration and evidence MUST remain private and existing
  records MUST be retained; every new attempt MUST use fresh destinations.
- **FR-006**: After the final authorized attempt, assessment MUST cover every
  agreed requirement once, distinguish observations from agent judgment, classify
  blockers/accepted limitations/deferred improvements, and stop on every outcome.
- **FR-007**: Prerequisite repair MUST verify extension registration, generated
  command resolution and bundled templates without invoking application checks.

### Key Entities

- **Evidence plan**: requirement baseline, bounded items, actual agreement and gaps.
- **Selection decision**: exact checks/context, execution permission and consumption state.
- **Assessment**: evidence references, judgments, limitations and closure recommendation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All affected requirements have an evidence item or a disclosed gap.
- **SC-002**: The initial proposal has no more than three evidence items.
- **SC-003**: Zero application checks execute during prerequisite repair.
- **SC-004**: Each execution decision permits at most one attempt and one bounded assessment.
- **SC-005**: All existing private evidence remains intact; absent required evidence never yields closure.

## Assumptions

- This is preparation of a verification workflow for the existing hosted server,
  not a request to change runtime behavior, enable Python or deploy.
- Candidate low-cost coverage is catalogue consistency and Python-wrapper
  compatibility, plus one bounded source review of the affected hosted constraints.
  These are proposals, not an agreed selection, execution authority or full hosted acceptance.
- No new tests are required merely to populate an evidence matrix.
- Constitution 1.0.0 was ratified on 2026-11-01; amendments require explicit
  maintainer approval. Private evidence
  destination and the precise implementation baseline will be resolved during prepare.
