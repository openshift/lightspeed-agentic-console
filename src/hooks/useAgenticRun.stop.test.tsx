// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
  k8sPatch,
  useAccessReview,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AgenticRunApprovalK8s, AgenticRunK8s } from '../models/agenticrun';
import { LightspeedAgenticRunModel } from '../models/agenticrun';
import { watchResult } from '../test-render';
import { useAgenticRun } from './useAgenticRun';

const watch = vi.mocked(useK8sWatchResource);
const accessReview = vi.mocked(useAccessReview);
const patch = vi.mocked(k8sPatch);

const makeRun = (namespace?: string): AgenticRunK8s =>
  ({
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRun',
    metadata: { name: 'run-1', uid: 'uid-1', ...(namespace ? { namespace } : {}) },
    spec: { request: 'Fix alert' },
    status: { conditions: [{ type: 'Analyzed', status: 'Unknown' }] },
  }) as AgenticRunK8s;

const setWatchResults = (run: AgenticRunK8s | undefined) => {
  const responses = [
    watchResult<AgenticRunK8s>(run, true),
    [[], true, undefined],
    [[], true, undefined],
    [[], true, undefined],
    [[], true, undefined],
    watchResult<AgenticRunApprovalK8s>(undefined, true),
  ] as const;
  let callCount = 0;
  watch.mockImplementation(() => {
    const response = responses[callCount % responses.length];
    callCount += 1;
    return response as never;
  });
};

beforeEach(() => {
  watch.mockReset();
  accessReview.mockReset();
  accessReview.mockReturnValue([true, false]);
  patch.mockReset();
  const acceptedRun: AgenticRunK8s = {
    ...makeRun('run-namespace'),
    spec: { request: 'Fix alert', cancelled: true },
  };
  patch.mockResolvedValue(acceptedRun);
});

describe('useAgenticRun stop access and mutation', () => {
  test.each([
    { runNamespace: 'run-namespace', expectedNamespace: 'run-namespace' },
    { runNamespace: undefined, expectedNamespace: 'watch-namespace' },
  ])(
    'checks namespaced stop permission using run namespace then watch fallback',
    ({ runNamespace, expectedNamespace }) => {
      setWatchResults(makeRun(runNamespace));

      renderHook(() => useAgenticRun('run-1', 'watch-namespace'));

      expect(accessReview).toHaveBeenCalledWith({
        group: 'agentic.openshift.io',
        resource: 'agenticruns',
        verb: 'patch',
        namespace: expectedNamespace,
      });
    },
  );

  test('returns the API error without optimistically changing the run phase', async () => {
    patch.mockRejectedValue(new Error('API denied the stop request'));
    setWatchResults(makeRun('run-namespace'));
    const { result } = renderHook(() => useAgenticRun('run-1', 'watch-namespace'));

    expect(result.current.view?.phase).toBe('Analyzing');

    let stopped = true;
    await act(async () => {
      stopped = await result.current.stopRun();
    });

    expect(stopped).toBe(false);
    expect(result.current.view?.phase).toBe('Analyzing');
    expect(result.current.stopError).toBe('API denied the stop request');
    expect(result.current.mutationError).toBeUndefined();
    expect(patch).toHaveBeenCalledWith({
      model: LightspeedAgenticRunModel,
      resource: { metadata: { name: 'run-1', namespace: 'run-namespace' } },
      data: [{ op: 'add', path: '/spec/cancelled', value: true }],
    });
  });
});
