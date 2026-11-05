# OpenShift Lightspeed Agentic Console Plugin

An OpenShift Console dynamic plugin for managing AI-driven remediation proposals on OpenShift clusters. It is part of the [OpenShift Lightspeed](https://github.com/openshift/lightspeed-service) ecosystem.

The plugin adds a navigation section to the admin perspective with the following pages:

- **Proposal List** (`/lightspeed/proposals`) — Filterable table of all `Proposal` custom resources across namespaces
- **Proposal Detail** (`/lightspeed/proposals/:ns/:name`) — Multi-tab workflow view with approval controls, live sandbox log streaming, and dynamic adapter components
- **Configuration** (`/lightspeed/configuration`) — Cluster-wide approval policy settings

## Custom Resources

The plugin consumes resources from the `agentic.openshift.io/v1alpha1` API group:

| Kind | Scope | Purpose |
|------|-------|---------|
| `Proposal` | Namespaced | AI-generated remediation proposal |
| `ProposalApproval` | Namespaced | Per-proposal, per-stage approval state |
| `AnalysisResult` | Namespaced | Output of the analysis agent |
| `ExecutionResult` | Namespaced | Output of the execution agent |
| `VerificationResult` | Namespaced | Output of the verification agent |
| `EscalationResult` | Namespaced | Output of the escalation agent |
| `ApprovalPolicy` | Cluster | Auto vs. manual approval per workflow stage |

## Prerequisites

- An OpenShift 4.23+ cluster with the Lightspeed Agentic operator installed
- [Node.js](https://nodejs.org) and [npm](https://www.npmjs.com) to build and run (see engines in
  package.json for the minimum versions)
- [oc](https://console.redhat.com/openshift/downloads) CLI (for local console development)
- [Docker](https://www.docker.com) or [podman 3.2.0+](https://podman.io) (for running console locally)

## Development

### Local development

In one terminal:

```sh
npm install
npm run start
```

In another terminal:

```sh
oc login  # log into your OpenShift cluster
npm run start-console
```

This runs the OpenShift console in a container connected to your cluster. The plugin dev server runs on port 9001 with CORS enabled. Navigate to <http://localhost:9000/lightspeed/proposals> to see the plugin.

### VS Code Dev Container

A `.devcontainer` configuration is provided for VS Code Remote Containers. Create a `dev.env` file in `.devcontainer/`:

```bash
OC_PLUGIN_NAME=lightspeed-agentic-console-plugin
OC_URL=https://api.example.com:6443
OC_USER=kubeadmin
OC_PASS=<password>
```

Then use `(Ctrl+Shift+P) => Remote Containers: Open Folder in Container...` and run `npm run start`.

### Running tests

```sh
npm run test-unit     # unit tests (vitest)
npm run test-watch    # watch mode
```

### Linting

```sh
npm run lint-fix
```

Stylelint enforces rules to prevent breaking console styles:

- **No hex colors** — use [PatternFly semantic tokens](https://www.patternfly.org/tokens/all-patternfly-tokens) instead
- **No `.pf-` or `.co-` prefixed selectors** — reserved for PatternFly and console
- **No naked element selectors** — prevents overwriting default console styles
- **Prefix custom classes** with `ols-plugin__` to avoid conflicts

## Building and Deployment

### Docker image

```sh
docker build -t quay.io/my-repository/lightspeed-agentic-console-plugin:latest .
docker push quay.io/my-repository/lightspeed-agentic-console-plugin:latest
```

On Apple Silicon, add `--platform=linux/amd64`.

## Internationalization

The i18n namespace is `plugin__lightspeed-agentic-console-plugin`. After adding or changing translatable strings, run:

```sh
npm run i18n
```

## References

- [OpenShift Lightspeed Service](https://github.com/openshift/lightspeed-service)
- [Console Plugin SDK](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk)
- [PatternFly React](https://www.patternfly.org/get-started/develop)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
