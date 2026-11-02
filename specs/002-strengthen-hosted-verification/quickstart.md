# Validation Guide — Future Authorized Work Only

Nothing below has been executed during planning. This guide is not execution
approval. Read [contracts](contracts/verification.md) and [data model](data-model.md).

## 1. Agree evidence before implementation

Run the installed `$speckit-specguard-prepare` workflow when implementation is
requested. Use its private acceptance-evidence template and propose E1–E3 and the
75-case inventory from this design. Pin spec/plan/tasks digests, closure criteria,
finite budgets and stopping rule. Obtain real agreement before editing tests.
Do not turn the current public plan into a retroactively approved private record.

## 2. Prepare isolated dependencies separately

Obtain a separate setup decision for an absolute local verification directory
outside the active checkout, disposable Linux environment, service ports, npm
registry downloads, browser downloads and (if needed) container image pulls.
Record baseline plus explicitly enumerated test/doc changes copied there; exclude
private config, evidence, credentials and active node_modules. Do not create a
second Git worktree that silently omits uncommitted implementation changes.

Within that prepared copy, these are setup command templates (resolve placeholders
before use; not runnable authorization):

```sh
npm --prefix "$VERIFY_ROOT/server" ci --ignore-scripts --no-audit --no-fund
node "$VERIFY_ROOT/server/vendor.js"
node "$VERIFY_ROOT/server/node_modules/playwright/cli.js" install chromium firefox webkit
```

Review dependency lifecycle needs first. If ignored scripts leave missing binaries,
stop and agree exact additional setup; do not enable all scripts automatically.
Use an isolated Playwright browser path and npm cache, and a separately prepared
Redis 7 bound only to loopback (example unused port 6380), with unique namespaces.
Avoid `--with-deps` host package changes; prefer pre-provisioned Linux dependencies.
Record actual Node 24/Python/browser/Redis/SpecGuard identities and required tools.
Build/locate the existing local SpecGuard runner here if necessary, before review.
No audit, application checks, production service contact or Redis flush during setup.
The setup owner removes only the resources created for this feature after evidence
is preserved. Verify must not install or repair prerequisites.

## 3. Implement only after agreement

Extend existing tests in G1–G3 and document claims/limits. No application behavior
changes. Development executions also require concrete scope approval; evidence-plan
agreement or setup authorization grants no test-running permission. Keep final
attempt authority separate from any explicitly authorized development checks.

## 4. Review exact final selection and seek execution approval

Use `$speckit-specguard-review` to inspect the final executable selection without
running it. Preserve existing private specguard.json. Set SpecGuard's `--repo` to
the canonical absolute VERIFY_ROOT. Locally exclude `VERIFY_ROOT/.verification/`
from Git before creating `VERIFY_ROOT/.verification/specguard.json` as the runnable
candidate. Keep the immutable approved snapshot at
`PRIVATE_ROOT/approved-selection.json`, outside the checkout; record matching bytes
and SHA-256 for both files. Invoke with the repository-contained configuration,
not the external snapshot.

Use repository-relative configuration `cwd` values (`.` or `server` as appropriate)
that resolve inside VERIFY_ROOT. Record their resolved absolute paths and absolute
executable identities in the selection review.

Proposed commands, all resolved against the isolated verification root:

| Entry | Command | Timeout |
| --- | --- | --- |
| server | npm --prefix <root>/server test | 180s |
| compatibility | python3 -B <root>/server/test/python-compat.py | 30s |
| usage browser | node <root>/server/test/usage-browser.mjs | 120s |
| runtime browser | node <root>/server/test/python-runtime-browser.mjs | 300s |
| dependency audit | npm --prefix <root>/server audit --omit=dev --json | 90s |
| diff hygiene | git -C <reviewed-source-root> diff --check <baseline> | 30s |

Each entry output limit 256 KiB; browser artifact paths must resolve under a fresh
private attempt directory, not a previous server/test-results destination. Existing
scripts use server/test-results: in the isolated copy redirect that location to
the fresh approved private directory during setup/review, documenting the binding.
Pin TEST_REDIS_URL to the isolated local service; record required environment names
without values. npm test includes existing suite coverage, not just new cases.

Disclose before approval: audit contacts the configured npm advisory registry over
HTTPS. Establish its exact endpoint from the isolated npm configuration. Review the
installed npm audit implementation/config to identify payload fields; disclose
package names/versions and any lockfile/tree/request metadata it sends. Do not
claim no source/credential disclosure without reviewing actual configuration.
If endpoint or payload cannot be established, block approval of that entry.
Audit does not scan a deployed host, evaluate exploitability or upgrade packages.

Capture exact args/cwd, scripts/config/lockfile and installed dependency identities,
network allowance, report/diagnostic paths, limits and redaction names in the private
selection review. Ask for explicit approval of that selection and one future attempt.
If availability, scope or conditions change, return to review rather than adapting silently.

## 5. One final SpecGuard attempt and stop

Invoke `$speckit-specguard-verify` only with valid unused execution authority. It
records consumption, reserves fresh paths and invokes the already built runner
once. Expected evidence is per-check outcomes and the contract assertions, not an
assumption of passing. Record failures/timeouts/interruption/not-run as observed.

Use installed delivery-assessment/human-summary templates for one bounded pass.
Map FR-001–011, separate deterministic observations from judgments, classify extra
findings with revisit triggers, record lessons, and recommend Good enough to close
or Blocked. Unmet required claims or unavailable required evidence block closure.
No retry, repair, new checks or extended investigation after that terminal stop.
Maintainer acceptance remains a separate decision.

## Runner host and Linux command boundary

The installed SpecGuard runner supports macOS arm64 with Node 24/26. Keep that
runner on the supported host; execute the five application entries through exact,
reviewed Docker argument arrays against the prepared Linux image. Run diff hygiene
on the host against the isolated copy's pinned Git baseline. The six logical
entries and existing budgets remain unchanged. Never run the runner inside Linux
and assume its host preflight supports that platform.

Pin the prepared local image ID, use `--pull=never`, and bind only the isolated
copy and fresh browser-artifact destination. Share the disposable Redis container's
network namespace for loopback service access; publish no host ports. The container
namespace may permit outbound network: application checks are approved only for
local fixture traffic, while the audit entry separately discloses registry HTTPS.
Do not forward host credentials or configuration into containers.

Disclose before execution that host process-group cleanup supervises Docker client
processes, not every process in Docker's Linux VM. Docker's signal forwarding and
container removal do not establish a hard sandbox guarantee; interrupted attempts
may leave owned containers requiring separate cleanup. Never silently rerun checks.
