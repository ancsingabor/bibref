# Feature Specification: Hosted Aquinas Apologetic Q&A

**Feature Branch**: `feat/server-web-vercel` (existing branch; no branch created)

**Created**: 2026-11-02

**Status**: Draft — ready for planning

**Input**: User description: "Implement hosted Aquinas-based apologetic Q&A with explicit Hungarian/English selection, grounded retrieval, verified citations, and abstention when unsupported. Preserve article context, distinguishing objections from Aquinas’s replies. Render quotations from source text; label generated translations. Enforce server-side: $10 monthly shared budget, atomic cost reservations, three answers/browser/day, network safeguards, bounded tokens, concurrency, and deduplication. Keep credentials server-side; avoid prompt logging. Verify bilingual quality, citation fidelity, injection resistance, concurrent budget enforcement, and provider failures. Preserve existing clients; deployment requires authorization."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive a grounded bilingual answer (Priority: P1)

A visitor explicitly selects Hungarian or English, asks an apologetic question, and receives an explanation grounded in approved Aquinas texts with inspectable citations, or a clear abstention.

**Why this priority**: The service is useful only if readers can distinguish supported teaching from unsupported generation.

**Independent Test**: Submit paired questions in both languages against a fixed approved corpus, including an unsupported question, and inspect answers and cited passages.

**Acceptance Scenarios**:

1. **Given** no language selection, **When** a visitor attempts submission, **Then** submission requires an explicit Hungarian or English choice; browser language does not silently choose.
2. **Given** a supported question and selected language, **When** an answer succeeds, **Then** explanatory prose uses that language and each substantive Aquinas attribution has a verified source reference and inspectable supporting passage.
3. **Given** a question supported only by an objection, **When** the answer is prepared, **Then** the objection is identified as such and evaluated against the article’s main answer and applicable reply; it is never presented as Aquinas’s conclusion.
4. **Given** absent, insufficient, contradictory, or unverifiable support, **When** responding, **Then** unsupported conclusions are withheld with a selected-language explanation; any supported partial answer states its limits.
5. **Given** a source in another language, **When** displaying its quotation, **Then** the exact source wording remains visible and any generated translation is separately labeled in the selected language.

---

### User Story 2 - Keep shared use affordable and fair (Priority: P1)

Visitors receive predictable allowance and availability messages while the operator’s shared monthly generation expense remains at or below $10.

**Why this priority**: Financial and admission limits are release conditions for a public hosted service.

**Independent Test**: Exercise simultaneous requests across browsers and deployment environments near daily, monthly, and concurrency boundaries using controlled cost outcomes.

**Acceptance Scenarios**:

1. **Given** three completed answers for one browser in a UTC day, **When** a fourth is requested from any tab, **Then** it is refused before paid work and the next reset is shown.
2. **Given** a nearly exhausted monthly allowance, **When** simultaneous requests compete for the remaining amount, **Then** only requests whose full maximum cost fits are admitted and settled costs plus outstanding reservations never exceed $10.
3. **Given** repeated submissions with the same browser request identity, **When** they overlap or are retried, **Then** they share one operation, cost reservation, and answer allowance entry; an altered question or language cannot reuse that identity.
4. **Given** exhausted concurrency, unavailable accounting, or uncertain prior provider completion, **When** another request arrives, **Then** the service refuses or reports pending safely without an unreserved paid retry.
5. **Given** month or day rollover during work, **When** the work settles, **Then** charges and answer allowance settle against their original admission periods without increasing the new period’s capacity incorrectly.

---

### User Story 3 - Handle hostile input and unavailable dependencies (Priority: P1)

A visitor receives safe, comprehensible failures without disclosure of credentials, stored questions, or fabricated answers.

**Why this priority**: Public questions and retrieved text are untrusted, and provider failures must not defeat cost controls.

**Independent Test**: Use controlled hostile questions, poisoned source passages, malformed provider output, timeouts, and dependency outages; inspect resulting content, accounting, and captured logs.

**Acceptance Scenarios**:

