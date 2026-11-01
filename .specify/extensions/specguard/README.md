# SpecGuard for Spec Kit

Local development extension for Spec Kit 1.2.5, initially targeting Codex skills.
The deterministic runner and its JSON contracts remain unchanged. Acceptance planning, review, delivery assessment and
summary authorship are agent responsibilities, not runner features.

## Scope and evidence

Resolve canonical absolute application root, feature directory, configuration,
runner executable and private evidence root before review. Ask when ambiguous;
never assume the framework checkout is the application. Identify the feature
using the application's Spec Kit context. One serial workflow owner handles an
approval; do not share it between concurrent agents.

Store private material outside public checkouts:

```text
PRIVATE_ROOT/application-feature/
  plan-ID/acceptance-evidence.md
  review-ID/selection-review.md
  review-ID/approved-config.json
  attempt-ID/verification-attempt.md
  attempt-ID/diagnostics.txt
  attempt-ID/report.json
  attempt-ID/summary.md
  attempt-ID/delivery-assessment.md
```

Use unique IDs and fresh destinations. Restrict local access as appropriate.
Never upload or copy private source, configuration, decisions or evidence into
the framework repository. For private applications, verify a local Git exclusion
for `specguard.json` before writing it; do not silently change shared ignore rules.
Inspect tracking/exclusion without invoking application scripts or repository
filters. A tracked private configuration requires a maintainer decision first.

Commands retain user file/network permissions. Process lifecycle controls are
not a security sandbox. Redaction is best effort and does not cover every secret
or private detail. Do not dump environment values or raw unsafe diagnostics.

## Installation

Use an already available Spec Kit 1.2.5 CLI in an initialized disposable Codex
application first:

```sh
specify extension add --dev /absolute/path/to/specguard/extensions/specguard
specify extension list --json
specify extension info specguard --json
```

`$speckit-specguard-prepare` has a mandatory unconditional `before_implement` hook.
It establishes a small agreed evidence set and stopping rule before implementation.
It does not authorize command execution.
`$speckit-specguard-review` has an optional unconditional `after_analyze` hook.
`$speckit-specguard-verify` has a mandatory unconditional `after_implement` hook.
Mandatory dispatch enters the approval gate; it does not authorize execution.
Direct verify entry performs the same gate, including when review was skipped.
Inspect generated command resolution
and installed `.specify/extensions.yml`. Spec Kit owns registration: preserve
unrelated hooks and generated core skills. Never overwrite the registration file
or manually duplicate entries. Use the installed CLI's supported removal/update
procedure before reinstalling and confirm a single enabled registration.

For 1.2.5 local development updates, `specify extension add --dev
/absolute/path/to/specguard/extensions/specguard --force` reinstalls the bundle.
Inspect registration afterward: exactly one enabled unconditional mandatory verify
hook, one mandatory prepare hook and one optional review hook. Do not depend on hook priority sorting or the
reserved `auto_execute_hooks` setting.

Templates live in the installed `.specify/extensions/specguard/templates/`
directory. Commands must resolve that application-local installation rather than
assuming the framework docs exist in the application.
The bundled human summary template is copied byte for byte from canonical
`docs/human-summary-template.md` in the framework checkout. Edit the canonical
source first, copy it into the bundle, and compare before installation validation.

## Authorization boundary

Review presents concrete checks before an explicit decision. Selection-only
approval permits preparation but does not authorize execution. One future attempt
requires an actual inspectable maintainer decision. Approval survives sessions
only for the same scope, unchanged configuration and execution-defining context,
and an unused attempt. Consume before invocation. Unknown/interrupted attempts
remain consumed; a rerun needs new explicit authority.

This is an agent-followed gate, not tamper-proof authorization. Missing, disabled,
conditional or malformed hook registration may prevent dispatch; core skills may
warn and continue. Do not claim a global enforcement guarantee. Standalone CLI
invocation retains its existing deliberate-invocation semantics from ADR-0002;
workflow approval is enforced by these command instructions, not the CLI.


## Bounded delivery assessment

Before implementation, agree a private `acceptance-evidence.md`: exact requirements
baseline, a small finite evidence set, check IDs and expected observations, bounded
agent review criteria, gaps, closure criteria and stopping rule. Use prepare even
when review was skipped; plan agreement is separate from execution approval.
After implementation, verify performs the final approved executable attempt and
writes its unchanged verification summary, followed by a separate private
`delivery-assessment.md`. It compares delivered artifacts with every agreed
requirement and cites evidence for the agent's reasoning. It runs no extra checks.
A blocked invocation still receives an assessment disclosing absent runner evidence.

Stop after one final authorized attempt and one bounded artifact assessment on
every outcome. Classify findings as delivery blockers, actually accepted limitations
with decision provenance, or deferred improvements with revisit triggers. Pending
acceptance cannot waive a closure criterion. Record lessons and recommend either
**Good enough to close** or **Blocked** with concrete reasons. The maintainer owns
acceptance. Missing prior agreement cannot be backfilled; changed baselines need
preserved, explicitly agreed amendments. This assesses delivery against agreement,
not whether the specification captured users' true needs. Never claim the harness
improved delivery without comparative evidence. No automatic remediation or retry.

Reinstall 0.2.0 using the supported force update and inspect all three registrations
and bundled templates. Existing features lacking a prior evidence plan must disclose
that gap; do not fabricate retrospective preparation. Missing/disabled hooks remain
an integration limitation, not an enforcement guarantee.
