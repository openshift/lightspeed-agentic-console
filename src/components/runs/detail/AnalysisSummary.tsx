import {
  Card,
  CardBody,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Label,
  Skeleton,
  Title,
} from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AgenticRunPhase,
  RootCauseView,
  SandboxView,
  TERMINAL_PHASES,
} from '../../../models/agenticrun-views';
import { MarkdownContent } from '../../MarkdownContent';
import { SandboxLogViewer } from './SandboxLogViewer';
import { StageApprovalBanner } from './StageApprovalBanner';

interface AnalysisSummaryProps {
  analysisRequest?: string;
  rootCause?: RootCauseView;
  hasRemediationOptions: boolean;
  phase: AgenticRunPhase;
  analysisSandbox?: SandboxView;
  analysisStartedAt?: string;
  needsApproval?: boolean;
  canApprove?: boolean;
  canApproveLoading?: boolean;
  mutationInProgress?: boolean;
  mutationError?: string;
  onApproveAnalysis?: () => Promise<boolean> | void;
  onClearError?: () => void;
}

const LoadingSkeleton: FC<{ text: string }> = ({ text }) => {
  return (
    <Flex direction={{ default: 'column' }}>
      <FlexItem>
        <Content component={ContentVariants.small}>
          <em>{text}</em>
        </Content>
      </FlexItem>
      <FlexItem>
        <Skeleton screenreaderText={text} width="70%" />
      </FlexItem>
      <FlexItem>
        <Skeleton width="40%" />
      </FlexItem>
      <FlexItem>
        <Skeleton width="50%" />
      </FlexItem>
    </Flex>
  );
};

export const AnalysisSummary: FC<AnalysisSummaryProps> = ({
  analysisRequest,
  phase,
  analysisSandbox,
  analysisStartedAt,
  hasRemediationOptions,
  rootCause,
  needsApproval,
  canApprove,
  canApproveLoading,
  mutationInProgress,
  mutationError,
  onApproveAnalysis,
  onClearError,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  if (phase === 'Pending') {
    if (needsApproval && onApproveAnalysis) {
      return (
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
          {analysisRequest && (
            <FlexItem>
              <Card>
                <CardBody>
                  <MarkdownContent text={analysisRequest} />
                </CardBody>
              </Card>
            </FlexItem>
          )}
          <FlexItem>
            <StageApprovalBanner
              canApprove={canApprove ?? false}
              canApproveLoading={canApproveLoading ?? false}
              mutationError={mutationError}
              mutationInProgress={mutationInProgress ?? false}
              onApprove={onApproveAnalysis}
              onClearError={onClearError}
              stageType="Analysis"
            />
          </FlexItem>
        </Flex>
      );
    }

    return (
      <Card>
        <CardBody>
          <LoadingSkeleton text={t('Waiting for analysis to start...')} />
        </CardBody>
      </Card>
    );
  }

  if (phase === 'Analyzing') {
    return (
      <Card>
        <CardBody>
          <Flex direction={{ default: 'column' }}>
            {analysisRequest && (
              <FlexItem>
                <MarkdownContent text={analysisRequest} />
              </FlexItem>
            )}
            <FlexItem>
              <LoadingSkeleton text={t('Analyzing ...')} />
            </FlexItem>
            {analysisSandbox && (
              <FlexItem>
                <SandboxLogViewer
                  phase="analysis"
                  sandbox={analysisSandbox}
                  sinceTime={analysisStartedAt}
                  streaming
                  title={t('Analysis')}
                />
              </FlexItem>
            )}
          </Flex>
        </CardBody>
      </Card>
    );
  }

  if (analysisRequest) {
    return (
      <>
        <Card>
          <CardBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsLg' }}>
              <FlexItem>
                <MarkdownContent text={analysisRequest} />
              </FlexItem>
              {analysisSandbox && (
                <FlexItem>
                  <SandboxLogViewer
                    phase="analysis"
                    sandbox={analysisSandbox}
                    sinceTime={analysisStartedAt}
                    title={t('Analysis')}
                  />
                </FlexItem>
              )}
            </Flex>
          </CardBody>
        </Card>

        {!hasRemediationOptions && rootCause && (
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsLg' }}>
            <FlexItem>
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                <FlexItem>
                  <Title headingLevel="h4">{t('Root cause analysis')}</Title>
                </FlexItem>
                <FlexItem>
                  <Label isCompact>{t('AI-generated')}</Label>
                </FlexItem>
              </Flex>
            </FlexItem>
            <FlexItem>
              <Card>
                <CardBody>
                  <Flex direction={{ default: 'column' }}>
                    <FlexItem>
                      <MarkdownContent text={rootCause.cause} />
                    </FlexItem>
                    <FlexItem>
                      <MarkdownContent text={rootCause.detail} />
                    </FlexItem>
                  </Flex>
                </CardBody>
              </Card>
            </FlexItem>
          </Flex>
        )}
      </>
    );
  }

  if (TERMINAL_PHASES.includes(phase)) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateBody>{t('Analysis was not completed.')}</EmptyStateBody>
          </EmptyState>
          {analysisSandbox && (
            <SandboxLogViewer
              phase="analysis"
              sandbox={analysisSandbox}
              sinceTime={analysisStartedAt}
              title={t('Analysis')}
            />
          )}
        </CardBody>
      </Card>
    );
  }

  return null;
};
