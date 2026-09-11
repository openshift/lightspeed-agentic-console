import {
  Alert,
  Content,
  ContentVariants,
  ExpandableSection,
  Flex,
  FlexItem,
  Label,
  Title,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ResourceIcon, ResourceLink, useK8sModels } from '@openshift-console/dynamic-plugin-sdk';
import { type FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentRbac, PermissionRule } from '../../../models/agenticrun';
import {
  buildPluralToKindMap,
  countClusterRules,
  countNamespaceRules,
  flattenRbacRules,
  formatResource,
  hasWriteVerb,
  isClusterScoped,
  isMutatingVerb,
  resolveKind,
  summarizeWritePermissions,
} from '../../../utils/rbac-utils';
import './detail.css';

interface NamespaceCellProps {
  namespace: string;
}

const NamespaceCell: FC<NamespaceCellProps> = ({ namespace }) => {
  if (namespace === '') return <>{'—'}</>;
  return (
    <ResourceLink className="ols-plugin__rbac-namespace-link" kind="Namespace" name={namespace} />
  );
};

interface ResourceCellProps {
  rule: PermissionRule;
  pluralToKind: Map<string, string>;
}

const ResourceCell: FC<ResourceCellProps> = ({ rule, pluralToKind }) => {
  const kinds = rule.resources.map((r) => resolveKind(pluralToKind, rule.apiGroups, r));
  if (!rule.resourceNames?.length) return <code>{formatResource(rule)}</code>;
  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
      {kinds.map((kind, j) => (
        <FlexItem key={rule.resources[j]}>
          <ResourceIcon kind={kind ?? rule.resources[j]} />
        </FlexItem>
      ))}
      <FlexItem>
        <code>{rule.resourceNames.join(', ')}</code>
      </FlexItem>
    </Flex>
  );
};

interface RequiredPermissionsProps {
  rbac: AgentRbac;
}

export const RequiredPermissions: FC<RequiredPermissionsProps> = ({ rbac }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [isExpanded, setIsExpanded] = useState(false);
  const [models] = useK8sModels();

  const pluralToKind = useMemo(() => buildPluralToKindMap(models), [models]);
  const rules = useMemo(() => flattenRbacRules(rbac), [rbac]);
  const namespaceCount = countNamespaceRules(rules);
  const clusterCount = countClusterRules(rules);
  const writeSummary = useMemo(() => summarizeWritePermissions(rules), [rules]);

  if (rules.length === 0) return null;

  return (
    <FlexItem>
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Title className="ols-plugin__remediation-card-header--title" headingLevel="h6">
            {t('Required permissions')}
          </Title>
        </FlexItem>
        <FlexItem>
          <Alert
            isInline
            isPlain
            title={t(
              'Permissions are fixed upon approval. The agent cannot exceed these scoped privileges.',
            )}
            variant="warning"
          />
        </FlexItem>
        <FlexItem>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
          >
            {namespaceCount > 0 && (
              <FlexItem>
                <Label color="blue" isCompact>
                  {t('{{count}} namespace permission', { count: namespaceCount })}
                </Label>
              </FlexItem>
            )}
            {clusterCount > 0 && (
              <FlexItem>
                <Label color="purple" isCompact>
                  {t('{{count}} cluster-wide permission', { count: clusterCount })}
                </Label>
              </FlexItem>
            )}
          </Flex>
        </FlexItem>
        {writeSummary && (
          <FlexItem>
            <Content component={ContentVariants.small}>
              {`${t('Includes write')}: ${writeSummary}`}
            </Content>
          </FlexItem>
        )}
        <FlexItem>
          <ExpandableSection
            isExpanded={isExpanded}
            onToggle={(_e, expanded) => setIsExpanded(expanded)}
            toggleText={isExpanded ? t('Hide permission details') : t('View permission details')}
          >
            <Table variant="compact">
              <Thead>
                <Tr>
                  <Th>{t('Namespace')}</Th>
                  <Th>{t('Resource')}</Th>
                  <Th>{t('Verbs')}</Th>
                  <Th>{t('Purpose')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rules.map((rule, i) => (
                  <Tr key={i}>
                    <Td dataLabel={t('Namespace')}>
                      {isClusterScoped(rule) ? (
                        <Label color="purple" isCompact>
                          {t('Cluster-wide')}
                        </Label>
                      ) : (
                        <NamespaceCell namespace={rule.namespace ?? ''} />
                      )}
                    </Td>
                    <Td dataLabel={t('Resource')}>
                      <ResourceCell pluralToKind={pluralToKind} rule={rule} />
                    </Td>
                    <Td dataLabel={t('Verbs')}>
                      <Flex flexWrap={{ default: 'wrap' }} spaceItems={{ default: 'spaceItemsXs' }}>
                        {rule.verbs.map((verb) => (
                          <FlexItem key={verb}>
                            <Label color={isMutatingVerb(verb) ? 'orange' : 'grey'} isCompact>
                              {verb}
                            </Label>
                          </FlexItem>
                        ))}
                      </Flex>
                    </Td>
                    <Td dataLabel={t('Purpose')}>
                      {rule.justification}{' '}
                      {hasWriteVerb(rule) && (
                        <Label color="orange" isCompact>
                          {t('write')}
                        </Label>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </ExpandableSection>
        </FlexItem>
      </Flex>
    </FlexItem>
  );
};
