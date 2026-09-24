import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  Content,
  ContentVariants,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Skeleton,
  Title,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useExecutionLogActions } from '../../../hooks/useExecutionLogActions';
import { ExecutionView } from '../../../models/agenticrun-views';
import { getOutcomeStatus } from '../../../utils/agenticrun-utils';
import { CodeBlockWithClipboard } from '../../CodeBlockWithClipboard';
import { MarkdownContent } from '../../MarkdownContent';
import { SandboxLogViewer } from './SandboxLogViewer';

interface ExecutionSummaryProps {
  execution: ExecutionView;
}

export const ExecutionSummary: FC<ExecutionSummaryProps> = ({ execution }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const hasActions = execution.actions.length > 0;
  const { actions: logActions, loading: logsLoading } = useExecutionLogActions(
    execution.executionSandbox,
    hasActions,
    execution.executionStartedAt,
  );

  const displayActions = hasActions ? execution.actions : logActions;

  return (
    <Card>
      <CardHeader>
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            {
              {
                success: (
                  <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />
                ),
                danger: (
                  <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
                ),
                warning: (
                  <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />
                ),
              }[getOutcomeStatus(execution.outcome)]
            }
          </FlexItem>
          <FlexItem>
            <Title headingLevel="h4">{t('Execution')}</Title>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <Flex direction={{ default: 'column' }} gap={{ default: 'gapLg' }}>
          {execution.executionRecord && (
            <FlexItem>
              <DescriptionList isHorizontal>
                {execution.executionRecord.selectedOption && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Selected option')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {execution.executionRecord.selectedOption}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                {execution.executionRecord.approverUsername && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Approved by')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {execution.executionRecord.approverUsername}
                      {execution.executionRecord.approvedAt && (
                        <>
                          {', '}
                          <Timestamp simple timestamp={execution.executionRecord.approvedAt} />
                        </>
                      )}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            </FlexItem>
          )}

          {execution.originalRootCause && (
            <FlexItem>
              <Content component={ContentVariants.small}>{t('Contextual evidence')}</Content>
              <DescriptionList>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Original root cause')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <MarkdownContent text={execution.originalRootCause} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {execution.remediationDelta && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Remediation delta')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <MarkdownContent text={execution.remediationDelta} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            </FlexItem>
          )}

          {logsLoading && (
            <FlexItem>
              <Skeleton screenreaderText={t('Loading execution details')} />
            </FlexItem>
          )}

          {displayActions.length > 0 && (
            <FlexItem>
              <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
                <FlexItem>
                  <Title headingLevel="h5">{t('Actions taken')}</Title>
                </FlexItem>
                {displayActions.map((action, i) => (
                  <FlexItem key={i}>
                    <Card isCompact>
                      <CardBody>
                        <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
                          <FlexItem>
                            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                              <FlexItem>
                                <Label isCompact variant="outline">
                                  {action.type}
                                </Label>
                              </FlexItem>
                              <FlexItem>
                                <Label
                                  isCompact
                                  status={action.outcome === 'Failed' ? 'danger' : 'success'}
                                >
                                  {action.outcome}
                                </Label>
                              </FlexItem>
                            </Flex>
                          </FlexItem>
                          <FlexItem>
                            <MarkdownContent text={action.description} />
                          </FlexItem>
                          {action.error && (
                            <FlexItem>
                              <Alert isInline isPlain title={action.error} variant="danger" />
                            </FlexItem>
                          )}
                          {action.output && (
                            <FlexItem>
                              <CodeBlockWithClipboard code={action.output} />
                            </FlexItem>
                          )}
                        </Flex>
                      </CardBody>
                    </Card>
                  </FlexItem>
                ))}
              </Flex>
            </FlexItem>
          )}

          {execution.executionSandbox && (
            <FlexItem>
              <SandboxLogViewer
                phase="execution"
                sandbox={execution.executionSandbox}
                sinceTime={execution.executionStartedAt}
                title={t('Execution')}
              />
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};
