# Run Lifecycle

The core domain of the plugin: displaying and managing runs through a multi-stage workflow.

## Behavioral Rules

### Phase Derivation

1. The plugin MUST derive the run phase from `status.conditions[]`, not from a stored phase field. The function `derivePhaseFromConditions` implements this logic and MUST match the operator's `DerivePhase` in `lightspeed-agentic-operator/api/v1alpha1/agenticrun_types.go`.
2. Phase derivation follows condition priority: EmergencyStopped > Escalated > Denied > Verified > Executed > Analyzed > Pending. Within the `Analyzed` condition, if the reason is `NoActionRequired`, the run maps to the `Completed` phase instead of `Proposed`. The `isNoActionRequired` helper checks this same condition/reason pair so the UI can distinguish a no-action-required completion from a normal one.
3. Within each condition, `status: True` means the stage completed successfully, `status: Unknown` means the stage is in progress, and `status: False` means the stage failed (unless a specific `reason` indicates retry).
4. The `Verified` condition with reason `RetryingExecution` maps to the `Executing` phase (not `Failed`).

### Run Phases

5. Valid phases are: Pending, Analyzing, Proposed, Executing, Verifying, Escalating, Completed, Failed, Denied, Escalated, EmergencyStopped.
6. Terminal phases are: Completed, Failed, Denied, Escalated, EmergencyStopped. No approval or other lifecycle actions are shown for terminal runs; the authorized Delete action remains available under rule 9c.
6a. A run enters `EmergencyStopped` when the operator triggers the cluster-wide kill switch. The console displays it as a distinct terminal error state with no approve/deny or Stop controls. No lifecycle action is possible; Delete remains available under rule 9c when authorized.
6b. When a `Completed` run's `Analyzed` condition has reason `NoActionRequired` (`view.noActionRequired`), the console displays an info alert instead of the normal terminal summary — no remediation proposal or approve/deny controls are shown. The run is complete — no lifecycle action is needed or available; Delete remains available under rule 9c when authorized.
6c. [PLANNED: OLS-3298] A per-run cancellation remains in the `Failed` phase. When the failing condition reason is `CancelledByUser`, the console displays `Failed` with the cause `Stopped by user`. If sandbox status remains while teardown is pending, the detail page also displays `Sandbox shutdown in progress`.
6d. [PLANNED: OLS-3298, OLS-4018] For a non-terminal run, when global suspension and per-run cancellation are both pending, `EmergencyStopped` takes precedence. The console displays `Emergency stopped`, not `Failed / Stopped by user`.

### Run List

7. The list page MUST watch all `AgenticRun` CRs across namespaces and display them in a virtualized table.
8. The list MUST support filtering by phase and text search. A trigger domain filter is shown alongside the phase filter, populated dynamically from distinct `agentic.openshift.io/source` label values across watched AgenticRun CRs.
9. Each row MUST show: name (linked to detail), target namespaces, trigger domain, phase label, tokens consumed, age, and a kebab actions menu.
9a. The trigger domain column reads from the `agentic.openshift.io/source` label on the AgenticRun CR. Shows "-" when the label is absent. Depends on [OLS-3299] for backend population of the label.
9a-i. The target namespaces column reads from `spec.targetNamespaces` (sorted) and renders each as a Namespace resource link. Shows "-" when the list is empty.
9b. The tokens consumed column displays an aggregate token count read from `status.usage.totalTokens` on the AgenticRun CR. Shows "-" when the count is unavailable.
9c. Each row has a kebab menu with a "Delete" action. Delete is gated by RBAC — the plugin performs a `useAccessReview` check for `delete` verb on `agenticruns` in API group `agentic.openshift.io`; if the user lacks permission the action is disabled. Selecting Delete opens a `ConfirmationModal`, and confirming calls `k8sDelete` on the AgenticRun CR.
9d. The list page MUST display a title ("Agentic runs"), a "Dev preview" badge (`PreviewBadge`), and a help-text advisory reminding users to review AI-generated content.
9e. The list page renders an `AgenticCapabilitiesToggle` card that suspends or resumes the whole agentic system by creating or patching the `AgenticOLSConfig` singleton's `spec.suspended` field. The control is RBAC-gated via `useAccessReview` (create/patch on `agenticolsconfigs`); a confirmation modal guards the state change. When suspended, `AgenticLayout` shows the system-suspended banner (see rule 13).

### Run Detail — Layout

