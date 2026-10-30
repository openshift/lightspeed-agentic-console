import { describe, expect, it } from 'vitest';

import {
  canStopRun,
  deriveFailureReason,
  derivePhaseFromConditions,
  getPhaseDisplay,
  isCancelledByUser,
  isNoActionRequired,
  isRunStopPending,
  isRunStopping,
} from './agenticrun';
import type { AgenticRunCondition, LightspeedAgenticRun } from './agenticrun';
import { cond } from '../test-helpers';

describe('derivePhaseFromConditions', () => {
  it('returns Pending for undefined conditions', () => {
    expect(derivePhaseFromConditions(undefined)).toBe('Pending');
  });

  it('returns Pending for empty conditions', () => {
    expect(derivePhaseFromConditions([])).toBe('Pending');
  });

  it('returns Analyzing for Analyzed=Unknown', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'Unknown')])).toBe('Analyzing');
  });

  it('returns Proposed for Analyzed=True (awaiting execution approval)', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'True')])).toBe('Proposed');
  });

  it('returns Completed for Analyzed=True with reason NoActionRequired', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'True', 'NoActionRequired')])).toBe(
      'Completed',
    );
  });

  it('Denied takes priority over Analyzed NoActionRequired', () => {
    expect(
      derivePhaseFromConditions([
        cond('Denied', 'True'),
        cond('Analyzed', 'True', 'NoActionRequired'),
      ]),
    ).toBe('Denied');
  });

  it('returns Failed for Analyzed=False', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'False')])).toBe('Failed');
  });

  it('returns Executing for Executed=Unknown', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'True'), cond('Executed', 'Unknown')])).toBe(
      'Executing',
    );
  });

  it('returns Verifying for Executed=True', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'True'), cond('Executed', 'True')])).toBe(
      'Verifying',
    );
  });

  it('returns Failed for Executed=False', () => {
    expect(derivePhaseFromConditions([cond('Analyzed', 'True'), cond('Executed', 'False')])).toBe(
      'Failed',
    );
  });

  it('returns Verifying for Verified=Unknown', () => {
    expect(
      derivePhaseFromConditions([
        cond('Analyzed', 'True'),
        cond('Executed', 'True'),
        cond('Verified', 'Unknown'),
      ]),
    ).toBe('Verifying');
  });

  it('returns Completed for Verified=True', () => {
    expect(
      derivePhaseFromConditions([
        cond('Analyzed', 'True'),
        cond('Executed', 'True'),
        cond('Verified', 'True'),
      ]),
    ).toBe('Completed');
  });

  it('returns Escalating for Verified=False with Escalated=Unknown (verification failure escalates)', () => {
    expect(
      derivePhaseFromConditions([
        cond('Analyzed', 'True'),
        cond('Executed', 'True'),
        cond('Verified', 'False', 'VerificationFailed'),
        cond('Escalated', 'Unknown', 'VerificationFailed'),
      ]),
    ).toBe('Escalating');
  });

  it('returns Failed for Verified=False with other reason', () => {
    expect(
      derivePhaseFromConditions([
        cond('Analyzed', 'True'),
        cond('Executed', 'True'),
        cond('Verified', 'False', 'SystemError'),
      ]),
    ).toBe('Failed');
  });

  it('returns Denied for Denied=True', () => {
    expect(derivePhaseFromConditions([cond('Denied', 'True')])).toBe('Denied');
  });

  it('returns Escalated for Escalated=True', () => {
    expect(derivePhaseFromConditions([cond('Escalated', 'True')])).toBe('Escalated');
  });

  it('Escalated takes priority over Denied', () => {
    expect(derivePhaseFromConditions([cond('Escalated', 'True'), cond('Denied', 'True')])).toBe(
      'Escalated',
    );
  });

  it('returns EmergencyStopped for EmergencyStopped=True', () => {
    expect(derivePhaseFromConditions([cond('EmergencyStopped', 'True')])).toBe('EmergencyStopped');
  });

  it('EmergencyStopped takes priority over Analyzed=True', () => {
    expect(
      derivePhaseFromConditions([cond('EmergencyStopped', 'True'), cond('Analyzed', 'True')]),
    ).toBe('EmergencyStopped');
  });

  it('EmergencyStopped takes priority over Escalated=True', () => {
    expect(
      derivePhaseFromConditions([cond('EmergencyStopped', 'True'), cond('Escalated', 'True')]),
    ).toBe('EmergencyStopped');
  });

  it('EmergencyStopped takes priority over Denied=True', () => {
    expect(
      derivePhaseFromConditions([cond('EmergencyStopped', 'True'), cond('Denied', 'True')]),
    ).toBe('EmergencyStopped');
  });
});

describe('deriveFailureReason', () => {
  it('returns undefined for undefined conditions', () => {
    expect(deriveFailureReason(undefined)).toBeUndefined();
  });

  it('returns undefined when no condition has failed', () => {
    expect(deriveFailureReason([cond('Analyzed', 'True')])).toBeUndefined();
  });

  it('combines reason and message for a failed Analyzed condition', () => {
    expect(
      deriveFailureReason([cond('Analyzed', 'False', 'SandboxFailed', '422 Unprocessable Entity')]),
    ).toBe('SandboxFailed: 422 Unprocessable Entity');
  });

  it('returns only the message when reason is absent', () => {
    expect(deriveFailureReason([cond('Analyzed', 'False', undefined, 'something broke')])).toBe(
      'something broke',
    );
  });

  it('returns only the reason when message is absent', () => {
    expect(deriveFailureReason([cond('Analyzed', 'False', 'SandboxFailed')])).toBe('SandboxFailed');
  });

  it('prefers the earliest failing condition in phase precedence order', () => {
    expect(
      deriveFailureReason([
        cond('Analyzed', 'True'),
        cond('Executed', 'False', 'ExecutionFailed', 'command failed'),
        cond('Verified', 'False', 'VerificationFailed', 'check failed'),
      ]),
    ).toBe('VerificationFailed: check failed');
  });
});

