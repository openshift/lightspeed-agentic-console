# OpenShift Lightspeed Agentic Console Plugin — Specifications

An OpenShift Console dynamic plugin for managing AI-driven cluster operation runs. Users view, approve/deny, and monitor runs through a multi-stage workflow (Analysis, Execution, Verification, Escalation) and configure approval policies.

## Structure

| Layer | Path | Purpose |
|---|---|---|
| **what/** | `.ai/spec/what/` | Behavioral rules. What the system must do. Implementation-agnostic. |
| **how/** | `.ai/spec/how/` | Codebase navigation. How the code is organized. Implementation-specific. |

## Scope

Covers the console plugin only — the React frontend that renders run state and sends approval/denial patches. Out of scope: the lightspeed-agentic-operator (which reconciles runs), the agentic-sandbox (which executes agent workloads), CRD definitions, and backend API logic.

## Audience

AI agents. Content is optimized for precision and machine consumption.

## Quick Start

| Task | Start here |
|---|---|
| Understand the system | `what/system-overview.md` |
| Understand runs UI | `what/run-lifecycle.md` |
| Understand configuration UI | `what/configuration.md` |
| Understand audit logging | `what/audit-logging.md` |
| Navigate the codebase | `how/project-structure.md` |
| Understand K8s data flow | `how/k8s-data-layer.md` |
| Understand the plugin system | `how/console-plugin-system.md` |
| Understand CI and e2e testing | `how/e2e-testing.md` |
| Handle dependency bumps | `how/dependency-management.md` |

## Cross-Reference

| what/ | how/ |
|---|---|
| `what/system-overview.md` | `how/project-structure.md`, `how/console-plugin-system.md` |
| `what/run-lifecycle.md` | `how/k8s-data-layer.md`, `how/project-structure.md` |
| `what/configuration.md` | `how/k8s-data-layer.md` |
| `what/audit-logging.md` | `how/k8s-data-layer.md` |
| — | `how/e2e-testing.md` |
| — | `how/dependency-management.md` |

## Conventions

- **Rule numbering:** behavioral rules are numbered sequentially within each what/ file.
- **Planned changes:** unimplemented behavior is marked with `[PLANNED]` or `[PLANNED: TICKET-XXXX]` inline next to the rule it affects.
- **Constraints:** component-specific and cross-cutting constraints go in the relevant what/ file's Constraints section, co-located with behavioral rules. Development conventions go in CLAUDE.md.
- **Authority:** what/ specs are authoritative for behavior. how/ specs are authoritative for implementation. When they conflict, what/ wins.
- **When to create a new file vs. extend an existing one:** if the new concern has its own lifecycle, configuration surface, and can be understood independently, it gets its own file. If it's a capability added to an existing component, it goes in that component's file.
