# Python mode for the experimental hosted bibref

Implementation update (2026-10-15): the selected design runs Python in a browser
worker and forwards only validated bibref operations to private server snapshots.
See [implementation, security boundaries and release checks](../../server/PYTHON.md).
The earlier server-side sandbox direction below is historical, not the selected
execution architecture. Production remains unchanged.

Saved 2026-10-15 at the user's request for continuation in a separate chat.

## Project context

The server web version is a standalone experiment in ancsingabor/bibref on
feat/server-web-vercel, deployed at https://bibref-server.vercel.app/.
There is no plan to merge this server project upstream. Upstream PR #36 is a
separate HunRUF/Aleppo WASM contribution and remains independent.

Current architecture: browser terminal → Node.js/Express container → native C++
bibref subprocess; Upstash Redis persists sessions. The browser receives no Bible
corpus or WASM engine.

## User's desired feature

Paste and execute Python examples from the Hungarian bibref book, especially
exercise 2.1: check names from Matthew 1:1–16 against the LXX and count matches.
The user is open to experimental approaches. No implementation is authorized by
this note; the user intends to discuss it in another chat.

Example shape (the book's full list has 39 names):

```python
from bibref.tools import *

names = ["Farec", "Zara", "Esrwm", "Aram"]
maxresults(10000)
for name in names:
    text1(name)
    occurrences = find1("LXX")
    print(f"{name}:{len(occurrences)} ", end="")
```

PDF extraction may corrupt indentation and characters. Preserve real Python
semantics; do not assume arbitrary PDF-pasted text is already executable.

## Proposed direction, not yet validated

- Python editor/mode alongside the existing terminal, with Run, streamed output,
  and Cancel.
- Compatibility with the existing bibrefpython `bibref.tools` API. Inspect its
  actual implementation and return values before choosing an adapter.
- Python orchestrates; native C++ performs all bibref computations.
- Prefer one isolated job with one persistent native engine for the whole script,
  avoiding native startup for every wrapper call. The current machine interface
  runs one command per process, so persistence needs investigation and changes.
- Start from current session clipboards/settings. Decide explicitly whether and
  when script state commits back, including failure/cancellation behavior.
- Standard Python plus bibref wrappers initially; third-party packages later.
- Arbitrary Python requires a real isolation boundary: no application secrets,
  restricted filesystem/network, memory/time/output limits, process cleanup.
  A normal subprocess in the current application container alone is insufficient.
- Research deployment/runtime options and costs before committing to an execution
  architecture. No Python runtime or sandbox provider has been selected/provisioned.

## Pending release context

User explicitly requested commit-only work while collecting more fixes; do not
deploy until asked.
- bf6e954: fixed long-output scrolling; desktop/mobile browser checks passed.
- b4e7ce1: browser-only `clear`, autocomplete and greeting; preserves server
  history/state; desktop/mobile checks passed.
- Neither fix is deployed. The accidental preview for the scroll fix was removed;
  production remains unchanged.
