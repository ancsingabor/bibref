# bibref Hosted Server Constitution

## Core Principles

### I. Preserve existing interfaces and module inputs
Hosted changes MUST preserve standard CLI, Qt, and WASM behavior. Standard CLI
and WASM builds retain `BIBREF_JSON=OFF`; hosted JSON-lines operation is optional.
Module pins, checksums, configs and notices MUST be preserved. Changed native
binaries or module inputs MUST change the engine manifest; incompatible retained
sessions remain readable but cannot execute new commands.

### II. Enforce ownership and execution isolation
Session IDs alone MUST NOT grant access. Mutations MUST require signed ownership
and same-origin JSON. Native subprocesses MUST receive no Redis, cookie or Vercel
credentials and retain documented process/memory limits. Browser-worker messages
MUST be treated as untrusted and independently validated by the server.

### III. Preserve state and reconcile uncertain outcomes
Only successful commands MAY commit clipboard/settings changes, guarded by
revision and lease token. Failure, cancellation and interruption MUST preserve the
preceding snapshot. Request receipts and revisions MUST prevent blind replay;
uncertain commands MUST be reconciled rather than automatically resubmitted.

### IV. Bound shared resources on the server
Concurrency, rate, storage, time and output controls MUST remain server-enforced.
Preview and production share global admission and daily execution allowance.
Usage displays MUST be aggregate, approximate where appropriate, and explicit
about stale/unavailable data. Tests MUST use isolated namespaces/unique keys and
MUST NOT flush Redis. No automatic paid Redis upgrade or team-wide protection
change affecting unrelated applications is authorized.

### V. Keep private data and credentials private
Credentials MUST NOT enter public assets, Docker layers, committed files or
command arguments. Platform logs MUST contain status/category/duration rather
than commands, verses, clipboards or Python source/results. Aggregate usage MUST
expose no ownership or execution identifiers. Existing private configuration and
evidence MUST be preserved; new SpecGuard evidence belongs outside public checkouts.

## Delivery Constraints

This standalone experiment targets fork base `feat/server-web-vercel`; it has no
planned upstream merge. A branch name MUST NOT be treated as deployment evidence.
Deployment requires an explicit request. Python MUST remain disabled by default;
release requires its documented checks and an explicitly authorized enabled preview.
Module notices and source links MUST be retained. Technical hosting does not settle
permission to redistribute or publicly serve copyrighted module content.

Sources: `README.md`, `server/README.md`, `server/PYTHON.md`,
`docker/cli/web/README.md`, and `next-steps.md`. Numeric operational defaults remain
in those documents rather than being restated as immutable constitutional values.

## Verification Workflow

Verification MUST be scoped to the affected hosted or engine path and disclose
omitted coverage. SpecGuard preparation MUST agree a finite acceptance evidence
set and stopping rule before implementation. Plan agreement is separate from
permission to execute checks. Review MUST present concrete checks for an explicit
one-attempt decision. Stop after that final attempt and one bounded artifact
assessment on every outcome; no automatic remediation or retry. Existing evidence
MUST NOT be rewritten as retrospective preparation. Missing/disabled hooks are
integration limitations, not a global enforcement guarantee.

## Governance

This constitution consolidates documented constraints and the requested SpecGuard
workflow; template examples are not adopted principles. Feature plans MUST identify
applicable constraints and disclose unresolved conflicts before implementation.
Constitution amendments MUST receive explicit maintainer approval before adoption.
Normal PR review alone does not authorize an amendment. This policy records the
maintainer decision of 2026-11-01.
The maintainer explicitly approved this baseline in this chat on 2026-11-01.
Version 1.0.0 establishes the first concrete baseline. Future version changes
MUST describe whether they redefine, extend or clarify adopted constraints.

**Version**: 1.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
