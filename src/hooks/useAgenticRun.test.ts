import { describe, expect, test } from 'vitest';
import {
  AgenticRunCondition,
  AgenticRunK8s,
  AnalysisResultK8s,
  ApprovalStage,
  ApproverInfo,
  derivePhaseFromConditions,
  EscalationResultK8s,
  ExecutionResultK8s,
  RemediationOption,
} from '../models/agenticrun';
import {
  buildExecutionRecord,
  filterLatest,
  mapEscalation,
  mapExecution,
  mapOption,
  mapRootCause,
  mapTimeline,
  mapToAgenticRunView,
} from './useAgenticRun';

const makeCondition = (
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
): AgenticRunCondition => ({ type, status, ...(reason ? { reason } : {}) });

const makeOption = (overrides?: Partial<RemediationOption>): RemediationOption => ({
  title: 'Restart pod',
  summary: 'Restart the failing pod',
  diagnosis: {
    summary: 'Pod OOMKilled',
    rootCause: 'Memory limit too low',
  },
  remediationPlan: {
    description: 'Increase memory limit',
    actions: [{ type: 'patch', description: 'Patch deployment' }],
    reversible: 'Reversible',
    estimatedImpact: 'Minimal downtime',
    rollbackPlan: {
      description: 'Revert memory limit',
      command: 'kubectl rollout undo',
    },
  },
  ...overrides,
});

