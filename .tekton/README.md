# Unit coverage, lint, and Codecov (OLS-4823)

`unit-and-lint-pull-request.yaml` and `unit-and-lint-push.yaml` are
standalone Pipelines-as-Code PipelineRuns that run, for every PR targeting
`main` and every push to `main`, respectively:

- the lint/type-check/i18n checks, and
- the unit test suite with coverage, uploading the report to Codecov.

They share the task definitions in `pipelines/unit-and-lint-pipeline.yaml`.
Uploads soft-fail: unit-test failures block the pipeline, Codecov failures
do not. The Codecov token lives in a Konflux secret that is injected only
into the upload step.

Design details, constraints, and secret setup live in
`.ai/spec/how/ci-pipelines.md`.
