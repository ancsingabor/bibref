# Hosted Q&A API and UI Contract

## Origin and identity

Canonical HTTPS origin is an explicit server setting. Only this origin hosts an enabled paid Q&A page and accepts Q&A mutations. Other preview/production origins offer a fixed configured link; local paid Q&A is disabled. Never construct redirects/provider URLs from a user-controlled Host or question. Local fixture origins are separately allowlisted with fake provider only.

Use `bibref_qa` signed, HttpOnly, Secure, SameSite=Strict, host-only cookie; seven-day renewable expiry, same UUID on renewal. Cookie ownership gates all receipts; IDs alone grant no access. The activity UUID and terminal owner cookie have no Q&A authority. No cross-origin CORS, iframe embedding, cookies in URL, or public shared-answer cache. All responses `Cache-Control: no-store`; maintain existing CSP and escaping.

Error envelope: `{code, language, message, retryAt?, requestId?}` with server-authored Hungarian/English messages; absent/invalid language has a bilingual selection message. Never reflect raw questions, provider errors, SQL errors or credentials. Capacity/reset times come from database/server UTC; UI formats them locally with explicit timezone. Browser displays limits as browsers, not unique people.

## GET /api/qa/meta

Returns `{enabled, canonicalUrl, corpusVersion?, sourceLanguages?, languages:["hu","en"], limits, disclosureVersion, serverTime}`. This is descriptive, never permission to bypass admission. Disabled config remains a safe response even if Q&A DB/provider setup failed. No usage identifiers, provider keys, DB configuration or private rights records. Existing `/api/meta` shape remains compatible; Q&A may add a namespaced optional feature flag only.

## POST /api/qa/requests

Same-origin JSON `{language:"hu"|"en"}`. Establish/validate browser cookie and mint server request UUID plus an HMAC-signed opaque ticket bound to browser, corpus version, issue time and a 15-minute admission expiry. Returns 201 `{requestId, ticket, corpusVersion, expiresAt, language}`. No provider work or answer quota consumption. This route and question POSTs share the ten-submissions/network/minute window; the UI reuses one ticket for duplicate clicks rather than repeatedly minting. General Q&A request abuse limits also apply to reads.

Tickets do not authorize paid work by themselves. Malformed/missing cookie on a receipt read is 404, never silently new ownership. Signing secrets are shared by enabled backend instances; rotate keys with overlap sufficient for live tickets/receipts.

## POST /api/qa/questions

Same-origin JSON `{requestId, ticket, language, question}`; no client provider/model/URL/price/token-limit fields allowed. Question is NFC normalized, edge-trimmed, nonempty, <=4,000 Unicode code points and <=16,000 UTF-8 bytes, no NUL. Only hu/en. Strict body limit 20 KiB. Reject unsupported extra fields. Preflight bounds include generated prompt/schema overhead, not question text alone.

The ticket pins corpus version. If it is unavailable or has been withdrawn for rights/safety reasons, return `corpus_unavailable` without generation. Existing safe receipts can be replayed only while their corpus remains permitted. Reusing ID with a different normalized question, language or corpus is 409 `request_conflict` and never dispatches. Expired ticket with a live owned matching receipt replays the receipt; expired ticket without one is 410 `request_expired` and cannot be recycled.

For a new request the handler performs atomic admission and completes within the 60-second work deadline. It returns 200 with a terminal verified answer/abstention; an overlapping duplicate returns 202 `{requestId,status:"running"|"uncertain",retryAfter:2}` and never starts a second task. On disconnect keep accounting conservative, no automatic restart. Browser recovery GETs poll only while visible, at most once per two seconds for 65 seconds, then show a safe pending/failure state.

Terminal payload:

```json
{
  "requestId": "server-issued UUID",
  "status": "answered",
  "language": "hu",
  "corpusVersion": "approved content hash",
  "answer": {
    "claims": [{"id":"c1","text":"selected-language prose","kind":"attribution","citations":["e1"]}],
    "limitations": []
  },
  "citations": [{
    "id":"e1","articleId":"ST.I.q2.a3","editionId":"approved-edition",
    "sectionRole":"respondeo","sectionId":"section-id",
    "spans":[{"start":0,"end":20,"text":"server-sliced source"}],
    "sourceLanguage":"en","articleUrl":"/qa/source/version/ST.I.q2.a3"
  }],
  "translations": [{"citationId":"e1","language":"hu","kind":"generated_translation","text":"verified translated passage"}],
  "allowance": {"remaining":2,"resetAt":"UTC ISO timestamp"}
}
```

This is a schema example, not a real quotation or theological answer. Server supplies citation text, roles, locators and URLs; provider text cannot overwrite them. Kinds are `attribution|synthesis`; both require evidence, and synthesis is visibly labeled. An abstention uses status `abstained`, empty claims/citations as appropriate, and a curated selected-language reason. Supported partial answers use `answered` with explicit limitations and only validated supported claims. Full encoded payload <=64 KiB. Quotation text may remain English; prose, generated-translation labels and limitations follow selection.

## GET /api/qa/requests/:requestId?language=hu|en

Owner cookie required. 200 terminal receipt or 202 running/uncertain; 404 for other-owner, malformed/unrecognized IDs or absent identity; 410 only for an owning, recognizable expired ticket presented via a safe request header. Never expose existence through ownership differences. No response includes stored question, binding digest, ledger amount, worker token or provider request ID. State beyond recovery window may return safe `uncertain`; no answer is invented.

## GET /qa/source/:corpusVersion/:articleId

Read only approved public-serving article text, canonical locator, edition/provenance/notices and roles, not the whole corpus index. Validate identifiers against the pinned bundle; no path traversal, arbitrary filesystem path or remote fetch. Use safe text rendering, bounded output (256 KiB/article maximum) and explicit source language. Do not expose unapproved fixture or withdrawn sources. Never require paid work for citation inspection.

## Status/error categories

400 invalid input/language/JSON; 403 invalid origin; 404 ownership/unknown route; 409 changed request binding or busy browser; 410 expired request; 413 question/token/response size; 415 non-JSON; 429 browser daily limit, network rate, global capacity or monthly budget; 503 disabled feature, stale pricing, corpus/accounting/provider unavailable. Provider refusal/incomplete/schema/citation failure produces a safe selected-language category, never raw upstream response. Valid unsupported evidence is an abstention, not a transport error. Include Retry-After only when a safe retry time is known; uncertain outcomes direct users to their receipt rather than issuing new IDs.

## UI behavior

Standalone scoped Q&A page, accessible label/radio or select for Hungarian/English with no initial selection, labeled question field, keyboard submit and explicit processing/limit states. No automatic language inference or automatic resubmission. Disable duplicate local submits but rely on server deduplication. Language change affects later submissions, preserves prior answer language and source text. Render prose/quotes as text nodes, no raw generated HTML/Markdown execution. Sources expand to show article role/context and original wording; generated translations have a persistent visible label. Explain source scope, fallibility, provider processing/retention and browser/day/shared budget limits before first submission. No question history beyond current page and short-lived owned recovery receipt. The terminal and optional Python UI remain independently usable.
