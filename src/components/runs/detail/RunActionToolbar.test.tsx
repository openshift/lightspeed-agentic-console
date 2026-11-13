// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

import type { AgenticRunView } from '../../../models/agenticrun-views';
import { fireEvent, renderWithProviders, screen } from '../../../test-render';
import { RunActionToolbar, type RunActionToolbarProps } from './RunActionToolbar';

const DISCLAIMER = /The autonomous features of OpenShift Lightspeed use AI technology/;

const makeView = (overrides: Partial<AgenticRunView> = {}): AgenticRunView => ({
  options: [],
  phase: 'Analyzing',
  request: 'Fix the failing alert',
  timeline: [],
  ...overrides,
});

const noApproval = { Analysis: false, Escalation: false, Execution: false, Verification: false };

const renderToolbar = (overrides: Partial<RunActionToolbarProps> = {}) => {
  const props: RunActionToolbarProps = {
    canApprove: true,
    canApproveLoading: false,
    canStop: true,
    canStopLoading: false,
    isStoppable: true,
    mutationInProgress: false,
    needsApproval: noApproval,
    onDeny: vi.fn(),
    onDownload: vi.fn(),
    onExecute: vi.fn(),
    onStop: vi.fn(),
    resultsLoaded: true,
    selectedOption: -1,
    view: makeView(),
    ...overrides,
  };
  renderWithProviders(<RunActionToolbar {...props} />);
  return props;
};

describe('RunActionToolbar', () => {
  test('shows only Stop run while the run is stoppable', () => {
    const props = renderToolbar();

    const toolbar = screen.getByTestId('run-action-toolbar');
    expect(toolbar).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Execute remediation')).not.toBeInTheDocument();
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  test('disables Stop run when access is denied', () => {
    const props = renderToolbar({ canStop: false });

    const button = screen.getByRole('button', { name: 'Stop run' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(props.onStop).not.toHaveBeenCalled();
  });

  test.each(['Analysis', 'Verification', 'Escalation'] as const)(
    'renders nothing while %s approval is pending',
    (stage) => {
      renderToolbar({
        needsApproval: { ...noApproval, [stage]: true },
        view: makeView({ phase: 'Verifying' }),
      });

      expect(screen.queryByTestId('run-action-toolbar')).not.toBeInTheDocument();
    },
  );

  test('renders nothing when the run is not stoppable outside Proposed', () => {
    renderToolbar({ isStoppable: false, view: makeView({ phase: 'Completed' }) });

    expect(screen.queryByTestId('run-action-toolbar')).not.toBeInTheDocument();
  });

  test('shows triage actions and the disclaimer in Proposed, without Stop', () => {
    renderToolbar({ isStoppable: false, view: makeView({ phase: 'Proposed' }) });

    expect(screen.getByText('Execute remediation')).toBeInTheDocument();
    expect(screen.getByText('Deny run')).toBeInTheDocument();
    expect(screen.getByText('Download plan')).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop run' })).not.toBeInTheDocument();
  });

  test('never shows Stop together with the Proposed actions', () => {
    renderToolbar({ isStoppable: true, view: makeView({ phase: 'Proposed' }) });

    expect(screen.getByText('Execute remediation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop run' })).not.toBeInTheDocument();
  });

  test('shows only Download plan for advisory Proposed runs', () => {
    renderToolbar({ isStoppable: false, view: makeView({ advisory: true, phase: 'Proposed' }) });

    expect(screen.getByText('Download plan')).toBeInTheDocument();
    expect(screen.queryByText('Execute remediation')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny run')).not.toBeInTheDocument();
  });

  test('renders nothing in Proposed until results load', () => {
    renderToolbar({
      isStoppable: false,
      resultsLoaded: false,
      view: makeView({ phase: 'Proposed' }),
    });

    expect(screen.queryByTestId('run-action-toolbar')).not.toBeInTheDocument();
  });
});
