.spec.install.spec.deployments |= map(
  if .name == $classic then
    .spec.template.spec.containers |= map(
      if .name == "manager" then
        .args = ((.args // [] | map(select(startswith("--agentic-console-image=") | not)))
                 + ["--agentic-console-image=" + $image])
      else . end)
  else . end)
| if any(.spec.install.spec.deployments[];
    .name == $classic and any(.spec.template.spec.containers[];
      .name == "manager" and any(.args[]; . == "--agentic-console-image=" + $image)))
  then {spec: {install: {spec: {deployments: .spec.install.spec.deployments}}}}
  else error("Classic operator manager container not found") end
