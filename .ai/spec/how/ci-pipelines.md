# CI Pipelines — Architecture

The repository has three Konflux/Pipelines-as-Code pipelines under `.tekton/`:
the image build PipelineRuns (PR and push), the `lightspeed-agentic-console-pre-commit`
integration test pipeline, and the standalone unit-and-lint/Codecov
PipelineRuns.

## Unit coverage, lint, and Codecov (OLS-4823)

### Structure

| Path | Purpose |
|---|---|
| `.tekton/unit-and-lint-pull-request.yaml` | PipelineRun triggered on PRs targeting `main` (presubmit). Supplies `{{source_branch}}`, PR number, `job-type: presubmit`, `cancel-in-progress: true`. |
| `.tekton/unit-and-lint-push.yaml` | PipelineRun triggered on pushes to `main` (postsubmit, Codecov baseline). Supplies `{{target_branch}}`, `job-type: postsubmit`, `cancel-in-progress: false`. |
| `.tekton/pipelines/unit-and-lint-pipeline.yaml` | Shared `kind: Pipeline` holding the entire task definitions (lint and unit-coverage tasks). Referenced by both PipelineRuns via the git resolver at the event's exact revision. |
| `scripts/codecov.sh` | Soft-fail Codecov uploader. Pinned `codecov-cli==11.3.1` run via `uv tool run --exclude-newer '14 days'` (matches the npm min-release-age policy for transitive dependencies). |
| `.codecov.yml` | Non-blocking status/comment policy (mirrors lightspeed-service). |
| `package.json` `test-coverage` | Runs the vitest unit suite (`src/**/*.test.{ts,tsx}`) with `@vitest/coverage-v8`, emitting `coverage/cobertura-coverage.xml`. Never the Playwright E2E/integration tests, and never uploads locally. |

The PipelineRuns must remain separate files: PaC binds one event trigger
(`on-cel-expression`) per PipelineRun, and the PR/push event payloads differ
(`pull_request_number`/`source_branch` vs `target_branch`). The job type
(presubmit/postsubmit) drives whether `scripts/codecov.sh` uploads a PR delta
or a `main` baseline.

The lint task runs `npm run lint`, `npm run type-check`, and a checked
`npm run i18n`: the locale catalogs are regenerated and the pipeline fails
if the committed `locales/` tree differs, so stale translations cannot merge.
The i18n regeneration is deterministic on a clean checkout and requires no
network beyond `npm ci`. The lint task and the unit-coverage task run in
parallel, giving immediate from-source feedback that does not wait for the
image build and snapshot required by the
`.tekton/integration-tests/lightspeed-agentic-console-pre-commit.yaml` ITS
pipeline. The lint checks intentionally overlap with the ITS pipeline's lint
task: this pipeline reports them directly on the PR/push event from source,
while the ITS pipeline re-validates them against the built snapshot.

### Constraints and rationale

- **No image build required.** The PipelineRuns are labeled
  `pipelines.appstudio.openshift.io/type: test` and produce no application
  snapshots, so unit/lint feedback does not wait for the build pipeline or
  the ITS snapshot.
- **nodejs-22-minimal image limits.** All steps run in
  `registry.access.redhat.com/ubi9/nodejs-22-minimal`, which has Node.js 22,
  npm, curl, and tar, but no git, gzip, or Python, and cannot install
  packages without root. The pipeline compensates:
  - **checkout** downloads the exact commit tarball from `codeload.github.com`,
    decompresses it with node's built-in zlib, and extracts it with
    `tar --strip-components=1`. No GitHub credentials are needed (public
    repository). Tarballs carry no git metadata, so the checkout verifies
    `package.json` landed.
  - **dependency install** runs `npx -y npm@11.21.1 ci --no-fund`: the
    image bundles npm 10, but the repository lockfile requires
    npm >= 11.10. The npm version is pinned rather than `npm@^11` because
    the repository waits until all dependencies, including npm, are
    14 days old. `--omit=optional` must NOT be used: vitest (rolldown)
    needs the optional platform-specific binding packages at runtime.
  - **coverage upload** downloads the pinned `uv` 0.10.0 release tarball
    (decompressed via node zlib); `uv` provisions its own CPython to run the
    Python-based codecov CLI.
- **Tekton workingDir pitfall.** The clone destination is never declared as
  a step `workingDir`: Tekton precreates working directories before checkout,
  potentially leaving the source owned by a different user. Each step `cd`s
  into `/workspace/source` instead.
- **Codecov CLI skips CI auto-detection** (`--auto-load-params-from
  GithubActions`) because its local adapter shells out to git, which the image
  lacks; all upload parameters (slug, sha, branch, PR) are passed explicitly
  via Prow-style environment variables set by the PipelineRun. These legacy
  variable names are the uploader's interface; this does not run in Prow.
- **Soft-fail uploads.** `scripts/codecov.sh` always exits 0 and clearly logs
  the outcome (`upload succeeded`, `CODECOV UPLOAD FAILED`, `upload skipped`).
  Unit-test failures block the pipeline; Codecov service failures do not.
- **Token handling.** The `ols-codecov-token-lightspeed-agentic-console`
  Konflux secret is injected only into the upload step, but step-scoped
  injection is not a security boundary against malicious source — PaC's
  untrusted-contributor approval controls must be retained and
  pipeline/uploader changes reviewed before approving a run. Do not commit
  the token or reuse another repository's token. A missing secret/key
  prevents the upload step from starting.

### Secret setup

Create a repository-specific Codecov upload token for
`openshift/lightspeed-agentic-console` and store it as an Opaque secret in
the Konflux tenant namespace `crt-nshift-lightspeed-tenant`:

- Name: **`ols-codecov-token-lightspeed-agentic-console`**
- Key: **`CODECOV_TOKEN`**

### Acceptance criteria (OLS-4823)

CI uploads the report to Codecov for the correct repository and commit, and
Codecov displays the `main` baseline plus a PR coverage delta. Local
validation cannot prove tenant admission/network policy permits the
PipelineRuns; the first Konflux run must verify that, followed by confirming
the baseline after the first push to `main` and a delta on a follow-up PR.
Ensure the Codecov GitHub integration is enabled for the repository.
