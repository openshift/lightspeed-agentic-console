// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAgenticRun } from '../../hooks/useAgenticRun';
import type { AgenticRunCondition, AgenticRunK8s } from '../../models/agenticrun';
import type { AgenticRunView, RemediationOptionView } from '../../models/agenticrun-views';
import RunDetailPage from './RunDetailPage';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../test-render';

vi.mock('../../hooks/useAgenticRun', () => ({
  useAgenticRun: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => ({ name: 'run-1', ns: 'openshift-lightspeed' }) };
});

const hook = vi.mocked(useAgenticRun);

const makeView = (overrides: Partial<AgenticRunView>): AgenticRunView => ({
  options: [],
  phase: 'Failed',
  request: 'Fix the failing alert',
  timeline: [],
  ...overrides,
});

const makeOption = (overrides?: Partial<RemediationOptionView>): RemediationOptionView => ({
  cause: 'Memory limit too low',
  description: 'Increase the memory limit',
  detail: 'Pod was OOMKilled',
  index: 0,
  title: 'Restart the pod',
  ...overrides,
});

interface StopHookOverrides {
  run?: AgenticRunK8s;
  canStop?: boolean;
  canStopLoading?: boolean;
  stopInProgress?: boolean;
  stopError?: string;
}

const stopRun = vi.fn(async () => true);
const clearStopError = vi.fn();

const makeRun = (
  conditions: AgenticRunCondition[] = [{ type: 'Analyzed', status: 'Unknown' }],
  cancelled = false,
): AgenticRunK8s => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRun',
  metadata: { name: 'run-1', namespace: 'openshift-lightspeed' },
  spec: { request: 'Fix the failing alert', ...(cancelled ? { cancelled: true } : {}) },
  status: { conditions },
});

const mockHook = (view: AgenticRunView, overrides: StopHookOverrides = {}) => {
  hook.mockReturnValue({
    approveExecution: vi.fn(),
    approveStage: vi.fn(),
    canApprove: true,
    canApproveLoading: false,
    canStop: overrides.canStop ?? true,
    canStopLoading: overrides.canStopLoading ?? false,
    clearMutationError: vi.fn(),
    clearStopError,
    denyStage: vi.fn(),
    mutationError: undefined,
    mutationInProgress: false,
    needsApproval: { Analysis: false, Escalation: false, Verification: false },
    resultsError: undefined,
    resultsLoaded: true,
    run: overrides.run ?? makeRun(),
    runError: undefined,
    runLoaded: true,
    stopError: overrides.stopError,
    stopInProgress: overrides.stopInProgress ?? false,
    stopRun,
    view,
  } as never);
};