1. **Given** instructions embedded in a question or source passage, **When** they request secret disclosure, policy overrides, external fetching, or fabricated citations, **Then** no such action occurs and unsupported content is withheld.
2. **Given** provider refusal, failure, timeout, malformed response, or invalid citations, **When** completing the request, **Then** no unverified answer is rendered; the visitor sees a selected-language failure or abstention and accounting remains conservative.
3. **Given** missing credentials or unavailable shared admission storage, **When** submitting a question, **Then** paid processing does not start and no internal error detail is exposed.
4. **Given** question and credential sentinel values, **When** success and failure paths run, **Then** public assets, error messages, and operational logs disclose no credentials; logs contain no prompts, question text, retrieved passages, or answer text.

---

### User Story 4 - Preserve existing workflows (Priority: P2)

Existing terminal, optional Python, CLI, Qt, and WASM users continue their current workflows regardless of Q&A availability.

**Why this priority**: The addition must preserve the established product and its resource protections.

**Independent Test**: Compare affected existing-client behavior with the established baseline while Q&A is disabled, enabled, exhausted, and failing.

**Acceptance Scenarios**:

1. **Given** an existing workflow, **When** Q&A is unavailable or its budget exhausted, **Then** existing behavior, ownership boundaries, session state, and existing quotas remain intact.
2. **Given** a completed implementation, **When** release readiness is assessed, **Then** no deployment occurs without explicit authorization; verification follows the constitution’s finite evidence and approval workflow.

### Edge Cases

- Empty, oversized, mixed-language, Unicode, or unsupported-language input; source quotations retain their original language even when prose uses the selected language.
- Correct-looking references with nonexistent locations, wrong editions, altered quotation wording, or support that contradicts the generated claim.
- A relevant excerpt lacking its objection/reply role or article context; such evidence cannot establish Aquinas’s position.
- Duplicate requests across tabs, disconnects, cancellation, crash recovery, expired reservations, and late or duplicate settlement.
- Clearing browser data creates a new anonymous browser identity; a browser quota is not a person quota. Supplemental network controls limit abuse without identifying users as people.
- Requests around UTC boundaries, differing preview/production settings, stale prices, unknown usage, and provider-side charges after local timeout.
- Redirects, private-network destinations, oversized upstream responses, hostile markup, and sources attempting to trigger additional network access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The hosted interface MUST require explicit Hungarian/English selection and submit the selected language with every question. Validation, limits, abstentions, and failures MUST use that selection. Changing language MUST affect subsequent answers without silently translating existing source quotations.
- **FR-002**: Answers MUST retrieve evidence from a versioned, maintainer-approved Aquinas corpus with documented provenance and permission to serve it. Arbitrary user-supplied sources and open-web search are outside this feature.
- **FR-003**: Evidence MUST retain work, edition, language, article locator, section role, and relevant surrounding article text. Roles MUST distinguish objections, contrary statements, main answers, and replies to numbered objections. Missing context or ambiguous roles MUST prevent attribution of that passage as Aquinas’s conclusion.
- **FR-004**: Every substantive doctrinal claim attributed to Aquinas MUST be supported by retrieved evidence. Before display, references MUST resolve to the approved edition and location, and evidence MUST support the claim in its article context. Invalid claims MUST be removed or cause abstention; model-created references alone are insufficient verification.
- **FR-005**: Displayed quotations MUST be rendered from verified source text rather than model recollection. Exact quoted spans and source locators MUST be inspectable. Paraphrases MUST remain distinguishable from quotations; omissions MUST be marked and MUST NOT change meaning.
- **FR-006**: Generated translations MUST be separately labeled as generated translations, retain the source quotation alongside them, and MUST NOT be represented as published source wording. Available published translations MUST identify their edition.
- **FR-007**: Insufficient evidence MUST produce an explicit abstention or bounded partial answer stating what cannot be supported. The service MUST distinguish Aquinas’s supported position from explanatory synthesis and MUST NOT substitute general model knowledge for missing source evidence.
- **FR-008**: The server MUST enforce one shared $10 USD calendar-month ceiling for all feature-related metered provider work across preview and production, including retrieval preparation, generation, translation, and retries. Other hosting expenses MUST be disclosed separately rather than represented as covered by this ceiling.
- **FR-009**: Before any metered operation, admission MUST atomically reserve its conservative maximum charge, including bounded input/output and any permitted subsequent work. Settled charges plus outstanding reservations MUST remain at or below $10. Missing or untrusted pricing MUST deny admission. Optional work MUST stop when it cannot fit within reserved capacity.
- **FR-010**: Settlement MUST occur at most once per operation against its original admission month. Only confirmed unused cost MAY be released. Unknown usage, timeouts, crashes, expired leases, and disconnects MUST retain the maximum charge until reliable reconciliation; automatic retries MUST NOT multiply uncertain charges. Shared-accounting failure MUST fail closed.
- **FR-011**: A server-validated anonymous browser identity MUST receive at most three completed Q&A responses per UTC calendar day across tabs and hosted environments. Answer slots MUST be reserved atomically before work. Completed substantive answers and abstentions consume a slot; validation rejection and provider failure do not, but remain subject to abuse controls. Uncertain completion MUST retain its slot until reconciliation.
- **FR-012**: Retries of one browser request identity MUST share an operation and stored outcome without additional paid work or allowance consumption. Identity MUST bind normalized question, selected language, and corpus version; changed content MUST be rejected. Deduplication receipts MUST survive for at least 24 hours after completion, without creating a public question history or sharing private responses across browsers.
- **FR-013**: Server-enforced limits MUST bound question size, retrieved context, total provider input/output tokens, upstream response size, request duration, and active paid operations. Launch defaults are 4,000 question characters, 12,000 total input tokens, 1,500 output tokens, 1 MiB upstream response, 60 seconds, one active operation per browser, and two globally. Invalid or over-limit input MUST be rejected before paid work; no unbounded waiting queue is permitted.
- **FR-014**: Network safeguards MUST accept only the hosted application’s authorized request origins, enforce at most ten Q&A submissions per network address per minute, and restrict outbound access to configured trusted providers and approved sources. User/source-controlled destinations, private/link-local/metadata networks, and redirects outside the trusted destinations MUST be blocked. Client disconnects MUST NOT bypass accounting.
- **FR-015**: Questions, source text, and provider output MUST be treated as untrusted data. They MUST NOT override language, evidence, network, credential, or spending rules. Rendered content MUST NOT execute markup or scripts, and answers MUST NOT cause automatic tool execution or external requests.
- **FR-016**: Credentials MUST remain server-side and outside public assets, committed files, native subprocess environments, and errors. Operational logging MUST contain only categories, timing, aggregate usage, and necessary opaque operation metadata, never prompt/question/source/answer bodies. Question-bearing deduplication data MUST be access-controlled and expire after 24 hours; browser allowance metadata after 48 hours; network-abuse identifiers after 24 hours. Minimal cost records MAY persist through monthly reconciliation without text content. Provider retention and logging settings MUST be documented and minimized before release.
- **FR-017**: Visitors MUST see distinct selected-language messages for unsupported evidence, daily limit, shared budget exhaustion, busy capacity, invalid input, and provider/dependency failure, including reset or retry guidance where known. Failures MUST NOT expose credentials, other visitors’ questions, or fabricated answers.
- **FR-018**: Implementation MUST preserve existing clients, module pins/notices, ownership, session state, native subprocess isolation, default build behavior, and existing quotas. Q&A availability MUST NOT enable Python by default or require existing clients to adopt new interfaces.
- **FR-019**: Release readiness MUST include bilingual content review, source/citation checks, hostile-input cases, concurrent budget/quota/deduplication tests, and provider/accounting failure cases. Evidence MUST identify tested corpus/version and omitted coverage. Execution MUST follow the constitution’s separately approved finite verification selection; deployment requires explicit authorization.

