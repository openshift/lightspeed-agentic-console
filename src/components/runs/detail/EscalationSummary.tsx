import { Card, CardBody, CardHeader, Flex, FlexItem, Label, Title } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { EscalationView } from '../../../models/agenticrun-views';
import { MarkdownContent } from '../../MarkdownContent';
import { SandboxLogViewer } from './SandboxLogViewer';

interface EscalationSummaryProps {
  escalation: EscalationView;
}

export const EscalationSummary: FC<EscalationSummaryProps> = ({ escalation }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  // Failure-only EscalationResults (agent/system error before summary is produced)
  // have no card body content — failureReason is shown via the page-level alert.
  if (!escalation.summary && !escalation.content && !escalation.escalationSandbox) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <ExclamationTriangleIcon
              aria-label={t('Escalated')}
              color="var(--pf-t--global--icon--color--status--warning--default)"
            />
          </FlexItem>
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Title headingLevel="h4">{t('Escalation summary')}</Title>
              </FlexItem>
              <FlexItem>
                <Label isCompact>{t('AI-generated')}</Label>
              </FlexItem>
            </Flex>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        <Flex direction={{ default: 'column' }} gap={{ default: 'gapLg' }}>
          {escalation.summary && (
            <FlexItem>
              <MarkdownContent text={escalation.summary} />
            </FlexItem>
          )}

          {escalation.content && escalation.content !== escalation.summary && (
            <FlexItem>
              <MarkdownContent text={escalation.content} />
            </FlexItem>
          )}

          {escalation.escalationSandbox && (
            <FlexItem>
              <SandboxLogViewer
                phase="escalation"
                sandbox={escalation.escalationSandbox}
                sinceTime={escalation.escalationStartedAt}
                title={t('Escalation')}
              />
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};
