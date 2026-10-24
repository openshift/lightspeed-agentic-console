import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmationModal } from '../ConfirmationModal';

export interface StopRunModalProps {
  isOpen: boolean;
  isExecuting: boolean;
  isLoading: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  runName?: string;
}

export const StopRunModal: FC<StopRunModalProps> = ({
  isOpen,
  isExecuting,
  isLoading,
  error,
  onConfirm,
  onClose,
  runName,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  return (
    <ConfirmationModal
      actionLabel={t('Stop run')}
      actionVariant="danger"
      body={
        isExecuting
          ? t(
              'Stopping this run cannot be undone. Partial cluster changes may already exist, so inspect the cluster manually after it stops.',
            )
          : t(
              'Stopping this run cannot be undone. Any changes already made to your cluster will remain.',
            )
      }
      error={error}
      isLoading={isLoading}
      isOpen={isOpen}
      onAction={onConfirm}
      onClose={onClose}
      title={runName ? t('Stop {{runName}}?', { runName }) : t('Stop run?')}
    />
  );
};
