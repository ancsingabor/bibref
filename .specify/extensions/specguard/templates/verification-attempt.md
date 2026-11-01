# Verification attempt

Copy privately. Workflow states below are not runner JSON fields or enums.

- Attempt ID: [unique; never reuse]
- Review ID / real additional authorization reference: [private record]
- Approval consumption timestamp: [before invocation]
- Canonical application / feature / config: [absolute paths]
- Current config SHA-256 / approved snapshot: [matched immediately before invocation]
- Rechecked execution conditions / runner identity: [evidence, uncertainties]
- Exact safe invocation: [executable plus argument array; no secret values]
- Fresh report / summary / safe diagnostics paths: [private; never overwrite]
- Start / end time: [observed or unknown]

State: reserved (approval consumed), invoking, finished, or interrupted/unknown

- Actual state: [one value]
- Observed exit / signal: [actual or unknown]
- Report persistence: [established / unsuccessful / unknown, with evidence]
- Report relevance and validity: [usable / unusable / missing, with reason]
- Runner runId: [only if usable]
- Observations / individual outcomes: [preserve distinctions]
- Capture / cleanup / coverage limitations: [observed, no invented facts]
- Evidence links: [private snapshot, decision, report when available, diagnostics, summary]

An attempt has zero or one usable report

A workflow attempt ID differs from the runner-generated runId and can exist without a report.

Failed preflight still consumes the attempt. Persistence failure before invocation
blocks execution. Any ambiguous consumption or invocation remains consumed; never
restore unused state. No retry, fix, configuration change or resumed implementation.