describe('getPhaseDisplay', () => {
  it.each([
    ['Pending', { color: 'grey', label: 'Pending' }],
    ['Analyzing', { color: 'blue', label: 'Analyzing' }],
    ['Proposed', { color: 'blue', label: 'Proposed' }],
    ['Executing', { color: 'teal', label: 'Executing' }],
    ['Verifying', { color: 'teal', label: 'Verifying' }],
    ['Escalating', { color: 'orange', label: 'Escalating' }],
    ['Completed', { color: 'green', label: 'Completed' }],
    ['Failed', { color: 'red', label: 'Failed' }],
    ['Denied', { color: 'red', label: 'Denied' }],
    ['Escalated', { color: 'orange', label: 'Escalated' }],
    ['EmergencyStopped', { color: 'red', label: 'Emergency stopped' }],
  ])('returns correct display for %s', (phase, expected) => {
    expect(getPhaseDisplay(phase)).toEqual(expected);
  });

  it('returns grey with phase as label for unknown phases', () => {
    expect(getPhaseDisplay('SomeUnknownPhase')).toEqual({
      color: 'grey',
      label: 'SomeUnknownPhase',
    });
  });

  it('returns grey with Unknown label when phase is undefined', () => {
    expect(getPhaseDisplay(undefined)).toEqual({
      color: 'grey',
      label: 'Unknown',
    });
  });
});

describe('isNoActionRequired', () => {
  it('returns true for Analyzed=True with reason NoActionRequired', () => {
    expect(isNoActionRequired([cond('Analyzed', 'True', 'NoActionRequired')])).toBe(true);
  });

  it('returns false for Analyzed=True with a different reason', () => {
    expect(isNoActionRequired([cond('Analyzed', 'True', 'OtherReason')])).toBe(false);
  });

  it('returns false when Analyzed condition is absent', () => {
    expect(isNoActionRequired(undefined)).toBe(false);
  });
});

describe('run stop helpers', () => {
  const makeRun = (
    conditions?: AgenticRunCondition[],
    cancelled?: boolean,
  ): LightspeedAgenticRun => ({
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRun',
    metadata: { name: 'test', namespace: 'default' },
    spec: {
      request: 'test request',
      ...(cancelled === undefined ? {} : { cancelled }),
    },
    ...(conditions === undefined ? {} : { status: { conditions } }),
  });

  it('treats only Stopping=True as a stopping state', () => {
    expect(isRunStopping(undefined)).toBe(false);
    expect(isRunStopping([])).toBe(false);
    expect(isRunStopping([cond('Stopping', 'False')])).toBe(false);
    expect(isRunStopping([cond('Stopping', 'Unknown')])).toBe(false);
    expect(isRunStopping([cond('Stopping', 'True')])).toBe(true);
  });

  it('matches cancellation to the effective failed condition by precedence', () => {
    expect(isCancelledByUser(undefined)).toBe(false);
    expect(isCancelledByUser([cond('Analyzed', 'False', 'CancelledByUser')])).toBe(true);
    expect(
      isCancelledByUser([
        cond('Analyzed', 'False', 'CancelledByUser'),
        cond('Verified', 'False', 'VerificationFailed'),
      ]),
    ).toBe(false);
    expect(
      isCancelledByUser([
        cond('Verified', 'False', 'CancelledByUser'),
        cond('Analyzed', 'False', 'AnalysisFailed'),
      ]),
    ).toBe(true);
    expect(
      isCancelledByUser([
        cond('Verified', 'False', 'CancelledByUser'),
        cond('Escalated', 'False', 'EscalationFailed'),
      ]),
    ).toBe(false);
    expect(isCancelledByUser([cond('Stopping', 'True', 'CancelledByUser')])).toBe(false);
  });

  it('recognizes requested and operator-confirmed stop-pending states', () => {
    expect(isRunStopPending(undefined)).toBe(false);
    expect(isRunStopPending(makeRun(undefined, true))).toBe(true);
    expect(isRunStopPending(makeRun([cond('Stopping', 'True')]))).toBe(true);
    expect(isRunStopPending(makeRun([cond('Stopping', 'Unknown')], false))).toBe(false);
  });

  it('allows stopping only in active sandbox phases when no stop is pending', () => {
    expect(canStopRun(undefined)).toBe(false);
    expect(canStopRun(makeRun([cond('Analyzed', 'Unknown')]))).toBe(true);
    expect(canStopRun(makeRun([cond('Executed', 'Unknown')]))).toBe(true);
    expect(canStopRun(makeRun([cond('Verified', 'Unknown')]))).toBe(true);
    expect(canStopRun(makeRun([cond('Escalated', 'Unknown')]))).toBe(true);
    expect(canStopRun(makeRun([]))).toBe(false);
    expect(canStopRun(makeRun([cond('Analyzed', 'True')]))).toBe(false);
    expect(canStopRun(makeRun([cond('Analyzed', 'Unknown')], true))).toBe(false);
    expect(canStopRun(makeRun([cond('Analyzed', 'Unknown'), cond('Stopping', 'True')]))).toBe(
      false,
    );
    expect(
      canStopRun(makeRun([cond('EmergencyStopped', 'True'), cond('Analyzed', 'Unknown')])),
    ).toBe(false);
  });
});