10. The detail page MUST display content progressively as data becomes available. The run header (breadcrumb, title, phase label, creation timestamp, failure/results alerts) MUST render immediately without waiting for result CRs. The detail section (RCA, remediation hub, timeline) MUST be gated behind a loading/error guard (`StatusGuard`): show a spinner while loading, an error state on failure (403 → restricted access, 404 → not found, other → error message with detail), and the section content when data is ready. `AnalysisSummary` MUST be gated on `view` (available once the run CR loads), not on `resultsLoaded`, so the analysis request prompt and analysis phase state display without waiting for all result CRs. Remediation hub and timeline remain gated on `resultsLoaded`.
11. The detail page uses a single-page section layout (not tabs). Sections are rendered conditionally based on the current phase: Analysis request, Remediation options, Execution summary, Verification summary, Escalation summary, and Timeline.
11a. Legal disclaimer banner — persistent info alert below the detail page title/status: "OpenShift Lightspeed uses AI technology to help generate remediation plans. Always review AI-generated content prior to use."
11b. AI-generated content labeling — section headings for AI-generated content (Root cause analysis, Remediation hub, Verification summary, Escalation summary) MUST display a compact "AI-generated" label inline next to the heading text.
12. During in-progress stages (Analyzing, Executing, Verifying, Escalating), the page MUST show a `StageInProgress` card with embedded live log streaming from the sandbox pod, unless a manual approval gate for that stage is pending (`StageApprovalBanner` is shown instead).
13. The page MUST be wrapped in `AgenticLayout` to display the system-suspended banner when the agentic config has `suspended: true`.

### Approval Flow

14. Each stage (Analysis, Execution, Verification, Escalation) can independently require approval based on the `AgenticRunApproval` CR.
14a. **Authorization gate.** Before rendering Approve/Deny buttons, the plugin MUST perform a `useAccessReview` check for `patch` verb on `agenticrunapprovals` resource in API group `agentic.openshift.io`. The namespace MUST fall back from `approval.metadata.namespace` to the run's `metadata.namespace` when the approval CR has not loaded yet. If the user lacks the permission, the buttons MUST be disabled (using `isAriaDisabled` so hover/focus events remain active for the tooltip) with a tooltip stating "You don't have permission to approve or deny runs." This check is performed in the `useAgenticRun` hook and exposed as `canApprove`/`canApproveLoading` on the returned view model. The disabled/tooltip/loading behavior is centralized in the reusable `ApprovalGatedButton` component (`src/components/ApprovalGatedButton.tsx`), which is used by `StageApprovalBanner` and `RunDetailPage` (action toolbar). `ConfirmationModal` is used for execution confirmation. The `approveStage()` and deny callbacks in `useAgenticRun` MUST also guard against `!canApprove` as defense-in-depth. This prevents confusing 403 errors — the API server enforces the real gate.
14b. **Stage approval gates.** When any non-Execution stage requires manual approval, the detail page shows an approval prompt (`StageApprovalBanner`) with an "Approve [stage]" button (primary) in place of the normal in-progress or skeleton UI for that stage. A "Deny run" button (secondary) is shown below the remediation hub when any non-Execution approval gate is pending. Both buttons are permission-gated via `canApprove` from `useAgenticRun`. Approving opens a confirmation modal; denying uses the existing deny confirmation modal. The plugin determines whether a stage needs manual approval from the `AgenticRunApproval` CR alone — when the `ApprovalPolicy` sets a stage to `Automatic`, the operator pre-populates the corresponding entry in `approval.spec.stages[]` at creation time, so a missing entry indicates manual approval is required. Execution keeps its own card-based approval flow (remediation option selection in the `Proposed` phase).
15. Approval decisions are written as JSON patches to the `AgenticRunApproval` CR, not to the `AgenticRun` CR.
16. When approving execution, the user can select a specific remediation option (by index) and specify retry count (0-3). Each option's remediation plan contains concrete bash commands (kubectl/oc) visible in the approval view.
17. Execution approval uses a `ConfirmationModal` — the user clicks Execute on a remediation option card, which opens a modal dialog for confirmation with loading state and inline error display.
17a. The execution confirmation modal body includes a legal disclaimer: "OpenShift Lightspeed uses AI technology to help generate remediation plans. Always review AI-generated content prior to use."
17b. [PLANNED: OLS-3298] Stop run control — a red danger button shown only during active sandbox phases: `Analyzing`, `Executing`, `Verifying`, and `Escalating`. It is not shown in `Pending`, `Proposed`, or terminal phases. The control opens an irreversible-action confirmation modal and, on confirmation, targets the run's namespaced AgenticRun with JSON Patch `add` at `/spec/cancelled` and value `true`. Its visibility/enabled state is gated by `useAccessReview` for verb `patch`, resource `agenticruns`, and API group `agentic.openshift.io`, scoped to `run.metadata.namespace` (falling back to the run-watch namespace before the run loads). During `Executing`, the confirmation warns that partial cluster changes may exist and require manual inspection. The console does not optimistically change the phase; API errors remain visible.
18. [PLANNED] The user can select which Agent to use for each approval stage, with available agents fetched from a cluster-scoped Agent CRD list. Not implemented: there is no Agent `K8sModel`/GVK in `src/models/agenticrun.ts`, no Agent in the CRD inventory (see system-overview rule 9), and no agent-picker UI in the codebase.

