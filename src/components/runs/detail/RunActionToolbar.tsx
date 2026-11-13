import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { ApprovalStageType } from '../../../models/agenticrun';
import type { AgenticRunView } from '../../../models/agenticrun-views';
import { ApprovalGatedButton } from '../../ApprovalGatedButton';
import { StopRunButton } from '../StopRunButton';

import './RunActionToolbar.css';

export interface RunActionToolbarProps {
  view: AgenticRunView;
  resultsLoaded: boolean;
  isStoppable: boolean;
  needsApproval: Record<ApprovalStageType, boolean>;
  canStop: boolean;
  canStopLoading: boolean;
  onStop: () => void;
  canApprove: boolean;
  canApproveLoading: boolean;
  mutationInProgress: boolean;
  selectedOption: number;
  onExecute: () => void;
  onDeny: () => void;
  onDownload: () => void;
}

// Sticky bottom toolbar for actions the user can take now: Stop while a sandbox runs,
// triage actions once a proposal is ready.
export const RunActionToolbar: FC<RunActionToolbarProps> = ({
  view,
  resultsLoaded,
  isStoppable,
  needsApproval,
  canStop,
  canStopLoading,
  onStop,
  canApprove,
  canApproveLoading,
  mutationInProgress,
  selectedOption,
  onExecute,
  onDeny,
  onDownload,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (view.phase === 'Proposed') {
    if (!resultsLoaded) {
      return null;
    }
    return (
      <div className="ols-plugin__action-toolbar" data-test="run-action-toolbar">
        <ActionList>
          <ActionListGroup>
            {!view.advisory && (
              <ActionListItem>
                <ApprovalGatedButton
                  canApprove={canApprove}
                  canApproveLoading={canApproveLoading}
                  disabledTooltip={t('Select a remediation option to execute')}
                  isDisabled={selectedOption < 0}
                  mutationInProgress={mutationInProgress}
                  onClick={onExecute}
                >
                  {t('Execute remediation')}
                </ApprovalGatedButton>
              </ActionListItem>
            )}
            {!view.advisory && (
              <ActionListItem>
                <ApprovalGatedButton
                  canApprove={canApprove}
                  canApproveLoading={canApproveLoading}
                  mutationInProgress={mutationInProgress}
                  onClick={onDeny}
                  variant="secondary"
                >
                  {t('Deny run')}
                </ApprovalGatedButton>
              </ActionListItem>
            )}
            <ActionListItem>
              <Button
                icon={<DownloadIcon />}
                isAriaDisabled={selectedOption < 0}
                onClick={onDownload}
                variant="link"
              >
                {t('Download plan')}
              </Button>
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
        <Content component={ContentVariants.small}>
          {t(
            'The autonomous features of OpenShift Lightspeed use AI technology to generate output.',
          )}{' '}
          {t('Always review AI-generated content prior to use.')}
        </Content>
      </div>
    );
  }

  // No sandbox runs while a stage waits for approval, so Stop is not offered then.
  const awaitingApproval = Object.values(needsApproval).some(Boolean);
  if (!isStoppable || awaitingApproval) {
    return null;
  }

  return (
    <div className="ols-plugin__action-toolbar" data-test="run-action-toolbar">
      <ActionList>
        <ActionListGroup>
          <ActionListItem>
            <StopRunButton canStop={canStop} canStopLoading={canStopLoading} onClick={onStop} />
          </ActionListItem>
        </ActionListGroup>
      </ActionList>
    </div>
  );
};
