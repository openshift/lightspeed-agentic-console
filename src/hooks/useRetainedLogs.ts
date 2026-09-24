import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { RUN_NAMESPACE } from '../constants';

const CONFIGMAP_NAME = 'lightspeed-agentic-configuration';
const ADMIN_ENDPOINT_KEY = 'otel-admin-endpoint';
const FETCH_LIMIT = 1000;

interface OtelLogRecord {
  body: Record<string, unknown>;
  event: string;
  id: number;
  phase: string;
  timestamp: string;
}

interface OtelLogsResponse {
  agentic_run_id: string;
  has_more: boolean;
  records: OtelLogRecord[];
}

export interface RetainedLogsResult {
  available: boolean;
  error?: string;
  lines: string[];
  loading: boolean;
}

let cachedAvailability: { available: boolean; endpoint: string } | undefined;
let fetchInFlight: Promise<{ available: boolean; endpoint: string }> | undefined;

const probeConfigMap = async (): Promise<{ available: boolean; endpoint: string }> => {
  if (cachedAvailability) return cachedAvailability;
  if (fetchInFlight) return fetchInFlight;

  const unavailable = { available: false, endpoint: '' } as const;

  fetchInFlight = (async () => {
    try {
      const url =
        `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(RUN_NAMESPACE)}` +
        `/configmaps/${encodeURIComponent(CONFIGMAP_NAME)}`;
      const response = await consoleFetch(url);
      if (!response.ok) return unavailable;
      const cm = await response.json();
      const endpoint = cm?.data?.[ADMIN_ENDPOINT_KEY];
      if (!endpoint) return unavailable;
      const result = { available: true, endpoint };
      cachedAvailability = result;
      return result;
    } catch {
      return unavailable;
    } finally {
      fetchInFlight = undefined;
    }
  })();

  return fetchInFlight;
};

const buildServiceProxyBase = (adminEndpoint: string): string | undefined => {
  try {
    const u = new URL(adminEndpoint);
    const hostParts = u.hostname.split('.');
    if (hostParts.length < 2) return undefined;
    const serviceName = hostParts[0];
    const namespace = hostParts[1];
    const port = u.port || '8080';
    return (
      `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}` +
      `/services/https:${encodeURIComponent(serviceName)}:${port}/proxy`
    );
  } catch {
    return undefined;
  }
};

const recordToLine = (r: OtelLogRecord): string => {
  const rawMsg =
    typeof r.body === 'object' && r.body !== null
      ? (r.body as Record<string, unknown>).msg
      : undefined;
  const body = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg ?? r.body);
  return `${r.timestamp} [${r.event}] ${body}`;
};

export type OtelPhase = 'analysis' | 'escalation' | 'execution' | 'verification';

export const useRetainedLogs = (
  runUid?: string,
  active?: boolean,
  phase?: OtelPhase,
): RetainedLogsResult => {
  const [available, setAvailable] = useState(cachedAvailability?.available ?? false);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(!cachedAvailability);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(
    async (signal: { cancelled: boolean }) => {
      const probe = await probeConfigMap();
      if (signal.cancelled) return;

      setAvailable(probe.available);

      if (!probe.available || !runUid) {
        setLoading(false);
        return;
      }

      const proxyBase = buildServiceProxyBase(probe.endpoint);
      if (!proxyBase) {
        setError('Invalid OTEL admin endpoint');
        setLoading(false);
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const qs = new URLSearchParams({
          agentic_run_id: runUid,
          limit: String(FETCH_LIMIT),
          ...(phase ? { phase } : {}),
        });
        const url = `${proxyBase}/api/v1/logs?${qs.toString()}`;
        const response = await consoleFetch(url, { signal: ac.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch retained logs (HTTP ${response.status})`);
        }
        const data: OtelLogsResponse = await response.json();

        if (!signal.cancelled) {
          setLines(data.records.map(recordToLine));
          setError(undefined);
        }
      } catch (err) {
        if (signal.cancelled) return;
        const msg = (err as Error)?.message;
        if (msg === 'The user aborted a request.') return;
        setError(msg || 'Failed to load retained logs');
      } finally {
        if (!signal.cancelled) setLoading(false);
      }
    },
    [phase, runUid],
  );

  useEffect(() => {
    if (!active) return;

    const signal = { cancelled: false };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLines([]);
    setError(undefined);
    doFetch(signal);

    return () => {
      signal.cancelled = true;
      abortRef.current?.abort();
    };
  }, [active, doFetch]);

  return { available, error, lines, loading: !!active && loading };
};

export { buildServiceProxyBase, probeConfigMap };
