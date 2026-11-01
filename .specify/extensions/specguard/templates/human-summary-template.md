# Human verification summary

Default template for agent-authored summaries of SpecGuard evidence. Adapt the
detail to the task; aim for 150 words excluding evidence links. SpecGuard produces
the JSON report. The agent writes this summary. The local Spec Kit extension
guides that authorship after an approved attempt; the runner does not generate
prose. This is the canonical source, copied byte for byte to
`extensions/specguard/templates/human-summary-template.md` for installation in
other applications. Synchronize that copy after edits and verify before release.

Keep observed results separate from interpretation and recommendations. Preserve
failed, skipped, and inconclusive outcomes. Do not infer full requirement coverage
from passing checks. Keep private summaries and evidence outside public checkouts.
Replace placeholders; remove these instructions from the finished summary.

## Purpose

[What was checked, and why. Mention relevant changes or experimental conditions.]

## Results

[Observed individual outcomes/reasons and invocation exit/signal or unknown.
Identify attempt/run and report usability/persistence. Preserve failed, skipped,
inconclusive, cancellation, missing evidence and runner errors honestly. An
apparently passing report with failed/unknown invocation does not pass verification.]

## Interpretation

[What the evidence supports. Identify this as the agent's assessment, not a tool
finding. Distinguish a detected project failure from a harness failure.]

## Limits

[Relevant untested/skipped scope, unavailable evidence, capture/cleanup/truncation
limits, redaction limits or uncertainty. Include this fixed coverage statement:]

Configured check outcomes only; full business correctness and specification
compliance are not established. Automatic requirement mapping is not provided.

## Next step

[Advisory recommendation for the maintainer. Verification stops here. No automatic
fix, retry, configuration change, install or resumed implementation. Do not invent
approval or imply that a recommendation authorizes further execution.]

Evidence: [Link to JSON reports and relevant comparison/change records; use run
IDs to disambiguate runs. Link to source-change evidence separately when available.]
