# Server-based bibref

The fork's canonical/default base is `feat/server-web-vercel`; `bibref-server`
names the Vercel project. New PRs target the fork base, independently of upstream.
On 2026-10-15 the Vercel project had no Git integration/production branch configured;
its production target recorded commit `598975e615061c58ada69399755b8b519ea5aaff`.
Do not infer deployment status from a branch name or deploy without an explicit request.

The [optional Python workspace](PYTHON.md) runs Python in the browser while
native searches stay on this server. It is disabled unless
`BIBREF_PYTHON_ENABLED=1`; default deployments retain the terminal alone.

This hosted variant keeps all six SWORD modules and the Greek caches on the
server. The browser provides the terminal and optional Python editor; commands use the original native
processor through its optional JSON-lines interface. Standard CLI and WASM
builds still default to `BIBREF_JSON=OFF`.

## Local development

From the repository root:

```sh
docker compose up --build -d
```

Open http://localhost:8090/. Compose uses real local Redis with a persistent
volume, a development-only cookie key, and a read-only application container.
Use `docker compose down` to stop it; `docker compose down -v` also removes the
local session data.

For tests, run a disposable local Redis on port 6380, then:

```sh
npm --prefix server ci
npm --prefix server test
node server/node_modules/playwright/cli.js install chromium
node server/test/browser.mjs
```

Set `TEST_REDIS_URL` for another local Redis. Browser acceptance defaults to
port 8090; set `BIBREF_WEB_URL` for a deployment. Screenshots and JSON results
are written beneath `server/test-results` (ignored by Git). Keep browser test
runs below the public rate limits; the suite performs fewer than 30 commands.

## Vercel

The project is `bibref-server` under `ancsingabors-projects`. Its native container
uses `Dockerfile.vercel`, Frankfurt (`fra1`), Standard memory and an 800-second
project function timeout. The supervisor stops execution after 720 seconds,
including process startup. Vercel's container runtime is currently beta.

Upstash was provisioned through Marketplace with plan `free`, region `fra1`,
`autoUpgrade=false`, `eviction=false`, and `prodPack=false`. No paid Redis upgrade
is automatic. Marketplace injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into
the backend. `BIBREF_COOKIE_SECRET` is a server-only random secret set separately
for development, preview and production. Preview deployments stay protected by Vercel authentication; production is public.
Never put credentials in public assets,
Docker layers, committed files or command-line arguments.

```sh
vercel deploy --target preview --yes --scope ancsingabors-projects
# Run browser and API acceptance against the resulting preview first.
# Build the production environment without publishing its aliases yet:
vercel deploy --prod --skip-domain --yes --scope ancsingabors-projects
# Verify that production deployment without auth headers, then:
vercel promote PRODUCTION_DEPLOYMENT_URL --scope ancsingabors-projects
```

Sessions are namespaced by `VERCEL_ENV`; global admission and usage limits are
shared across preview and production. Development/testing can use separate
namespaces; tests use unique keys and never flush the database. Changing the
native binary or module inputs changes the engine manifest hash. Existing
incompatible sessions remain readable but cannot execute new commands.

## API and execution semantics

- `GET /api/meta`: engine/module versions, notices, completion vocabulary, limits.
- `GET /api/health`: process/storage availability.
- `POST /api/sessions` with `{}`: create an anonymous session.
- `GET /api/sessions/:id`: resume state/history and discover a running command.
- `DELETE /api/sessions/:id` with `{}`: delete an idle session.
- `POST /api/sessions/:id/commands` with `{requestId, revision, command}`:
  stream `accepted`, `output`, `heartbeat`, then `completed` or `failed` events
  over SSE. Completed duplicates return `recorded`; running duplicates return
  `running`. Use a UUID request ID and never blindly retry uncertain requests.
- `GET /api/sessions/:id/commands/:requestId`: retrieve the recorded outcome.
- `POST /api/sessions/:id/commands/:requestId/cancel` with `{}`: request cancellation.

Browser ownership uses a signed HttpOnly, SameSite cookie; Secure is enabled on
Vercel. Mutations require same-origin JSON requests. Session IDs alone do not
grant access. Each tab keeps its own session ID; this browser's recent-session
list contains identifiers only. No accounts or cross-device sharing are included.

