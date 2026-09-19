# Kubernetes Data Layer

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `src/models/agenticrun.ts` | `LightspeedAgenticRunModel`, `LightspeedAgenticRunGVK`, all `*Model`/`*GVK` constants | K8sModel definitions for the Console SDK's watch/patch/create/delete functions |
| `src/models/agenticrun.ts` | `LightspeedAgenticRun`, `LightspeedAgenticRunApproval`, `*ResultCR` types | TypeScript types for each CRD |
| `src/models/agenticrun.ts` | `AgenticRunK8s`, `AgenticRunApprovalK8s`, `AnalysisResultK8s`, `ExecutionResultK8s`, `VerificationResultK8s`, `EscalationResultK8s` | K8s intersection types (`CRDType & K8sResourceCommon`) for `useK8sWatchResource` generics |
| `src/models/agenticrun-views.ts` | `AgenticRunView`, `RemediationOptionView`, `ExecutionView`, `VerificationView`, `EscalationView` | View-model types — output of the API→view mapping layer |
| `src/hooks/useAgenticRun.ts` | `useAgenticRun`, `mapToAgenticRunView` | Fetches all run-related CRs, evaluates approval/stop access, and maps to a single `AgenticRunView` |
| `src/utils/approval.ts` | `buildApprovalPatch` | Generates JSON Patch arrays for `AgenticRunApproval` mutations |

## Data Flow

### AgenticRun Watching

[PLANNED: OLS-3298] The watched AgenticRun type includes optional `spec.cancelled`. The detail view derives cancellation presentation from the failing condition's `reason: CancelledByUser` and retains sandbox status references while cleanup is pending.

```
useK8sWatchResource(LightspeedAgenticRunGVK, {name, namespace})
  → WebSocket watch on /apis/agentic.openshift.io/v1alpha1/namespaces/{ns}/agenticruns/{name}
  → Console SDK manages cache invalidation and re-renders
```

### Result CR Correlation

Result CRs are not watched by name. Instead, they are correlated by the run's UID via a label selector. The result watches are deferred until the run CR loads (so the UID is available):

```typescript
// Wait for run to load and provide its UID
const runUid = run?.metadata?.uid;
const resultsWatchEnabled = watchEnabled && !!runUid;

useK8sWatchResource(resultsWatchEnabled
  ? {groupVersionKind: AnalysisResultGVK, namespace, isList: true, selector: {matchLabels: {[RESULT_LABEL_RUN]: runUid}}}
  : null)
  → null while run is loading (watch disabled)
  → Returns all AnalysisResults for this run once runUid is available
  → filterLatest(results, run.status.steps.analysis.results)
    → Finds the result CR referenced by the last entry in the step's results array
```

This pattern repeats for ExecutionResult, VerificationResult, and EscalationResult. The `results[]` array on each step status contains `{name, outcome}` refs — the name matches the result CR's `metadata.name`.

The `useAgenticRun` hook wraps watches for AgenticRun, AnalysisResult, ExecutionResult, VerificationResult, EscalationResult, and AgenticRunApproval, and uses `filterLatest` to select the most recent result CR by `creationTimestamp`. The mapped `AgenticRunView` is recomputed via `useMemo` whenever any watched resource changes.

### Approval Patch Generation

`buildApprovalPatch` handles three structural cases:
1. **Stages array exists** (`spec.stages` is non-empty): appends via `add` to `/spec/stages/-`
2. **Spec exists but no stages**: creates the array via `add` to `/spec/stages`
3. **No spec at all**: creates the entire spec via `add` to `/spec`

### Log Streaming

```
consoleFetch(/api/kubernetes/.../pods/{pod}/log?container=agent&follow=true&timestamps=true)
  → ReadableStream reader
  → Chunks buffered in logChunksRef, flushed every 200ms via setTimeout
  → On stream end: non-follow fetch to capture remaining buffered output
  → On error: exponential backoff reconnect (1s → 15s max)
```

### Retained Log Fetching

When the OTEL collector's admin API is configured, non-streaming log viewers fetch retained logs instead of pod logs. The data path:

```
1. Probe: consoleFetch GET /api/kubernetes/api/v1/namespaces/openshift-lightspeed/configmaps/lightspeed-agentic-configuration
   → Check for `otel-admin-endpoint` key in data
   → Cache result at module level (single probe per session)

2. Fetch: consoleFetch GET /api/kubernetes/api/v1/namespaces/{ns}/services/https:{service}:{port}/proxy/api/v1/logs
     ?agentic_run_id={runUid}&limit={pageSize}&after={cursor}
   → Returns {agentic_run_id, records: [{id, phase, timestamp, event, body}], has_more}
   → Cursor-based pagination: `after` = last record ID
   → Records filtered by phase (phaseless records included in all viewers)
   → Records mapped to display lines: `{timestamp} [{event}] {body}`
```

