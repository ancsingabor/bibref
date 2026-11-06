# Finite Acceptance Verification Contract

This is the proposed inventory, not execution authorization. Before implementation, SpecGuard prepare must freeze exact fixtures, commands, hashes, private evidence path, limits and stopping rule with maintainer agreement. Later review obtains an explicit one-attempt selection. Run once, assess once, stop on all outcomes. Private evidence stays outside the public checkout. No retries/remediation or relaxed criteria after results.

## V1 — Evidence and bilingual behavior (FR-001–007, SC-001–003)

Fixed live set: S01–S20 are twenty paired supported questions (40 operations, hu and en versions), O01–O10 are ten objection/reply traps (five hu/five en), U01–U10 are ten unsupported/unverifiable questions (five hu/five en). Total 60 operations; permit at most ten predeclared boundary/control cases for an absolute 70-operation cap, not ad hoc reruns. No repeated attempt when an answer fails. Freeze question/expected evidence/role/allowed limitation before provider execution. Supported set includes God’s existence, simplicity, knowledge, providence, creation and evil within the approved corpus; out-of-scope theology must not be silently answered.

Human reviewer competent in hu/en and Aquinas records correctness, relevance, understandability, exact citation support and translation fidelity per case. >=18/20 supported answers pass in each language; all selected-language prose must match selection. All citations and quotations must resolve/match source spans; all objection cases preserve Aquinas’s position. All unsupported cases abstain or limit conclusions explicitly; zero fabricated references. Model verifier verdicts are supplementary and cannot replace this human oracle. Generated translations must be visibly labeled in every relevant case.

Deterministic source fixtures: altered quote; nonexistent article; wrong edition/hash; negative/out-of-range/code-point span; reordered sentence; omitted reversal; objection mistaken for conclusion; missing main answer; collective reply; oversized context; no relevant retrieval; mixed-language source; corpus withdrawal/version mismatch. Each must fail closed or produce the specified bounded result. Synthetic public fixtures do not imply source serving rights.

## V2 — Accounting and concurrency (FR-008–013, SC-004–005)

Use real isolated PostgreSQL transactions, injected fake provider and controlled clock; never production/preview resources or real keys. At least 50 simultaneous new operations from distinct browsers split between two service instances share one near-cap month and control row. Assert accepted reservation count, unique operations, every financial invariant after each transition and total fake-provider sends. Repeat inventory variants as predefined cases, not opportunistic reruns:

- Exact-fit reserve and one-unit-too-large reserve; different instances racing on same row.
- Ten simultaneous same-browser submissions; <=3 daily completed responses, <=1 active per browser and <=2 globally at every observed dispatch.
- Same ID replay while reserved, generating, verifying, terminal and uncertain; exactly one call per permitted stage, never a second logical generation. Changed content/language/corpus with same ticket => conflict.
- Lost admission commit response; lost dispatch-fence response; crash before send; crash after send; late result; double settlement; stale fence/epoch; cancellation/disconnect; unknown usage; confirmed partial usage; absent usage.
- UTC day/month rollover and network-identity key rotation: preserve the rolling ten/minute limit across midnight; charge original periods; failed operation releases daily slot only when noncompletion known; no refund credited to a new month.
- Lease expiry does not release paid concurrency. A third operation stays denied while two are uncertain. Retention boundary halts admission before identity cleanup, and reconciliation cannot resurrect a draft.
- Missing/expired pricing, missing ledger/control, DB outage/commit uncertainty, restore epoch, disabled rights/config, capacity/storage-full, expired signed ticket and receipt expiry all deny unsafe paid work.

Evidence: per-case database snapshots of numeric/state fields only, fake send counters, acceptance categories and invariants. No raw questions/provider payloads in operational evidence logs. This isolated two-instance race supplies the concurrency evidence for SC-004. Release review separately confirms shared authoritative ledger configuration and canonical-origin routing. Simulated restore/failure checks demonstrate application fencing. Enabled release needs separate operational durability evidence.

## V3 — Injection, transport and privacy (FR-014–017, SC-006–007)

Predeclare cases for question injection, poisoned source instruction, forged section labels, provider-supplied credential request, script/HTML payload, invented external link, localhost/private/link-local/metadata destination, trusted-host redirect outside allowlist, DNS-address validation failure, oversized body, refusal, HTTP 429/500, timeout, incomplete JSON, schema mismatch, invalid citation, missing verifier claim, wrong prose language and translation error.

For each assert zero unauthorized outbound requests, tools, scripts or secret exposure, and safe selected-language result within 65 seconds. Record categories/counters only. Credential/question/source/answer sentinels must be absent from captured application logs, errors and built public assets. Encrypted owned receipt data is an explicitly allowed private output artifact and expires as contracted. Inspect provider store=false/no-tool/no-retry parameters, and verify two calls maximum with combined bounded input/output. A real 60-second timeout case may run only within the approved suite’s declared budget.

Verify invalid Origin, forged/missing cookie, another owner, missing/non-JSON body, invalid IDs/language, Unicode/byte boundary, >4,000 characters, malicious forwarded address and ten/minute network threshold with a valid positive control after rejection. Denials must not send provider requests, create answer state or consume terminal buckets. Receipts never expose another owner’s existence or data.

## V4 — Browser and existing clients (FR-018, SC-008)

Fixture Chromium flow: no language chosen; select hu; supported answer and exact original quote; generated-translation label; switch to en without rewriting old quote; inspect full role/context; unsupported abstention; daily limit/reset; budget exhaustion; busy/provider failure; duplicate tabs; refresh receipt recovery; expired receipt; hostile text safe; keyboard/focus labels. Other origins show only canonical Q&A link, and cannot make local paid requests. Q&A initialization/accounting failure leaves terminal functional.

Reuse affected existing node server/store/Python API regression suite, Python compatibility script and usage browser flow. Preserve CLI/Qt/WASM default build configuration through diff/source review; no native changes means no invented full native acceptance claim. Existing Python remains disabled by default; enabled local fixture tests do not authorize an enabled preview. Monitor existing quota keys and session clipboard/revisions before/after Q&A failures to establish isolation.

## V5 — Operational release review (FR-019)

Inspect corpus approval and notices/hash, canonical origin and cookie policy, dedicated key restrictions, current price/token manifest, selected provider data controls/disclosure, DB acknowledged-write durability and restore fencing, receipt/backups/key retention, disabled-feature behavior and no-secret build inputs. Distinguish documented design, locally simulated failure behavior and actually verified deployment configuration. Missing required live quality, rights, durability or provider bounds blocks enabled release, even when fixture suites pass.

## Evidence/time/cost ceiling

Proposed command bundles: deterministic Q&A tests 180s; PostgreSQL tests 180s; fixture Q&A browser 180s; existing regression bundle 300s; live quality 1,200s with <=70 operations/140 calls and <=$0.70 reserved; one bounded artifact/semantic assessment <=30 minutes. Freeze exact command timeouts before execution. Price changes can lower the number of admissible live cases; they never raise the $0.70 or monthly $10 limits. Unperformed required cases remain pending, not passed. Use fresh private evidence paths and isolated namespaces; never flush shared Redis or rewrite prior evidence.
