# Implementation Plan: Strengthen hosted-server verification

**Branch**: `feat/server-web-vercel` (actual Git branch) | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: `specs/002-strengthen-hosted-verification/spec.md`

## Summary

Extend existing tests in exactly three improvement groups: G1 HTTP ownership,
G2 cookie/origin/input boundaries, G3 native-process framing and errors. Use
existing fixtures and built-in assertions; do not modify runtime behavior to make
checks pass. Reuse regression coverage and the existing dependency audit. Deliver
claims and limits alongside tests and one final private SpecGuard assessment.

This is Phase 1 design only. Evidence-plan agreement and execution authorization
are pending. Planning invocation is permission to plan, not permission to implement.
Setup reported feature identifier `002-strengthen-hosted-verification` as BRANCH;
its common.sh fallback derives that from feature.json, not the actual Git branch.

## Technical Context

**Language/Version**: Existing JavaScript ES modules, Node 24 project requirement;
Python 3 for subprocess fixtures and compatibility coverage. Exact executable
versions/fingerprints are recorded during separate setup/review, not assumed.

**Primary Dependencies**: Existing Express 5, Redis 7 local disposable service,
Playwright and locked npm dependencies; local SpecGuard 0.2.0 integration. No new
scanner, lint framework or package is proposed.

**Storage**: Unique per-fixture Redis keys/namespaces; fresh private evidence
outside public checkouts. No schema migration or production storage access.

**Testing**: node:test/assert, Python compatibility script, existing usage and
Python runtime browser scripts, npm audit production dependency scope.

**Target Platform**: Isolated local Linux test environment for Linux native
process semantics; existing browser engines Chromium/Firefox/WebKit. Do not treat
host macOS availability as proof of Linux process/resource-limit behavior.

**Project Type**: Hosted web-service verification enhancement.

**Performance Goals**: Bounded evidence, not a throughput benchmark: proposed
final check budget 14 minutes total, plus one 30-minute artifact assessment.

**Constraints**: Three improved groups maximum; no runtime remediation, deployment,
production scanning, native interface expansion, upgrades, retries or new frameworks.
No application execution or installation during planning. Concrete execution needs
separate approval, including advisory-service network use.

**Scale/Scope**: Ten route families for ownership; finite G2/G3 matrix defined in
[contracts](contracts/verification.md); six reused execution entries in three
requirement-linked evidence bundles. Group count measures improvement areas,
not subprocess count or all pre-existing tests in the regression suite.

## Constitution Check

Pre-research and post-design checks both pass for planning:

- I: No CLI/Qt/WASM, native binary, module input or manifest changes.
- II: Ownership, same-origin and subprocess isolation are verification targets;
  Python enabled only in local fixtures, default unchanged.
- III: Compare clipboard/settings snapshots separately from failure receipts and
  revision changes; failed commands may legitimately add receipts/increment revisions.
- IV: Unique keys and isolated local quotas; no Redis flush or shared services.
- V: Preserve existing private config/evidence; final paths are fresh and private.
- Delivery: No release/deployment or enabled preview is proposed.
- Governance: No constitutional amendment. Before implementation, mandatory
  SpecGuard prepare must obtain real evidence agreement. Final review/verify
  requires exact approval and stops after one attempt plus one assessment.

**Implementation gate: pending**, not a waived violation. Missing agreement,
private destination and execution identities are future approval prerequisites,
not unresolved technical design. Do not begin implementation through this plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-strengthen-hosted-verification/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/verification.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
server/test/app.test.js          # G1/G2 HTTP and G3 hosted error propagation
server/test/python-api.test.js   # G1 enabled Python ownership, reuse validation
server/test/engine.test.js       # G3 controlled native-output fixtures
server/test/store.test.js        # reuse only
server/test/python-compat.py     # reuse only
server/test/usage-browser.mjs    # reuse only
server/test/python-runtime-browser.mjs # reuse only
server/README.md                 # claims, limits and validation references
.specify/extensions/specguard/   # installed workflow/templates; no changes
```

**Structure Decision**: Extend existing suites; a small test-only fixture helper
may be extracted if needed to expose explicit cookies/raw requests and snapshots.
Do not add a parallel scanner/suite or production API. Application modules are
read-only contract references. tasks.md belongs to the subsequent tasks command.

## Phase 0 — Research

Completed local source research in [research.md](research.md). No external lookup,
installation, checks or dependency audit. No technical clarifications remain.

## SpecGuard Path Contract

`VERIFY_ROOT` is the canonical absolute isolated application copy supplied as
SpecGuard's `--repo`. Its runnable candidate configuration is
`VERIFY_ROOT/.verification/specguard.json`; exclude `.verification/` locally from
Git before creating that file. Configuration `cwd` values are repository-relative
(`.` or `server` as appropriate), and must resolve inside VERIFY_ROOT. Record the
resolved absolute working directories in the private selection review.

`PRIVATE_ROOT` remains outside the checkout and holds evidence, decisions and the
immutable approved configuration snapshot. Record matching bytes and SHA-256 for
the snapshot and runnable configuration. Invoke SpecGuard with the repository-contained
configuration, not the external snapshot. Preserve existing private configuration
and evidence; do not overwrite or relocate them.

## Phase 1 — Design

- [data-model.md](data-model.md): test fixtures and private evidence lifecycle.
- [contracts/verification.md](contracts/verification.md): finite cases and oracle boundaries.
- [quickstart.md](quickstart.md): separate setup and future approved validation.

## Proposed Acceptance Evidence Budget — Not Yet Agreed

| Bundle | Requirements | Required evidence and limits |
| --- | --- | --- |
| E1 boundary behavior | FR-001–004 | Existing server suite with G1–G3 cases and positive controls; case inventory, snapshots, runner counters and error categories. Synthetic adapter evidence is not real-engine acceptance. |
| E2 reused regressions | FR-005 | Python compatibility, usage browser, three-engine Python runtime browser and production-scope dependency audit; no native corpus or full enabled-Python browser acceptance claim. |
| E3 delivery and governance | FR-006–011 | One source/artifact review of agreement, setup, exact approval, final attempt, requirement map, scope diff, lessons and findings. Agent judgment is labeled; no assertion of user-need validity. |

Propose six final entries: server test suite (180s), Python compatibility (30s),
usage browser (120s), Python runtime browser (300s), dependency audit (90s),
whitespace diff check (30s). Total maximum 750 seconds; allow 90 seconds runner
startup/serialization overhead, for a 14-minute ceiling. Each entry caps output at
256 KiB. One assessment pass, at most 30 minutes, restricted to this feature's
spec/plan/tasks, changed tests/docs, setup/approval records and this attempt's
artifacts. No additional discovery, test execution, retry or repairs.

All E1–E3 required evidence must be usable; failed required checks, unmet claims,
or required gaps block closure. Advisory findings are preserved and assessed for
scope/impact; no automatic upgrade. A limitation can support closure only with
actual maintainer acceptance. Stop after every final attempt outcome, including
preflight failure/interruption. No criterion relaxation after seeing results.

The concrete commands, case inventory, hashes, private paths and budgets must be
copied into the private SpecGuard evidence plan and agreed before implementation;
these public design notes are not approval or retrospective evidence.