The bridge restores clipboards and settings in an isolated native process.
The subprocess receives no Redis/cookie/Vercel credentials and has a 512 MiB
address-space limit. Fingerprint analysis rejects non-a-z clipboard contents
in the hosted interface instead of indexing native arrays out of bounds.
Only a successful command can commit changed clipboard/settings state, guarded by a revision and
lease token. Errors, cancellation, output limits and crashes retain the preceding
snapshot. Outcome checkpoints advance the session revision even on failure,
so an old request cannot silently re-execute after its retained history expires.
Oversized history records retain the outcome/request ID with an explicit
truncation notice rather than silently losing deduplication. `quit` closes the hosted session; New Session starts a fresh one.
Expired leases record an interrupted outcome and do not replay the command.

Resource defaults:

- Two concurrent commands globally, one per session.
- 30 submissions/minute/IP, five session creations/hour/IP, 120 API requests/minute/IP.
- 64 KiB command input, 64 KiB per clipboard, 2 MiB command output.
- Seven-day sliding session expiry; newest 100 commands and at most 2 MiB of history.
- 200 MiB global session capacity, conservatively reserved in 2.25 MiB slots.
- One hour of aggregate execution daily (UTC): reserve the full command deadline
  before starting and refund unused time after completion. Interrupted servers
  retain their reservation conservatively. New execution pauses when admission
  cannot reserve enough allowance; the UI/history remain accessible.
- Cancellation checks every two seconds, SSE heartbeats every ten seconds;
  disconnected clients are cancelled after a ten-second grace period.

Rate controls and admission bound useful execution, not total monetary spending
or all incoming internet traffic. Free Redis stops at its provider limits;
Vercel CPU, memory, bandwidth and builds still consume the team's allowance.
Logs contain status, error category and duration, not commands, verses or clipboards.
Do not use team-wide auto-pause settings to protect this project at the expense
of unrelated applications. A project-scoped Vercel rule, "bibref resource usage
and server errors", notifies team owners of high-severity CPU/duration/bandwidth/
invocation anomalies and API 5xx anomalies. It is usage monitoring, not a
project-specific currency cap. No team-wide rule or spending limit was modified.

## Module notices

Module pins and archive checksums are documented in `docker/cli/web/README.md`.
The server preserves configs, including copyright notices, and publishes source
links at `/notices.html`. Scientific-use attribution does not grant additional
rights; backend hosting does not itself settle permission for public text serving.
The browser receives requested results, including raw Greek book output where
requested and within technical limits; no corpus download endpoint exists.

## Acceptance results (2026-10-13)

The native Docker build and six-module smoke tests passed. Automated API, Redis
and subprocess tests cover ownership, revisions, deduplication, concurrency,
cancellation, stale leases, budget admission, expiry, quotas, malformed output,
crashes and deadlines. The five archive validation tests remain passing.

Chromium passed 23 terminal checks locally and against a protected Vercel preview:
all requested Hungarian/Hebrew and existing-module lookups, Greek clipboard
comparison, tokens/search, an underscored book, real Tab completion, multiline
Statement paste, SVG, refresh/resume and escaping hostile clipboard text.
Hebrew ordering and SVG were visually inspected. No browser errors occurred.
Browser assets total 340,176 bytes; no WASM, module ZIP or corpus request occurs.
Local readiness was approximately 0.3 seconds; the first measured preview
readiness was approximately 1.1 seconds, with a sample HunRUF lookup taking
approximately 0.6 seconds over the network. Measurements depend on network,
cache state and platform cold starts. The production-environment build also
passed the 23 checks without authentication headers: approximately 0.8 seconds
to readiness and 0.55 seconds for a Hungarian lookup. A real nearest12 run
was cancelled from the browser in approximately two seconds and retained both
clipboards. API/subprocess/storage checks total 13 passing tests.

## Python examples from the book

The Python editor includes both code examples from `bibref-hu-20260812+.pdf`:
exercise 2.1 (p. 22), counting Matthew 1 names in the LXX, and exercise 2.5
(p. 45), finding the nearest passages to Matthew 5:31 in Leviticus, Numbers,
and Deuteronomy. The examples preserve the book’s inputs and operations, with
source comments, browser-ready indentation, and an English explanatory comment.
The whole-book searches can take several minutes; Stop cancels a running script.
A nearest match is a similarity result, not evidence of a quotation: the book
discusses these particular matches as false positives.
