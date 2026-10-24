import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  k8sDelete,
  ListPageBody,
  ListPageFilter,
  ListPageHeader,
  ResourceIcon,
  RowFilter,
  RowProps,
  TableColumn,
  TableData,
  Timestamp,
  useAccessReview,
  useK8sWatchResource,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Content,
  ContentVariants,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Icon,
  Label,
  MenuToggle,
} from '@patternfly/react-core';
import { CogIcon, EllipsisVIcon, SearchIcon } from '@patternfly/react-icons';
import RhUiInformationFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-information-fill-icon';

import {
  AgenticRunCondition,
  AgenticRunK8s,
  canStopRun,
  derivePhaseFromConditions,
  isCancelledByUser,
  isRunStopping,
  LightspeedAgenticRunGVK,
  LightspeedAgenticRunModel,
} from '../../models/agenticrun';
import { useStopRunAccess, useStopRunMutation } from '../../hooks/useStopRun';
import { RUN_LABEL_SOURCE } from '../../constants';
import { compareTokenUsage, formatTokenCell } from '../../utils/token-utils';
import AgenticLayout from '../AgenticLayout';
import { ConfirmationModal } from '../ConfirmationModal';
import PreviewBadge from '../PreviewBadge';
import { StopRunButton } from './StopRunButton';
import { StopRunModal } from './StopRunModal';
import AgenticCapabilitiesToggle from './AgenticCapabilitiesToggle';
import { RunPhaseLabel } from './detail/RunPhaseLabel';

const getTriggerDomain = (obj: AgenticRunK8s): string =>
  obj.metadata?.labels?.[RUN_LABEL_SOURCE] || '';

const getTargetCluster = (obj: AgenticRunK8s): string => obj.spec?.targetCluster?.trim() ?? '';

const RunKebab: React.FC<{
  obj: AgenticRunK8s;
  canDelete: boolean;
  onDelete: (obj: AgenticRunK8s) => void;
}> = ({ obj, canDelete, onDelete }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef) => (
        <MenuToggle
          aria-label={t('Actions for {{name}}', { name: obj.metadata.name })}
          isExpanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          ref={toggleRef}
          variant="plain"
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem
          isDisabled={!canDelete}
          key="delete"
          onClick={() => {
            setIsOpen(false);
            onDelete(obj);
          }}
        >
          {t('Delete')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

const NoRunsMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No runs')}>
      <EmptyStateBody>
        {t('Runs are created by adapters or by user request. No runs have been created yet.')}
      </EmptyStateBody>
    </EmptyState>
  );
};

const FilteredEmptyMsg: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return (
    <EmptyState headingLevel="h2" icon={SearchIcon} titleText={t('No results found')}>
      <EmptyStateBody>
        {t('No runs match the current filters. Try adjusting your filters.')}
      </EmptyStateBody>
    </EmptyState>
  );
};

type RunRowContentProps = RowProps<AgenticRunK8s> & {
  canDelete: boolean;
  onDelete: (obj: AgenticRunK8s) => void;
  onStop: (obj: AgenticRunK8s) => void;
  showTargetCluster: boolean;
};

const RunRowContent: React.FC<RunRowContentProps> = ({
  activeColumnIDs,
  canDelete,
  obj,
  onDelete,
  onStop,
  showTargetCluster,
}) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [canStopAccess, canStopLoading] = useStopRunAccess(obj.metadata.namespace);
  const conditions = obj.status?.conditions as AgenticRunCondition[];
  const phase = derivePhaseFromConditions(conditions);
  const canStopByPhase = canStopRun(obj);
  const stopping = isRunStopping(conditions);
  const stoppedByUser = phase === 'Failed' && !stopping && isCancelledByUser(conditions);
  const triggerDomain = getTriggerDomain(obj);
  const detailPath = `/lightspeed/runs/${obj.metadata.namespace}/${obj.metadata.name}`;

  return (
    <>
      <TableData activeColumnIDs={activeColumnIDs} id="name">
        <ResourceIcon groupVersionKind={LightspeedAgenticRunGVK} />{' '}
        <Link to={detailPath}>{obj.metadata.name}</Link>
      </TableData>
      {showTargetCluster && (
        <TableData activeColumnIDs={activeColumnIDs} id="target-cluster">
          {getTargetCluster(obj) || '-'}
        </TableData>
      )}
      <TableData activeColumnIDs={activeColumnIDs} id="trigger-domain">
        {triggerDomain ? <Label variant="outline">{triggerDomain}</Label> : '-'}
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="phase">
        <RunPhaseLabel phase={phase} stopping={stopping} />
        {stoppedByUser && (
          <>
            <br />
            <Content component={ContentVariants.small}>{t('Stopped by user')}</Content>
          </>
        )}
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="tokens">
        {formatTokenCell(obj)}
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} id="age">
        <Timestamp timestamp={obj.metadata.creationTimestamp} />
      </TableData>
      <TableData activeColumnIDs={activeColumnIDs} className="pf-v6-c-table__action" id="">
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          flexWrap={{ default: 'nowrap' }}
          justifyContent={{ default: 'justifyContentFlexEnd' }}
          spaceItems={{ default: 'spaceItemsSm' }}
        >
          {canStopByPhase && (
            <FlexItem>
              <StopRunButton
                canStop={canStopAccess}
                canStopLoading={canStopLoading}
                isCompact
                onClick={() => {
                  if (canStopAccess && !canStopLoading && canStopByPhase) {
                    onStop(obj);
                  }
                }}
                phase={phase}
              />
            </FlexItem>
          )}
          <FlexItem>
            <RunKebab canDelete={canDelete} obj={obj} onDelete={onDelete} />
          </FlexItem>
        </Flex>
      </TableData>
    </>
  );
};

const RunListPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const navigate = useNavigate();

  const [runs, loaded, loadError] = useK8sWatchResource<AgenticRunK8s[]>({
    groupVersionKind: LightspeedAgenticRunGVK,
    isList: true,
    namespaced: true,
  });

  const [canDelete] = useAccessReview({
    group: LightspeedAgenticRunModel.apiGroup,
    resource: LightspeedAgenticRunModel.plural,
    verb: 'delete',
  });

  const [deleteTarget, setDeleteTarget] = React.useState<AgenticRunK8s | null>(null);
  const [deleteError, setDeleteError] = React.useState('');
  const [deleteInProgress, setDeleteInProgress] = React.useState(false);

  const { clearStopError, stopError, stopInProgress, stopRun } = useStopRunMutation();
  const [stopTarget, setStopTarget] = React.useState<{
    name: string;
    namespace: string;
    uid?: string;
  } | null>(null);
  const currentStopTarget = React.useMemo(() => {
    if (!stopTarget) {
      return undefined;
    }
    const watchedTarget = (runs ?? []).find(
      (run) =>
        run.metadata.name === stopTarget.name &&
        run.metadata.namespace === stopTarget.namespace &&
        run.metadata.uid === stopTarget.uid,
    );
    return watchedTarget && canStopRun(watchedTarget) ? watchedTarget : undefined;
  }, [runs, stopTarget]);

  const openStopModal = React.useCallback(
    (obj: AgenticRunK8s) => {
      clearStopError();
      setStopTarget({
        name: obj.metadata.name,
        namespace: obj.metadata.namespace,
        uid: obj.metadata.uid,
      });
    },
    [clearStopError],
  );

  const handleStop = React.useCallback(async () => {
    if (!currentStopTarget || !canStopRun(currentStopTarget)) {
      return;
    }
    const success = await stopRun(currentStopTarget);
    if (success) {
      setStopTarget(null);
    }
  }, [currentStopTarget, stopRun]);

  React.useEffect(() => {
    if (stopTarget && !currentStopTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStopTarget(null);
      clearStopError();
    }
  }, [clearStopError, currentStopTarget, stopTarget]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleteInProgress(true);
    setDeleteError('');
    try {
      await k8sDelete({ model: LightspeedAgenticRunModel, resource: deleteTarget });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteInProgress(false);
    }
  }, [deleteTarget]);

  // Use the full watch result so filtering cannot hide the column for other runs.
  const showTargetCluster = (runs ?? []).some((run) => getTargetCluster(run) !== '');

  const columns: TableColumn<AgenticRunK8s>[] = React.useMemo(
    () => [
      { id: 'name', sort: 'metadata.name', title: t('Name') },
      ...(showTargetCluster
        ? [
            {
              id: 'target-cluster',
              sort: (data: AgenticRunK8s[], direction: 'asc' | 'desc') =>
                [...data].sort((a, b) => {
                  const cmp = getTargetCluster(a).localeCompare(getTargetCluster(b));
                  return direction === 'desc' ? -cmp : cmp;
                }),
              title: t('Target cluster'),
            },
          ]
        : []),
      {
        id: 'trigger-domain',
        sort: (data, direction) =>
          [...data].sort((a, b) => {
            const cmp = getTriggerDomain(a).localeCompare(getTriggerDomain(b));
            return direction === 'desc' ? -cmp : cmp;
          }),
        title: t('Trigger domain'),
      },
      {
        id: 'phase',
        sort: (data, direction) =>
          [...data].sort((a, b) => {
            const pa = derivePhaseFromConditions(a.status?.conditions as AgenticRunCondition[]);
            const pb = derivePhaseFromConditions(b.status?.conditions as AgenticRunCondition[]);
            const cmp = pa.localeCompare(pb);
            return direction === 'desc' ? -cmp : cmp;
          }),
        title: t('Status'),
      },
      {
        id: 'tokens',
        sort: (data, direction) => compareTokenUsage(data, direction),
        title: t('Tokens (in / out)'),
      },
      { id: 'age', sort: 'metadata.creationTimestamp', title: t('Created') },
      { id: '', props: { className: 'pf-v6-c-table__action' }, title: '' },
    ],
    [showTargetCluster, t],
  );

  const RunRow = React.useCallback<React.FC<RowProps<AgenticRunK8s>>>(
    (props) => (
      <RunRowContent
        {...props}
        canDelete={canDelete}
        onDelete={setDeleteTarget}
        onStop={openStopModal}
        showTargetCluster={showTargetCluster}
      />
    ),
    [canDelete, openStopModal, showTargetCluster],
  );

  const filters: RowFilter<AgenticRunK8s>[] = React.useMemo(() => {
    const domainItems = Array.from(new Set((runs || []).map(getTriggerDomain).filter(Boolean)))
      .sort()
      .map((domain) => ({ id: domain, title: domain }));

    const phaseFilter: RowFilter<AgenticRunK8s> = {
      filter: (filterValue, obj) => {
        const selected = filterValue?.selected || [];
        const phase = derivePhaseFromConditions(obj?.status?.conditions as AgenticRunCondition[]);
        return !selected.length || selected.includes(phase);
      },
      filterGroupName: t('Phase'),
      items: [
        { id: 'Pending', title: t('Pending') },
        { id: 'Analyzing', title: t('Analyzing') },
        { id: 'Proposed', title: t('Proposed') },
        { id: 'Executing', title: t('Executing') },
        { id: 'Verifying', title: t('Verifying') },
        { id: 'Escalating', title: t('Escalating') },
        { id: 'Completed', title: t('Completed') },
        { id: 'Failed', title: t('Failed') },
        { id: 'Denied', title: t('Denied') },
        { id: 'Escalated', title: t('Escalated') },
        { id: 'EmergencyStopped', title: t('Emergency stopped') },
      ],
      reducer: (obj) => derivePhaseFromConditions(obj?.status?.conditions as AgenticRunCondition[]),
      type: 'run-phase',
    };

    const triggerDomainFilter: RowFilter<AgenticRunK8s> = {
      filter: (filterValue, obj) => {
        const selected = filterValue?.selected || [];
        return !selected.length || selected.includes(getTriggerDomain(obj));
      },
      filterGroupName: t('Trigger domain'),
      items: domainItems,
      reducer: getTriggerDomain,
      type: 'trigger-domain',
    };

    return [phaseFilter, triggerDomainFilter];
  }, [runs, t]);

  const [data, filteredData, onFilterChange] = useListPageFilter(runs, filters);

  return (
    <AgenticLayout>
      <ListPageHeader
        badge={<PreviewBadge />}
        helpText={
          <Content component={ContentVariants.small}>
            <Icon status="info">
              <RhUiInformationFillIcon />
            </Icon>{' '}
            {t(
              'The autonomous features of OpenShift Lightspeed use AI technology to generate output. Always review AI-generated content prior to use.',
            )}
          </Content>
        }
        title={t('Agentic runs')}
      >
        <Button
          aria-label={t('Configuration')}
          onClick={() => navigate('/lightspeed/configuration')}
          variant="plain"
        >
          <CogIcon />
        </Button>
      </ListPageHeader>
      <ListPageBody>
        <AgenticCapabilitiesToggle />
        <ListPageFilter
          data={data}
          loaded={loaded}
          onFilterChange={onFilterChange}
          rowFilters={filters}
        />
        <VirtualizedTable<AgenticRunK8s>
          columns={columns}
          data={filteredData}
          EmptyMsg={FilteredEmptyMsg}
          loaded={loaded}
          loadError={loadError}
          NoDataEmptyMsg={NoRunsMsg}
          Row={RunRow}
          unfilteredData={data}
        />
      </ListPageBody>

      <StopRunModal
        error={stopError}
        isExecuting={
          currentStopTarget
            ? derivePhaseFromConditions(
                currentStopTarget.status?.conditions as AgenticRunCondition[],
              ) === 'Executing'
            : false
        }
        isLoading={stopInProgress}
        isOpen={stopTarget !== null && currentStopTarget !== undefined}
        onClose={() => {
          setStopTarget(null);
          clearStopError();
        }}
        onConfirm={handleStop}
        runName={currentStopTarget?.metadata.name}
      />
      <ConfirmationModal
        actionLabel={t('Delete')}
        actionVariant="danger"
        body={t('Are you sure you want to delete this agentic run? This action cannot be undone.')}
        error={deleteError}
        isLoading={deleteInProgress}
        isOpen={deleteTarget !== null}
        onAction={handleDelete}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        title={t('Delete agentic run')}
      />
    </AgenticLayout>
  );
};

export default RunListPage;