describe('derivePhase', () => {
  test('returns Pending when conditions are undefined', () => {
    expect(derivePhaseFromConditions(undefined)).toBe('Pending');
  });

  test('returns Pending when conditions are empty', () => {
    expect(derivePhaseFromConditions([])).toBe('Pending');
  });

  test('returns EmergencyStopped when EmergencyStopped=True', () => {
    const conditions = [makeCondition('EmergencyStopped', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('EmergencyStopped');
  });

  test('returns Escalated when Escalated=True', () => {
    const conditions = [makeCondition('Escalated', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Escalated');
  });

  test('returns Denied when Denied=True', () => {
    const conditions = [makeCondition('Denied', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Denied');
  });

  test('EmergencyStopped takes priority over Escalated', () => {
    const conditions = [
      makeCondition('Escalated', 'True'),
      makeCondition('EmergencyStopped', 'True'),
    ];
    expect(derivePhaseFromConditions(conditions)).toBe('EmergencyStopped');
  });

  test('returns Escalating when Escalated=Unknown', () => {
    const conditions = [makeCondition('Escalated', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Escalating');
  });

  test('returns Failed when Escalated=False', () => {
    const conditions = [makeCondition('Escalated', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Completed when Verified=True', () => {
    const conditions = [makeCondition('Verified', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Completed');
  });

  test('returns Verifying when Verified=Unknown', () => {
    const conditions = [makeCondition('Verified', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Verifying');
  });

  test('returns Failed when Verified=False', () => {
    const conditions = [makeCondition('Verified', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Verifying when Executed=True', () => {
    const conditions = [makeCondition('Executed', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Verifying');
  });

  test('returns Executing when Executed=Unknown', () => {
    const conditions = [makeCondition('Executed', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Executing');
  });

  test('returns Failed when Executed=False', () => {
    const conditions = [makeCondition('Executed', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Proposed when Analyzed=True', () => {
    const conditions = [makeCondition('Analyzed', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Proposed');
  });

  test('returns Analyzing when Analyzed=Unknown', () => {
    const conditions = [makeCondition('Analyzed', 'Unknown')];
    expect(derivePhaseFromConditions(conditions)).toBe('Analyzing');
  });

  test('returns Failed when Analyzed=False', () => {
    const conditions = [makeCondition('Analyzed', 'False')];
    expect(derivePhaseFromConditions(conditions)).toBe('Failed');
  });

  test('returns Pending when conditions exist but none match known types', () => {
    const conditions = [makeCondition('SomeOtherCondition', 'True')];
    expect(derivePhaseFromConditions(conditions)).toBe('Pending');
  });
});

describe('mapRootCause', () => {
  test('returns undefined when analysis is undefined', () => {
    expect(mapRootCause(undefined)).toBeUndefined();
  });

  test('returns undefined when analysis has no diagnosis or options', () => {
    const analysis = { status: {} } as AnalysisResultK8s;
    expect(mapRootCause(analysis)).toBeUndefined();
  });

  test('returns undefined when first option has no diagnosis', () => {
    const opt = makeOption({ diagnosis: undefined });
    const analysis = { status: { options: [opt] } } as AnalysisResultK8s;
    expect(mapRootCause(analysis)).toBeUndefined();
  });

  test('extracts root cause from the first option diagnosis', () => {
    const opt = makeOption();
    const analysis = { status: { options: [opt] } } as AnalysisResultK8s;
    const result = mapRootCause(analysis);
    expect(result).toEqual({
      cause: 'Memory limit too low',
      detail: 'Pod OOMKilled',
    });
  });

  test('prefers option diagnosis over top-level diagnosis', () => {
    const topDiagnosis = {
      summary: 'Top-level diagnosis',
      rootCause: 'Top-level root cause',
    };
    const opt = makeOption();
    const analysis = { status: { diagnosis: topDiagnosis, options: [opt] } } as AnalysisResultK8s;
    const result = mapRootCause(analysis);
    expect(result).toEqual({
      cause: 'Memory limit too low',
      detail: 'Pod OOMKilled',
    });
  });

  test('falls back to top-level diagnosis when no options exist', () => {
    const topDiagnosis = {
      summary: 'No action needed',
      rootCause: 'False alarm',
    };
    const analysis = { status: { diagnosis: topDiagnosis } } as AnalysisResultK8s;
    const result = mapRootCause(analysis);
    expect(result).toEqual({
      cause: 'False alarm',
      detail: 'No action needed',
    });
  });
});

describe('mapOption', () => {
  test('maps a full option to RemediationOptionView', () => {
    const opt = makeOption();
    const result = mapOption(opt, 0);
    expect(result).toEqual({
      index: 0,
      title: 'Restart pod',
      description: 'Increase memory limit',
      reversibility: 'Reversible',
      estimatedImpact: 'Minimal downtime',
      actions: [{ type: 'patch', description: 'Patch deployment' }],
      rollbackDescription: 'Revert memory limit',
      rollbackCommand: 'kubectl rollout undo',
      cause: 'Memory limit too low',
      detail: 'Pod OOMKilled',
      rbac: undefined,
    });
  });

  test('uses summary as description when remediationPlan is absent', () => {
    const opt = makeOption({ remediationPlan: undefined, summary: 'Just a summary' });
    const result = mapOption(opt, 2);
    expect(result.index).toBe(2);
    expect(result.description).toBe('Just a summary');
    expect(result.estimatedImpact).toBeUndefined();
    expect(result.actions).toBeUndefined();
  });

  test('passes through rbac when present', () => {
    const rbac = {
      namespaceScoped: [
        {
          namespace: 'openshift-monitoring',
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'create', 'patch'],
          justification: 'Rotate secret',
        },
      ],
      clusterScoped: [],
    };
    const opt = makeOption({ rbac });
    const result = mapOption(opt, 0);
    expect(result.rbac).toEqual(rbac);
  });

  test('falls back to empty string when both remediationPlan and summary are absent', () => {
    const opt = makeOption({ remediationPlan: undefined, summary: undefined });
    const result = mapOption(opt, 0);
    expect(result.description).toBe('');
  });
});

describe('mapExecution', () => {
  test('returns undefined when execution is undefined', () => {
    expect(mapExecution(undefined, undefined)).toBeUndefined();
  });

  test('builds post-execution view from execution and verification', () => {
    const options: RemediationOption[] = [makeOption()];
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {
        conditions: [
          {
            type: 'Executed',
            status: 'True',
            reason: 'Success',
            message: 'Actions completed',
            lastTransitionTime: '2025-01-01T00:00:00Z',
          },
        ],
        actionsTaken: [{ type: 'patch', description: 'Patched deployment', outcome: 'Succeeded' }],
      },
    };
    const result = mapExecution(options, execution);
    expect(result).toBeDefined();
    expect(result!.originalRootCause).toBe('Memory limit too low');
    expect(result!.outcome).toBe('Unknown');
  });

  test('handles execution without verification', () => {
    const options: RemediationOption[] = [makeOption()];
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {
        actionsTaken: [{ type: 'patch', description: 'Patched', outcome: 'Succeeded' }],
      },
    };

    const result = mapExecution(options, execution);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe('Unknown');
  });

  test('handles execution with no actionsTaken', () => {
    const execution: ExecutionResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'exec-1', namespace: 'default' },
      spec: { agenticRunName: 'p1' },
      status: {},
    };

    const result = mapExecution(undefined, execution);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe('Unknown');
    expect(result!.remediationDelta).toBe('');
  });
});

describe('buildExecutionRecord', () => {
  const makeExecStage = (execution?: ApprovalStage['execution']): ApprovalStage => ({
    type: 'Execution',
    ...(execution ? { execution } : {}),
  });

  const approver: ApproverInfo = {
    username: 'alice',
    approvedAt: '2026-01-01T09:00:00Z',
  };

  test('returns undefined when execStage is undefined', () => {
    expect(buildExecutionRecord(undefined, [makeOption()], approver, undefined)).toBeUndefined();
  });

  test('returns undefined when no fields are defined', () => {
    expect(buildExecutionRecord(makeExecStage(), undefined, undefined, undefined)).toBeUndefined();
  });

  test('returns undefined when only approvedAt would be set (nothing renders standalone)', () => {
    const result = buildExecutionRecord(
      makeExecStage(),
      undefined,
      undefined,
      '2026-01-01T10:00:00Z',
    );
    expect(result).toBeUndefined();
  });

  test('resolves selectedOption from the executed option index', () => {
    const options = [makeOption({ title: 'Scale up' }), makeOption({ title: 'Restart pod' })];
    const result = buildExecutionRecord(
      makeExecStage({ option: 1 }),
      options,
      undefined,
      undefined,
    );
    expect(result).toEqual({ selectedOption: 'Restart pod' });
  });

  test('leaves selectedOption undefined when option index is out of range', () => {
    const options = [makeOption({ title: 'Scale up' })];
    const result = buildExecutionRecord(
      makeExecStage({ option: 5 }),
      options,
      undefined,
      undefined,
    );
    expect(result).toBeUndefined();
  });

  test('leaves selectedOption undefined when option index is not set', () => {
    const options = [makeOption({ title: 'Scale up' })];
    const result = buildExecutionRecord(makeExecStage(), options, approver, undefined);
    expect(result?.selectedOption).toBeUndefined();
    expect(result?.approverUsername).toBe('alice');
  });

  test('prefers approver approvedAt over executionStartedAt', () => {
    const result = buildExecutionRecord(
      makeExecStage(),
      undefined,
      approver,
      '2026-01-01T10:00:00Z',
    );
    expect(result?.approvedAt).toBe('2026-01-01T09:00:00Z');
  });

  test('falls back to executionStartedAt when approver approvedAt is absent', () => {
    const result = buildExecutionRecord(
      makeExecStage(),
      undefined,
      { username: 'alice' },
      '2026-01-01T10:00:00Z',
    );
    expect(result?.approvedAt).toBe('2026-01-01T10:00:00Z');
  });

  test('maps all fields together', () => {
    const options = [makeOption({ title: 'Restart pod' })];
    const result = buildExecutionRecord(
      makeExecStage({ option: 0 }),
      options,
      approver,
      '2026-01-01T10:00:00Z',
    );
    expect(result).toEqual({
      approvedAt: '2026-01-01T09:00:00Z',
      approverUsername: 'alice',
      selectedOption: 'Restart pod',
    });
  });
});

describe('filterLatest', () => {
  test('returns undefined for undefined input', () => {
    expect(filterLatest(undefined)).toBeUndefined();
  });

  test('returns undefined for empty array', () => {
    expect(filterLatest([])).toBeUndefined();
  });

  test('returns the only item for single-element array', () => {
    const item = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'a', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    expect(filterLatest([item])).toBe(item);
  });

  test('returns the item with the latest creationTimestamp', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'old', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'new', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    expect(filterLatest([older, newer])).toBe(newer);
    expect(filterLatest([newer, older])).toBe(newer);
  });

  test('handles items missing creationTimestamp gracefully', () => {
    const withTs = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'has-ts', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const withoutTs = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'no-ts' },
    };
    // Item with a timestamp should be preferred over one without
    expect(filterLatest([withoutTs, withTs])).toBe(withTs);
  });

  test('prefers StepResultRef match over latest timestamp', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-1', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-2', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    const refs = [
      { name: 'result-1', outcome: 'Succeeded' as const },
      { name: 'result-1', outcome: 'Succeeded' as const },
    ];
    // Should match by ref name (result-1) even though result-2 is newer
    expect(filterLatest([older, newer], refs)).toBe(older);
  });

  test('falls back to timestamp when ref name is not found', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-1', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'result-2', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    const refs = [{ name: 'result-missing', outcome: 'Succeeded' as const }];
    expect(filterLatest([older, newer], refs)).toBe(newer);
  });

  test('falls back to timestamp when refs are undefined', () => {
    const older = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'old', creationTimestamp: '2025-01-01T00:00:00Z' },
    };
    const newer = {
      apiVersion: 'v1',
      kind: 'Test',
      metadata: { name: 'new', creationTimestamp: '2025-06-15T12:00:00Z' },
    };
    expect(filterLatest([older, newer], undefined)).toBe(newer);
  });
});

describe('mapEscalation', () => {
  test('returns undefined when escalationResult is undefined', () => {
    expect(mapEscalation(undefined)).toBeUndefined();
  });

  test('maps escalation result fields', () => {
    const escalation: EscalationResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'EscalationResult',
      metadata: { name: 'esc-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: {
        summary: 'Verification failed after remediation',
        content: 'The pod was patched but the alert persisted. Recommend manual investigation.',
        failureReason: undefined,
        conditions: [
          {
            type: 'Started',
            status: 'True',
            lastTransitionTime: '2026-01-01T10:00:00Z',
          },
          {
            type: 'Completed',
            status: 'True',
            reason: 'Succeeded',
            lastTransitionTime: '2026-01-01T10:01:00Z',
          },
        ],
      },
    };
    const result = mapEscalation(escalation);
    expect(result).toBeDefined();
    expect(result!.summary).toBe('Verification failed after remediation');
    expect(result!.content).toBe(
      'The pod was patched but the alert persisted. Recommend manual investigation.',
    );
    expect(result!.failureReason).toBeUndefined();
    expect(result!.escalationStartedAt).toBe('2026-01-01T10:00:00Z');
  });

  test('maps sandbox info when provided', () => {
    const escalation: EscalationResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'EscalationResult',
      metadata: { name: 'esc-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: { summary: 'Summary' },
    };
    const sandbox = { claimName: 'sandbox-pod', namespace: 'test-ns' };
    const result = mapEscalation(escalation, sandbox);
    expect(result!.escalationSandbox).toEqual({ podName: 'sandbox-pod', namespace: 'test-ns' });
  });

  test('maps failureReason when escalation step itself fails', () => {
    const escalation: EscalationResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'EscalationResult',
      metadata: { name: 'esc-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: { failureReason: 'Sandbox timeout after 120s' },
    };
    const result = mapEscalation(escalation);
    expect(result!.failureReason).toBe('Sandbox timeout after 120s');
  });
});

describe('mapTimeline escalation events', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof mapTimeline>[2];

  const makeRun = (conditions?: AgenticRunCondition[]): AgenticRunK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'AgenticRun',
      metadata: { name: 'run-1', namespace: 'default', creationTimestamp: '2026-01-01T00:00:00Z' },
      spec: { request: 'Fix alert' },
      status: { conditions },
    }) as AgenticRunK8s;

  test('includes escalation started and completed events', () => {
    const escalation: EscalationResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'EscalationResult',
      metadata: { name: 'esc-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: {
        conditions: [
          {
            type: 'Started',
            status: 'True',
            lastTransitionTime: '2026-01-01T10:00:00Z',
          },
          {
            type: 'Completed',
            status: 'True',
            reason: 'Succeeded',
            message: 'Escalation complete',
            lastTransitionTime: '2026-01-01T10:01:00Z',
          },
        ],
      },
    };

    const run = makeRun([makeCondition('Escalated', 'True')]);
    const events = mapTimeline(
      run,
      'Escalated',
      t,
      undefined,
      undefined,
      undefined,
      undefined,
      escalation,
    );

    const escalationEvents = events.filter(
      (e) => e.label.includes('Escalation') || e.label.includes('escalation'),
    );
    expect(escalationEvents.length).toBe(2);
    expect(escalationEvents[0].label).toContain('started');
    expect(escalationEvents[1].label).toContain('completed');
    expect(escalationEvents[1].description).toBe('Escalation complete');
  });

  test('includes escalation failure reason in timeline event', () => {
    const escalation: EscalationResultK8s = {
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'EscalationResult',
      metadata: { name: 'esc-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: {
        failureReason: 'Sandbox crashed',
        conditions: [
          {
            type: 'Completed',
            status: 'True',
            reason: 'Failed',
            lastTransitionTime: '2026-01-01T10:01:00Z',
          },
        ],
      },
    };

    const run = makeRun([makeCondition('Escalated', 'True')]);
    const events = mapTimeline(
      run,
      'Escalated',
      t,
      undefined,
      undefined,
      undefined,
      undefined,
      escalation,
    );

    const failedEvent = events.find(
      (e) => e.label.includes('Escalation') && e.variant === 'danger',
    );
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.description).toBe('Sandbox crashed');
  });
});

describe('mapToAgenticRunView target cluster', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof mapToAgenticRunView>[6];

  test.each(['remote-cluster', undefined, '', '   '])(
    'maps spec.targetCluster (%j) without waiting for result CRs',
    (targetCluster) => {
      const run: AgenticRunK8s = {
        apiVersion: 'agentic.openshift.io/v1alpha1',
        kind: 'AgenticRun',
        metadata: { name: 'run-1', namespace: 'default' },
        spec: { request: 'Fix alert', targetCluster },
      };
      const view = mapToAgenticRunView(
        run,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        t,
      );

      expect(view).toBeDefined();
      expect(view?.targetCluster).toBe(targetCluster);
    },
  );
});

describe('mapToAgenticRunView failureReason precedence', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof mapToAgenticRunView>[6];

  const makeRun = (conditions: AgenticRunCondition[]): AgenticRunK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'AgenticRun',
      metadata: { name: 'run-1', namespace: 'default', creationTimestamp: '2026-01-01T00:00:00Z' },
      spec: { request: 'Fix alert' },
      status: { conditions },
    }) as AgenticRunK8s;

  const makeAnalysis = (failureReason?: string): AnalysisResultK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'AnalysisResult',
      metadata: { name: 'analysis-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: { ...(failureReason ? { failureReason } : {}) },
    }) as AnalysisResultK8s;

  const makeExecution = (failureReason?: string): ExecutionResultK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'ExecutionResult',
      metadata: { name: 'execution-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: { ...(failureReason ? { failureReason } : {}) },
    }) as ExecutionResultK8s;

  test('returns undefined when the run has no name', () => {
    expect(
      mapToAgenticRunView(undefined, undefined, undefined, undefined, undefined, undefined, t),
    ).toBeUndefined();
  });

  test('prefers the analysis result failureReason over the condition fallback', () => {
    const run = makeRun([makeCondition('Analyzed', 'False', 'AnalysisFailed')]);
    const view = mapToAgenticRunView(
      run,
      makeAnalysis('Analysis pod exceeded memory limit'),
      undefined,
      undefined,
      undefined,
      undefined,
      t,
    );

    expect(view?.phase).toBe('Failed');
    expect(view?.failureReason).toBe('Analysis pod exceeded memory limit');
  });

  test('falls back to the execution result failureReason when analysis reports none', () => {
    const run = makeRun([
      makeCondition('Analyzed', 'True'),
      makeCondition('Executed', 'False', 'ExecutionFailed'),
    ]);
    const view = mapToAgenticRunView(
      run,
      makeAnalysis(),
      makeExecution('Insufficient permissions to patch CoreDNS ConfigMap'),
      undefined,
      undefined,
      undefined,
      t,
    );

    expect(view?.phase).toBe('Failed');
    expect(view?.failureReason).toBe('Insufficient permissions to patch CoreDNS ConfigMap');
  });

  test('falls back to the failing condition via deriveFailureReason when no result CR reports one', () => {
    const run = makeRun([
      {
        type: 'Analyzed',
        status: 'False',
        reason: 'SandboxFailed',
        message: '422 Unprocessable Entity',
      },
    ]);
    const view = mapToAgenticRunView(
      run,
      makeAnalysis(),
      undefined,
      undefined,
      undefined,
      undefined,
      t,
    );

    expect(view?.phase).toBe('Failed');
    expect(view?.failureReason).toBe('SandboxFailed: 422 Unprocessable Entity');
  });

  test('does not derive a condition failure reason for a non-Failed run (Denied with Escalated=False)', () => {
    const run = makeRun([
      {
        type: 'Escalated',
        status: 'False',
        reason: 'EscalationFailed',
        message: 'sandbox crashed',
      },
      makeCondition('Denied', 'True'),
    ]);
    const view = mapToAgenticRunView(
      run,
      makeAnalysis(),
      undefined,
      undefined,
      undefined,
      undefined,
      t,
    );

    expect(view?.phase).toBe('Denied');
    expect(view?.failureReason).toBeUndefined();
  });
});

