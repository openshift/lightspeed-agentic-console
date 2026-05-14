# Console plugin — implementation architecture

Scope: OpenShift Console dynamic plugin wiring for the agentic proposals UI. Complements `what/proposal-ui.md`. CRD lifecycle semantics: `lightspeed-agentic-operator/.ai/spec/what/proposal-lifecycle.md`.

## Module Map (`src/`)

| Path | Purpose |
|------|---------|
| `config.ts` | `getApiUrl`: builds URLs under the plugin proxy prefix + `ols` path segment (currently unused by components). |
| `models/proposal.ts` | `K8sModel` + GVK helpers for Proposal, Agent, ProposalApproval, Analysis/Execution/Verification/Escalation Result CRDs; TypeScript types for specs/status, remediation structures, phase helpers (`derivePhaseFromConditions`, `getPhaseDisplay`, `getRiskColor`, `resultOutcome`). Comment documents desire to auto-generate from OpenAPI/CRD. |
| `utils/approval.ts` | `findStage`, `getStageStatus`, `stageNeedsApproval`, `buildApprovalPatch` (JSON Patch triples for `ProposalApproval.spec.stages`). |
| `utils/markdown.ts` | `stripUiFences`, `renderMarkdown` (marked + DOMPurify). |
| `hooks/useStageApproval.ts` | Combines derived phase + `stageNeedsApproval` with `k8sPatch` calls using `buildApprovalPatch`; loading and error state. |
| `components/proposals/ProposalListPage.tsx` | List page header, filters, watch + virtualized table. |
| `components/proposals/ProposalDetailPage.tsx` | Detail shell: watches, tab state, CMO/trigger variants, compose Overview/Proposal/Execution/Verification/Escalation tab bodies inline as subcomponents. |
| `components/proposals/EscalateModal.tsx` | Modal wrapper calling `useStageApproval(..., 'Escalation')` approve; no text fields. |
| `components/proposals/SandboxLogViewer.tsx` | Pod watch + `consoleFetch` streaming log client + UI (auto-scroll switch, status badge). |
| `components/proposals/PhaseIcon.tsx` | PatternFly icons per phase + failure overlays for completed + failed results. |
| `components/proposals/MarkdownText.tsx` | Memoized `renderMarkdown` → `dangerouslySetInnerHTML`. |
| `components/proposals/DynamicComponent.tsx` | Re-export from `dynamic/`. |
| `components/proposals/dynamic/index.tsx` | `DynamicComponent` switch: maps `type` strings to visualization, diff, picker, evidence, timeline, CMO components; unknown → warning + JSON. |
| `components/proposals/dynamic/types.ts` | Prop interfaces for dynamic components. |
| `components/proposals/dynamic/Visualization.tsx` | `QueryBrowser` path vs static Victory chart path; uses `DataTable` for optional summary. |
| `components/proposals/dynamic/DataTable.tsx` | Plain HTML table with optional monospace first column. |
| `components/proposals/dynamic/EvidenceTable.tsx` | Card + `DataTable`. |
| `components/proposals/dynamic/ResourceDiff.tsx` | Side-by-side `CodeBlock` JSON. |
| `components/proposals/dynamic/ActionPicker.tsx` | Selectable cards + confirm button calling optional `onAction`. |
| `components/proposals/dynamic/StatusTimeline.tsx` | Vertical list with `statusIcon`. |
| `components/proposals/dynamic/CmoComponents.tsx` | CMO diagnosis, metric evidence, remediation step, trigger proposal (builds `PrometheusRule` via `k8sCreate`). |
| `components/proposals/dynamic/utils.ts` | Timespan presets, chart palette, formatters, timeline icons, severity color, name sanitizer for PrometheusRule metadata. |
| `components/proposals/proposal-detail.css` | Tab + layout classes (`ols-plugin__*` prefix). |
| `components/proposals/sandbox-log-viewer.css` | Log viewer layout. |
| `test-setup.ts`, `test-helpers.ts` | Vitest harness. |
| `models/proposal.test.ts`, `utils/approval.test.ts`, `hooks/useStageApproval.test.ts` | Unit tests. |
| `__mocks__/dynamic-plugin-sdk.ts` | SDK stub for tests. |

