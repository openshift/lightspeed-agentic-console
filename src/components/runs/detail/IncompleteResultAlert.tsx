import { Alert } from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { STEP_LIMIT_REACHED } from '../../../models/agenticrun';

interface IncompleteResultAlertProps {
  reason?: string;
  title: string;
}

export const IncompleteResultAlert: FC<IncompleteResultAlertProps> = ({ reason, title }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  return (
    <Alert data-test="incomplete-result-alert" isInline title={title} variant="warning">
      {reason === STEP_LIMIT_REACHED
        ? t(
            'The agent reached its step limit before finishing. Review this result carefully before relying on it.',
          )
        : t('Review this result carefully before relying on it.')}
    </Alert>
  );
};
