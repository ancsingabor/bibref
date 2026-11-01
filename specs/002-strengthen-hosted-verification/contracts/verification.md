# Verification Contracts

These are test oracles for existing interfaces, not new public APIs or runtime
changes. Case IDs become named cases or subtests in existing suites. Expected
outcomes must not be changed after execution solely to obtain a pass.

## G1 — Ownership: 40 cases (FR-002)

Ten route families, each with four ownership conditions: valid owning browser,
another independently issued valid browser, no cookie, malformed cookie. For
mutation routes, keep origin/content type/payload valid to isolate ownership.

| Route family | Valid-owner control |
| --- | --- |
| GET /api/sessions/:id | saved session available |
| DELETE /api/sessions/:id | own disposable session removed |
| POST /api/sessions/:id/commands | accepted and valid result recorded |
| GET /api/sessions/:id/commands/:requestId | own known receipt available |
| POST /api/sessions/:id/commands/:requestId/cancel | own active work cancelled |
| POST /api/sessions/:id/context | valid local module fixture result available |
| POST /api/sessions/:id/python-runs | own run created from current revision |
| POST /api/sessions/:id/python-runs/:runId/operations | own valid operation completes |
| GET /api/sessions/:id/python-runs/:runId/operations/:requestId | own known receipt available |
| POST /api/sessions/:id/python-runs/:runId/end | own active run ends |

Each denied case expects 404, no protected response content, zero additional runner
calls and unchanged target saved state/history/active work. Use controlled paused
work where cancellation/end could otherwise mutate it. Rate counters and cookie
renewal are not protected-state invariants. Owner controls need fresh fixtures so
delete/end/cancel do not destroy a later case's target.

## G2 — Boundaries: 24 cases (FR-003)

| Case IDs | Stimulus | Expected observation |
| --- | --- | --- |
| B01–03 | expired correctly signed cookie; tampered signature; malformed token on a protected read | 404 without target data; no protected changes |
| B04–07 | missing, foreign, literal null, valid origin on valid mutation | first three 403; valid control admitted |
| B08–09 | text/plain versus valid JSON content type | 415 versus valid control |
| B10–11 | malformed JSON; body over parser 80kb limit | 400 invalid_json; 413 input_limit |
| B12–13 | malformed route ID; malformed request ID | 400 invalid_id |
| B14–15 | unsafe integer revision; negative revision in command | 400 invalid_command |
| B16 | command contains NUL | 400 invalid_command |
| B17–18 | multibyte command exactly configured byte limit; one codepoint above | admitted control; 400 invalid_command |
| B19–20 | local HTTP cookie issuance; simulated secure request cookie issuance | HttpOnly, SameSite=Strict, Path=/, configured Max-Age; Secure for secure context |
| B21–22 | invalid context book; invalid context verse with owning cookie | 400 invalid_reference, no runner call |
| B23–24 | valid command after rejection; injected storage error with sentinel | control still usable; sanitized 503 without sentinel/internal details |

Every rejection checks no native invocation and no target state/history/active
mutation when applicable. Cookie cases use controlled time/signatures, never real
credentials. Header assertions do not prove browser policy or actual proxy setup.
B17 must use a fixture with adequate quotas; byte length is not character count.
No claims of exhaustive malformed inputs or origin spoofing prevention.

## G3 — Native adapter: 11 cases (FR-004)

| IDs | Stimulus | Expected observation |
| --- | --- | --- |
| N01–02 | valid record split across writes; several valid records coalesced | correct events/result, no protocol failure |
| N03 | unknown event | engine_protocol |
| N04 | fatal event | engine_error |
| N05 | successful exit without terminal result | engine_crash |
| N06 | valid records followed by partial trailing data | engine_crash |
| N07 | missing executable | engine_unavailable |
| N08 | nonzero exit after result | engine_crash |
| N09–11 | real adapter protocol/crash/unavailable fixtures through hosted command route | failed streamed receipt/category; saved clipboard/settings unchanged; active work released |

Hosted failure can append a failure receipt and advance revision: test those
explicitly rather than calling any metadata change corruption. Reuse existing
malformed JSON, crash, output limit, deadline, cancellation/process-group and
credential sentinel assertions. Those tests use memoryLimit=false: no new claim
of Linux prlimit enforcement. OS pipe coalescing is nondeterministic; write patterns
exercise framing but do not prove every possible chunk partition.

Duplicate terminal records, unexpected terminal schemas and metadata-as-completion
remain a finite source-review question, not newly invented rejection rules.
Record one finding per distinct unresolved contract issue with a revisit trigger
(e.g. protocol schema adoption or any adapter change). If it prevents an agreed
required claim, classify blocked; otherwise request explicit limitation acceptance.

## Evidence and approval contract (FR-001, FR-005–011)

- Fixed proposed inventory: 40 G1 + 24 G2 + 11 G3 = 75 cases, plus existing reused
  tests. Case count is a budget, not a claim of coverage by itself. Any inventory
  change needs documented pre-implementation agreement, not silent expansion.
- Three evidence bundles E1–E3 in plan.md; six runner entries, 750 seconds summed
  check limits plus 90 seconds overhead, 256 KiB per entry; one 30-minute assessment.
- Record exact versions/config bytes/digests, expected outcomes, network, private
  destinations and actual agreement/approval using installed SpecGuard templates.
- Final attempt runs serially under one approval owner. Consume authority before
  invocation. Preserve outcomes including missing/disabled/unavailable checks.
- Do not flush Redis, use production credentials, enable a deployed Python preview,
  audit production services or upgrade dependencies. Audit is package metadata only.
- Required failure/gap blocks closure. Distinguish observations from judgment;
  additional findings require rationale, requirement impact, acceptance reference
  if relevant, and revisit trigger. Include lessons. Stop after recommendation;
  maintainer acceptance is separate.
