# Testing

## Overview

The agentic console has two CI test tiers per PR:

1. **Pre-commit** — static checks and unit tests, no cluster. Fast, runs first.
2. **E2E integration** — real-cluster Playwright tests against the PR-built console
   image, installed the production way (operator + OLM bundle) with the run
   controllers disabled so seeded CRs render deterministically. This document is
   primarily about tier 2.

The agentic console is a **read-only view over Kubernetes CRs** — it watches
`AgenticRun` and result/approval CRs and renders them. It never calls an LLM
itself; the LLM lives in the agentic operator's sandbox. E2E determinism therefore
does not come from mocking an LLM endpoint — it comes from ensuring **no run
controller reconciles the seeded CRs**, so the pipeline seeds fixtures directly and
the UI renders exactly what was seeded. See
`decisions/0001-e2e-controller-isolation.md` for why this approach was chosen over
seeding-against-a-live-controller or deploying a mock LLM.

## Pre-commit Pipeline

`.tekton/integration-tests/lightspeed-agentic-console-pre-commit.yaml` defines a Tekton
Pipeline that runs as a Konflux integration test on every PR. It checks out the PR commit
and runs these checks sequentially:

1. `npm run lint` — ESLint and Stylelint
2. `npm run type-check` — TypeScript
3. `npm run test-unit` — unit tests
4. `npm run i18n` — verifies locale files are up to date

The pipeline uses the Playwright base image (`mcr.microsoft.com/playwright`) for its Node.js
toolchain and runs with a 4Gi memory limit. It extracts the commit SHA from the Konflux
SNAPSHOT parameter to check out the exact PR revision.

## E2E Integration Pipeline

`.tekton/integration-tests/lightspeed-agentic-console-e2e.yaml` defines a second Tekton
Pipeline, registered as a Konflux `IntegrationTestScenario` so it runs per-PR after the
console image build completes. It provisions a real cluster, installs the operator with the
PR-built console image, disables the run controllers, seeds fixtures, and runs Playwright.

### Requirements

- **Real cluster.** OCP ≥ 5.0 (the version at which the agentic layer ships — see the
  parent decision `.ai/spec/decisions/0037-agentic-version-gating.md`). Ephemeral,
  claimed per run and released on teardown.
- **Per PR.** Runs on every pull request via Konflux integration testing.
- **Install via operator with image substitution.** The console plugin is deployed by the
  classic `lightspeed-operator`, not hand-applied manifests, so the test exercises the real
  deployment contract. The PR-built image is substituted at the operator's own args (see
  Image Substitution below).
- **No live LLM.** Achieved by disabling the run controllers, not by mocking (see Controller
  Isolation below).

### Pipeline Tasks

Run in order; the last two always run (even on failure).

1. **extract-snapshot-metadata** — from the `SNAPSHOT` param, extract the
   `lightspeed-agentic-console` component's `containerImage` (→ `CONSOLE_IMAGE`) and
   `source.git.revision` (→ commit SHA). Reuses the extraction pattern from the pre-commit
   pipeline.
2. **provision-cluster** — claim an ephemeral OCP ≥ 5.0 cluster from the Konflux cluster
   pool. Emits a kubeconfig consumed by later tasks via `KUBECONFIG_PATH`.
3. **install-and-isolate** — perform the install + isolation sequence (below). This is
   cluster orchestration, not browser work, so it lives in the pipeline task rather than in
   Playwright `global-setup.ts`.
4. **run-e2e** — check out the PR commit, `npm ci`, run `npx playwright test`. Playwright
   performs only browser login + assertions; cluster setup is already done, so the run is
   invoked with `SKIP_OLS_SETUP=1`.
5. **gather-artifacts** *(always)* — archive `gatherClusterArtifacts` output plus the
   Playwright HTML report, JUnit XML, screenshots, videos, and traces.
6. **release-cluster** *(always)* — return the ephemeral cluster to the pool.

## Install and Isolation Sequence

This is the core of the E2E design. It installs the console the production way, then removes
the reconcilers so seeded CRs of **any** phase (terminal and non-terminal) stay exactly as
applied.

