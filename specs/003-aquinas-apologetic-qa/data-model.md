# Data Model: Aquinas Q&A

## Authority and units

PostgreSQL private schema `qa` is authoritative for admission, quota, concurrency, receipts and costs. No browser can connect directly. Use a narrowly privileged server role; mutation through audited transaction functions, no financial-table writes by public roles. If Supabase is later selected, do not expose this schema through public Data API grants. Existing Redis/session state is unrelated.

Use database UTC time and signed 64-bit integer nano-USD. Monthly ceiling is 10,000,000,000 units ($10). Node handles money as BigInt/decimal strings, never floating-point SQL arithmetic or lossy JSON numbers. Price multiplication rounds upward per call. All FK/unique/check constraints must be enforced in the database, with transaction-level state validation.

## Corpus entities (private immutable build artifacts)

### CorpusManifest

Fields: `version` (content hash), `workId`, `editionId`, `sourceUrl`, `sourceChecksum`, `sourceLanguage`, `allowedArticles`, `extractionVersion`, `notices`, `rightsStatus` (`fixture|approved|disabled`), `rightsEvidenceRef`, `jurisdictions`, `approvedAt`, `topicsChecksum`.

Only `approved` bundles may enable hosted answers. Rights evidence may point to private records, never embed them in public assets. Source and topic changes create a new version. Fixture manifests cannot pass production activation.

### Article / Section / Span

Article: canonical `articleId` such as `ST.I.q2.a3`, edition/version, question/article titles, ordered section IDs, original display text/hash. Sections: `role` in `objection|sed_contra|respondeo|reply`, objection number where applicable, `respondsTo[]`, or explicit `collectiveReply=true`. Reject unclassified body sections rather than guessing their role. Replies may cover several objections or omit individual restatement.

Spans: evidence ID derived from corpus/section/hash, start/end Unicode code-point offsets into the immutable section text (half-open), section hash. No offsets into normalized search text. Rendering takes exact source substrings; selected multi-spans show explicit ellipses. Require bounds, edition/hash match and unchanged meaning. Search-normalized fields/aliases never become displayed quotations.

### TopicIndex

Reviewed Hungarian/English aliases and question/article associations; inverted token index with weights and normalization version. Corpus/index hash must agree. Top-three article evidence packs include main answer, contrary section and every objection/reply needed for attribution; no isolated objection as doctrinal support.

## Transactional entities

### Control (one row for the feature)

`id`, `enabled`, `epoch`, `schemaVersion`, `canonicalOrigin`, `corpusVersion`, `priceVersion`, `activeCount`, `receiptSlots`, `receiptReservedBytes`, `haltReason`, timestamps.

All admission/dispatch/settlement transactions lock this row first. It serializes low-volume decisions without keeping locks during provider calls. Initial activation requires explicit initialized rows; a missing row is unavailable, never zero usage. Restore, failover with possible data loss, configuration mismatch, or expired price manifest fences dispatch via epoch/halt. Operational deployment must ensure no acknowledged financial commit can be silently rolled back; otherwise activation is forbidden.

### MonthLedger

`month` (UTC admission YYYY-MM), `epoch`, `ceilingNanoUsd`, `reservedNanoUsd`, `settledNanoUsd`, `unresolvedCount`, `initializedAt`, `closedAt`.

Checks: nonnegative values, fixed ceiling <=$10, `reserved+settled<=ceiling`. Month rollover creates a row under the locked Control transaction; existing missing historical rows are errors. Never infer a zero ledger after database restore. Keep ledgers until reconciliation; proposed cleanup is 90 days after a fully reconciled closed month, with exported aggregate reconciliation totals. Unresolved records do not expire automatically.

### BrowserDay / BrowserActive

`browserDigest` (HMAC of verified signed cookie UUID; no raw cookie), UTC `day`, `completedCount`, `reservedCount`, `resetAt`, `expiresAt`; active record associates browser digest with its one operation. Enforce completed+reserved<=3, unique active browser. Day expiry is exactly UTC day start +48 hours; no cleanup can create capacity within the original day.

Never use the terminal owner cookie or advisory activity UUID. Dedicated cookie signs UUID, issuedAt, expiry and key version. Stable ID is renewed without resetting counts. Browser data deletion is an acknowledged limit, not a reason to accept client-created IDs.

### Operation

`id` (server UUID), `browserDigest`, `bindingHmac`, `language` (`hu|en`), `corpusVersion`, `epoch`, `admissionDay`, `admissionMonth`, `status`, `fenceToken`, `createdAt`, `deadlineAt`, `completedAt`, `receiptExpiresAt`, `reservedNanoUsd`, `settledNanoUsd`, `quotaOutcome`, `costOutcome`, and `failureCategory`.

Binding HMAC covers Unicode NFC/trimmed question, language and corpus version using a private dedicated key. Do not collapse case/internal whitespace or retain raw question. HMAC prevents unsalted dictionary recovery; delete it with private receipt data. Nonterminal statuses: `reserved`, `generating`, `verifying`, `uncertain`; terminal: `answered`, `abstained`, `failed`. Only terminal verified answer/abstention becomes a response receipt. Failed operations retain an opaque safe receipt for recovery, with no provider payload.

### ProviderDispatch (at most two per operation)

