# Selection review

Copy privately; replace placeholders. Never invent a maintainer decision.

- Review ID: [unique]
- Canonical application root / feature directory: [absolute paths]
- Configuration path: [application/specguard.json]
- Exact approved snapshot path / SHA-256: [private path and digest]
- Runner and Node executable identity/version/fingerprint: [no secret values]
- Private evidence root and local exclusion/access policy: [reviewed destination]

- Acceptance evidence plan / agreed baseline: [private link or missing]
- Evidence item to proposed check ID mapping / gaps: [no automatic coverage claim]

## Proposed selection

For every check record ID/name/purpose, enabled state, exact executable and args
as an array, resolved cwd, dependencies and observed availability, script/tool
identity, side effects, network/privileges, timeout and output limits, redaction
environment names (never values), coverage and uncertainties. Include the full
proposed JSON bytes or an inspectable private candidate snapshot.

Disabled checks require `skipReason`; enabled checks must not contain it.
Explain omitted coverage and exclude remediation commands.

## Reviewed execution conditions

[Fingerprints of relevant scripts/configuration/lockfiles; installed tools and
dependencies, cwd resolution, runtime/runner identity, relevant environment
requirements, permissions/network assumptions, privacy/redaction and evidence
destination. Record how identity was established and all uncertainty. An unchanged
lockfile alone does not prove installed dependencies or behavior are unchanged.]

## Decision and use

Decision: pending, approved, declined, revoked, or superseded

- Actual decision: [one value; pending until explicit decision]
- Maintainer decision quotation/reference and date: [inspectable real provenance]
- Scope: [selection only OR selection and one future attempt]

Authorized use: one attempt; unused or consumed

- Execution authorized: [yes/no; selection-only means no]
- Actual use state: [unused/consumed]
- Consuming attempt ID / timestamp: [when consumed]
- Invalidation/re-review reason / superseding record: [if applicable]
- Additional-attempt authorization: [new real decision and separate record]

Reuse requires established provenance, unchanged scope/selection/conditions and
unused authority. Ordinary source-only edits alone do not invalidate approval.
Changes or uncertainty require review; consumption is irreversible for this record.
