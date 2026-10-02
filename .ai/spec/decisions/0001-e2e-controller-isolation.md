# 0001: E2E Controller Isolation

**Status:** Accepted
**Applies to:** lightspeed-agentic-console (E2E integration tests)
**Related:** decision `0037-agentic-version-gating.md` in the parent `ols` repo spec

## Context

Per-PR E2E tests must render the agentic console on a real cluster, installed the
production way, and assert its behavior across **all** run states — terminal (Completed,
Failed, Denied, Escalated, EmergencyStopped) and non-terminal (Pending, Analyzing,
Proposed, Executing, Verifying, Escalating, pending-approval).

Three facts constrain the design:

1. **The console never calls an LLM.** It is a read-only view over `AgenticRun` and
   result/approval CRs. The LLM lives in the agentic operator's sandbox. So "mock LLM
   responses to avoid flakiness" really means "ensure nothing drives the seeded runs."

2. **On OCP ≥ 5.0 the production install is the v2 OLM bundle** (decision `0037-agentic-version-gating.md` in the parent `ols` repo spec), whose CSV
   carries two OLM-managed controller deployments: the classic operator and the agentic run
   controller. OLM owns both — scaling or deleting the child Deployments is reverted within
   seconds.

3. **The live run controller mutates non-terminal runs.** Its reconciler early-returns on
   terminal phases (leaving them untouched), but drives any non-terminal run forward
   (spawning a sandbox, invoking the LLM). The suspend kill-switch is not a usable hold
   either: `handleSuspension` rewrites every non-terminal run to `EmergencyStopped`. So
   against a live controller, non-terminal seeds cannot survive as authored.

We must therefore run non-terminal seeded CRs on a cluster where no controller reconciles
them, while still installing the console via the real operator path.

## Decision

Install the full v2 bundle the production way, wait for the operator-deployed console plugin
to be ready, then **disable both controllers by patching the v2 CSV to set its
controller-manager deployment replicas to `0`**. Seed `AgenticRun` + result/approval
fixtures of every phase and run Playwright against the live console.

Two substitution/isolation points are load-bearing and were chosen deliberately:

- **Image substitution at the operator's args, not the console Deployment.** The classic
  operator's `agenticconsole` reconciler owns the console Deployment's image field, so a
  direct Deployment patch is reverted. Patching the operator's `--agentic-console-image` arg
  makes the operator deploy the PR image and defend it.

- **Controller isolation by editing the CSV's own deployment spec, not the child
  Deployments.** OLM reconciles child Deployments *from* the CSV, so editing the CSV replicas
  holds; editing the children does not. The console plugin Deployment is reconciled by the
  classic operator at runtime (owned by `OLSConfig`), not by OLM, so once the classic
  controller is at zero the plugin keeps running with nothing to restore or tear it down.

## Alternatives Considered

- **Seed terminal states only, against a live controller** — rejected: the console renders
  substantial non-terminal UI (in-progress cards, remediation proposals, approval gates)
  that terminal-only seeding cannot cover.

- **Deploy an in-cluster mock LLM and drive real runs** — rejected: highest infrastructure
  cost (stub image, LLMProvider wiring, sandbox network path, response fixtures), timing
  races against the controller's live phase transitions, and it primarily exercises the
  operator/sandbox rather than the console.

- **Suspend kill-switch (`AgenticOLSConfig.spec.suspended=true`) to hold runs** — rejected:
  `handleSuspension` forces every non-terminal run to `EmergencyStopped`, destroying the
  states under test.

- **Scale/delete the controller child Deployments** — rejected: OLM reverts changes to
  CSV-owned child resources.

- **Delete the CSV** — rejected: risks broader OLM garbage collection and finalizer
  interactions; zeroing the CSV's deployment replicas is narrower and reversible.

- **CRD-only install, no operator** — rejected: does not exercise the real
  operator-managed console install per PR, which the requirement calls for.

## Consequences

- Full-fidelity install (real v2 bundle, real operator-deployed console) combined with fully
  deterministic tests: no live LLM, no sandbox, no controller-driven phase transitions.
- Every UI state — terminal and non-terminal — is coverable by seeding CRs directly.
- The isolation step depends on OLM honoring CSV deployment-spec edits and on the console
  plugin being classic-operator-reconciled (not OLM-owned). If either changes — e.g. the
  console plugin becomes OLM-owned, or OLM stops honoring CSV replica edits — the isolation
  step must be revisited.
- Terminal-phase fixtures are robust even against an accidentally-live controller (it
  early-returns on terminal phases); non-terminal fixtures are only valid with the
  controllers disabled.
- The install/isolate sequence lives in the CI pipeline task, not Playwright `global-setup`,
  keeping cluster orchestration separate from browser concerns.