### Key Entities

- **Corpus edition and article**: Approved source, provenance, serving permission, version, language, canonical locator, section roles, and contextual relationships.
- **Evidence and citation**: Retrieved source spans, article context, claim association, verified locator, and original quotation; linked generated translation where present.
- **Q&A operation**: Opaque identity, browser ownership, question/language/corpus binding, bounded lifecycle, answer or abstention, and expiring private deduplication outcome.
- **Browser allowance**: Anonymous validated browser identity, UTC admission day, completed count, reserved slots, and expiry; never a claim of unique-person identity.
- **Budget ledger and reservation**: Shared admission month, USD ceiling, pricing basis, maximum reserved charge, confirmed settled charge, reconciliation status, and at-most-once settlement.
- **Admission controls**: Shared concurrency occupancy, per-browser occupancy, short-lived network abuse counters, and bounded expiry/recovery state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On at least 20 paired supported questions reviewed in Hungarian and English, at least 90% of answers in each language are judged correct, relevant, and understandable by a reviewer competent in that language and Aquinas; 100% use the explicitly selected prose language.
- **SC-002**: Across that set and at least ten objection/reply traps, 100% of displayed citations resolve to the correct approved source and support their associated claims; 100% of quotations match source spans; no objection is misattributed as Aquinas’s conclusion and all generated translations are labeled.
- **SC-003**: All of at least ten unsupported or unverifiable questions yield abstention or an explicitly bounded supported partial answer, with zero fabricated references.
- **SC-004**: In at least 50 simultaneous submissions near the monthly ceiling split across two isolated service instances sharing one authoritative ledger, settled costs plus outstanding maximum charges never exceed $10. Duplicate settlement, crashes, uncertain charges, and month rollover preserve this invariant. Release review separately verifies that every enabled hosted backend uses that same authoritative ledger and that other origins direct browsers to the canonical Q&A origin.
- **SC-005**: In at least ten simultaneous same-browser submissions across tabs, at most three completed responses are admitted per UTC day, at most one operation is active for that browser, at most two globally, and replaying one identity creates exactly one paid operation.
- **SC-006**: All selected hostile-question, poisoned-source, credential-sentinel, unsafe-destination, and hostile-rendering cases produce zero unauthorized network requests, executed scripts, disclosed secrets, or logged prompt bodies.
- **SC-007**: All selected provider refusal, timeout, malformed output, invalid citation, missing pricing, and unavailable-accounting cases end in a safe user-visible state within 65 seconds; no uncertain charge is refunded without confirmation and no unreserved paid retry occurs.
- **SC-008**: All selected existing-client compatibility checks pass with Q&A disabled, available, exhausted, and failing; no deployment occurs as part of specification or unapproved verification.

