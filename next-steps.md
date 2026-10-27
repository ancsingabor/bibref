# Next steps

## Implemented: Shared usage and recent activity

The compact disclosure below the header helps users understand server availability
before submitting commands. It shows slots and approximate available daily time;
expanded details cover consumption, reservations, recent browser activity, reset
and retry guidance. It matches the existing terminal styling.

Usage refreshes once/minute while visible and after local command outcomes
(coalesced to five seconds). Activity means recent visible keyboard, pointer or
command interaction; idle open tabs do not renew it. Anonymous browser identifiers
deduplicate tabs where storage is available. Stale/unavailable metrics never
block command input. See `server/README.md` for API and accounting details.

Delivered requirements:

- Show occupied execution slots out of the global limit.
- Show approximate remaining daily execution allowance and a countdown to its
  UTC reset, displaying the reset time in the user's local timezone.
- Distinguish time already consumed from reservations for running commands:
  admission reserves the full command deadline and refunds unused time, so
  available allowance is not a promise of how many commands can still run.
- Explain capacity rejection and when to retry; the server currently has no
  waiting queue or fairness guarantee.
- Show an approximate count of browsers active in the last 15 minutes. Define
  activity explicitly and use expiring, anonymous browser activity records;
  retained sessions and IP addresses must not be presented as unique people.
- Label activity counts as approximate browsers, not users or accounts.

Implementation constraints:

- Return aggregate information only; expose no session IDs, commands, ownership
  information, IP addresses, or credentials.
- Keep resource enforcement server-side and preserve existing ownership,
  revision, lease, request reconciliation, and same-origin protections.
- Use bounded updates and expiring activity records so the indicator does not
  materially increase Redis usage or consume native execution slots. Account
  for multiple tabs and make stale/unavailable metrics explicit.
- Derive displayed limits from server configuration. Explain that preview and
  production share global admission and daily execution allowance.

Verification completed with local Redis and isolated namespaces: slot occupancy,
reservation/refund behavior, UTC rollover, activity expiry and multiple tabs,
and unavailable/stale metrics. `npm --prefix server test` passes (33 tests).
`node server/test/usage-browser.mjs` passes desktop, mobile portrait/landscape,
keyboard disclosure, outcome refresh and failure recovery checks using a
local deterministic runner. Python was not enabled and nothing was deployed.

## Shared-network session limits

Session creation uses the signed ownership cookie for its normal 30/hour browser
allowance, with a broader atomic 120/hour/IP safeguard against cookie rotation.
Tabs sharing a cookie share the normal allowance; separate browsers behind one
IP do not share it. Command/API limits remain network-scoped. Rate-limit errors
identify the limiting action and browser/network scope, report the actual Redis
window retry time, and display that time locally in the example runner/terminal.
