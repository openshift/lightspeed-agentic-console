// @vitest-environment jsdom
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useStopRunAccess, useStopRunMutation } from '../../hooks/useStopRun';
import type { AgenticRunCondition, AgenticRunK8s } from '../../models/agenticrun';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../test-render';
import RunListPage from './RunListPage';

let visibleNames: string[] | undefined;

const stopAccess = vi.mocked(useStopRunAccess);
const stopMutation = vi.mocked(useStopRunMutation);
const stopRun = vi.fn(
  async (_target: { metadata?: { name?: string; namespace?: string } }) => true,
);
const clearStopError = vi.fn();

vi.mock('@openshift-console/dynamic-plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  k8sDelete: vi.fn(),
  ListPageBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ListPageFilter: () => null,
  ListPageHeader: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
  TableData: ({ id, children }: { id: string; children: ReactNode }) => (
    <td data-test={`cell-${id}`}>{children}</td>
  ),
  useListPageFilter: (runs: AgenticRunK8s[] | undefined) => [
    runs,
    visibleNames ? runs?.filter((run) => visibleNames?.includes(run.metadata.name)) : runs,
    vi.fn(),
  ],
  VirtualizedTable: ({
    columns,
    data,
    Row,
  }: {
    columns: { id: string; title: string }[];
    data: AgenticRunK8s[] | undefined;
    Row: ComponentType<{ obj: AgenticRunK8s; activeColumnIDs: Set<string> }>;
  }) => (
    <table>
      <thead>
        <tr>
          {columns.map(({ id, title }) => (
            <th key={id}>{title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data?.map((obj) => (
          <tr key={obj.metadata.name}>
            <Row activeColumnIDs={new Set(columns.map(({ id }) => id))} obj={obj} />
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('../../hooks/useStopRun', () => ({
  useStopRunAccess: vi.fn(),
  useStopRunMutation: vi.fn(),
}));

vi.mock('../AgenticLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./AgenticCapabilitiesToggle', () => ({ default: () => null }));

const makeRun = (
  name: string,
  targetCluster?: string,
  namespace = 'default',
  conditions?: AgenticRunCondition[],
  cancelled = false,
): AgenticRunK8s => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRun',
  metadata: { name, namespace },
  spec: {
    request: 'Help',
    ...(targetCluster !== undefined ? { targetCluster } : {}),
    ...(cancelled ? { cancelled: true } : {}),
  },
  ...(conditions ? { status: { conditions } } : {}),
});

const watch = vi.mocked(useK8sWatchResource);

const renderRuns = (runs: AgenticRunK8s[]) => {
  watch.mockReturnValue([runs, true, undefined]);
  return renderWithProviders(<RunListPage />);
};

beforeEach(() => {
  stopRun.mockReset().mockResolvedValue(true);
  clearStopError.mockClear();
  stopAccess.mockReturnValue([true, false]);
  stopMutation.mockReturnValue({
    clearStopError,
    stopError: undefined,
    stopInProgress: false,
    stopRun,
  });
});

afterEach(() => {
  visibleNames = undefined;
  vi.clearAllMocks();
});

describe('RunListPage columns', () => {
  test.each([undefined, 'remote-cluster'])(
    'renders the supported columns (%s)',
    (targetCluster) => {
      renderRuns([makeRun('first', targetCluster)]);

      const expectedColumns = [
        'Name',
        ...(targetCluster ? ['Target cluster'] : []),
        'Trigger domain',
        'Status',
        'Tokens (in / out)',
        'Created',
        '',
      ];
      expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(
        expectedColumns,
      );
      expect(screen.getAllByRole('cell')).toHaveLength(expectedColumns.length);
    },
  );
});

describe('RunListPage target cluster column', () => {
  test('is hidden when no run has the field', () => {
    renderRuns([makeRun('first'), makeRun('second')]);

    expect(screen.queryByRole('columnheader', { name: 'Target cluster' })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('cell-target-cluster')).toHaveLength(0);
  });

  test('shows the value and a dash for missing or blank values', () => {
    renderRuns([
      makeRun('present', 'remote-cluster'),
      makeRun('missing'),
      makeRun('blank', ''),
      makeRun('whitespace', '   '),
    ]);

    expect(screen.getByRole('columnheader', { name: 'Target cluster' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByTestId('cell-target-cluster')).toHaveTextContent('remote-cluster');
    rows.slice(1).forEach((row) => {
      expect(within(row).getByTestId('cell-target-cluster')).toHaveTextContent(/^-$/);
    });
  });

  test('updates the column when watched runs change', () => {
    const { rerender } = renderRuns([makeRun('first')]);
    expect(screen.queryByRole('columnheader', { name: 'Target cluster' })).not.toBeInTheDocument();

    watch.mockReturnValue([[makeRun('first', 'remote-cluster')], true, undefined]);
    rerender(<RunListPage />);
    expect(screen.getByRole('columnheader', { name: 'Target cluster' })).toBeInTheDocument();
    expect(screen.getByTestId('cell-target-cluster')).toHaveTextContent('remote-cluster');

    watch.mockReturnValue([[makeRun('first', '   ')], true, undefined]);
    rerender(<RunListPage />);
    expect(screen.queryByRole('columnheader', { name: 'Target cluster' })).not.toBeInTheDocument();
  });

  test('hides the column when all values are empty or whitespace', () => {
    renderRuns([makeRun('blank', ''), makeRun('whitespace', '   '), makeRun('missing')]);

    expect(screen.queryByRole('columnheader', { name: 'Target cluster' })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('cell-target-cluster')).toHaveLength(0);
  });

  test('keeps the column when the run with the field is filtered out', () => {
    visibleNames = ['missing'];
    renderRuns([makeRun('present', 'remote-cluster'), makeRun('missing')]);

    expect(screen.getByRole('columnheader', { name: 'Target cluster' })).toBeInTheDocument();
    expect(screen.getByTestId('cell-target-cluster')).toHaveTextContent('-');
    expect(screen.queryByText('remote-cluster')).not.toBeInTheDocument();
  });
});

describe('RunListPage stop action', () => {
  const activeRun = (name: string, namespace: string) =>
    makeRun(name, undefined, namespace, [{ type: 'Analyzed', status: 'Unknown' }]);
  // PatternFly renders the menu through a popper, so it is queried outside the row.
  const openRowActions = async (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
    await screen.findByRole('menu');
  };
  const clickStopItem = async (name: string) => {
    await openRowActions(name);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop' }));
  };

  test('offers Stop above Delete in the kebab for an active run', async () => {
    renderRuns([activeRun('active', 'team-a')]);

    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();

    await openRowActions('active');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Stop',
      'Delete',
    ]);
    expect(stopAccess).toHaveBeenCalledWith('team-a');
    expect(stopMutation).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'stopping',
      [
        { type: 'Analyzed', status: 'Unknown' },
        { type: 'Stopping', status: 'True' },
      ],
      false,
    ],
    ['requested', [{ type: 'Analyzed', status: 'Unknown' }], true],
    ['failed', [{ type: 'Analyzed', status: 'False', reason: 'CancelledByUser' }], true],
    ['pending', undefined, false],
  ] as [string, AgenticRunCondition[] | undefined, boolean][])(
    'omits Stop from the kebab for the %s run',
    async (name, conditions, cancelled) => {
      renderRuns([makeRun(name, undefined, 'team-a', conditions, cancelled)]);

      await openRowActions(name);
      expect(screen.queryByRole('menuitem', { name: 'Stop' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    },
  );

  test('shows Stopping in the row while cleanup is pending', () => {
    renderRuns([
      makeRun('stopping', undefined, 'team-b', [
        { type: 'Analyzed', status: 'Unknown' },
        { type: 'Stopping', status: 'True' },
      ]),
      makeRun('requested', undefined, 'team-c', [{ type: 'Analyzed', status: 'Unknown' }], true),
    ]);

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Stopping')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Analyzing')).toBeInTheDocument();
  });

  test('shows Stopped by user only for the effective Failed cancellation outcome', () => {
    renderRuns([
      makeRun(
        'cancelled',
        undefined,
        'team-a',
        [
          { type: 'Executed', status: 'False', reason: 'CancelledByUser' },
          { type: 'Analyzed', status: 'False', reason: 'PreviousFailure' },
        ],
        true,
      ),
      makeRun(
        'stale-cancellation',
        undefined,
        'team-b',
        [
          { type: 'Executed', status: 'False', reason: 'ExecutionFailed' },
          { type: 'Analyzed', status: 'False', reason: 'CancelledByUser' },
        ],
        true,
      ),
      makeRun(
        'emergency-stop',
        undefined,
        'team-c',
        [
          { type: 'EmergencyStopped', status: 'True' },
          { type: 'Executed', status: 'False', reason: 'CancelledByUser' },
        ],
        true,
      ),
      makeRun(
        'stopping',
        undefined,
        'team-d',
        [
          { type: 'Executed', status: 'False', reason: 'CancelledByUser' },
          { type: 'Stopping', status: 'True' },
        ],
        true,
      ),
    ]);

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Failed')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Stopped by user')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Failed')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Stopped by user')).not.toBeInTheDocument();
    expect(within(rows[2]).getByText('Emergency stopped')).toBeInTheDocument();
    expect(within(rows[2]).queryByText('Stopped by user')).not.toBeInTheDocument();
    expect(within(rows[3]).getByText('Stopping')).toBeInTheDocument();
    expect(within(rows[3]).queryByText('Stopped by user')).not.toBeInTheDocument();
  });

  test('shows Stop failed for an effective CancellationFailed outcome', () => {
    renderRuns([
      makeRun(
        'cancellation-failed',
        undefined,
        'team-a',
        [
          { type: 'Executed', status: 'False', reason: 'CancellationFailed' },
          { type: 'Stopping', status: 'False', reason: 'TeardownFailed' },
        ],
        true,
      ),
    ]);

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Failed')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Stop failed')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('Stopped by user')).not.toBeInTheDocument();
    expect(within(rows[0]).queryByText('Stopping')).not.toBeInTheDocument();
  });

  test('disables the Stop item when the user lacks namespaced patch access', async () => {
    stopAccess.mockReturnValue([false, false]);
    renderRuns([activeRun('denied', 'team-a')]);

    await openRowActions('denied');
    const stopItem = screen.getByRole('menuitem', { name: 'Stop' });
    expect(stopItem).toHaveAttribute('aria-disabled', 'true');
    expect(stopAccess).toHaveBeenCalledWith('team-a');
    fireEvent.mouseEnter(stopItem);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "You don't have permission to stop runs.",
    );
    fireEvent.click(stopItem);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stopRun).not.toHaveBeenCalled();
  });

  test('disables the Stop item without a denial tooltip while access is loading', async () => {
    stopAccess.mockReturnValue([true, true]);
    renderRuns([activeRun('loading', 'team-a')]);

    await openRowActions('loading');
    const stopItem = screen.getByRole('menuitem', { name: 'Stop' });
    expect(stopItem).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(stopItem);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stopRun).not.toHaveBeenCalled();
  });

  test('submits against the latest watched run and closes after success', async () => {
    const initialRun = activeRun('run-1', 'team-a');
    const { rerender } = renderRuns([initialRun]);

    await clickStopItem('run-1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const latestRun = makeRun('run-1', undefined, 'team-a', [
      { type: 'Executed', status: 'Unknown' },
    ]);
    watch.mockReturnValue([[latestRun], true, undefined]);
    rerender(<RunListPage />);

    expect(screen.getByText(/Partial cluster changes may already exist/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    await waitFor(() => expect(stopRun).toHaveBeenCalledWith(latestRun));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Executing')).toBeInTheDocument();
  });

  test('closes a confirmation when the watched run becomes non-stoppable', async () => {
    const active = activeRun('run-1', 'team-a');
    const { rerender } = renderRuns([active]);

    await clickStopItem('run-1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const stopping = makeRun('run-1', undefined, 'team-a', [
      { type: 'Analyzed', status: 'Unknown' },
      { type: 'Stopping', status: 'True' },
    ]);
    watch.mockReturnValue([[stopping], true, undefined]);
    rerender(<RunListPage />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(stopRun).not.toHaveBeenCalled();
  });
  test('closes confirmation when the watched run is replaced', async () => {
    const original = activeRun('run-1', 'team-a');
    original.metadata.uid = 'original-uid';
    const { rerender } = renderRuns([original]);

    await clickStopItem('run-1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const replacement = activeRun('run-1', 'team-a');
    replacement.metadata.uid = 'replacement-uid';
    watch.mockReturnValue([[replacement], true, undefined]);
    rerender(<RunListPage />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(stopRun).not.toHaveBeenCalled();
  });
});
