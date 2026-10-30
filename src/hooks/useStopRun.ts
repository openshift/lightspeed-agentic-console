import { useCallback, useState } from 'react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';

import type { AgenticRunK8s } from '../models/agenticrun';
import { LightspeedAgenticRunModel } from '../models/agenticrun';

export const useStopRunAccess = (namespace: string): [boolean, boolean] =>
  useAccessReview({
    group: LightspeedAgenticRunModel.apiGroup,
    resource: LightspeedAgenticRunModel.plural,
    verb: 'patch',
    namespace,
  });

export const useStopRunMutation = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [stopInProgress, setStopInProgress] = useState(false);
  const [stopError, setStopError] = useState<string>();

  const clearStopError = useCallback(() => setStopError(undefined), []);

  const stopRun = useCallback(
    async (target: { metadata?: { name?: string; namespace?: string } }): Promise<boolean> => {
      const name = target.metadata?.name;
      const namespace = target.metadata?.namespace;
      if (!name || !namespace) {
        setStopError(t('Agentic run is not available yet.'));
        return false;
      }

      setStopInProgress(true);
      setStopError(undefined);
      try {
        const patchedRun = (await k8sPatch({
          model: LightspeedAgenticRunModel,
          resource: { metadata: { name, namespace } },
          data: [{ op: 'add', path: '/spec/cancelled', value: true }],
        })) as AgenticRunK8s;
        if (patchedRun.spec?.cancelled !== true) {
          setStopError(
            t(
              'Cancellation was not accepted. The run may still be running. Upgrade the operator and AgenticRun CRD before retrying.',
            ),
          );
          return false;
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStopError(message || t('Failed to stop run.'));
        return false;
      } finally {
        setStopInProgress(false);
      }
    },
    [t],
  );

  return { stopRun, stopInProgress, stopError, clearStopError };
};