beforeEach(() => {
  stopRun.mockReset().mockResolvedValue(true);
  clearStopError.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RunDetailPage target cluster badge', () => {
  test('renders between Tech preview and the trigger domain', () => {
    mockHook(makeView({ source: 'alerts', targetCluster: 'remote-cluster' }));
    renderWithProviders(<RunDetailPage />);

    const badge = screen.getByTestId('target-cluster-badge');
    expect(badge).toHaveTextContent('Target cluster: remote-cluster');
    expect(
      screen.getByText('Tech preview').compareDocumentPosition(badge) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      badge.compareDocumentPosition(screen.getByText('Trigger domain: alerts')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('trims whitespace from the target cluster value', () => {
    mockHook(makeView({ targetCluster: '  remote-cluster  ' }));
    renderWithProviders(<RunDetailPage />);

    expect(screen.getByTestId('target-cluster-badge').textContent).toBe(
      'Target cluster: remote-cluster',
    );
  });

  test.each([undefined, '', '   '])(
    'is hidden for a missing or blank value (%j)',
    (targetCluster) => {
      mockHook(makeView({ targetCluster }));
      renderWithProviders(<RunDetailPage />);

      expect(screen.queryByTestId('target-cluster-badge')).not.toBeInTheDocument();
      expect(screen.getByText('Tech preview')).toBeInTheDocument();
    },
  );

  test('updates when the watched run changes', () => {
    mockHook(makeView({}));
    const { rerender } = renderWithProviders(<RunDetailPage />);
    expect(screen.queryByTestId('target-cluster-badge')).not.toBeInTheDocument();

    mockHook(makeView({ targetCluster: 'remote-cluster' }));
    rerender(<RunDetailPage />);
    expect(screen.getByTestId('target-cluster-badge')).toHaveTextContent('remote-cluster');

    mockHook(makeView({ targetCluster: '   ' }));
    rerender(<RunDetailPage />);
    expect(screen.queryByTestId('target-cluster-badge')).not.toBeInTheDocument();
  });
});

describe('RunDetailPage remediation plans failure rendering', () => {
  test('renders the failure card when a Failed run has no remediation options', () => {
    mockHook(makeView({ failureReason: 'Analysis pod exceeded memory limit', options: [] }));
    renderWithProviders(<RunDetailPage />);

    expect(screen.getByText('Remediation plans')).toBeInTheDocument();
    expect(screen.getByText('Analysis pod exceeded memory limit')).toBeInTheDocument();
    expect(screen.queryByText('Restart the pod')).not.toBeInTheDocument();
  });

  test('renders the terminal summary when a Failed run has remediation options', () => {
    mockHook(
      makeView({
        execution: {
          actions: [],
          originalRootCause: 'Memory limit too low',
          outcome: 'Failed',
          remediationDelta: '',
        },
        failureReason: 'Insufficient permissions to patch CoreDNS ConfigMap',
        options: [makeOption()],
      }),
    );
    renderWithProviders(<RunDetailPage />);

    expect(screen.getByText('Restart the pod')).toBeInTheDocument();
    expect(screen.getByText('Execution')).toBeInTheDocument();
  });
});

describe('RunDetailPage proposed-state action toolbar', () => {
  const proposedView = () =>
    makeView({
      options: [makeOption(), makeOption({ index: 1, title: 'Snapshot PVC' })],
      phase: 'Proposed',
    });

  test('renders execute, deny, and download actions', () => {
    mockHook(proposedView());
    renderWithProviders(<RunDetailPage />);

    expect(screen.getByText('Execute remediation')).toBeInTheDocument();
    expect(screen.getByText('Deny run')).toBeInTheDocument();
    expect(screen.getByText('Download plan')).toBeInTheDocument();
  });

  test('disables execute and download until a plan is selected', () => {
    mockHook(proposedView());
    renderWithProviders(<RunDetailPage />);

    const execute = screen.getByText('Execute remediation').closest('button') as HTMLButtonElement;
    const download = screen.getByText('Download plan').closest('button') as HTMLButtonElement;
    expect(execute).toHaveAttribute('aria-disabled', 'true');
    expect(download).toHaveAttribute('aria-disabled', 'true');
  });

  test('enables execution and opens the confirmation modal once a plan is selected', () => {
    mockHook(proposedView());
    renderWithProviders(<RunDetailPage />);

    fireEvent.click(screen.getByRole('radio', { name: 'Select plan 1' }));
    fireEvent.click(screen.getByText('Execute remediation').closest('button') as HTMLButtonElement);

    expect(screen.getByText('Execute remediation?')).toBeInTheDocument();
  });

  test('does not render the toolbar for advisory runs', () => {
    mockHook(makeView({ advisory: true, options: [makeOption()], phase: 'Proposed' }));
    renderWithProviders(<RunDetailPage />);

    expect(screen.queryByText('Execute remediation')).not.toBeInTheDocument();
  });
});

describe('RunDetailPage stop action', () => {
  test.each([
    { canStop: false, canStopLoading: false },
    { canStop: true, canStopLoading: true },
  ])('does not open confirmation when stop access is unavailable (%o)', (access) => {
    mockHook(makeView({ phase: 'Analyzing' }), access);
    renderWithProviders(<RunDetailPage />);

    const button = screen.getByTestId('stop-run-button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stopRun).not.toHaveBeenCalled();
  });

  test('does not render Stop outside active sandbox phases', () => {
    mockHook(makeView({ phase: 'Pending' }));
    renderWithProviders(<RunDetailPage />);

    expect(screen.queryByTestId('stop-run-button')).not.toBeInTheDocument();
  });

  test('closes confirmation when the watched resource identity changes', async () => {
    const original = makeRun();
    original.metadata.uid = 'original-uid';
    mockHook(makeView({ phase: 'Analyzing' }), { run: original });
    const { rerender } = renderWithProviders(<RunDetailPage />);

    fireEvent.click(screen.getByTestId('stop-run-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const replacement = makeRun();
    replacement.metadata.uid = 'replacement-uid';
    mockHook(makeView({ phase: 'Analyzing' }), { run: replacement });
    rerender(<RunDetailPage />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(stopRun).not.toHaveBeenCalled();
  });

  test('warns about partial changes for Executing and closes after success', async () => {
    mockHook(makeView({ phase: 'Executing' }));
    renderWithProviders(<RunDetailPage />);

    fireEvent.click(screen.getByTestId('stop-run-button'));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Stopping this run cannot be undone. Partial cluster changes may already exist, so inspect the cluster manually after it stops.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop run' }));
    await waitFor(() => expect(stopRun).toHaveBeenCalledWith());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Executing')).toBeInTheDocument();
  });

  test('shows mutation errors inline and clears them when the modal is reopened', async () => {
    const view = makeView({ phase: 'Analyzing' });
    mockHook(view);
    stopRun.mockResolvedValueOnce(false);
    const { rerender } = renderWithProviders(<RunDetailPage />);

    fireEvent.click(screen.getByTestId('stop-run-button'));
    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop run' }));
    await waitFor(() => expect(stopRun).toHaveBeenCalled());

    mockHook(view, { stopError: 'Patch failed' });
    rerender(<RunDetailPage />);
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Patch failed')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(clearStopError).toHaveBeenCalled();

    mockHook(view);
    rerender(<RunDetailPage />);
    fireEvent.click(screen.getByTestId('stop-run-button'));
    expect(screen.queryByText('Patch failed')).not.toBeInTheDocument();
  });

  test('follows watched stopping and final cancellation outcome', async () => {
    const sandbox = { namespace: 'openshift-lightspeed', podName: 'sandbox-pod' };
    const activeView = makeView({ phase: 'Executing', executionSandbox: sandbox });
    mockHook(activeView, {
      run: makeRun([{ type: 'Executed', status: 'Unknown' }]),
    });
    const { rerender } = renderWithProviders(<RunDetailPage />);

    fireEvent.click(screen.getByTestId('stop-run-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const stoppingView = makeView({
      analysisSandbox: sandbox,
      failureReason: 'This failure is not final while teardown is pending',
      options: [makeOption()],
      phase: 'Failed',
      sandboxShutdownPending: true,
      stopPending: true,
      stopping: true,
    });
    mockHook(stoppingView, {
      run: makeRun(
        [
          { type: 'Analyzed', status: 'False', reason: 'OtherFailure' },
          { type: 'Stopping', status: 'True' },
        ],
        true,
      ),
    });
    rerender(<RunDetailPage />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Stopping')).toBeInTheDocument();
    expect(screen.getByText('Sandbox shutdown in progress')).toBeInTheDocument();
    expect(
      screen.queryByText('This failure is not final while teardown is pending'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Restart the pod')).not.toBeInTheDocument();

    const finalView = makeView({
      analysisSandbox: sandbox,
      failureReason: 'Stopped by user',
      phase: 'Failed',
      sandboxShutdownPending: true,
      stopPending: true,
    });
    mockHook(finalView, {
      run: makeRun([{ type: 'Analyzed', status: 'False', reason: 'CancelledByUser' }], true),
    });
    rerender(<RunDetailPage />);

    expect(screen.getByText('Stopped by user')).toBeInTheDocument();
    expect(screen.getByText('Sandbox shutdown in progress')).toBeInTheDocument();
    expect(screen.queryByText('Stopping')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stop-run-button')).not.toBeInTheDocument();
  });

  test('never displays Stopped by user for an EmergencyStopped outcome', () => {
    const sandbox = { namespace: 'openshift-lightspeed', podName: 'sandbox-pod' };
    mockHook(
      makeView({
        analysisSandbox: sandbox,
        phase: 'EmergencyStopped',
        sandboxShutdownPending: true,
        stopPending: true,
      }),
      {
        run: makeRun(
          [
            { type: 'EmergencyStopped', status: 'True' },
            { type: 'Analyzed', status: 'False', reason: 'CancelledByUser' },
          ],
          true,
        ),
      },
    );
    renderWithProviders(<RunDetailPage />);

    expect(screen.getByText('Emergency stopped')).toBeInTheDocument();
    expect(screen.queryByText('Stopped by user')).not.toBeInTheDocument();
    expect(screen.getByText('Sandbox shutdown in progress')).toBeInTheDocument();
  });

  test('does not show the shutdown alert without a retained sandbox', () => {
    mockHook(makeView({ phase: 'Analyzing', stopPending: true }), {
      run: makeRun([{ type: 'Analyzed', status: 'Unknown' }], true),
    });
    renderWithProviders(<RunDetailPage />);

    expect(screen.queryByText('Sandbox shutdown in progress')).not.toBeInTheDocument();
  });
});
