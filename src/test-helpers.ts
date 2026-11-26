import { onTestFinished, vi } from 'vitest';

import {
  AgenticRunCondition,
  AnalysisResultK8s,
  ApprovalStage,
  EscalationResultK8s,
  ExecutionResultK8s,
  LightspeedAgenticRunApproval,
  ResultCondition,
  VerificationResultK8s,
} from './models/agenticrun';

export const cond = (
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
  message?: string,
): AgenticRunCondition => ({ type, status, reason, message });

// Result CR conditions require lastTransitionTime, unlike AgenticRun conditions
export const resultCond = (
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
  message?: string,
): ResultCondition => ({
  lastTransitionTime: '2026-01-01T00:00:00Z',
  message,
  reason,
  status,
  type,
});

type ResultKinds = {
  AnalysisResult: AnalysisResultK8s;
  EscalationResult: EscalationResultK8s;
  ExecutionResult: ExecutionResultK8s;
  VerificationResult: VerificationResultK8s;
};

export const makeResult = <K extends keyof ResultKinds>(
  kind: K,
  status: ResultKinds[K]['status'] = {},
): ResultKinds[K] =>
  ({
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind,
    metadata: { name: 'result-1', namespace: 'default' },
    spec: { agenticRunName: 'run-1' },
    status,
  }) as ResultKinds[K];

export const makeApproval = (stages: ApprovalStage[] = []): LightspeedAgenticRunApproval => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRunApproval',
  metadata: { name: 'test', namespace: 'default' },
  spec: { stages },
});

export const makeApprovalNoSpec = (): LightspeedAgenticRunApproval => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRunApproval',
  metadata: { name: 'test', namespace: 'default' },
});

// Restoring in onTestFinished runs after all afterEach hooks, including React Testing Library's
// unmount, so unmount effects can still revoke URLs
export const stubObjectUrl = (createObjectURL: typeof URL.createObjectURL = () => 'blob:fake') => {
  const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  onTestFinished(() => {
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });
  return { createObjectURL: createSpy, revokeObjectURL: revokeSpy };
};

// Stubs anchor clicks so downloads don't navigate jsdom, and exposes the last anchor created.
// Also fakes setTimeout, so a download's delayed URL revoke can't fire during a later test.
// Advance timers to trigger it.
export const stubAnchorDownload = () => {
  vi.useFakeTimers({ toFake: ['clearTimeout', 'setTimeout'] });
  let lastAnchor: HTMLAnchorElement | undefined;
  const realCreateElement = document.createElement.bind(document);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const createElement = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (element instanceof HTMLAnchorElement) {
        lastAnchor = element;
      }
      return element;
    });
  onTestFinished(() => {
    click.mockRestore();
    createElement.mockRestore();
    vi.useRealTimers();
  });
  return { click, getLastAnchor: () => lastAnchor };
};