`operationId`, `stage` (`generation|verification`), unique `dispatchToken`, `state` (`prepared|sent|confirmed|uncertain`), `model`, `priceVersion`, `inputBound`, `outputBound`, `maximumCost`, `confirmedCost`, `providerRequestId` if returned, `startedAt`, `confirmedEndedAt`.

Commit the dispatch fence before sending. A timeout between commit and send may sacrifice capacity but MUST NOT cause redispatch. No provider idempotency promise is assumed. A CAS on `prepared` under the same control epoch authorizes exactly one send. Actual unknown usage retains that dispatch’s full cost. Proven never-sent future stages can be released separately. Provider request IDs remain private and are not browser API fields.

### Receipt (encrypted, owner-bound)

Operation ID, ciphertext, encryption key version, created/completed time and deletion deadline. Payload contains safe answer/abstention, citations with source spans, translations and category, never raw provider prompts/responses. Ciphertext is short-lived; decryption only for the owning browser. Delete payload and binding HMAC <=24 hours after completion, retaining only text-free financial records. Cap each encoded receipt at 64 KiB and reserve one of at most 1,000 receipt slots (64 MiB worst-case) at admission. When full, deny admission rather than evict a live deduplication receipt. SQL queries filter expiry immediately; scheduled cleanup frees capacity and deletes expired rows, with missed cleanup failing conservatively.

### NetworkWindow

Daily rotating keyed HMAC of trusted proxy-resolved network address; 60-second sliding window of submission timestamps, at most ten. Across midnight rotation, read and count both previous/current key windows atomically until all previous-window submissions age out; rotating the key cannot reset the sliding allowance. Expire within 24 hours. Update even when provider/validation failures do not consume answer slots. A separate inexpensive edge/general request safeguard handles malformed flood traffic; Q&A never consumes terminal rate buckets. Trust only documented deployment proxy hops, never arbitrary forwarded headers.

## Admission transaction

1. Verify canonical origin, signed browser cookie, signed short-lived request ticket, JSON shape, language, question and serialized token bounds outside paid work. Bind corpus version from ticket. Query owned receipt first: a replay returns existing state; changed content fails with conflict.
2. Lock Control, then month, browser/day and operation records in that consistent order. Check schema/epoch/rights/pricing activation and receipt/network limits. Use database time, not client timestamps.
3. Enforce browser completed+reserved<3, unique browser active, activeCount<2 and month settled+reserved+full operation maximum<=ceiling. Recheck replay/conflict under lock.
4. Insert operation, reserve daily slot, active occupancy, receipt storage and entire two-call cost envelope together, commit; only then may any provider request dispatch. Transaction outcome unknown means recover the operation ID on the primary; never assume rollback or call provider immediately.

## Lifecycle and settlement

`reserved -> generating -> verifying -> answered|abstained`; pre-dispatch failures may become `failed`. Missing local evidence may directly produce `abstained` with zero actual provider cost, but still consumes one daily response. Failure/timeout after dispatch becomes `failed` only if completion/noncompletion is known, otherwise `uncertain`.

Every dispatch and terminal transition is fenced by operation token/control epoch and at-most-once stage identity. Settlement moves reserved money to confirmed cost and refunds only confirmed unused amount, always on the original month. Terminal answer/abstention transfers one reserved slot to completed on the original day. Confirmed provider failure releases the daily slot but settles actual known cost; unknown completion retains it. No unverified draft is written to the public receipt.

At deadline, return a safe failure/uncertain state within 65 seconds. Worker lease expiry/disconnect does NOT release money, daily slot, or paid concurrency. Count uncertain provider operations as active until reliable provider completion/cancellation or a verified provider execution bound proves they ended. No such bound is presumed from a local HTTP timeout. If unresolved work would reach the 48-hour browser metadata retention boundary, halt all Q&A admission/dispatch, erase expired identity linkage, and preserve text-free global occupancy/cost tombstones. Resume only after reconciliation proves no old active work remains. This chooses availability loss over violating concurrency or retention.

Late results can settle only their original dispatch; a stale worker cannot publish, reopen admission or overwrite a terminal response. Reconciliation may lower conservative cost only on reliable usage evidence. No question data is retained to regenerate a lost answer. After receipt expiry, an old ticket can never create new paid work.

## Retention and recovery

Questions live in request memory for <=60 seconds; disable body/error/SQL parameter tracing. Answer-bearing encrypted receipts expire 24 hours after completion; unresolved operations retain only metadata, never draft text. Browser/day metadata expires at UTC admission day start +48 hours; erase browserDigest from Operation and BrowserActive by that cutoff, including unresolved work, after the global admission halt described above; network identifiers <=24 hours. Financial tombstones keep operation ID, month, costs, stages and outcome, without browser/question binding after expiry. Expired signed request tickets and durable operation IDs prevent replay after content removal. Read receipt expiry before decryption; cleanup is not the privacy authorization boundary.

Backups/WAL can retain deleted ciphertext. Encrypt text separately, restrict backup access and document backup retention/key lifecycle; logical deletion is not an immediate claim of physical erasure from all backups. Restore requires operator reconciliation and a new disabled epoch before any metered dispatch. Database credentials cannot be inherited by the native subprocess.
