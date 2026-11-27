// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useAgenticRun } from '../../hooks/useAgenticRun';
import type { AgenticRunView, RemediationOptionView } from '../../models/agenticrun-views';
import RunDetailPage from './RunDetailPage';
import { fireEvent, renderWithProviders, screen } from '../../test-render';

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

const mockHook = (view: AgenticRunView) => {
  hook.mockReturnValue({
    approveExecution: vi.fn(),
    approveStage: vi.fn(),
    canApprove: true,
    canApproveLoading: false,
    clearMutationError: vi.fn(),
    denyStage: vi.fn(),
    mutationError: undefined,
    mutationInProgress: false,
    needsApproval: { Analysis: false, Escalation: false, Verification: false },
    resultsError: undefined,
    resultsLoaded: true,
    run: { metadata: { name: 'run-1', namespace: 'openshift-lightspeed' } },
    runError: undefined,
    runLoaded: true,
    view,
  } as unknown as ReturnType<typeof useAgenticRun>);
};

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

describe('RunDetailPage incomplete analysis warning', () => {
  test('renders above the remediation plans', () => {
    mockHook(
      makeView({
        analysisMayBeIncomplete: { reason: 'StepLimitReached' },
        options: [makeOption()],
        phase: 'Proposed',
      }),
    );
    renderWithProviders(<RunDetailPage />);

    const alert = screen.getByText('Analysis result may be incomplete');
    expect(
      alert.compareDocumentPosition(screen.getByText('Remediation plans')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('is not rendered when the analysis result is complete', () => {
    mockHook(makeView({ options: [makeOption()], phase: 'Proposed' }));
    renderWithProviders(<RunDetailPage />);

    expect(screen.queryByText('Analysis result may be incomplete')).not.toBeInTheDocument();
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
