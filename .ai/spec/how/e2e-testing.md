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
Apply the scenario in the Konflux tenant once the pipeline and global setup are available
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
3. Check out the snapshot revision, prepare `oc` and `operator-sdk`, and run `npm ci`.
4. Run `npx playwright test`. Global setup reuses the installed bundle or installs it
   through OLM when absent, applies the snapshot plugin image, waits for readiness and
   registration, and isolates both controllers before browser login and UI tests.
5. Collect cluster diagnostics and upload reports/artifacts even if installation or
   Playwright fails. A final `fail-if-any-step-failed` step propagates failures after
   artifact collection. Pipeline logs are exported in `finally`, including claim failures.

#### Bundle installation and controller isolation

The `bundle-image` parameter defaults to
`quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest`.
It must contain both `lightspeed-operator-controller-manager` and
`lightspeed-agentic-operator-controller-manager`; a classic-only bundle fails explicitly.
Use a digest override for a reproducible investigation.

Before installing or reusing a bundle, global setup applies the operator's
`config/manager/imagedigestmirrorset.yaml` from upstream `main`. It waits up to 30 minutes
for every populated MachineConfigPool to converge and for its rendered
`/etc/containers/registries.conf` to contain the requested sources and mirrors. Checking
rendered content avoids accepting the old `Updated=True` status immediately after apply.
Mirror application or convergence failures stop setup before bundle installation.

The pipeline parameter `image-digest-mirror-set-url` (environment variable
`IMAGE_DIGEST_MIRROR_SET_URL` locally) can point at a raw GitHub branch or commit URL.
Until the operator IDMS additions merge, override it with the pushed operator branch's
manifest; the default `main` URL will not include unmerged mappings. Prefer commit URLs
and bundle digests for reproducible investigations.

This modifies cluster-wide image pull configuration and requires cluster-admin access
on a standalone OCP cluster. Setup leaves the IDMS installed for the claimed cluster's
lifetime. The mirrors cover project CI images, not every third-party operand; valid
pull credentials are still needed for unmapped `registry.redhat.io` images, including
PostgreSQL, Dataverse exporter, MCP server and RHOKP.

The PR image is set on the **classic operator's `--agentic-console-image` argument**.
Global setup updates that argument in the CSV deployment spec, not the OLM-owned child
Deployment: OLM can restore a direct Deployment edit. The classic operator is resumed (including after a prior isolated local run), then deploys
and registers the plugin through `OLSConfig`. Existing configuration and credentials are
preserved; global setup creates an OLSConfig and placeholder secret only when absent. Readiness requires a completed Deployment
rollout of the snapshot image, not merely an old ready replica during an update. Placeholder provider credentials satisfy
configuration validation; no real provider token, mock LLM, or sandbox is needed by
these UI tests.

Once the correct plugin image is running, both controllers' replicas are set to zero in
the CSV's authoritative deployment specs. Global setup verifies both controller Deployments
are at zero and their pods are gone, while the plugin and AgenticRun CRD remain. This
prevents reconciliation from changing imported/seeded run states. Do not use the suspend
kill-switch (it rewrites non-terminal states), scale only child Deployments (OLM reverts
that), or hand-deploy the console plugin.

This follows the isolation design proposed in agentic-console PR #252. Current Playwright
coverage is navigation and YAML-import/list/detail; comprehensive seeded result/approval
fixtures for every workflow state are not yet implemented by this pipeline change.

#### Artifacts and tenant prerequisites

The shared task volume retains `gui_test_screenshots/` and `playwright.log` (including
global setup output) for artifact collection.
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

Installation, CSV patches, readiness checks and controller isolation all live in
`integration-tests/support/global-setup.ts`, following the classic console's setup pattern.
Focused Vitest tests in `integration-tests/support/global-setup.test.ts` cover installation
reuse, image patch preservation, incompatible bundles, rollout readiness and isolation
failures. They run as part of `npm run test-unit`; no local `jq` dependency is needed.
The pipelines still use `jq` to extract snapshot metadata before checking out source.

Local checks:

```sh
npm run test-unit -- integration-tests/support/global-setup.test.ts
npm run lint
npm run type-check
```

These checks do not validate actual OLM installation or live-cluster execution.
For local E2E runs, provide `oc`, a kubeconfig, and console login credentials. If no CSV
exists in the OLS namespace, setup also needs `operator-sdk` to install the configured
bundle. An existing installation must include both controllers in a succeeded CSV;
incompatible or incomplete installations fail rather than being overwritten.
`CONSOLE_IMAGE` is optional locally: without it, setup uses the installed plugin image.
Setup leaves both controllers isolated after the run, just as in CI.

## E2E Framework

Playwright with `@playwright/test`. Mirrors the setup used by the sibling
`lightspeed-console` repo.

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `playwright.config.ts` | — | Test runner configuration (browser, reporters, timeouts, auth) |
| `integration-tests/support/fixtures.ts` | `test`, `expect`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Bundle install/reuse, image patch, controller isolation, browser login and storageState |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cluster cleanup and artifact gathering |
| `integration-tests/tests/` | — | Test files (`*.spec.ts`) |

## Auth Flow

1. `global-setup.ts` prepares the cluster, then launches Chromium and logs in via the
   OpenShift OAuth page.
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
| `SKIP_OLS_SETUP` | Disable cluster/browser global setup/teardown entirely; do not set in CI | unset |
| `KUBECONFIG_PATH` | Path to kubeconfig file | (required) |
| `LOGIN_USERNAME` | Login username | `kubeadmin` |
| `LOGIN_PASSWORD` | Login password | (required) |
| `LOGIN_IDP` | Identity provider name | `kube:admin` |
| `BUNDLE_IMAGE` | OLM bundle installed by global setup when absent | `quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest` |
| `IMAGE_DIGEST_MIRROR_SET_URL` | Operator IDMS manifest applied before bundle setup | Operator `main` at `config/manager/imagedigestmirrorset.yaml` |
| `CONSOLE_IMAGE` | Optional plugin image override applied by global setup | Existing image locally; SNAPSHOT image in CI |
| `OLS_NAMESPACE` | Namespace used by cluster setup | `openshift-lightspeed` |

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
- Global setup owns OLM installation/reuse, image substitution, controller isolation, auth
  and plugin stabilization. Tekton prepares tools/credentials and invokes Playwright;
  individual tests focus on UI behavior.
