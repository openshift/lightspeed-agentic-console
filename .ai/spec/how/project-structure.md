# Project Structure

## Module Map

| File/Directory | Key Symbols | Responsibility |
|---|---|---|
| `src/models/agenticrun.ts` | All K8sModel definitions, GVK constants, CRD types, `derivePhaseFromConditions`, `getPhaseDisplay` | Central type definitions and phase logic |
| `src/utils/approval.ts` | `findStage`, `getStageStatus`, `stageNeedsApproval`, `buildApprovalPatch` | Pure functions for approval logic |
| `src/utils/markdown.ts` | `renderMarkdown`, `renderMarkdownInline` | Low-level sanitized markdown rendering (marked + DOMPurify). `renderMarkdown` emits block HTML via `marked.parse`; `renderMarkdownInline` emits inline HTML via `marked.parseInline`. All links are hardened with `target="_blank" rel="noopener noreferrer"`. Prefer `MarkdownContent` component over direct calls. |
| `src/utils/agenticrun-utils.ts` | `buildPodLogUrl`, `getOutcomeStatus`, `getReversibilityColor` | Helpers for pod log URLs, outcome status mapping, reversibility colors |
| `src/utils/remediation-plan.ts` | `downloadRemediationOption` | Downloads a remediation option as a JSON file via programmatic anchor click |
| `src/utils/rbac-utils.ts` | `flattenRbacRules`, `resolveKind`, `isWriteVerb`, `hasWriteVerb`, `formatResource`, `summarizeWritePermissions`, `countNamespaceRules`, `countClusterRules`, `ScopedPermissionRule` | Flattens the grouped `namespaceScoped`/`clusterScoped` RBAC wire contract into one ordered rule list and derives write-verb summaries/counts for `RequiredPermissions` |
| `src/components/runs/RunListPage.tsx` | `RunListPage` | Run list with virtualized table (target-namespaces, trigger-domain, phase, tokens, age, kebab columns), phase + trigger-domain filters, and per-row delete |
| `src/components/runs/RunDetailPage.tsx` | `RunDetailPage` | Section-based run detail page with sticky action toolbar, delegates to `detail/` subcomponents |
| `src/components/runs/RunDetailPage.css` | `.ols-plugin__action-toolbar` | Sticky bottom toolbar styling for triage actions |
| `src/components/runs/detail/AnalysisSummary.tsx` | `AnalysisSummary` | Analysis request display, analysis loading/streaming state |
| `src/components/runs/detail/RemediationOptionCard.tsx` | `RemediationOptionCard` | Expandable remediation option card with radio selection, embedded root cause analysis, and per-card download (readOnly mode) |
| `src/components/runs/detail/ExecutionSummary.tsx` | `ExecutionSummary` | Post-execution actions and outcome display |
| `src/components/runs/detail/VerificationSummary.tsx` | `VerificationSummary` | Verification checks and summary |
| `src/components/runs/detail/EscalationSummary.tsx` | `EscalationSummary` | Freeform escalation summary/content card (returns null when empty) |
| `src/components/runs/detail/RunPhaseLabel.tsx` | `RunPhaseLabel` | Phase label with status color |
| `src/components/runs/detail/RunTimeline.tsx` | `RunTimeline` | Chronological event timeline |
| `src/components/runs/detail/RequiredPermissions.tsx` | `RequiredPermissions` | RBAC permission summary and expandable detail table for remediation options |
| `src/components/runs/detail/StageInProgress.tsx` | `StageInProgress` | In-progress stage card with embedded log viewer |
| `src/components/runs/detail/StageApprovalBanner.tsx` | `StageApprovalBanner` | Approval prompt shown in place of the in-progress/skeleton UI when a non-Execution stage requires manual approval (OLS-3688) |
| `src/components/runs/RunUidContext.ts` | `RunUidProvider`, `useRunUid` | React context providing the run UID to detail subcomponents without prop drilling |
| `src/components/runs/detail/SandboxLogViewer.tsx` | `SandboxLogViewer` | Expandable log viewer with streaming, retained log support, and search |
| `src/components/AgenticLayout.tsx` | `AgenticLayout` | Watches `AgenticOLSConfig` CR; renders a system-suspended danger banner above page content when `spec.suspended` is true |
| `src/components/runs/AgenticCapabilitiesToggle.tsx` | `AgenticCapabilitiesToggle` | Card on the run list page that suspends/resumes the agentic system by creating/patching `AgenticOLSConfig.spec.suspended`; RBAC-gated via `useAccessReview` (create/patch) |
| `src/components/runs/agenticCapabilitiesUtils.ts` | `AGENTIC_OLS_CONFIG_NAME`, `buildAgenticOLSConfig`, `buildSuspendedPatch`, `isNotFoundError` | Pure helpers for the `AgenticOLSConfig` singleton and its suspended patch |
| `src/components/PreviewBadge.tsx` | `PreviewBadge` | "Dev preview" label shown as the run list page header badge |
| `src/components/ApprovalGatedButton.tsx` | `ApprovalGatedButton` | Reusable approve/deny button with `isAriaDisabled` gating, permission tooltip, and loading state; used by `RemediationOptionCard`, `StageApprovalBanner`, `RunDetailPage` |
| `src/components/MarkdownContent.tsx` | `MarkdownContent` | Reusable component for rendering sanitized markdown. Wraps `renderMarkdown`/`renderMarkdownInline` with a block-level container (defaults to PatternFly `Content` div). Props: `text` (markdown string), `component` (wrapper element, default `Content`), `inline` (use inline parser for short text like titles). Prevents invalid nested HTML by binding the parse mode to the correct container. |
| `src/components/CodeBlockWithClipboard.tsx` | `CodeBlockWithClipboard` | Reusable code block with clipboard copy button and expandable truncation for long content |
| `src/components/ConfirmationModal.tsx` | `ConfirmationModal` | Reusable confirmation modal with confirm/cancel actions, loading state, and inline error display |
| `src/components/StatusGuard.tsx` | `StatusGuard` | Loading/error/empty gate using PatternFly `ErrorState`; replaces internal console `StatusBox` |
| `src/models/agenticrun-views.ts` | `AgenticRunView`, `RemediationOptionView`, `ExecutionView`, `VerificationView`, `EscalationView`, `SandboxView`, `TimelineEvent`, `TERMINAL_PHASES` | View-model types for the detail page (output of `useAgenticRun` mapping layer) |
| `src/constants.ts` | `RUN_NAMESPACE`, `RUN_LABEL_SOURCE`, `RESULT_LABEL_RUN` | Shared constants for K8s label keys and namespace |
| `src/hooks/useAgenticRun.ts` | `useAgenticRun`, `mapRootCause`, `mapOption`, `mapExecution`, `mapVerification`, `mapEscalation`, `mapTimeline`, `filterLatest` | Fetches run + result CRs (including EscalationResult), maps API types → view types |
| `src/hooks/useExecutionLogActions.ts` | `useExecutionLogActions` | Parses execution actions from sandbox pod logs |
| `src/hooks/useRetainedLogs.ts` | `useRetainedLogs`, `probeConfigMap`, `buildServiceProxyBase` | Fetches retained logs from OTEL Admin API via K8s service proxy; probes ConfigMap for availability |
| `src/hooks/useSandboxLogStream.ts` | `useSandboxLogStream` | Streams audit lines from sandbox pod logs |
| `src/components/configuration/ConfigurationPage.tsx` | `ConfigurationPage` | Configuration page rendering the approval policy view |
| `src/components/configuration/ApprovalPolicy.tsx` | `ApprovalPolicy` | Approval policy CRUD |
| `src/components/configuration/ExecutionPolicyModal.tsx` | `ExecutionPolicyModal` | Acknowledgment modal (automatic-execution + RBAC checkboxes) confirming a switch of a stage to automatic approval |
| `console-extensions.json` | — | Plugin extension declarations (routes, nav items) |
| `webpack.config.ts` | — | Module federation and build configuration |
| `playwright.config.ts` | — | Playwright e2e test configuration |
| `integration-tests/support/fixtures.ts` | `test`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Operator readiness, browser login, storageState |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cluster cleanup and artifact gathering |
| `.tekton/lightspeed-agentic-console-pull-request.yaml` | — | Konflux PipelineRun for PR builds |
| `.tekton/lightspeed-agentic-console-push.yaml` | — | Konflux PipelineRun for push builds |
| `.tekton/integration-tests/lightspeed-agentic-console-pre-commit.yaml` | — | Konflux integration test Pipeline running lint, unit tests, and i18n checks |

## Key Entry Points

The plugin has no traditional `main` entry point. Webpack's `ConsoleRemotePlugin` generates entry points from `console-extensions.json`. The three exposed modules are:

1. `RunListPage` → `src/components/runs/RunListPage.tsx`
2. `RunDetailPage` → `src/components/runs/RunDetailPage.tsx`
3. `ConfigurationPage` → `src/components/configuration/ConfigurationPage.tsx`

## Naming Conventions

- Components: PascalCase `.tsx` files, one primary component per file, default export.
- CSS: co-located `.css` files alongside components. All classes prefixed `ols-plugin__`.
- Models: `agenticrun.ts` contains all CRD types and K8s intersection types. `agenticrun-views.ts` contains view-model types (`*View` suffix) for the detail page.
- Hooks: `use` prefix, one hook per file in `src/hooks/`.
- Detail subcomponents: each section of the detail page is a separate component in `src/components/runs/detail/`, imported by `RunDetailPage.tsx`.
