# Browser Python workspace

Python mode is implemented but **disabled by default**. Set
`BIBREF_PYTHON_ENABLED=1` only in a deliberately enabled environment. Production
has not been changed or deployed by this work. Terminal remains the default.

## Using it locally

Build the existing Docker image, then run with the feature enabled:

```sh
docker compose build web
docker compose run --rm --service-ports -e BIBREF_PYTHON_ENABLED=1 web
```

Stop an existing `web` container first if it already occupies port 8090. The
compose Redis dependency remains local. Alternatively, the isolated acceptance
server below uses port 8091 and its own Redis namespace.

Open Python, choose an example or edit the default names exercise, and press Run
or Ctrl/Cmd+Enter. Stop terminates the worker and cancels any native operation.
Tab moves focus out of the editor; Ctrl/Cmd+] and Ctrl/Cmd+[ indent/unindent.
Downloads are `.py` files. Drafts are stored locally and never execute on restore.
Output is plain text, with buttons linking traceback lines to the editor.

`from bibref.tools import *` exposes the repository wrapper's calculation API,
including numbered aliases and `_n` forms. Return values preserve the original
wrapper, including its percentage-scaled floating point distances, nearest-match
tuple, nested occurrence lists and string `getrefs_maxlength` result. Process
helpers raise `NotImplementedError`. The original CLI/Python package is unchanged.

The supplied names are in the book's Greek-font ASCII notation: `Farec` means
`Φαρες`, `q` means χ, `j` means θ, and `w` means ω. Browser `text1/2` converts
ASCII words in that notation to Unicode Greek before sending the operation.
Unicode Greek retains the existing behavior. Use `latintext1/2` for bibref's
different internal Latin encoding. Unsupported book letters produce an error.

## Execution and security boundaries

- Pyodide 314.0.7 and CodeMirror are pinned in `package-lock.json` and self-hosted
  by `vendor.js`; Python and the editor are loaded only from Python mode. No
  Bible modules or native bibref engine are downloaded to the browser.
- Each execution gets a fresh module worker. A bounded SharedArrayBuffer channel
  lets synchronous Python functions wait while the page makes asynchronous
  requests. HTTPS (or trustworthy localhost), COOP `same-origin`, COEP
  `require-corp` and SharedArrayBuffer support are required. Unsupported browsers
  retain Terminal. No experimental JavaScript promise integration is required.
- The worker receives source and a bridge channel, never owner credentials,
  session/run identifiers or API URLs. Its CSP allows runtime assets and the
  adapter source only. It blocks direct API/external network access, nested
  workers, arbitrary JavaScript evaluation and external package downloads.
  `wasm-unsafe-eval` is limited to the worker policy.
- Worker messages are untrusted. The page restricts operations and argument size;
  the server independently validates operation names, arity, types, clipboard
  indices, numeric bounds, module names and single-line command construction.
  Server validation rejects control characters, newlines and comment delimiters.
  It never evaluates Python or accepts shell commands through this interface.
- This is not a separate-origin browser VM. Only run scripts you trust; malicious
  code can consume its own tab's CPU/memory and access permitted browser-worker
  facilities. No browser memory-isolation guarantee is made. There is no sharing
  link, automatic script execution or package installation feature.
- Private Redis run sessions occupy a separate namespace from terminal sessions
  and count against storage capacity. Creation atomically checks source ownership,
  revision, engine version and idleness, then clones its state. One Python run is
  allowed per source session. Native calls run sequentially through the existing
  credential-free subprocess executor and memory/process-group limits.
- Each native operation uses the **same global concurrency and daily execution
  budget** as Terminal. Idle Python does not reserve a native slot. Only successful
  native calls advance the private snapshot; terminal state/revision/history are
  never committed by Python. A terminal may continue independently after the clone.
- Limits are 256 accepted native calls, 12 minutes from run creation, 64 KiB source,
  five starts/hour/IP, 120 Python submissions/minute/IP and the existing general
  API rate limit. Result/output allowance is 2 MiB across the run. The server
  conservatively counts native output plus returned values; browser output and
  response values are also bounded by the client. Native searches cap explicit
  `maxresults()` settings at 10,000.
- Server time, call, output, ownership and admission limits cannot be disabled by
  changing Python/JavaScript. Local script-size/stdout/device limits protect normal
  UI use, rather than acting as server authorization controls.
- Stop terminates the worker, aborts the request and asks the server to end the
  run. Active native work is cancelled through Redis polling; dropped streams
  get the existing ten-second grace period. Expiry is absolute, with cleanup
  grace. Failures retain a 60-second outcome receipt but discard clipboard state.
  Explicit completion discards the private session. Incomplete cleanup expires.
- Platform logs contain event/status/category/duration only, not source,
  operations, arguments or results. No new external service or credentials exist.

## API

All mutations require the existing signed owner cookie, same-origin JSON request,
and valid identifiers. Endpoints exist only when the feature flag is enabled.

- `POST /api/sessions/:id/python-runs` with `{revision}` returns
  `{id, deadline, sequence: 0}`. Python source is never submitted.
- `POST /api/sessions/:id/python-runs/:runId/operations` with
  `{requestId, sequence, operation, args}` uses SSE: `accepted`, optional
  `heartbeat`, then `completed`/`failed` carrying a `record`. Success contains
  `record.value`; failures contain safe `code`/`message` fields.
- Duplicate completed requests return `recorded`; running duplicates return
  `running`. A reused request ID with different arguments is rejected. Sequence
  checks prevent replay after retained history is trimmed. Never automatically
  resubmit an uncertain request. Capacity/rate rejections before admission can
  wait and retry; uncertain connections query their original receipt.
- `GET /api/sessions/:id/python-runs/:runId/operations/:requestId` retrieves a
  completed/failed receipt or running status.
- `POST /api/sessions/:id/python-runs/:runId/end` with `{}` ends/cancels the run.

## Verification and release

With local Redis on port 6380:

```sh
npm --prefix server ci
node server/vendor.js
npm --prefix server test
python3 server/test/python-compat.py
node server/node_modules/playwright/cli.js install chromium firefox webkit
node server/test/python-runtime-browser.mjs
```

For full native acceptance, build `Dockerfile.vercel` as `bibref-python-test` and
run `test/python-local-server.mjs` inside it, with `TEST_REDIS_URL` pointing to
local Redis. Bind only localhost port 8091. This test entrypoint creates an isolated
test namespace and refuses Vercel environments. Then run:

```sh
node server/test/python-browser.mjs
BIBREF_WEB_URL=http://127.0.0.1:8091/ node server/test/browser.mjs
BIBREF_WEB_URL=http://127.0.0.1:8091/ node server/test/cancel-browser.mjs
```

Reports/screenshots go to ignored `server/test-results`. Tests use scoped keys,
never flush Redis, and do not use production credentials. The compatibility test
compares 21 wrapper return contracts/types against the original wrapper using a
deterministic engine transcript; full browser acceptance additionally checks live
native results. The runtime bridge is tested in Chromium, Firefox and WebKit.

Local acceptance on 2026-10-15 matched **all 39 supplied LXX counts**. The names
exercise, including Python startup and 79 native calls, took **8.9–17.5 seconds**
across two passes with warm native filesystem caches. The browser-only infinite loop stopped in
**67–78 ms**. Existing native `nearest12` cancellation took about **2 seconds**
and preserved terminal clipboards. These are local measurements, not Vercel SLAs.
The self-hosted Python assets total about 13.5 MB before HTTP compression; Terminal
does not load them. The measured terminal resource size was approximately 345 KB.

All three sequential fork PRs target `feat/server-web-vercel`; merge runtime,
then run API, then workspace. Later branches contain earlier commits until those
PRs merge. Keep the flag off until checks pass. Upgrade the Vercel CLI before
deployment work, then validate an explicitly authorized preview with the feature
enabled before any production release. No deployment, production enablement,
Git integration change, branch rename or upstream PR is part of implementation.
