// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const ADMIN_ENDPOINT = 'https://lightspeed-otel-collector.openshift-lightspeed.svc:8080';

const makeJsonResponse = (data: unknown) => ({
  json: () => Promise.resolve(data),
  ok: true,
  status: 200,
});

const makeRecord = (id: number, event: string, msg: string) => ({
  body: { msg },
  event,
  id,
  phase: 'analysis',
  timestamp: `2026-01-01T00:00:0${id}Z`,
});

// Each describe block re-imports the module to get a fresh module-level cache
// (cachedAvailability/fetchInFlight). The SDK alias in vitest.config.ts creates
// a fresh consoleFetch vi.fn() per import, so we acquire it from the re-imported
// SDK mock alongside the module under test.
const freshImport = async () => {
  vi.resetModules();
  const sdk = await import('@openshift-console/dynamic-plugin-sdk');
  const mod = await import('./useRetainedLogs');
  const mockFetch = sdk.consoleFetch as ReturnType<typeof vi.fn>;
  return { mockFetch, ...mod };
};

describe('buildServiceProxyBase', () => {
  let buildServiceProxyBase: Awaited<ReturnType<typeof freshImport>>['buildServiceProxyBase'];

  beforeEach(async () => {
    const mod = await freshImport();
    buildServiceProxyBase = mod.buildServiceProxyBase;
  });

  test('parses standard admin endpoint URL', () => {
    const result = buildServiceProxyBase(ADMIN_ENDPOINT);
    expect(result).toBe(
      '/api/kubernetes/api/v1/namespaces/openshift-lightspeed' +
        '/services/https:lightspeed-otel-collector:8080/proxy',
    );
  });

  test('defaults port to 8080 when not specified', () => {
    const result = buildServiceProxyBase(
      'https://lightspeed-otel-collector.openshift-lightspeed.svc',
    );
    expect(result).toBe(
      '/api/kubernetes/api/v1/namespaces/openshift-lightspeed' +
        '/services/https:lightspeed-otel-collector:8080/proxy',
    );
  });

  test('returns undefined for hostname without namespace', () => {
    expect(buildServiceProxyBase('https://collector:8080')).toBeUndefined();
  });

  test('returns undefined for invalid URL', () => {
    expect(buildServiceProxyBase('not-a-url')).toBeUndefined();
  });
});

describe('probeConfigMap', () => {
  let probeConfigMap: Awaited<ReturnType<typeof freshImport>>['probeConfigMap'];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await freshImport();
    probeConfigMap = mod.probeConfigMap;
    mockFetch = mod.mockFetch;
  });

  test('returns available when ConfigMap has otel-admin-endpoint', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }),
    );

    const result = await probeConfigMap();
    expect(result).toEqual({ available: true, endpoint: ADMIN_ENDPOINT });
  });

  test('returns unavailable when ConfigMap lacks otel-admin-endpoint key', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ data: { other: 'value' } }));

    const result = await probeConfigMap();
    expect(result).toEqual({ available: false, endpoint: '' });
  });

  test('returns unavailable when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('404'));

    const result = await probeConfigMap();
    expect(result).toEqual({ available: false, endpoint: '' });
  });

  test('caches positive result across calls', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }),
    );

    const first = await probeConfigMap();
    const second = await probeConfigMap();

    expect(first).toEqual(second);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('does not cache failures so subsequent calls can retry', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }));

    const first = await probeConfigMap();
    expect(first).toEqual({ available: false, endpoint: '' });

    const second = await probeConfigMap();
    expect(second).toEqual({ available: true, endpoint: ADMIN_ENDPOINT });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('useRetainedLogs availability', () => {
  let useRetainedLogs: Awaited<ReturnType<typeof freshImport>>['useRetainedLogs'];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await freshImport();
    useRetainedLogs = mod.useRetainedLogs;
    mockFetch = mod.mockFetch;
  });

  test('sets available=true when ConfigMap has endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-1', has_more: false, records: [] }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-1', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(true);
  });

  test('sets available=false when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('404'));

    const { result } = renderHook(() => useRetainedLogs('uid-1', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
  });
});