describe('mapToAgenticRunView stop state', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof mapToAgenticRunView>[6];
  const makeAnalysis = (failureReason?: string): AnalysisResultK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'AnalysisResult',
      metadata: { name: 'analysis-1', namespace: 'default' },
      spec: { agenticRunName: 'run-1' },
      status: { ...(failureReason ? { failureReason } : {}) },
    }) as AnalysisResultK8s;

  type RunSteps = NonNullable<AgenticRunK8s['status']>['steps'];

  const makeRun = (
    conditions: AgenticRunCondition[],
    options: { cancelled?: boolean; steps?: RunSteps } = {},
  ): AgenticRunK8s =>
    ({
      apiVersion: 'agentic.openshift.io/v1alpha1',
      kind: 'AgenticRun',
      metadata: { name: 'run-1', namespace: 'default' },
      spec: { request: 'Fix alert', cancelled: options.cancelled },
      status: { conditions, steps: options.steps },
    }) as AgenticRunK8s;

  const map = (run: AgenticRunK8s, analysis?: AnalysisResultK8s, execution?: ExecutionResultK8s) =>
    mapToAgenticRunView(run, analysis, execution, undefined, undefined, undefined, t);

  test('shows the cancellation cause instead of stale result failure text only for the effective Failed condition', () => {
    const run = makeRun([
      makeCondition('Analyzed', 'True'),
      makeCondition('Executed', 'False', 'CancelledByUser'),
    ]);

    expect(map(run, makeAnalysis('Stale analysis failure'))?.failureReason).toBe('Stopped by user');
  });

  test('keeps the normal result failure priority when a lower-precedence condition says CancelledByUser', () => {
    const run = makeRun([
      makeCondition('Executed', 'False', 'ExecutionFailed'),
      makeCondition('Analyzed', 'False', 'CancelledByUser'),
    ]);

    const view = map(run, makeAnalysis('Stale analysis failure'));
    expect(view?.phase).toBe('Failed');
    expect(view?.failureReason).toBe('Stale analysis failure');
  });

  test('does not render a final failure reason while Stopping=True', () => {
    const run = makeRun([
      makeCondition('Executed', 'False', 'ExecutionFailed'),
      makeCondition('Stopping', 'True'),
    ]);

    const view = map(run, makeAnalysis('Execution failed'));
    expect(view?.phase).toBe('Failed');
    expect(view?.stopping).toBe(true);
    expect(view?.failureReason).toBeUndefined();
  });

  test('keeps a recorded non-cancellation failure visible when spec.cancelled remains true', () => {
    const run = makeRun([makeCondition('Analyzed', 'False', 'AnalysisFailed')], {
      cancelled: true,
    });

    const view = map(run, makeAnalysis('Analysis failed'));
    expect(view?.stopPending).toBe(true);
    expect(view?.stopping).toBe(false);
    expect(view?.failureReason).toBe('Analysis failed');
  });

  test('marks shutdown pending for a retained sandbox in any step with a pending stop', () => {
    const run = makeRun([makeCondition('Analyzed', 'Unknown')], {
      cancelled: true,
      steps: { escalation: { sandbox: { claimName: 'sandbox-1' } } },
    });

    const view = map(run);
    expect(view?.stopping).toBe(false);
    expect(view?.stopPending).toBe(true);
    expect(view?.sandboxShutdownPending).toBe(true);
  });

  test('marks shutdown pending for final user cancellation or emergency stop with a sandbox', () => {
    const sandboxSteps: RunSteps = { verification: { sandbox: { claimName: 'sandbox-1' } } };
    const cancelled = makeRun([makeCondition('Executed', 'False', 'CancelledByUser')], {
      steps: sandboxSteps,
    });
    const emergency = makeRun([makeCondition('EmergencyStopped', 'True')], {
      steps: sandboxSteps,
    });

    expect(map(cancelled)?.sandboxShutdownPending).toBe(true);
    expect(map(cancelled)?.failureReason).toBe('Stopped by user');
    expect(map(emergency)?.phase).toBe('EmergencyStopped');
    expect(map(emergency)?.failureReason).not.toBe('Stopped by user');
    expect(map(emergency)?.sandboxShutdownPending).toBe(true);
  });

  test('does not signal sandbox shutdown without a retained sandbox reference', () => {
    const run = makeRun([makeCondition('Analyzed', 'Unknown')], { cancelled: true });

    expect(map(run)?.stopPending).toBe(true);
    expect(map(run)?.sandboxShutdownPending).toBe(false);
  });
});
