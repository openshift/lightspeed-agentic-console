#!/usr/bin/env bash
# Install the production OLM bundle, substitute the PR console image, and stop
# both reconcilers before Playwright. Requires oc, jq and operator-sdk on PATH.
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

: "${KUBECONFIG:?KUBECONFIG must point to the claimed cluster}"
: "${CONSOLE_IMAGE:?CONSOLE_IMAGE must be the snapshot image}"
: "${BUNDLE_IMAGE:?BUNDLE_IMAGE must be set}"
OLS_NAMESPACE="${OLS_NAMESPACE:-openshift-lightspeed}"
CLASSIC_CONTROLLER=lightspeed-operator-controller-manager
AGENTIC_CONTROLLER=lightspeed-agentic-operator-controller-manager
PLUGIN=lightspeed-agentic-console-plugin

# Check the completed cluster version, not an in-progress upgrade target.
oc get clusterversion version -o json | jq -e '
  [.status.history[] | select(.state == "Completed")][0].version
  | split(".")[0] | tonumber >= 5
' >/dev/null

oc create namespace "$OLS_NAMESPACE" --dry-run=client -o yaml | oc apply -f -
operator-sdk run bundle --namespace "$OLS_NAMESPACE" --timeout 30m "$BUNDLE_IMAGE"

# Fail clearly if :latest still points to a classic-only bundle. Never silently
# fall back to a standalone controller or a CRD-only installation.
CSV=$(oc get csv -n "$OLS_NAMESPACE" -o json | jq -er --arg classic "$CLASSIC_CONTROLLER" --arg agentic "$AGENTIC_CONTROLLER" '
  [.items[] | select(.status.phase == "Succeeded")
   | select(any(.spec.install.spec.deployments[]; .name == $classic))
   | select(any(.spec.install.spec.deployments[]; .name == $agentic))]
  | if length == 1 then .[0].metadata.name
    else error("Expected exactly one succeeded v2 CSV with both controllers") end
')
for crd in olsconfigs.ols.openshift.io agenticruns.agentic.openshift.io; do
  oc wait --for=condition=Established "crd/$crd" --timeout=120s
done

# OLM owns the operator Deployment too. Set the operator's args in its CSV
# source so OLM cannot revert the image override during installation.
IMAGE_PATCH=$(oc get csv "$CSV" -n "$OLS_NAMESPACE" -o json | jq -ec \
  --arg classic "$CLASSIC_CONTROLLER" --arg image "$CONSOLE_IMAGE" \
  -f "$SCRIPT_DIR/jq/console-image-patch.jq")
oc patch csv "$CSV" -n "$OLS_NAMESPACE" --type=merge -p "$IMAGE_PATCH"

# Placeholder credentials satisfy OLSConfig validation; these UI-only tests do
# not call the classic service or an LLM. No real provider token is needed.
oc create secret generic console-e2e-provider -n "$OLS_NAMESPACE" \
  --from-literal=apitoken=unused-console-e2e-token --dry-run=client -o yaml | oc apply -f -
oc apply -f - <<'EOF'
apiVersion: ols.openshift.io/v1alpha1
kind: OLSConfig
metadata:
  name: cluster
spec:
  llm:
    providers:
      - name: console-e2e
        type: openai
        url: https://api.openai.com/v1
        credentialsSecretRef:
          name: console-e2e-provider
        models:
          - name: gpt-4o-mini
  ols:
    defaultModel: gpt-4o-mini
    defaultProvider: console-e2e
EOF

plugin_ready() {
  oc get deployment "$PLUGIN" -n "$OLS_NAMESPACE" -o json | jq -e \
    --arg image "$CONSOLE_IMAGE" -f "$SCRIPT_DIR/jq/plugin-ready.jq" >/dev/null &&
    oc get consoleplugin "$PLUGIN" >/dev/null &&
    oc get consoles.operator.openshift.io cluster -o json | jq -e --arg plugin "$PLUGIN" '
      any(.spec.plugins[]?; . == $plugin)
    ' >/dev/null
}

ready=0
for _ in $(seq 1 120); do
  if plugin_ready; then
    ready=1
    break
  fi
  sleep 5
done
if [ "$ready" != 1 ]; then
  echo "Console plugin did not become ready with the snapshot image" >&2
  exit 1
fi

# Capture the actual selectors before scaling, so verification covers old and
# new ReplicaSets rather than relying on an assumed pod label.
SELECTORS=$(oc get csv "$CSV" -n "$OLS_NAMESPACE" -o json | jq -er --arg classic "$CLASSIC_CONTROLLER" --arg agentic "$AGENTIC_CONTROLLER" '
  .spec.install.spec.deployments[] | select(.name == $classic or .name == $agentic)
  | .spec.selector.matchLabels | to_entries | map(.key + "=" + .value) | join(",")
  | if length > 0 then . else error("Controller selector must not be empty") end
')
ISOLATION_PATCH=$(oc get csv "$CSV" -n "$OLS_NAMESPACE" -o json | jq -ec \
  --arg classic "$CLASSIC_CONTROLLER" --arg agentic "$AGENTIC_CONTROLLER" \
  -f "$SCRIPT_DIR/jq/controller-isolation-patch.jq")
oc patch csv "$CSV" -n "$OLS_NAMESPACE" --type=merge -p "$ISOLATION_PATCH"

controllers_stopped() {
  local controller selector
  for controller in "$CLASSIC_CONTROLLER" "$AGENTIC_CONTROLLER"; do
    oc get deployment "$controller" -n "$OLS_NAMESPACE" -o json | jq -e '
      .spec.replicas == 0 and (.status.replicas // 0) == 0
    ' >/dev/null || return 1
  done
  while IFS= read -r selector; do
    oc get pods -n "$OLS_NAMESPACE" -l "$selector" -o json | jq -e '.items | length == 0' >/dev/null || return 1
  done <<< "$SELECTORS"
}

isolated=0
for _ in $(seq 1 60); do
  if controllers_stopped; then
    isolated=1
    break
  fi
  sleep 5
done
if [ "$isolated" != 1 ]; then
  echo "Controller isolation failed; refusing to run nondeterministic UI tests" >&2
  exit 1
fi
plugin_ready
oc get crd agenticruns.agentic.openshift.io >/dev/null
printf 'Console image %s is ready; both CSV controllers are isolated.\n' "$CONSOLE_IMAGE"
