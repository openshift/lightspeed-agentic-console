// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { RunUidProvider } from '../RunUidContext';

vi.unmock('./SandboxLogViewer');

vi.mock('@patternfly/react-log-viewer', () => ({
  LogViewer: ({ data, toolbar }: { data: string; toolbar: ReactNode }) => (
    <>
      {toolbar}
      <div data-testid="log-data">{data}</div>
    </>
  ),
  LogViewerSearch: () => null,
}));

const mockRetainedLogs = vi.fn();
vi.mock('../../../hooks/useRetainedLogs', () => ({
  useRetainedLogs: (...args: unknown[]) => mockRetainedLogs(...args),
}));

const mockPodLogStream = vi.fn();
vi.mock('../../../hooks/useSandboxLogStream', () => ({
  useSandboxLogStream: (...args: unknown[]) => mockPodLogStream(...args),
}));

import { SandboxLogViewer } from './SandboxLogViewer';

const SANDBOX = { namespace: 'openshift-lightspeed', podName: 'sandbox-pod' };

const otelResult = (overrides: Record<string, unknown> = {}) => ({
  available: true,
  error: undefined,
  lines: [] as string[],
  loading: false,
  ...overrides,
});

const podResult = (overrides: Record<string, unknown> = {}) => ({
  error: undefined,
  lines: [] as string[],
  loading: false,
  ...overrides,
});

const renderAndExpand = (props: Record<string, unknown> = {}) => {
  const result = render(
    <RunUidProvider value="uid-123">
      <SandboxLogViewer phase="analysis" sandbox={SANDBOX} title="Analysis" {...props} />
    </RunUidProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /View Analysis logs/ }));
  return result;
};

beforeEach(() => {
  mockRetainedLogs.mockReturnValue(otelResult({ available: false }));
  mockPodLogStream.mockReturnValue(podResult());
});

test('displays OTEL log lines when available', () => {
  mockRetainedLogs.mockReturnValue(
    otelResult({ lines: ['2026-01-01T00:00:01Z [agent.start] Starting analysis'] }),
  );

  renderAndExpand();

  expect(screen.getByTestId('log-data')).toHaveTextContent(
    '2026-01-01T00:00:01Z [agent.start] Starting analysis',
  );
});

test('empty OTEL logs show empty state without falling back to pod logs', () => {
  mockRetainedLogs.mockReturnValue(otelResult());

  renderAndExpand();

  expect(screen.getByText('No logs available.')).toBeInTheDocument();
  expect(mockPodLogStream).toHaveBeenCalledWith(SANDBOX, false, false, undefined, true);
});

test('uses pod logs when OTEL is unavailable', () => {
  mockPodLogStream.mockReturnValue(podResult({ lines: ['pod log line'] }));

  renderAndExpand();

  expect(screen.getByTestId('log-data')).toHaveTextContent('pod log line');
  expect(mockPodLogStream).toHaveBeenCalledWith(SANDBOX, true, false, undefined, true);
});

test('falls back to pod logs when OTEL fetch errors', () => {
  mockRetainedLogs.mockReturnValue(
    otelResult({ error: 'Failed to fetch retained logs (HTTP 500)' }),
  );
  mockPodLogStream.mockReturnValue(podResult({ lines: ['pod fallback line'] }));

  renderAndExpand();

  expect(screen.getByTestId('log-data')).toHaveTextContent('pod fallback line');
});

test('shows Live label when streaming', () => {
  render(
    <RunUidProvider value="uid-123">
      <SandboxLogViewer phase="analysis" sandbox={SANDBOX} streaming title="Analysis" />
    </RunUidProvider>,
  );

  expect(screen.getByText('Live')).toBeInTheDocument();
});

test('does not show Live label when not streaming', () => {
  render(
    <RunUidProvider value="uid-123">
      <SandboxLogViewer phase="analysis" sandbox={SANDBOX} title="Analysis" />
    </RunUidProvider>,
  );

  expect(screen.queryByText('Live')).not.toBeInTheDocument();
});

test('hides health check checkbox when using OTEL', () => {
  mockRetainedLogs.mockReturnValue(otelResult());

  renderAndExpand();

  expect(screen.queryByLabelText('Hide health checks')).not.toBeInTheDocument();
});

test('shows health check checkbox for pod logs', () => {
  renderAndExpand();

  expect(screen.getByLabelText('Hide health checks')).toBeInTheDocument();
});

test('shows loading message while logs are loading', () => {
  mockRetainedLogs.mockReturnValue(otelResult({ loading: true }));

  renderAndExpand();

  expect(screen.getByText('Loading logs...')).toBeInTheDocument();
});

test('shows warning alert and failure message on error', () => {
  mockPodLogStream.mockReturnValue(podResult({ error: 'Connection refused' }));

  renderAndExpand();

  expect(screen.getByText('Connection refused')).toBeInTheDocument();
  expect(screen.getByTestId('log-data')).toHaveTextContent('Failed to load logs.');
});

test('passes phase to useRetainedLogs', () => {
  renderAndExpand({ phase: 'execution' });

  expect(mockRetainedLogs).toHaveBeenCalledWith('uid-123', true, 'execution');
});
