# Audit Logging

Implementation spec for compliance audit logging support in the agentic console. Parent spec: `ols/.ai/spec/what/audit-logging.md` (authoritative for cross-repo requirements, event semantics, and correlation contract).

## Behavioral Rules

### No Audit Emission

1. The agentic console does NOT emit audit events. It is a presentation layer — every consequential action (approvals, denials, configuration changes) results in a Kubernetes CR mutation observed by the operator.

### Approval Field Population

2. When the user approves or denies a proposal stage, the console MUST submit the approval decision as a JSON patch to the ProposalApproval CR. The patch includes decision fields: selected option, max retries, stage, and decision (approve/deny).

3. The console does NOT need to populate `spec.approver` identity fields (`uid`, `username`, `timestamp`) on the patch request. The mutating admission webhook in the agentic-operator injects these from the authenticated user's AdmissionReview. If the console does include them, the webhook overwrites them.

### Approver Display

4. The console MUST display `spec.approver` fields (username, timestamp) on the proposal detail page once an approval has been recorded. This data is populated by the webhook and available on the ProposalApproval CR after PATCH.

5. The console MUST handle the case where `spec.approver` is absent (pre-existing approvals created before the webhook was deployed) by gracefully omitting the approver display.

## Cross-References

- `proposal-lifecycle.md` — approval flow UI (rules 15-18)
- `configuration.md` — configuration UI (no audit changes needed)