1. **Install the v2 OLM bundle.** On OCP ≥ 5.0 the operator ships from the v2 (full) bundle,
   whose CSV carries two controller-manager deployments —
   `lightspeed-operator-controller-manager` (classic) and
   `lightspeed-agentic-operator-controller-manager` (agentic run controller) — and owns both
   the `ols.openshift.io` and `agentic.openshift.io` CRDs. Install via Subscription against
   the FBC catalog / bundle image.
2. **Substitute the PR console image.** Patch the classic operator's Deployment container
   args to set `--agentic-console-image=$CONSOLE_IMAGE`, then wait for the operator to roll
   out. (See Image Substitution below for why this is the correct layer.)
3. **Trigger console deployment.** Apply an `OLSConfig` CR. This drives the classic
   operator's reconcile loop, which deploys the agentic console plugin (Deployment, Service,
   ConsolePlugin CR, RBAC) and registers it with the Console CR.
4. **Wait for the console plugin to be ready** — the plugin pod is Ready and the plugin
   renders in the console (poll the plugin route, as `global-setup.ts` does today for the
   `Agentic Runs` heading).
5. **Disable the run controllers.** Patch the v2 CSV to set both controller-manager
   deployments' `spec.install.spec.deployments[*].spec.replicas` to `0`. This edits the CSV's
   own deployment spec — the authoritative source OLM reconciles *from* — so OLM scales both
   controllers to zero and keeps them there. Do **not** scale or delete the child Deployments
   directly: OLM reverts changes to CSV-owned child resources within seconds. Do **not**
   delete the CSV: that risks broader OLM garbage collection and finalizer interactions.
6. **Verify isolation.** Confirm both controller-manager pods are gone and that the CRDs and
   the already-running console plugin Deployment survive. The console plugin is reconciled by
   the classic operator controller at runtime (owned by `OLSConfig`), not by OLM, so once the
   classic controller is scaled to zero the plugin Deployment keeps running untouched — no
   reconciler restores or tears it down.

After this sequence, nothing on the cluster reconciles `AgenticRun` CRs. Seeded CRs sit
inert regardless of phase.

## Image Substitution

The correct substitution point is the **operator's own startup args**, not the console
Deployment.

- The classic operator receives operand images as `--<name>-image=` CLI args on its own
  Deployment container (e.g. `--agentic-console-image=<image>`), resolved once at startup
  into its `Options`. It then sets the console Deployment's image from that value and
  **reconciles it** — its `agenticconsole` reconciler owns the console Deployment's image
  field.
- Because the reconciler owns that field, **patching the console Deployment's image directly
  is reverted** on the next reconcile. Patching the operator's args makes the operator deploy
  the PR image *and defend it* — reconcile drift works in the test's favor.

Note: the `--agentic-console-image` arg is `[PLANNED: OLS-3236]` in the operator's bundle
deployment patch, but the flag already exists in the operator. The pipeline adds/sets it via
`oc patch` on the operator Deployment regardless of bundle wiring state.

## E2E Framework

Playwright with `@playwright/test`. Mirrors the setup used by the sibling
`lightspeed-console` repo.

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `playwright.config.ts` | — | Test runner configuration (browser, reporters, timeouts, auth) |
| `integration-tests/support/fixtures.ts` | `test`, `expect`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Browser-based login and storageState persistence |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cleanup of seeded CRs and artifact gathering |
| `integration-tests/support/fixtures/` | — | `AgenticRun` + result/approval CR manifests, one set per UI state |
| `integration-tests/tests/` | — | Test files (`*.spec.ts`) |

## Auth Flow

1. `global-setup.ts` launches a Chromium instance and logs in via the OpenShift OAuth page.
2. After login, it waits for the console to stabilize (plugin loaded, no further reloads).
3. Browser `storageState` (cookies + localStorage) is saved to
   `integration-tests/.auth/state.json`.
4. All test projects reuse this `storageState` — individual tests start already
   authenticated.

