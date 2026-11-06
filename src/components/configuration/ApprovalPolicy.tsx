import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { k8sCreate, k8sPatch, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Button, Spinner, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';

import {
  ApprovalMode,
  ApprovalPolicyK8s,
  ApprovalPolicyStage,
  LightspeedApprovalPolicyGVK,
  LightspeedApprovalPolicyModel,
  SandboxStepName,
} from '../../models/agenticrun';
import { getStageLabel } from '../../utils/agenticrun-utils';
import ExecutionPolicyModal from './ExecutionPolicyModal';

const STAGES: SandboxStepName[] = ['Analysis', 'Execution', 'Verification', 'Escalation'];

const getStageApproval = (
  stages: ApprovalPolicyStage[] | undefined,
  name: SandboxStepName,
): ApprovalMode => {
  const found = stages?.find((s) => s.name === name);
  return found?.approval ?? 'Manual';
};

const ApprovalPolicy: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [policy, loaded, loadError] = useK8sWatchResource<ApprovalPolicyK8s>({
    groupVersionKind: LightspeedApprovalPolicyGVK,
    name: 'cluster',
  });

  const policyExists = loaded && !loadError && !!policy?.metadata?.name;

  const [stageValues, setStageValues] = React.useState<Record<SandboxStepName, ApprovalMode>>({
    Analysis: 'Manual',
    Execution: 'Manual',
    Verification: 'Manual',
    Escalation: 'Manual',
  });
  const [isExecutionModalOpen, setIsExecutionModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const policyResourceVersion = policy?.metadata?.resourceVersion;
  React.useEffect(() => {
    if (policyExists) {
      const stages = policy.spec?.stages;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStageValues({
        Analysis: getStageApproval(stages, 'Analysis'),
        Execution: getStageApproval(stages, 'Execution'),
        Verification: getStageApproval(stages, 'Verification'),
        Escalation: getStageApproval(stages, 'Escalation'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyResourceVersion]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const spec = {
      stages: STAGES.map((name) => ({ name, approval: stageValues[name] })),
    };

    try {
      if (policyExists) {
        await k8sPatch({
          model: LightspeedApprovalPolicyModel,
          resource: policy,
          data: [{ op: 'replace', path: '/spec/stages', value: spec.stages }],
        });
      } else {
        await k8sCreate({
          model: LightspeedApprovalPolicyModel,
          data: {
            apiVersion: 'agentic.openshift.io/v1alpha1',
            kind: 'ApprovalPolicy',
            metadata: { name: 'cluster' },
            spec: {
              ...spec,
              maxConcurrentAgenticRuns: 5,
            },
          },
        });
      }
      setSuccess(t('Approval policy saved successfully.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <Spinner size="lg" />;
  }

  return (
    <>
      {error && (
        <Alert isInline title={t('Error saving approval policy')} variant="danger">
          {error}
        </Alert>
      )}
      {success && <Alert isInline title={success} variant="success" />}

      <div className="ols-plugin__config-approval-rows">
        {STAGES.map((stage) => (
          <div
            className="ols-plugin__config-approval-row"
            data-test={`config-approval-row-${stage}`}
            key={stage}
          >
            <span className="ols-plugin__config-approval-label">{getStageLabel(stage, t)}</span>
            <ToggleGroup>
              <ToggleGroupItem
                isSelected={stageValues[stage] === 'Manual'}
                onChange={() => setStageValues((prev) => ({ ...prev, [stage]: 'Manual' }))}
                text={t('Manual')}
              />
              <ToggleGroupItem
                isSelected={stageValues[stage] === 'Automatic'}
                onChange={() => {
                  if (stage === 'Execution' && stageValues[stage] === 'Manual') {
                    setIsExecutionModalOpen(true);
                    return;
                  }
                  setStageValues((prev) => ({ ...prev, [stage]: 'Automatic' }));
                }}
                text={t('Automatic')}
              />
            </ToggleGroup>
          </div>
        ))}
      </div>
      <ExecutionPolicyModal
        isOpen={isExecutionModalOpen}
        onClose={() => {
          setIsExecutionModalOpen(false);
          //Clear focus on the "Automatic" button, so it doesn't look selected
          requestAnimationFrame(() => (document.activeElement as HTMLElement)?.blur());
        }}
        onConfirm={() => {
          setStageValues((prev) => ({ ...prev, Execution: 'Automatic' }));
          setIsExecutionModalOpen(false);
        }}
      />

      <div className="ols-plugin__config-form-actions">
        <Button isDisabled={saving} isLoading={saving} onClick={handleSave} variant="primary">
          {t('Save')}
        </Button>
      </div>
    </>
  );
};

export default ApprovalPolicy;