describe('useRetainedLogs', () => {
  let useRetainedLogs: Awaited<ReturnType<typeof freshImport>>['useRetainedLogs'];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await freshImport();
    useRetainedLogs = mod.useRetainedLogs;
    mockFetch = mod.mockFetch;
  });

  test('reports loading=false when not active even without cached probe', () => {
    const { result } = renderHook(() => useRetainedLogs('uid-123', false));

    expect(result.current.lines).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  test('returns empty lines when runUid is undefined', async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }),
    );

    const { result } = renderHook(() => useRetainedLogs(undefined, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual([]);
  });

  test('fetches and formats log records when active', async () => {
    const records = [
      makeRecord(1, 'agent.start', 'Starting analysis'),
      makeRecord(2, 'agent.text', 'Running checks'),
    ];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: false,
          records,
        }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual([
      '2026-01-01T00:00:01Z [agent.start] Starting analysis',
      '2026-01-01T00:00:02Z [agent.text] Running checks',
    ]);
    expect(result.current.error).toBeUndefined();
  });

  test('filters records by phase and includes phaseless records', async () => {
    const records = [
      {
        id: 1,
        phase: 'analysis',
        timestamp: '2026-01-01T00:00:01Z',
        event: 'start',
        body: { msg: 'A' },
      },
      {
        id: 2,
        phase: 'execution',
        timestamp: '2026-01-01T00:00:02Z',
        event: 'start',
        body: { msg: 'E' },
      },
      {
        id: 3,
        phase: '',
        timestamp: '2026-01-01T00:00:03Z',
        event: 'system',
        body: { msg: 'No phase' },
      },
      {
        id: 4,
        phase: 'analysis',
        timestamp: '2026-01-01T00:00:04Z',
        event: 'end',
        body: { msg: 'A2' },
      },
    ];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: false, records }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true, 'analysis'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(3);
    expect(result.current.lines[0]).toContain('A');
    expect(result.current.lines[1]).toContain('No phase');
    expect(result.current.lines[2]).toContain('A2');
  });

  test('handles pagination with has_more', async () => {
    const page1Records = [makeRecord(1, 'agent.start', 'Page 1')];
    const page2Records = [makeRecord(2, 'agent.text', 'Page 2')];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: true,
          records: page1Records,
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: false,
          records: page2Records,
        }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(2);
    expect(result.current.lines[0]).toContain('Page 1');
    expect(result.current.lines[1]).toContain('Page 2');

    // Second fetch should include after=1 parameter
    const secondCallUrl = mockFetch.mock.calls[2][0] as string;
    expect(secondCallUrl).toContain('after=1');
  });

  test('paginates correctly when record IDs start at 0', async () => {
    const page1 = [makeRecord(0, 'agent.start', 'First')];
    const page2 = [makeRecord(1, 'agent.text', 'Second')];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records: page1 }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: false, records: page2 }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(2);
    const secondCallUrl = mockFetch.mock.calls[2][0] as string;
    expect(secondCallUrl).toContain('after=0');
  });

  test('errors when pagination cursor does not advance', async () => {
    const page = [makeRecord(5, 'agent.start', 'Same page')];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records: page }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records: page }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Pagination stalled: cursor did not advance');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('caps accumulated lines at 20000', async () => {
    const bigPage = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      phase: 'analysis',
      timestamp: '2026-01-01T00:00:00Z',
      event: 'agent.text',
      body: { msg: `line-${i}` },
    }));

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }),
    );
    for (let page = 0; page < 41; page++) {
      const offset = page * 500;
      const records = bigPage.map((r) => ({ ...r, id: r.id + offset }));
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records }),
      );
    }

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(20000);
    expect(mockFetch).toHaveBeenCalledTimes(41); // 1 probe + 40 pages to reach 20000
  });

  test('truncates a final page that would exceed 20000 lines', async () => {
    const bigPage = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      phase: 'analysis',
      timestamp: '2026-01-01T00:00:00Z',
      event: 'agent.text',
      body: { msg: `line-${i}` },
    }));

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }),
    );
    // 39 full pages = 19500 lines, then one more page of 500 should be truncated to 500
    for (let page = 0; page < 40; page++) {
      const offset = page * 500;
      const records = bigPage.map((r) => ({ ...r, id: r.id + offset }));
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records }),
      );
    }

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(20000);
  });

  test('errors when cursor ID is non-finite', async () => {
    const records = [
      {
        id: NaN,
        phase: 'analysis',
        timestamp: '2026-01-01T00:00:01Z',
        event: 'start',
        body: { msg: 'bad' },
      },
    ];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({ agentic_run_id: 'uid-123', has_more: true, records }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Invalid cursor in retained log response');
  });

  test('terminates pagination when has_more is true but records are empty', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: true,
          records: [],
        }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('sets error when log fetch returns non-ok HTTP status', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce({ ok: false, status: 403, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch retained logs (HTTP 403)');
  });

  test('sets error when log fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.lines).toEqual([]);
  });

  test('does not fetch when retained API is unavailable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('404'));

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('formats record body as JSON when msg field is absent', async () => {
    const records = [
      {
        body: { key: 'value' },
        event: 'agent.tool',
        id: 1,
        phase: 'analysis',
        timestamp: '2026-01-01T00:00:01Z',
      },
    ];

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: false,
          records,
        }),
      );

    const { result } = renderHook(() => useRetainedLogs('uid-123', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines[0]).toBe('2026-01-01T00:00:01Z [agent.tool] {"key":"value"}');
  });

  test('resets state when active changes to true', async () => {
    mockFetch.mockRejectedValue(new Error('404'));

    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useRetainedLogs('uid-123', active),
      { initialProps: { active: false } },
    );

    expect(result.current.lines).toEqual([]);

    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ data: { 'otel-admin-endpoint': ADMIN_ENDPOINT } }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          agentic_run_id: 'uid-123',
          has_more: false,
          records: [makeRecord(1, 'agent.start', 'Hello')],
        }),
      );

    act(() => rerender({ active: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toHaveLength(1);
  });
});
