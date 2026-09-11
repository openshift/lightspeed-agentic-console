import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  Flex,
  FlexItem,
  PageSection,
  Title,
} from '@patternfly/react-core';

import ApprovalPolicy from './ApprovalPolicy';
import AgenticLayout from '../AgenticLayout';
import PreviewBadge from '../PreviewBadge';
import './configuration.css';

const ConfigurationPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const navigate = useNavigate();

  return (
    <AgenticLayout>
      <PageSection hasBodyWrapper={false} type="breadcrumb">
        <Breadcrumb>
          <BreadcrumbItem
            onClick={(e) => {
              e.preventDefault();
              navigate('/lightspeed/runs');
            }}
            to="#"
          >
            {t('Agentic runs')}
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t('Configuration')}</BreadcrumbItem>
        </Breadcrumb>
      </PageSection>
      <PageSection>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Title headingLevel="h1">{t('Configuration')}</Title>
          </FlexItem>
          <FlexItem>
            <PreviewBadge />
          </FlexItem>
        </Flex>
        <p className="ols-plugin__config-page-subtitle">
          {t(
            'Manage manual or automatic stage approval modes across the agentic troubleshooting lifecycle.',
          )}
        </p>
      </PageSection>
      <PageSection>
        <div className="ols-plugin__config-content">
          <ApprovalPolicy />
        </div>
      </PageSection>
    </AgenticLayout>
  );
};

export default ConfigurationPage;
