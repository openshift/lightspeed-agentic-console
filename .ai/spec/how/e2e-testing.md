# Testing

## Konflux CI Pipelines

### Pre-commit checks

`.tekton/integration-tests/lightspeed-agentic-console-pre-commit.yaml` defines the
cluster-free checks. It checks out the snapshot commit and runs four checks sequentially:

1. `npm run lint` — ESLint and Stylelint
2. `npm run type-check` — TypeScript
3. `npm run test-unit` — unit tests
4. `npm run i18n` — generates locale files

The pipeline uses the Playwright base image (`mcr.microsoft.com/playwright`) for its Node.js
toolchain and runs with a 4Gi memory limit. It extracts the commit SHA from the Konflux
SNAPSHOT parameter to check out the exact PR revision.

### Real-cluster E2E

`.tekton/integration-tests/lightspeed-agentic-console-e2e.yaml` defines the separate
cluster-based pipeline. `.tekton/integration-tests/integration-test-scenarios.yaml`
registers it for the `lightspeed-agentic-console` component in the `ols` application.
Apply the scenario in the Konflux tenant once the pipeline and helper script are available
on upstream `main`. Registration is not performed by committing the YAML alone.

The pipeline uses the `generic-claim` workflow from `openshift/konflux-tasks`, matching the
classic console's claim-based setup before PR #2437. Its selectors are:

- `version: "5.0"`, `architecture: amd64`, `cloud: aws`, `owner: obs`, `product: ocp`
- labels `region: us-east-1`, `variant: fips`
- claim duration `timeout: 3h0m0s`