In CI, cluster install/isolation happens in the pipeline task **before** Playwright starts.
`global-setup.ts` is responsible only for browser login, not operator install — the two
responsibilities are separated because CSV patching and bundle install are cluster
operations, not browser concerns.

## Seeding Model

Because the run controllers are scaled to zero, applied CR status stands verbatim. Tests
seed fixtures and assert the rendered UI.

- `integration-tests/support/fixtures/` holds `AgenticRun` + associated result/approval CR
  manifests, one set per UI state under test.
- A `seedRun(name)` helper wraps `oc apply -f` for a fixture; teardown deletes seeded CRs by
  a common label.
- Each `*.spec.ts` seeds the fixtures it needs, then asserts the rendered UI against the
  behavioral rules in `what/run-lifecycle.md`.

### States to cover

**Terminal** (the live run controller would leave these alone even if running, because its
reconciler early-returns on terminal phases):

- Completed (with AnalysisResult/RCA and remediation options)
- Completed / NoActionRequired
- Failed
- Failed / CancelledByUser
- Denied
- Escalated
- EmergencyStopped

**Non-terminal** (these are why the controllers must be disabled — a live controller would
drive them forward or, under the suspend kill-switch, rewrite them to EmergencyStopped):

- Pending
- Analyzing (in-progress card)
- Proposed (remediation options shown)
- Executing
- Verifying
- Escalating
- A pending manual-approval-gate variant

## Custom Test Fixture

`fixtures.ts` exports a custom `test` object that extends `@playwright/test` with two
auto-fixtures:

- **`captureConsoleLogs`** — records browser `console.error` and `console.warn` messages,
  prints them only when a test fails.
- **`dismissGuidedTour`** — auto-dismisses the OpenShift guided tour modal if it appears
  during a test.

Tests import `test` and `expect` from `../support/fixtures` instead of `@playwright/test`
directly.

## Cluster Helpers

### `oc` helper

Wraps `execFileSync('oc', ...)` with `--kubeconfig` from the `KUBECONFIG_PATH` env var.
Used by seeding helpers and teardown for cluster operations (applying fixtures, cleanup).

### `gatherClusterArtifacts`

Collects cluster state for debugging failed test runs:

- Resource YAMLs (pods, services, deployments, etc.) from the OLS namespace
- Pod logs (current and previous) for all containers

Output is written to `gui_test_screenshots/artifacts/cluster/`.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Console URL (cluster console route in CI) | `http://localhost:9000` |
| `SKIP_OLS_SETUP` | Skip cluster setup in global setup (set in CI; the pipeline does setup) | unset |
| `KUBECONFIG_PATH` | Path to kubeconfig file | (required) |
| `LOGIN_USERNAME` | Login username | `kubeadmin` |
| `LOGIN_PASSWORD` | Login password | (required) |
| `LOGIN_IDP` | Identity provider name | `kube:admin` |
| `BUNDLE_IMAGE` | v2 operator bundle image used by the install-and-isolate task | (required in CI) |
| `CONSOLE_IMAGE` | PR-built agentic console plugin image, substituted at the operator's `--agentic-console-image` arg | (from SNAPSHOT in CI) |

## Configuration

`playwright.config.ts` at the repo root:

- **Test directory:** `./integration-tests/tests`
- **Test pattern:** `**/*.spec.ts`
- **Browser:** Chromium, viewport 1440×1080
- **Parallelism:** Disabled (`fullyParallel: false`, `workers: 1`) — tests depend on shared
  cluster state
- **Reporters:** HTML (to `gui_test_screenshots/playwright-report/`) and JUnit
- **Artifacts:** Screenshots on failure, video and trace retained on failure
- **Timeouts:** 60s test, 10s expect, 10s action

## npm Scripts

- `test-e2e` — runs `npx playwright test`
- `test-e2e-headless` — runs `npx playwright test --reporter=list`

## Conventions

- Test files use `*.spec.ts` extension.
- Selectors use `data-test` attributes for stability.
- Tests are serial by default (shared cluster state).
- Cluster install and controller isolation are performed by the CI pipeline task; Playwright
  handles browser login, CR seeding, and UI assertions.