### Remediation Options

19. Analysis produces one or more `RemediationOption` objects, each containing diagnosis, proposed remediation (a concrete script of ordered bash commands using kubectl/oc), RBAC requirements derived from those commands, and a verification plan. Each action in the remediation plan includes `command` (exact bash command), `type` (phase category: pre-check, mutation, wait, post-check), and `description`. [OLS-3441]
20. When multiple options exist, they are rendered as expandable cards with a "Select this option" button.
21. RBAC permissions shown in the run are derived from the concrete bash commands in the remediation script and locked at approval time — the UI shows a warning alert stating the agent cannot escalate its own privileges. When `rbac` is present on a remediation option, a `RequiredPermissions` section displays a permission count, write-verb summary, and a collapsed expandable containing a single unified table with Namespace, Resource, Verbs, and Purpose columns. The grouped `namespaceScoped`/`clusterScoped` wire contract is flattened into one ordered rule list in the frontend. Each row's Namespace cell shows a purple "Cluster-wide" label for cluster-scoped rules or a namespace resource link for namespace-scoped rules; the Resource cell shows the resource icon and name when specific resource names are requested, otherwise the resource string; scope count badges in the section header are derived from the flattened rule list. [OLS-3441, OLS-3809, OLS-3919]
19a. [PLANNED: OLS-3661] Analysis token count — display the total token count for the full analysis as a badge on the root cause analysis card ("X tokens (analysis)"). This is a single count for the entire analysis. A run-level aggregate exists at `status.usage.totalTokens` (shown in the run list), but no per-analysis token field exists on the CRD yet and no analysis badge is currently rendered.
19b. Remove the confidence tag from the root cause analysis display.
19c. Remediation execution record — a structured record in the execution summary (`ExecutionSummary`) showing the selected option and the "Approved by" username + timestamp derived from `AgenticRunApproval.spec.approver`.
19d. Each remediation option supports downloading its plan as a JSON file (`remediation-option-<n>.json`). In the `Proposed` phase, the "Download plan" action is in the sticky action toolbar (rule 19g) and operates on the selected option. In read-only phases (post-execution), a per-card "Download plan" button is shown within each expanded option card.
19e. The "Analysis request" section displays the original prompt or alert event string that initiated the run, with a help popover explaining its purpose. Below it, the analysis sandbox log viewer is available when the sandbox has run.
19f-i. **Remediation option selection.** In the `Proposed` phase, each option card has a dedicated radio button for selection. The first option displays an "AI recommended" badge. The entire selection row (radio, plan label, badges) is clickable to select the plan. Selection and expand are independent — selecting a plan does not expand it, and expanding via "View plan details" does not select it. Multiple plans can be expanded simultaneously. No plan is pre-selected; the user must explicitly select one before executing.
19g. **Sticky action toolbar.** In the `Proposed` phase, a sticky bottom toolbar anchors triage actions to the viewport. For non-advisory runs: "Execute remediation" (disabled until a plan is selected, with tooltip), "Deny run", and "Download plan" (disabled until a plan is selected). For advisory runs: only "Download plan" (advisory runs have no execute/deny actions). The toolbar includes an AI disclaimer: "The autonomous features of OpenShift Lightspeed use AI technology to generate output. Always review AI-generated content prior to use." The toolbar is rendered even when no remediation options exist (non-advisory runs still show "Deny run").
19h. When remediation options exist, root cause analysis is displayed within each remediation option card. Each card shows the detected cause and detail, alongside estimated impact, proposed agent commands, rollback plan, and verification steps. When no remediation options are available, root cause analysis is shown below the analysis request section.
21a. When the run is in the `Failed` phase and analysis produced no remediation options, the remediation hub MUST render a failure card — a red "Failed" label with an error icon and the failure reason text — rather than the empty terminal content that would otherwise show. The failure reason is `view.failureReason`, which falls back to the failing AgenticRun condition's `reason: message` (via `deriveFailureReason`) when no result CR reports a `status.failureReason`. When the reason is `CancelledByUser`, the displayed cause MUST be `Stopped by user`. When a `Failed` run does have remediation options (e.g., a mid-run execution or verification failure), the hub renders the normal terminal summary (option cards and stage summaries) unchanged.

