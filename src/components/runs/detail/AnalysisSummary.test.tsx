// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { RootCauseView } from '../../../models/agenticrun-views';
import { AnalysisSummary } from './AnalysisSummary';
import { renderWithProviders, screen } from '../../../test-render';

type Props = Parameters<typeof AnalysisSummary>[0];

const rootCause: RootCauseView = { cause: 'Memory limit too low', detail: 'Pod was OOMKilled' };

const render = (props: Partial<Props> = {}) =>
  renderWithProviders(
    <AnalysisSummary hasRemediationOptions={false} phase="Completed" {...props} />,
  );

describe('AnalysisSummary', () => {
  test('shows the approval banner when pending approval', () => {
    render({
      analysisRequest: 'Investigate the pod',
      needsApproval: true,
      onApproveAnalysis: vi.fn(),
      phase: 'Pending',
    });
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
    expect(screen.getByText('Investigate the pod')).toBeInTheDocument();
  });

  test('shows a waiting skeleton when pending without approval', () => {
    render({ phase: 'Pending' });
    expect(screen.getAllByText('Waiting for analysis to start...').length).toBeGreaterThan(0);
    expect(screen.queryByText('Waiting for approval')).not.toBeInTheDocument();
  });

  test('shows the analyzing state with the request and log viewer', () => {
    render({
      analysisRequest: 'Investigate the pod',
      analysisSandbox: { namespace: 'ns', podName: 'pod' },
      phase: 'Analyzing',
    });
    expect(screen.getByText('Investigate the pod')).toBeInTheDocument();
    expect(screen.getAllByText('Analyzing ...').length).toBeGreaterThan(0);
    expect(screen.getByText('View Analysis logs')).toBeInTheDocument();
  });

  test('renders the request and root cause when analysis is complete', () => {
    render({ analysisRequest: 'Investigate the pod', rootCause });
    expect(screen.getByText('Investigate the pod')).toBeInTheDocument();
    expect(screen.getByText('Root cause analysis')).toBeInTheDocument();
    expect(screen.getByText('Memory limit too low')).toBeInTheDocument();
    expect(screen.getByText('Pod was OOMKilled')).toBeInTheDocument();
  });

  test('hides the root cause when remediation options exist', () => {
    render({ analysisRequest: 'Investigate the pod', hasRemediationOptions: true, rootCause });
    expect(screen.queryByText('Root cause analysis')).not.toBeInTheDocument();
  });

  test('shows a not-completed empty state for terminal phases with no request', () => {
    render({ phase: 'Failed' });
    expect(screen.getByText('Analysis was not completed.')).toBeInTheDocument();
  });

  test('renders nothing for a non-terminal phase with no request', () => {
    const { container } = render({ phase: 'Executing' });
    expect(container).toBeEmptyDOMElement();
  });

  test('warns about an incomplete analysis above the root cause', () => {
    render({
      analysisRequest: 'Investigate the pod',
      mayBeIncomplete: { reason: 'StepLimitReached' },
      rootCause,
    });
    expect(
      screen
        .getByText('Analysis result may be incomplete')
        .compareDocumentPosition(screen.getByText('Root cause analysis')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('does not warn when the analysis result is complete', () => {
    render({ analysisRequest: 'Investigate the pod', rootCause });
    expect(screen.queryByText('Analysis result may be incomplete')).not.toBeInTheDocument();
  });
});
