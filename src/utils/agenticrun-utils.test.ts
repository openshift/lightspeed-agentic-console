import { describe, expect, it } from 'vitest';

import type { AgenticRunPhase } from '../models/agenticrun';
import { getPhaseLabel, TFunction } from './agenticrun-utils';

const t = ((key: string) => key) as unknown as TFunction;

describe('getPhaseLabel', () => {
  it.each<[AgenticRunPhase, string]>([
    ['Analyzing', 'Analyzing'],
    ['Completed', 'Completed'],
    ['Denied', 'Denied'],
    ['EmergencyStopped', 'Emergency stopped'],
    ['Escalated', 'Escalated'],
    ['Escalating', 'Escalating'],
    ['Executing', 'Executing'],
    ['Failed', 'Failed'],
    ['Pending', 'Pending'],
    ['Proposed', 'Proposed'],
    ['Verifying', 'Verifying'],
  ])('returns correct label for %s', (phase, expected) => {
    expect(getPhaseLabel(phase, t)).toBe(expected);
  });

  it('returns the phase itself for unknown phases', () => {
    expect(getPhaseLabel('SomeUnknownPhase' as AgenticRunPhase, t)).toBe('SomeUnknownPhase');
  });
});
