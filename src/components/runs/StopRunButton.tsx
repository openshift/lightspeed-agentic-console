import type { FC } from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export interface StopRunButtonProps {
  canStop: boolean;
  canStopLoading: boolean;
  onClick: () => void;
}

export const StopRunButton: FC<StopRunButtonProps> = ({ canStop, canStopLoading, onClick }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const enabled = canStop && !canStopLoading;
  const permissionBlocked = !canStop && !canStopLoading;

  return (
    <Tooltip
      content={t("You don't have permission to stop runs.")}
      trigger={permissionBlocked ? undefined : 'manual'}
    >
      <Button
        data-test="stop-run-button"
        isAriaDisabled={!enabled}
        isDanger
        onClick={enabled ? onClick : undefined}
        variant="secondary"
      >
        {t('Stop run')}
      </Button>
    </Tooltip>
  );
};