These select `obs-ocp-5-0-fips-amd64-aws-us-east-1` in
`openshift-observability-cluster-pool` (openshift/release PR #86705).
There is **no EaaS space task, Hypershift cluster provisioning, or explicit deprovision
task**. When the PipelineRun finishes, Konflux automatically releases all claims held by
the pipeline asynchronously. An explicit `deprovision-ephemeral-cluster` task is
unnecessary: Konflux performs cleanup without blocking the pipeline result.

#### Task flow

1. Extract exactly one console image and source revision from `SNAPSHOT`; fail on missing
   or ambiguous metadata before claiming a cluster.
2. Claim the 5.0 FIPS cluster; consume the returned secret's `kubeconfig` and
   `kubeAdminPassword` without printing either.
3. Check out the snapshot revision and run `scripts/install-and-isolate.sh` (under
   `.tekton/integration-tests/`). Install the bundle through OLM, wait for the snapshot
   plugin image to be ready and registered, then isolate both controllers.
4. Run `npm ci` and `npx playwright test` with browser global setup enabled. Refuse to
   start tests if installation/isolation did not succeed.
5. Collect cluster diagnostics and upload reports/artifacts even if installation or
   Playwright fails. A final `fail-if-any-step-failed` step propagates failures after
   artifact collection. Pipeline logs are exported in `finally`, including claim failures.

#### Bundle installation and controller isolation

The `bundle-image` parameter defaults to
`quay.io/redhat-user-workloads/crt-nshift-lightspeed-tenant/ols-bundle:latest`.
It must contain both `lightspeed-operator-controller-manager` and
`lightspeed-agentic-operator-controller-manager`; a classic-only bundle fails explicitly.
Use a digest override for a reproducible investigation.

The PR image is set on the **classic operator's `--agentic-console-image` argument**.
The script updates that argument in the CSV deployment spec, not the OLM-owned child
Deployment: OLM can restore a direct Deployment edit. The classic operator then deploys
and registers the plugin through `OLSConfig`. Readiness requires a completed Deployment
rollout of the snapshot image, not merely an old ready replica during an update. Placeholder provider credentials satisfy
configuration validation; no real provider token, mock LLM, or sandbox is needed by
these UI tests.

Once the correct plugin image is running, both controllers' replicas are set to zero in
the CSV's authoritative deployment specs. The script verifies both controller Deployments
are at zero and their pods are gone, while the plugin and AgenticRun CRD remain. This
prevents reconciliation from changing imported/seeded run states. Do not use the suspend
kill-switch (it rewrites non-terminal states), scale only child Deployments (OLM reverts
that), or hand-deploy the console plugin.

This follows the isolation design proposed in agentic-console PR #252. Current Playwright
coverage is navigation and YAML-import/list/detail; comprehensive seeded result/approval
fixtures for every workflow state are not yet implemented by this pipeline change.

#### Artifacts and tenant prerequisites

The shared task volume retains `gui_test_screenshots/` and install logs between steps.
`artifact-repository` defaults to `quay.io/openshift-lightspeed/ols-console-artifacts`,
reusing the existing console artifact repository. E2E artifact tags use
`agentic-<PipelineRun name>` to distinguish retries and classic console runs.
`artifact-credentials-secret` defaults to `ols-konflux-artifacts-bot`; it must exist in
the tenant, contain `.dockerconfigjson`, and permit writes to the selected repository.
The task projects that key to the `oci-storage-dockerconfigjson` filename required by
`secure-push-oci`; log export reads the original `.dockerconfigjson` key. Upload errors
are not suppressed by the StepAction's `always-pass` setting. The tenant must also have the
TestPlatformCluster controller/claim access and git/StepAction resolvers used by the
classic console setup.

The CSV image/isolation patches and plugin-readiness predicate live in
`.tekton/integration-tests/scripts/jq/`. Both the installer and the Vitest regression
suite execute these exact filters; tests do not extract expressions from Bash source.
The suite covers preservation of unrelated deployments/arguments, missing manager
containers, and rollout readiness (including an old ready pod during an update).
It runs as part of the existing `npm run test-unit` command. The pre-commit task installs
`jq` in its test container; local developers need `jq` on PATH. No Python or PyYAML is
required, and no new npm dependencies are added.

Local checks (existing npm tooling, Bash, jq, and ShellCheck):

```sh
npm run test-unit -- .tekton/integration-tests/tests/csv-filters.test.ts
npm run lint
bash -n .tekton/integration-tests/scripts/install-and-isolate.sh
shellcheck .tekton/integration-tests/scripts/install-and-isolate.sh
```

These validate the shared jq logic and shell code, not actual OLM installation or cluster
execution.

## E2E Framework

Playwright with `@playwright/test`. Mirrors the setup used by the sibling
`lightspeed-console` repo.

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `playwright.config.ts` | — | Test runner configuration (browser, reporters, timeouts, auth) |
| `integration-tests/support/fixtures.ts` | `test`, `expect`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Browser login, plugin stabilization, storageState persistence |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cluster cleanup and artifact gathering |
| `integration-tests/tests/` | — | Test files (`*.spec.ts`) |

## Auth Flow

1. `global-setup.ts` launches a Chromium instance and logs in via the OpenShift OAuth page.
2. After login, it waits for the console to stabilize (plugin loaded, no further reloads).
3. Browser `storageState` (cookies + localStorage) is saved to
   `integration-tests/.auth/state.json`.
4. All test projects reuse this `storageState` — individual tests start already
   authenticated.

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
Used by global setup/teardown for cluster operations (role bindings, resource creation,
cleanup).

### `gatherClusterArtifacts`

Collects cluster state for debugging failed test runs:

- Resource YAMLs (pods, services, deployments, etc.) from the OLS namespace
- Pod logs (current and previous) for all containers

Output is written to `gui_test_screenshots/artifacts/cluster/`.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Console URL | `http://localhost:9000` |
| `SKIP_OLS_SETUP` | Disable browser global setup/teardown entirely; do not set in CI | unset |
| `KUBECONFIG_PATH` | Path to kubeconfig file | (required) |
| `LOGIN_USERNAME` | Login username | `kubeadmin` |
| `LOGIN_PASSWORD` | Login password | (required) |
| `LOGIN_IDP` | Identity provider name | `kube:admin` |
| `BUNDLE_IMAGE` | Bundle used by the pipeline install script, not Playwright | Pipeline `bundle-image` parameter |
| `CONSOLE_IMAGE` | PR plugin image used by the pipeline install script | From SNAPSHOT |

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
- The pipeline handles OLM installation and controller isolation; browser global setup handles auth and plugin stabilization. Individual tests focus on UI behavior.
