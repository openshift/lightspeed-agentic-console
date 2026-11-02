import type { useTranslation } from 'react-i18next';

export type TFunction = ReturnType<typeof useTranslation>[0];

export const buildPodLogUrl = (
  namespace: string,
  podName: string,
  params: Record<string, string>,
): string => {
  const qs = new URLSearchParams(params);
  return (
    `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}` +
    `/pods/${encodeURIComponent(podName)}/log?${qs.toString()}`
  );
};

export const getOutcomeStatus = (outcome: string): 'success' | 'danger' | 'warning' => {
  switch (outcome) {
    case 'Succeeded':
    case 'Improved':
    case 'Unchanged':
      return 'success';
    case 'Failed':
    case 'Degraded':
      return 'danger';
    default:
      return 'warning';
  }
};

export const getReversibilityColor = (
  reversibility: string,
): 'green' | 'orange' | 'yellow' | 'grey' => {
  switch (reversibility) {
    case 'Reversible':
      return 'green';
    case 'Irreversible':
      return 'orange';
    case 'Partial':
      return 'yellow';
    default:
      return 'grey';
  }
};

export const getReversibilityText = (reversibility: string, t: TFunction): string => {
  switch (reversibility) {
    case 'Reversible':
      return t('Reversible');
    case 'Irreversible':
      return t('Irreversible');
    case 'Partial':
      return t('Partially reversible');
    default:
      return '';
  }
};

export const getReversibilityDescription = (reversibility: string, t: TFunction): string => {
  switch (reversibility) {
    case 'Irreversible':
      return t(
        'You will not be able to roll back or automatically undo this remediation once execution begins. Ensure you have taken a full cluster backup if required.',
      );
    case 'Partial':
      return t(
        'You will be able to partially roll back this remediation once execution begins. Ensure you have taken a full cluster backup if required.',
      );
    default:
      return '';
  }
};

export const getStageLabel = (stageType: string, t: TFunction): string => {
  switch (stageType) {
    case 'Analysis':
      return t('Analysis');
    case 'Execution':
      return t('Execution');
    case 'Verification':
      return t('Verification');
    case 'Escalation':
      return t('Escalation');
    default:
      return stageType;
  }
};