### Refine Flow [PLANNED]

22. [PLANNED] After analysis completes, the user can submit revision feedback via a "Refine" button. The `revisionFeedback` field exists in the CRD type definition but no UI component currently renders the Refine button.
23. [PLANNED] Refinement writes `spec.revisionFeedback` to the `AgenticRun` CR via patch. If the value already exists, it uses `replace`; otherwise `add`.
24. [PLANNED] A revision is considered pending when `spec.revisionFeedback` is set AND `metadata.generation` exceeds the `observedGeneration` on the `Analyzed` condition.

### Sandbox Log Streaming

25. While a stage is in progress, the plugin streams logs from the sandbox pod's `agent` container.
26. Log streaming uses `follow: true` with automatic reconnection on stream end or error (exponential backoff from 1s to 15s).
27. When the streaming result data arrives, the log viewer auto-collapses to an expandable section.
28. Logs are capped at 20,000 lines.

### Retained Logs

28a. When the OTEL collector's admin API is configured, non-streaming log viewers use it as the primary log source instead of pod logs. This keeps logs visible after sandbox pod termination.
28b. OTEL availability is detected at runtime by probing the `lightspeed-agentic-configuration` ConfigMap in the `openshift-lightspeed` namespace for the `otel-admin-endpoint` key. The probe result is cached for the session.
28c. Source selection: streaming log viewers (in-progress stages) always use pod logs; non-streaming log viewers use OTEL when available, pod logs otherwise. Pod log fetching is gated on OTEL probe completion to prevent firing before availability is known.
28d. The OTEL Admin API is accessed via the K8s service proxy (`/api/kubernetes/api/v1/namespaces/{ns}/services/https:{name}:{port}/proxy/api/v1/logs`). Records are fetched with cursor-based pagination.
28e. Streaming log viewers display a compact "Live" label next to the expandable section toggle text. Non-streaming viewers show no source indicator.
28f. The "Hide health checks" filter is only shown for pod log sources, not OTEL.

### Escalation

29. Verification failure enables an "Escalate" button that opens a confirmation modal.
30. Escalation approval creates an Escalation stage in the `AgenticRunApproval` CR.
31. The detail page watches `EscalationResult` CRs via the same label-selector pattern as other result CRs (`agentic.openshift.io/run`) and maps them into the run view (`EscalationView`).
32. While the run is in the `Escalating` phase: if escalation requires manual approval, show `StageApprovalBanner`; otherwise show `StageInProgress` with sandbox log streaming from `status.steps.escalation.sandbox`.
33. On terminal phases that include an escalation result, the page renders an `EscalationSummary` card. The card body is freeform AI-generated markdown from `EscalationResult.status.summary` and, when present and different, `status.content` — rendered as unmarked markdown (not titled subsections or an expandable section).
34. `EscalationSummary` MUST NOT render when the mapped view has no `summary`, `content`, or escalation sandbox. Failure-only results (system/agent error with only `status.failureReason`) surface via the page-level danger alert that aggregates stage `failureReason` values, not as an empty card. The page-level alert is suppressed for a `Failed` run with no remediation options — that failure is shown in the remediation hub failure card instead (see 21a).
35. Timeline events include Escalation started/completed conditions from the `EscalationResult` (same condition-to-event mapping as Analysis/Execution/Verification).

## Constraints

- The `derivePhaseFromConditions` function is a behavioral contract with the operator. Changes require synchronization.
- The approval patch structure depends on whether `spec`, `spec.stages`, or individual stages already exist — three patch variants are generated accordingly.
- [PLANNED: OLS-3298] Cancellation is a separate AgenticRun JSON Patch (`add` at `/spec/cancelled` with value `true`), not an approval patch.
