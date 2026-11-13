# System Overview

The OpenShift Lightspeed Agentic Console Plugin is a dynamic plugin that loads into the OpenShift Console at runtime via webpack module federation. It provides a UI for cluster administrators to view, approve, and monitor AI-driven runs that diagnose and remediate cluster issues. It reads `AgenticRun` CRs, patches `AgenticRunApproval` CRs to express human decisions, and [PLANNED: OLS-3578] deletes `AgenticRun` CRs via an RBAC-gated action.

## Behavioral Rules

### System Role

1. The plugin MUST load into OpenShift Console via the ConsolePlugin CRD and webpack module federation. It does not run standalone.
2. The plugin MUST register four routes: `/lightspeed/runs` (list), `/lightspeed/runs/:ns/:name` (detail), `/lightspeed/configuration` (settings), and [PLANNED] `/lightspeed/audit` (audit & logs). Behavioral spec for the Audit & Logs page is not yet defined — see completeness gap in verification/lightspeed-agentic-console-report.md.
3. The plugin MUST add an "Agentic Runs" navigation section after the Compute section of the admin perspective, containing two subnav items: "Agentic runs" (`/lightspeed/runs`) and [PLANNED] "Audit & logs" (`/lightspeed/audit`). The configuration page remains a separate route, not a subnav item.
4. All user-facing strings MUST use the `plugin__lightspeed-agentic-console-plugin` i18n namespace.
5. All CSS classes MUST be prefixed with `ols-plugin__` to avoid style conflicts with the host console.

### API Contract

6. All custom resources use API group `agentic.openshift.io` version `v1alpha1`.
7. The plugin communicates with the cluster exclusively through the OpenShift Console SDK's `useK8sWatchResource` (reads) and `k8sPatch`/`k8sCreate`/`k8sDelete` (writes).
8. Pod logs are streamed via the Kubernetes API at `/api/kubernetes/api/v1/namespaces/{ns}/pods/{pod}/log` using `consoleFetch`.

### CRD Inventory

9. The plugin operates on these CRDs: `AgenticRun` (namespaced), `AgenticRunApproval` (namespaced), ApprovalPolicy (cluster-scoped), AnalysisResult (namespaced), ExecutionResult (namespaced), VerificationResult (namespaced), EscalationResult (namespaced), AgenticOLSConfig (cluster-scoped).
10. Result CRs (AnalysisResult, ExecutionResult, VerificationResult, EscalationResult) are discovered via label selector `agentic.openshift.io/run: <run-uid>` (the parent AgenticRun's `metadata.uid`) and correlated to their parent `AgenticRun` via `status.steps.<stage>.results[]` references.

## Configuration Surface

| Field/Flag | Type | Default | Description |
|---|---|---|---|
| `consolePlugin.name` | string | `lightspeed-agentic-console-plugin` | Plugin name registered with console |

## Constraints

- React 18 (matches console's React version).
- PatternFly 6 — use PF components and CSS variables exclusively. No hex colors.
- No naked element selectors or `.pf-`/`.co-` prefixed classes in CSS.
- TypeScript strict mode is off (`strict: false`) but `noUnusedLocals` is enforced.
- `exposedModules` in package.json MUST match `$codeRef` values in console-extensions.json exactly.

## Planned Changes

| Ticket | Summary |
|---|---|
| OLS-3661 | Analysis token count badge on the root cause analysis card. No per-analysis token field exists on the CRD yet. |
| — | Audit & logs page (`/lightspeed/audit` route and "Audit & logs" subnav). Behavioral spec not yet defined. |
| — | Auto-generate CRD types from OpenAPI schema (noted as TODO in `src/models/agenticrun.ts`) |