Repository root: `console-extensions.json` (routes + nav), `webpack.config.ts` (ConsoleRemotePlugin, ts-loader, locales copy), `package.json` (`consolePlugin.exposedModules`).

## Data Flow

1. **List** — `useK8sWatchResource` list on `LightspeedProposalGVK` → filter by derived phase → row links to `/lightspeed/proposals/:ns/:name`.
2. **Detail** — Parallel watches: Proposal, ProposalApproval, Agent list, four result CR lists with label selector → derive phase → compute `latest*` results via last step result ref → pass into tab bodies.
3. **Approval** — `useStageApproval` computes need from conditions + existing stages + terminal phases → `k8sPatch` JSON Patch on ProposalApproval (append stage path chosen by whether `spec` / `spec.stages` exists).
4. **Refine** — Direct `k8sPatch` on Proposal `spec.revisionFeedback` from Proposal tab.
5. **Logs** — Sandbox pod name/namespace from `status.steps.*.sandbox` → core Pod watch → GET pod log stream with query params (`container`, `follow`, `tailLines` or `sinceTime`).
6. **Dynamic UI** — Analysis result options carry `components` arrays → `AdapterComponents` filters to known `type` set in ProposalDetailPage → `DynamicComponent` dispatches.

## Key Abstractions

- **GVK constants** — `LightspeedProposalGVK`, `LightspeedProposalApprovalGVK`, `AnalysisResultGVK`, `ExecutionResultGVK`, `VerificationResultGVK`, `EscalationResultGVK` align group/kind/version with models for watches.
- **Models** — `K8sModel` entries: `apiGroup` `agentic.openshift.io`, `apiVersion` `v1alpha1`, plural forms `proposals`, `agents`, `proposalapprovals`, `analysisresults`, `executionresults`, `verificationresults`, `escalationresults`.
- **Phase parity** — `derivePhaseFromConditions` annotated to match Go `DerivePhase`.
- **Approval patch shape** — RFC 6902-style operations: add `/spec/stages/-` or initialize `/spec/stages` or `/spec` with first stage; stage payload includes nested spec per stage type.
- **Result outcome** — `resultOutcome` reads `Completed` condition reason `Succeeded` / `Failed`.

## Integration Points

- **Console dynamic plugin SDK** — `useK8sWatchResource`, `k8sPatch`, `k8sCreate`, `ResourceLink`, list/table primitives, `QueryBrowser`, `consoleFetch`.
- **PatternFly** — Layout, cards, labels, charts (Victory wrappers), modal.
- **Routing** — `react-router-dom` v5 + `useParams` with pathname fallback parsing.
- **i18n** — `react-i18next` namespace `plugin__lightspeed-agentic-console-plugin`.
- **Plugin registration** — `console-extensions.json`: routes `/lightspeed/proposals`, `/lightspeed/proposals/:ns/:name`; nav href under Administration perspective labeled via i18n key.
- **Exposed modules** — `package.json` `consolePlugin.exposedModules` maps `ProposalListPage` and `ProposalDetailPage` only.
- **HTTP proxy** — `API_BASE_URL` pattern `/api/proxy/plugin/lightspeed-agentic-console-plugin/ols` for future backend calls; Kubernetes traffic uses `/api/kubernetes/...` in log viewer.
- **PrometheusRule creation** — `monitoring.coreos.com/v1` `PrometheusRule` from CMO trigger proposal data (inline model struct in `CmoComponents.tsx`).

## Implementation Notes

- Webpack uses `ConsoleRemotePlugin` with empty entry; context `src/`; federated remote consumed by console host; `CopyWebpackPlugin` copies `locales/`. Dev server port and CORS headers configured for bridge/container workflows.
- TypeScript types for CRDs are hand-maintained; `proposal.ts` TODO references OpenAPI codegen from cluster or CRD YAML.
- Tests mock `@openshift-console/dynamic-plugin-sdk` for isolation.
- `KNOWN_COMPONENT_TYPES` set in ProposalDetailPage must stay aligned with `DynamicComponent` switch aliases (including `lightspeed_*` prefixed names).
- `DynamicComponent` accepts legacy short type names (`visualization`, `prometheus_query`, etc.) and `lightspeed_*` equivalents for the same renderers.
