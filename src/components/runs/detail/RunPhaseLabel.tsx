import type { SVGIconProps } from '@patternfly/react-icons/dist/esm/createIcon';
import RhUiBanIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-ban-icon';
import RhUiCheckCircleFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-check-circle-fill-icon';
import RhUiErrorFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-error-fill-icon';
import RhUiInProgressIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-in-progress-icon';
import RhUiPauseCircleIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-pause-circle-icon';
import RhUiPendingIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-pending-icon';
import RhUiRunningIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-running-icon';
import RhUiSyncIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-sync-icon';
import RhUiWarningFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-warning-fill-icon';
import type { ComponentClass, FC } from 'react';
import { useTranslation } from 'react-i18next';

import { getPhaseDisplay } from '../../../models/agenticrun';
import { AgenticRunPhase } from '../../../models/agenticrun-views';

import './RunPhaseLabel.css';

// Canonical OCP console status icons for each agentic run phase
const STATUS_ICON: Record<AgenticRunPhase, ComponentClass<SVGIconProps>> = {
  Analyzing: RhUiInProgressIcon,
  Completed: RhUiCheckCircleFillIcon,
  Denied: RhUiBanIcon,
  EmergencyStopped: RhUiBanIcon,
  Escalated: RhUiWarningFillIcon,
  Escalating: RhUiWarningFillIcon,
  Executing: RhUiRunningIcon,
  Failed: RhUiErrorFillIcon,
  Pending: RhUiPendingIcon,
  Proposed: RhUiPauseCircleIcon,
  Verifying: RhUiSyncIcon,
};

// Transient phases are omitted so their icon inherits currentColor from the theme
const STATUS_ICON_COLOR_CLASS: Partial<Record<AgenticRunPhase, string>> = {
  Completed: 'ols-plugin__run-phase-icon--success',
  Denied: 'ols-plugin__run-phase-icon--danger',
  EmergencyStopped: 'ols-plugin__run-phase-icon--danger',
  Escalated: 'ols-plugin__run-phase-icon--warning',
  Escalating: 'ols-plugin__run-phase-icon--warning',
  Failed: 'ols-plugin__run-phase-icon--danger',
  Pending: 'ols-plugin__run-phase-icon--subtle',
};

export const RunPhaseLabel: FC<{ phase: AgenticRunPhase; stopping?: boolean }> = ({
  phase,
  stopping = false,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const { label: phaseLabel } = getPhaseDisplay(phase);
  const label = stopping ? t('Stopping') : t(phaseLabel);
  const Icon = stopping ? RhUiInProgressIcon : STATUS_ICON[phase];
  const iconColorClass = stopping ? undefined : STATUS_ICON_COLOR_CLASS[phase];

  return (
    <span className="ols-plugin__run-phase">
      {Icon ? (
        <span aria-hidden className={iconColorClass}>
          <Icon />
        </span>
      ) : null}
      {label}
    </span>
  );
};
