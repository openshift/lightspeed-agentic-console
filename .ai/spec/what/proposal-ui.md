# Proposal UI — behavioral specification

Scope: proposal list, detail, multi-stage approval UX, sandbox log streaming, structured “dynamic” renderers, markdown safety. Type shapes and CRD fields are defined in the operator and mirrored in TypeScript for the console only as needed for UI bindings — see `lightspeed-agentic-operator` CRD/OpenAPI docs; phase derivation must stay in sync with `lightspeed-agentic-operator/.ai/spec/what/proposal-lifecycle.md` (operator `DerivePhase`).

## Behavioral Rules

1. The list page watches all namespaced `Proposal` resources and presents a virtualized table row per object with sortable columns: name (links to detail), phase (derived and displayed per rules 8–17), request text (truncated after a fixed preview length with ellipsis), namespace, and age from `metadata.creationTimestamp`.
2. List phase filtering uses the same derived phase as the phase column; filter options exclude at least one operator-derived phase value that the list can still display when derived (filter set and derived phase set can disagree).
3. The detail page watches a single `Proposal` by route params (`namespace`, `name`), the matching namespaced `ProposalApproval`, cluster-scoped `Agent` list (for names), and namespaced `AnalysisResult`, `ExecutionResult`, `VerificationResult`, and `EscalationResult` lists filtered by label selector `agentic.openshift.io/proposal` = proposal name.
4. The detail header shows proposal name, a phase badge (color and label per rule 16), and `PhaseIcon` (per rule 17); it does not duplicate namespace in the header row (namespace appears in the Overview tab).
5. Tab set is chevron-style: `Overview`, `Proposal`, `Execution`, `Verification`, and conditionally `Escalation`. `Escalation` is omitted unless an `Escalated`-typed condition exists on the proposal. For CMO-sourced alert proposals (label `ols.openshift.io/source` = cluster-monitoring-operator, and not trigger-bootstrap), `Overview` is hidden and the default tab selection treats `overview` as `proposal`.
6. A “trigger-bootstrap” proposal (label `ols.openshift.io/proposal-type` = trigger-bootstrap) renders a dedicated simplified layout: trigger display name from `ols.openshift.io/trigger-name` label or metadata name, phase badge, optional analysis sandbox logs, and structured options rendered only via adapter `components` (no standard tab chrome).
7. The Overview tab shows phase (icon + badge), markdown-rendered `spec.request`, optional external source link from annotations `ols.openshift.io/source-url` / `ols.openshift.io/source-name`, `spec.targetNamespaces` when non-empty, formatted creation time, and sandbox claim display for analysis, execution, and verification steps when `status.steps.*.sandbox.claimName` is set.
8. **Phase derivation** (must match operator `DerivePhase` and `proposal-lifecycle.md`): Evaluate `status.conditions` in a fixed precedence chain; mirror the operator implementation.
9. If there are no conditions, derived phase is `Pending`.
10. If an `Escalated` condition exists with status `True`, derived phase is `Escalated`.
11. If a `Denied` condition exists with status `True`, derived phase is `Denied`.
12. If an `Escalated` condition exists but its status is not `True`: when status is `Unknown`, derived phase is `Escalating`; otherwise derived phase is `Failed`.
13. If a `Verified` condition exists: when status is `True`, derived phase is `Completed`; when `Unknown`, `Verifying`; when status is neither, if reason is `RetryingExecution` then `Executing`, else `Failed`. (When this condition row exists, earlier branches did not return.)
14. If no `Verified` condition exists and an `Executed` condition exists: when status is `True`, `Verifying`; when `Unknown`, `Executing`; otherwise `Failed`.
15. If no `Executed` condition exists and an `Analyzed` condition exists: when status is `True`, `Proposed`; when `Unknown`, `Analyzing`; otherwise `Failed`. If no condition in the chain matched, derived phase is `Pending`.
16. **Phase display mapping** for badges (`getPhaseDisplay`): `Pending` → grey / “Pending”; `Analyzing` → blue / “Analyzing”; `Proposed` → teal / “Proposed”; `Executing` → purple / “Executing”; `Verifying` → orange / “Verifying”; `Escalating` → orange / “Escalating”; `Completed` → green / “Completed”; `Failed` → red / “Failed”; `Denied` → red / “Denied”; `Escalated` → orangered / “Escalated”; unknown string → grey / raw string or “Unknown”.
17. `PhaseIcon` maps a subset of phases to distinct icons; phases without an explicit case reuse the default idle icon. `Completed` shows a warning icon instead of success when execution or verification result outcome is failed (parallel display nuance).
18. **Analysis approval**: When `ProposalApproval` exists, the proposal is not in a terminal derived phase, no `Analysis` stage is recorded in `ProposalApproval.spec.stages`, and (`Analyzed` condition is missing OR its status is not `True`), the UI offers approve/deny for analysis (optional agent dropdown from cluster agents, defaulting to `spec.analysis.agent`). Approving patches `ProposalApproval` with a new `Analysis` stage without `decision: Denied`. Denying adds `decision: Denied`.
19. **Execution approval**: When `Analyzed` is `True`, no `Executed` condition row exists yet, a terminal phase is not active, and no `Execution` stage is recorded, the UI requires choosing a remediation option index when multiple options exist, supports approve-with-retries vs approve-without (maps to `maxAttempts` on the patch only when positive), optional execution agent selection defaulting to `spec.execution.agent`, and deny. Advisory proposals (`spec.execution` absent) still show execution approval affordances but display informational copy that cluster execution is skipped. Approving sends `Execution` stage with selected `option` index and optional `maxAttempts` / `agent`.
20. **Verification approval gate** (`stageNeedsApproval`): When `Executed` is `True`, the `Verified` condition row is absent, the derived phase is not terminal, and no `Verification` stage is recorded, the hook reports that verification needs approval.
21. **Verification tab vs approval UI**: The verification **ApprovalCard** is shown only in the branch where there is no verification result CR yet **and** no verification sandbox pod; once a sandbox pod exists, the tab shows streaming/result layout even if approval were still pending in another operator state. Escalation tab follows the same pattern for its approval card.
22. **Escalation approval**: When `Escalated` condition status is `Unknown`, no `Escalation` stage exists yet, and derived phase is not terminal, the UI offers escalation approve/deny (optional agent; default in card copy references analysis agent). A separate modal launched from the verification tab confirms escalation approval with the same hook; it does not collect freeform escalation text.
23. If any stage records `decision: Denied`, that stage’s card state reads “denied”; otherwise an existing stage reads “approved”. A user **Deny** patch records `decision: Denied` on that stage; terminal derived phase `Denied` occurs when the operator sets condition `Denied: True` (see operator lifecycle spec — console does not set conditions).
24. Tabs show a “Needs approval” badge when that tab aggregates a stage awaiting approval (`Proposal` tab if analysis or execution needs approval; `Verification` / `Escalation` similarly). A passive “active phase” dot appears on the tab matching the current derived phase when that tab is not selected and approval is not pending there.
25. **Proposal tab content**: If `spec.revisionFeedback` is set and proposal `metadata.generation` exceeds `Analyzed`’s `observedGeneration`, show re-analysis waiting state with feedback alert and analysis sandbox logs when available. Otherwise if analysis results have no options: show analysis approval card (if sandbox not present), or analyzing logs card, or terminal/non-terminal empty messages. When options exist: optional collapsible analysis sandbox logs (auto-collapses when analysis data first appears unless revision pending), then remediation options with diagnosis/proposal/RBAC/verification/adapter components. Execution approval controls appear under the selected option. **Refine** opens inline textarea patching `spec.revisionFeedback` on the `Proposal` (not the escalation modal).
26. **Execution tab**: Streams execution sandbox logs (or placeholder messages) until an `ExecutionResult` exists; then shows structured execution outcome, actions taken, and post-execution verification summary as markdown when present.
27. **Verification tab**: Follows rule 21 for approval vs logs/result; shows verification outcome label, markdown summary, expandable checks with CLI-like source/value display when a result exists. If verification outcome failed, show **Escalate** opening the escalation modal.
28. **Escalation tab**: Parallel pattern: approval card (per rule 21), logs, result with summary, expandable full content markdown, failure reason alert.
29. “Latest” result CR for each step is resolved by taking the last `status.steps.*.results` ref name and finding the CR with that `metadata.name` in the watched list.
30. **Sandbox log viewer**: Watches core `Pod`; when phase is `Running`, opens a follow log stream for container name `agent` via console-authenticated Kubernetes log API; buffers chunks, trims retained text when exceeding an internal maximum, supports reconnect with exponential backoff capped at an internal maximum, toggles auto-scroll, and shows connection state badges (searching, waiting, streaming, ended, reconnecting, error). If pod missing, transitions to ended/searching appropriately. Default namespace for sandbox when `status.steps.*.sandbox.namespace` is empty is `openshift-lightspeed`.
31. **Markdown** (`MarkdownText`): UI-oriented fenced blocks matching a `ui:*` code-fence pattern are stripped (including a trailing partial fence) before parsing; remainder is parsed as markdown and sanitized to HTML before injection.
32. **Remediation risk label colors**: `low` → green; `medium` → orange; `high` or `critical` → red; other → grey. Diagnosis **confidence** labels use a separate mapping (high → green, medium → orange, low → red).
33. **Dynamic / adapter components**: Objects under `RemediationOption.components` (or trigger-bootstrap options) render each element. If `type` is in the plugin’s known set, a typed renderer is used; otherwise compact JSON is shown. Known types include lightspeed Prometheus/metrics, resource diff, action picker, evidence table, status timeline, and CMO alert/metric/remediation/trigger types (see how-spec for dispatch table). `ActionPicker` supports `onAction` when wired; remediation embeddings omit a handler so confirming a selection does not send feedback from the console.
34. `ResourceDiff` displays pretty-printed JSON snapshots of `before` / `after` maps side by side (not a line-oriented unified diff).
35. `Visualization` either embeds console `QueryBrowser` when `queries` is non-empty (optional summary `DataTable` above) or renders a static chart from `series` data.
36. `EvidenceTable` wraps `DataTable` with a titled card and monospace styling on the first column by default.
37. `StatusTimeline` lists timestamp, label, and icon per event severity bucket (`success`, `danger`, `warning`, `info`).