## Assumptions

- This invocation produces a specification, not implementation or deployment. No new infrastructure or paid provider calls are authorized by specification creation.
- Initial scope is anonymous, single-question apologetic Q&A grounded in approved Aquinas articles; accounts, conversation memory, user uploads, open-web research, and arbitrary corpus expansion are excluded.
- Planning must identify the initial corpus, editions, serving rights, and provider pricing/usage guarantees before implementation can establish faithful answers and a hard spend ceiling. No existing Aquinas corpus is presumed available.
- The $10 ceiling means feature-attributable metered provider charges before taxes and currency conversion, across all environments, rather than total infrastructure expenses. A provider with unbounded or unverifiable charges is unsuitable for this ceiling.
- UTC is the common daily/monthly reset basis. Anonymous browser limits discourage casual overuse; deleting browser data or changing browsers can evade identity continuity, so they are not per-person guarantees.
- Numeric token, concurrency, network-rate, and retention defaults above are conservative launch assumptions, configurable only server-side while preserving the fixed $10 and three-response ceilings.
- Source quotations retain their original language; selected-language explanations and labeled generated translations provide bilingual access. Answer quality requires human bilingual/source review as well as automated fidelity checks.
- Existing project governance remains in force. No Supabase provisioning is required by this specification; if later authorized, projects may be created only directly in the maintainer’s existing Supabase organization (identifier kept in private provisioning configuration), never through Vercel Marketplace.


## Current implementation status — 2026-11-06

The drafting and proposed-path statements above are preserved as historical design context. Current branch: `codex/003-aquinas-apologetic-qa`. Implementation tasks T001–T030 are marked complete and checkpointed in `f9b25dd`; T031 selection review and T032 authorized verification remain pending. Application modules and acceptance entry points now exist. Implementation completion does not establish acceptance, live quality, operational activation readiness or deployment authorization. The private agreed acceptance plan and its dated amendments govern evidence; the original $0.50 E5 budget was amended to $0.70 on 2026-11-04.


## Draft PR checkpoint — 2026-11-06

The local implementation and verification corrections are ready for code review. SpecGuard selection and verification activities T031–T032 have been performed. The initial attempt failed migration loading and two isolation assertions; the authorized follow-up corrected SQL CASE parsing, bound rate spies to their store, and made constructor-only origin injection explicit. All seven enabled checks passed in the second attempt, including PostgreSQL and all 112 server regression tests. Paid live evaluation was disabled, so the overall runner result was skipped rather than all-passed. Private configurations, decisions, source bundles and raw evidence remain outside this repository.

Feature acceptance and activation remain blocked on live bilingual review, omitted acceptance cases and operational evidence. This draft does not authorize deployment or activation. The default corpus and price manifests remain disabled/incomplete. See tasks.md for the remaining acceptance work.
