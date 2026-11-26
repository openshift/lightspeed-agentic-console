// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { ExecutionView } from '../../../models/agenticrun-views';
import { ExecutionSummary } from './ExecutionSummary';
import { renderWithProviders, screen } from '../../../test-render';

const baseExecution: ExecutionView = {
  actions: [],
  originalRootCause: '',
  outcome: 'Succeeded',
  remediationDelta: '',
};

const render = (execution: Partial<ExecutionView> = {}) =>
  renderWithProviders(<ExecutionSummary execution={{ ...baseExecution, ...execution }} />);

describe('ExecutionSummary', () => {
  test('renders the execution heading', () => {
    render();
    expect(screen.getByText('Execution')).toBeInTheDocument();
  });

  test('renders the execution record details when present', () => {
    render({
      executionRecord: {
        approvedAt: '2026-08-19T10:00:00Z',
        approverUsername: 'alice',
        selectedOption: 'Restart the pod',
      },
    });
    expect(screen.getByText('Selected option')).toBeInTheDocument();
    expect(screen.getByText('Restart the pod')).toBeInTheDocument();
    expect(screen.getByText('Approved by')).toBeInTheDocument();
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText('2026-08-19T10:00:00Z')).toBeInTheDocument();
  });

  test('renders contextual evidence when a root cause is present', () => {
    render({ originalRootCause: 'Memory limit too low', remediationDelta: 'Raised the limit' });
    expect(screen.getByText('Original root cause')).toBeInTheDocument();
    expect(screen.getByText('Memory limit too low')).toBeInTheDocument();
    expect(screen.getByText('Remediation delta')).toBeInTheDocument();
    expect(screen.getByText('Raised the limit')).toBeInTheDocument();
  });

  test('renders actions taken with type, outcome, and output', () => {
    render({
      actions: [
        {
          description: 'Patched the deployment',
          outcome: 'Succeeded',
          output: 'deployment.apps/web patched',
          type: 'patch',
        },
      ],
    });
    expect(screen.getByText('Actions taken')).toBeInTheDocument();
    expect(screen.getByText('patch')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Patched the deployment')).toBeInTheDocument();
    expect(screen.getByText('deployment.apps/web patched')).toBeInTheDocument();
  });

  test('renders an alert for a failed action error', () => {
    render({
      actions: [
        {
          description: 'Attempted patch',
          error: 'permission denied',
          outcome: 'Failed',
          type: 'patch',
        },
      ],
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('permission denied')).toBeInTheDocument();
  });

  test('renders the log viewer when an execution sandbox is present', () => {
    render({ executionSandbox: { namespace: 'ns', podName: 'pod' } });
    expect(screen.getByText('View Execution logs')).toBeInTheDocument();
  });

  test('warns when the execution result may be incomplete', () => {
    render({ mayBeIncomplete: { reason: 'StepLimitReached' } });
    expect(screen.getByText('Execution result may be incomplete')).toBeInTheDocument();
  });

  test('does not warn when the execution result is complete', () => {
    render();
    expect(screen.queryByText('Execution result may be incomplete')).not.toBeInTheDocument();
  });
});