## Configuration Surface

- `Proposal.metadata.annotations` (console model: `LightspeedProposalModel`): `ols.openshift.io/source-url`, `ols.openshift.io/source-name` (external link in Overview).
- `Proposal.metadata.labels`: `ols.openshift.io/source`, `ols.openshift.io/proposal-type`, `ols.openshift.io/trigger-name` (layout and naming).
- `Proposal.spec.request`, `targetNamespaces`, `revisionFeedback`, `analysis.agent`, `execution` presence (advisory), `execution.agent`, `verification.agent`.
- `Proposal.status.conditions`, `status.steps.*` (sandbox claims, result refs).
- `ProposalApproval.spec.stages[]`: `type`, `decision`, `analysis`, `execution` (`option`, `maxAttempts`, `agent`), `verification`, `escalation`.
- `AnalysisResult.status.options[]`: remediation payloads including `components`.
- Execution / verification / escalation result CRs: standard status fields consumed by tabs.
- Log streaming: Kubernetes path namespace and pod name from sandbox status; container name fixed to `agent`.

## Constraints

- UI must not diverge from operator phase semantics; when in doubt, treat `proposal-lifecycle.md` as authoritative.
- Do not duplicate full CRD field inventories here; mirror types in `src/models/proposal.ts` only as needed.
- English copy is i18n-keyed under `plugin__lightspeed-agentic-console-plugin`.
- API URL helper `getApiUrl` exists for a console-proxy prefix; no component references it yet (extension HTTP surface is unused for these flows).

## Planned Changes

- [PLANNED: OLS-3022] Remove or replace diagnosis **confidence** presentation per transparency initiative.
- [PLANNED: OLS-3014] Tech Preview badge in console shell context for agentic surfaces.
- [PLANNED: OLS-3015] AI content tagging conventions in UI.
- [PLANNED: OLS-3016] Disclaimer placement for AI-generated content.
- [PLANNED: OLS-2963–OLS-2973] AG-UI Chat integration for agentic OLS (not present in current proposal routes).
- [PLANNED: HPUX-1451] Broader Agentic AI UX alignment with console platform patterns.
- [PLANNED: OCPSTRAT-3095] Feature-level UX requirements as epics land.
- Align list phase filter IDs with full derived phase enum (e.g. include `Proposed`) for consistent filtering.
- [PLANNED: UX] Escalation modal freeform feedback if product requires user context in addition to operator-driven escalation flow.
- Wire `ActionPicker` to a chat/feedback channel when AG-UI or equivalent exists.
