import { describe, expect, it } from 'vitest';

import { deriveFailureReason, derivePhaseFromConditions, isNoActionRequired } from './agenticrun';
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
