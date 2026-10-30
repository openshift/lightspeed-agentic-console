import type { FC } from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import type { AgenticRunPhase } from '../../models/agenticrun';

export interface StopRunButtonProps {
  phase: AgenticRunPhase;
  stopPending?: boolean;
  canStop: boolean;
  canStopLoading: boolean;
  onClick: () => void;
  isCompact?: boolean;
}

const STOPPABLE_PHASES: AgenticRunPhase[] = ['Analyzing', 'Executing', 'Verifying', 'Escalating'];

export const StopRunButton: FC<StopRunButtonProps> = ({
  phase,
  stopPending = false,
  canStop,
  canStopLoading,
  onClick,
  isCompact = false,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (!STOPPABLE_PHASES.includes(phase) || stopPending) {
    return null;
  }

  const permissionBlocked = !canStop && !canStopLoading;

  return (
    <Tooltip
      content={t("You don't have permission to stop runs.")}
      trigger={permissionBlocked ? undefined : 'manual'}
    >
      <Button
        data-test="stop-run-button"
        isAriaDisabled={!canStop || canStopLoading}
        isDanger
        onClick={canStop && !canStopLoading ? onClick : undefined}
        size={isCompact ? 'sm' : undefined}
        variant="secondary"
      >
        {isCompact ? t('Stop') : t('Stop run')}
      </Button>
    </Tooltip>
  );
};
