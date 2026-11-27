// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { VerificationCheckView, VerificationView } from '../../../models/agenticrun-views';
import { VerificationSummary } from './VerificationSummary';
import { renderWithProviders, screen } from '../../../test-render';

const check = (overrides: Partial<VerificationCheckView> = {}): VerificationCheckView => ({
  name: 'Pod ready',
  result: 'Passed',
  source: 'kubectl',
  value: 'All replicas ready',
  ...overrides,
});

const render = (verification: Partial<VerificationView> = {}) =>
  renderWithProviders(<VerificationSummary verification={{ checks: [], ...verification }} />);

describe('VerificationSummary', () => {
  test('renders the heading and summary text', () => {
    render({ summary: 'Everything checks out' });
    expect(screen.getByText('Verification summary')).toBeInTheDocument();
    expect(screen.getByText('Everything checks out')).toBeInTheDocument();
  });

  test('renders verification checks with name, result, and source', () => {
    render({ checks: [check()] });
    expect(screen.getByText('Verification checks')).toBeInTheDocument();
    expect(screen.getByText('Pod ready')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('kubectl')).toBeInTheDocument();
    expect(screen.getByText('All replicas ready')).toBeInTheDocument();
  });

  test('flags a failed status when any check fails', () => {
    render({ checks: [check(), check({ name: 'Endpoint reachable', result: 'Failed' })] });
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
  });

  test('flags a passed status when all checks pass', () => {
    render({ checks: [check()] });
    expect(screen.getByLabelText('Passed')).toBeInTheDocument();
  });

  test('shows an in-progress status when there are no checks', () => {
    render();
    expect(screen.getByLabelText('In progress')).toBeInTheDocument();
  });

  test('renders a warning label for a check that is neither passed nor failed', () => {
    render({ checks: [check({ name: 'Metrics settling', result: 'Pending' })] });
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByLabelText('In progress')).toBeInTheDocument();
  });

  test('renders the failure reason when present', () => {
    render({ failureReason: 'Endpoint never came up' });
    expect(screen.getByText('Failure reason')).toBeInTheDocument();
    expect(screen.getByText('Endpoint never came up')).toBeInTheDocument();
  });

  test('renders the log viewer when a verification sandbox is present', () => {
    render({ verificationSandbox: { namespace: 'ns', podName: 'pod' } });
    expect(screen.getByText('View Verification logs')).toBeInTheDocument();
  });

  test('warns when the verification result may be incomplete', () => {
    render({ mayBeIncomplete: { reason: 'StepLimitReached' }, summary: 'Everything checks out' });
    expect(screen.getByText('Verification result may be incomplete')).toBeInTheDocument();
  });

  test('does not warn when the verification result is complete', () => {
    render({ summary: 'Everything checks out' });
    expect(screen.queryByText('Verification result may be incomplete')).not.toBeInTheDocument();
  });
});
