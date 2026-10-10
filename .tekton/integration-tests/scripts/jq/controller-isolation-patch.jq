.spec.install.spec.deployments |= map(
  if .name == $classic or .name == $agentic then .spec.replicas = 0 else . end)
| {spec: {install: {spec: {deployments: .spec.install.spec.deployments}}}}
