// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AgenticRunK8s } from '../models/agenticrun';
import { LightspeedAgenticRunModel } from '../models/agenticrun';
import { useStopRunAccess, useStopRunMutation } from './useStopRun';

const accessReview = vi.mocked(useAccessReview);
const patch = vi.mocked(k8sPatch);
const makePatchedRunResponse = (spec?: AgenticRunK8s['spec']): AgenticRunK8s =>
  ({
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRun',
    metadata: { name: 'run-1', namespace: 'tenant-a' },
    ...(spec === undefined ? {} : { spec }),
  }) as AgenticRunK8s;

const acceptedRunResponse = makePatchedRunResponse({
  request: 'Fix alert',
  cancelled: true,
});

beforeEach(() => {
  accessReview.mockReset();
  accessReview.mockReturnValue([true, false]);
  patch.mockReset();
  patch.mockResolvedValue(acceptedRunResponse);
});

describe('useStopRunAccess', () => {
  test('checks patch access for agenticruns in the requested namespace', () => {
    const { result } = renderHook(() => useStopRunAccess('tenant-a'));

    expect(result.current).toEqual([true, false]);
    expect(accessReview).toHaveBeenCalledWith({
      group: 'agentic.openshift.io',
      resource: 'agenticruns',
      verb: 'patch',
      namespace: 'tenant-a',
    });
  });
});

describe('useStopRunMutation', () => {
  test('adds only spec.cancelled=true to the namespaced run when response confirms it', async () => {
    const { result } = renderHook(() => useStopRunMutation());
    let stopped = false;

    await act(async () => {
      stopped = await result.current.stopRun({
        metadata: { name: 'run-1', namespace: 'tenant-a' },
      });
    });

    expect(stopped).toBe(true);
    expect(patch).toHaveBeenCalledWith({
      model: LightspeedAgenticRunModel,
      resource: { metadata: { name: 'run-1', namespace: 'tenant-a' } },
      data: [{ op: 'add', path: '/spec/cancelled', value: true }],
    });
    expect(result.current.stopError).toBeUndefined();
    expect(result.current.stopInProgress).toBe(false);
  });

  test.each([
    {
      description: 'a CRD-pruned cancelled field',
      response: makePatchedRunResponse({ request: 'Fix alert' }),
    },
    {
      description: 'cancelled=false',
      response: makePatchedRunResponse({ request: 'Fix alert', cancelled: false }),
    },
    {
      description: 'a missing spec',
      response: makePatchedRunResponse(),
    },
  ])('does not report success for $description', async ({ response }) => {
    patch.mockResolvedValue(response);
    const { result } = renderHook(() => useStopRunMutation());
    let stopped = true;

    await act(async () => {
      stopped = await result.current.stopRun({
        metadata: { name: 'run-1', namespace: 'tenant-a' },
      });
    });

    expect(stopped).toBe(false);
    expect(result.current.stopError).toBeDefined();
    expect(result.current.stopInProgress).toBe(false);
  });

  test('returns the API error for inline display and clears it on request', async () => {
    patch.mockRejectedValue(new Error('API denied the stop request'));
    const { result } = renderHook(() => useStopRunMutation());
    let stopped = true;

    await act(async () => {
      stopped = await result.current.stopRun({
        metadata: { name: 'run-1', namespace: 'tenant-a' },
      });
    });

    expect(stopped).toBe(false);
    expect(result.current.stopError).toBe('API denied the stop request');
    expect(result.current.stopInProgress).toBe(false);

    act(() => result.current.clearStopError());
    expect(result.current.stopError).toBeUndefined();
  });

  test('clears an acknowledgement error after an accepted retry and resets progress', async () => {
    patch
      .mockResolvedValueOnce(makePatchedRunResponse({ request: 'Fix alert' }))
      .mockResolvedValueOnce(acceptedRunResponse);
    const { result } = renderHook(() => useStopRunMutation());
    const target = { metadata: { name: 'run-1', namespace: 'tenant-a' } };
    let stopped = true;

    await act(async () => {
      stopped = await result.current.stopRun(target);
    });

    expect(stopped).toBe(false);
    expect(result.current.stopError).toBeDefined();
    expect(result.current.stopInProgress).toBe(false);

    await act(async () => {
      stopped = await result.current.stopRun(target);
    });

    expect(stopped).toBe(true);
    expect(result.current.stopError).toBeUndefined();
    expect(result.current.stopInProgress).toBe(false);
    expect(patch).toHaveBeenCalledTimes(2);
  });
});