The service name, namespace, and port are parsed from the `otel-admin-endpoint` URL in the ConfigMap (expected format: `https://{service}.{namespace}.svc:{port}`).

## Key Abstractions

### K8sModel Pattern

Every CRD has a paired `K8sModel` (used by Console SDK functions) and a `GVK` object (used by `useK8sWatchResource`). The `K8sModel` includes `apiGroup`, `apiVersion`, `kind`, `plural`, `namespaced`, and display labels. These are defined once in `agenticrun.ts` and imported everywhere.

### Type Union Strategy

CRD types are hand-written, not generated. A TODO exists to auto-generate from OpenAPI. The types closely mirror the CRD status structure — changes in the operator's CRD require manual synchronization here.

K8s intersection types (e.g., `AgenticRunK8s = LightspeedAgenticRun & K8sResourceCommon`) are defined at the bottom of `agenticrun.ts` for use with `useK8sWatchResource` generics. A separate view-model layer in `agenticrun-views.ts` defines UI-optimized types (`AgenticRunView`, `RemediationOptionView`, etc.) with `*View` suffix. The `useAgenticRun` hook in `src/hooks/useAgenticRun.ts` contains pure mapping functions (`mapRootCause`, `mapOption`, `mapExecution`, `mapVerification`, `mapEscalation`, `mapTimeline`) that transform API types into view types. Phase derivation is centralized in `derivePhaseFromConditions` (defined in `agenticrun.ts`, used by both list and detail pages); the companion `deriveFailureReason` (also in `agenticrun.ts`) extracts a human-readable failure reason from the failing condition and backs the `view.failureReason` fallback when no result CR reports one.

### Approval Logic

Approval logic is embedded in the `useAgenticRun` hook — a single hook instance per detail page. It exposes:
- Read: `canApprove` / `canApproveLoading` → derived from `useAccessReview` on `agenticrunapprovals`
- Write: `approveStage(stageType)` / `denyExecution()` → `k8sPatch` with patches from `buildApprovalPatch`
- State helpers: `stageNeedsApproval()` and `getStageStatus()` from `src/utils/approval.ts` are used internally

[PLANNED: OLS-3298] Stop access is evaluated separately: `canStop` / loading state comes from `useAccessReview` for verb `patch`, resource `agenticruns`, and API group `agentic.openshift.io`, scoped to `run.metadata.namespace` (falling back to the run-watch namespace before the run loads). The Stop action targets that same namespaced AgenticRun and sends JSON Patch `add /spec/cancelled` with value `true`; this changes no other field and succeeds whether `cancelled` is absent or already present (`spec` remains required).

There is no per-tab instantiation — the detail page uses a single-page sectioned layout.

## Integration Points

| Consumer | Provider | Mechanism |
|---|---|---|
| All components | Kubernetes API | Console SDK `useK8sWatchResource` (WebSocket) |
| Approval actions | Kubernetes API | Console SDK `k8sPatch` (HTTP PATCH) |
| Per-run stop action | Kubernetes API | Console SDK `useAccessReview` for namespaced `patch agenticruns` in `agentic.openshift.io`, then `k8sPatch` JSON Patch `add` at `/spec/cancelled` with value `true` on that same resource |
| Configuration CRUD | Kubernetes API | Console SDK `k8sCreate`/`k8sPatch`/`k8sDelete` |
| Log streaming | Kubernetes API | `consoleFetch` with ReadableStream |
| Retained logs | OTEL Admin API via K8s service proxy | `consoleFetch` GET through K8s service proxy; availability probed from `lightspeed-agentic-configuration` ConfigMap |

## Implementation Notes

- The Console SDK's `useK8sWatchResource` returns `[data, loaded, error]` and handles WebSocket lifecycle internally. The plugin does not manage WebSocket connections directly except for log streaming.
- Watch configs are memoized with `React.useMemo` to prevent unnecessary re-subscriptions.
- Result CR watches use `isList: true` with label selectors rather than watching by name, because the result CR name is only known after the step creates it.
- The `consoleFetch` function is the Console SDK's authenticated fetch wrapper — it handles CSRF tokens and auth headers transparently.
