# Data Model

No production schema or persistence changes. The following are test/evidence entities.

| Entity | Fields and relationships | Validation |
| --- | --- | --- |
| BoundaryCase | ID, G1/G2/G3, requirement IDs, fixture state, request/process stimulus, expected status/category, protected-state comparison, runner delta, positive control, limit | Unique ID; one primary failure dimension; source-backed oracle; no secret values in public descriptions |
| OwnerFixture | independent owner A/B cookies, session/run/request IDs, unique Redis namespace, active-work controls | Cookies are local test-only; valid controls; never production secrets; cleanup only owned keys/resources |
| ProtectedSnapshot | clipboard/settings, history, revision, active work, Python run state | Exact denied-request comparison; failure receipts/revisions distinguished from saved-state changes |
| CheckGroup | ID, risk, gap, finite cases, claims, limits | At most three improved groups; existing regression checks do not count as added groups |
| EvidencePlan | private ID, baseline/digests, FR mapping, E1–E3, budgets, gaps, closure/stopping rules, actual agreement reference | Pending until real maintainer agreement; immutable original plus linked amendments |
| SetupRecord | private ID, clean-copy provenance, runtime/package/browser/runner identities, local service/namespace, network, cleanup owner | No setup audit; no production endpoints; no assumed availability |
| SelectionDecision | snapshot/hash, exact executable/args/cwd, network, time/output limits, evidence paths, actual decision, use state | Selection-only is not execution; changed/uncertain conditions require review; preserve existing config |
| Attempt | unique ID, decision link, reserved/invoking/terminal timestamps, result references and per-check outcomes | Fresh private paths; persisted consumption before invocation; no reset or overwrite |
| AssessmentFinding | requirement/evidence references, observation, separate judgment, class, rationale, revisit trigger, acceptance reference | Missing acceptance remains pending; unmet closure cannot be deferred to manufacture closure |

## State transitions

Evidence plan: draft → agreed (actual decision) → linked amendment if needed.
Setup: planned → separately authorized → prepared or unavailable.
Selection: pending → approved/declined; approval can become revoked/superseded.
Authorized use: unused → consumed before final invocation; irreversible.
Attempt: reserved → invoking → completed/failed/interrupted/unknown; all stop.
Assessment: one bounded pass → Good enough to close or Blocked → stop.
Maintainer acceptance: separately pending until a real decision, independent of recommendation.

Raw evidence and decision records remain private outside public checkouts. Never
copy older evidence as current proof or backdate pre-implementation agreement.
