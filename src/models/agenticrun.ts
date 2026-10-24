// TODO: Auto-generate these types from the CRD OpenAPI schema using
// openapi-typescript against the cluster's /openapi/v3/apis/agentic.openshift.io/v1alpha1
// endpoint, or from the CRD YAML files in lightspeed-operator/config/crd/bases/.
import { K8sModel, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

export const LightspeedAgenticRunModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AgenticRun',
  plural: 'agenticruns',
  abbr: 'AGR',
  namespaced: true,
  label: 'AgenticRun',
  labelPlural: 'AgenticRuns',
};

export const LightspeedAgenticRunGVK = {
  group: LightspeedAgenticRunModel.apiGroup,
  kind: LightspeedAgenticRunModel.kind,
  version: LightspeedAgenticRunModel.apiVersion,
};

export const LightspeedApprovalPolicyModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ApprovalPolicy',
  plural: 'approvalpolicies',
  abbr: 'LAP',
  namespaced: false,
  label: 'ApprovalPolicy',
  labelPlural: 'ApprovalPolicies',
};

export const LightspeedApprovalPolicyGVK = {
  group: LightspeedApprovalPolicyModel.apiGroup,
  kind: LightspeedApprovalPolicyModel.kind,
  version: LightspeedApprovalPolicyModel.apiVersion,
};

export const LightspeedAgenticRunApprovalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AgenticRunApproval',
  plural: 'agenticrunapprovals',
  abbr: 'AGRA',
  namespaced: true,
  label: 'AgenticRunApproval',
  labelPlural: 'AgenticRunApprovals',
};

export const LightspeedAgenticRunApprovalGVK = {
  group: LightspeedAgenticRunApprovalModel.apiGroup,
  kind: LightspeedAgenticRunApprovalModel.kind,
  version: LightspeedAgenticRunApprovalModel.apiVersion,
};

export const AnalysisResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AnalysisResult',
  plural: 'analysisresults',
  abbr: 'AR',
  namespaced: true,
  label: 'AnalysisResult',
  labelPlural: 'AnalysisResults',
};

export const AnalysisResultGVK = {
  group: AnalysisResultModel.apiGroup,
  kind: AnalysisResultModel.kind,
  version: AnalysisResultModel.apiVersion,
};

export const ExecutionResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ExecutionResult',
  plural: 'executionresults',
  abbr: 'ER',
  namespaced: true,
  label: 'ExecutionResult',
  labelPlural: 'ExecutionResults',
};

export const ExecutionResultGVK = {
  group: ExecutionResultModel.apiGroup,
  kind: ExecutionResultModel.kind,
  version: ExecutionResultModel.apiVersion,
};

export const VerificationResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'VerificationResult',
  plural: 'verificationresults',
  abbr: 'VR',
  namespaced: true,
  label: 'VerificationResult',
  labelPlural: 'VerificationResults',
};

export const VerificationResultGVK = {
  group: VerificationResultModel.apiGroup,
  kind: VerificationResultModel.kind,
  version: VerificationResultModel.apiVersion,
};

export const EscalationResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'EscalationResult',
  plural: 'escalationresults',
  abbr: 'ESR',
  namespaced: true,
  label: 'EscalationResult',
  labelPlural: 'EscalationResults',
};

export const EscalationResultGVK = {
  group: EscalationResultModel.apiGroup,
  kind: EscalationResultModel.kind,
  version: EscalationResultModel.apiVersion,
};

export const AgenticOLSConfigModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AgenticOLSConfig',
  plural: 'agenticolsconfigs',
  abbr: 'AOC',
  namespaced: false,
  label: 'AgenticOLSConfig',
  labelPlural: 'AgenticOLSConfigs',
};

export const AgenticOLSConfigGVK = {
  group: AgenticOLSConfigModel.apiGroup,
  kind: AgenticOLSConfigModel.kind,
  version: AgenticOLSConfigModel.apiVersion,
};

export type AgenticOLSConfig = {
  apiVersion: string;
  kind: string;
  metadata: { name: string };
  spec?: { suspended?: boolean };
};

// AgenticRunApproval types

export type ApprovalStageType = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

export type AnalysisApproval = {
  agent?: string;
};

export type ExecutionApproval = {
  agent?: string;
  option?: number;
};

export type VerificationApproval = {
  agent?: string;
};

export type EscalationApproval = {
  agent?: string;
};

export type ApprovalStage = {
  type: ApprovalStageType;
  decision?: 'Approved' | 'Denied';
  analysis?: AnalysisApproval;
  execution?: ExecutionApproval;
  verification?: VerificationApproval;
  escalation?: EscalationApproval;
};

export type ApprovalStageStatus = {
  name: string;
  conditions?: AgenticRunCondition[];
};

export type ApproverInfo = {
  username?: string;
  uid?: string;
  approvedAt?: string;
};

export type AgenticRunApprovalSpec = {
  approver?: ApproverInfo;
  stages?: ApprovalStage[];
};

export type AgenticRunApprovalStatus = {
  stages?: ApprovalStageStatus[];
};

export type LightspeedAgenticRunApproval = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    ownerReferences?: Array<{
      apiVersion: string;
      kind: string;
      name: string;
      uid: string;
    }>;
  };
  spec?: AgenticRunApprovalSpec;
  status?: AgenticRunApprovalStatus;
};

export type AgenticRunPhase =
  | 'Pending'
  | 'Analyzing'
  | 'Proposed'
  | 'Executing'
  | 'Verifying'
  | 'Escalating'
  | 'Completed'
  | 'Failed'
  | 'Denied'
  | 'Escalated'
  | 'EmergencyStopped';

export type StepPhase = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';

export type SandboxInfo = {
  claimName?: string;
  namespace?: string;
};

export type AgenticRunCondition = {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
  observedGeneration?: number;
};

export type StepResultRef = {
  name: string;
  outcome: 'Succeeded' | 'Failed';
};

export type SkillsSource = {
  image: string;
  paths?: string[];
};

export type SecretMountSpec = {
  type: 'EnvVar' | 'FilePath';
  envVar?: { name: string };
  filePath?: { path: string };
};

export type SecretRequirement = {
  name: string;
  description?: string;
  mountAs: SecretMountSpec;
};

export type MCPHeaderConfig = {
  name: string;
  valueFrom?: {
    type: 'Secret' | 'ServiceAccountToken';
    secret?: { name: string };
  };
};

export type MCPServerConfig = {
  name: string;
  url: string;
  timeoutSeconds?: number;
  headers?: MCPHeaderConfig[];
};

export type ToolsSpec = {
  skills?: SkillsSource[];
  requiredSecrets?: SecretRequirement[];
  mcpServers?: MCPServerConfig[];
};

export type AgenticRunStep = {
  agent?: string;
  tools?: ToolsSpec;
};

// Agent structured response types (used by step status and StructuredProposal component)

export type AgentDiagnosis = {
  summary: string;
  rootCause: string;
};

export type AgentAction = {
  command?: string;
  type: string;
  description: string;
};

export type AgentRemediationPlan = {
  description: string;
  actions: AgentAction[];
  reversible?: 'Reversible' | 'Irreversible' | 'Partial';
  estimatedImpact: string;
  rollbackPlan?: AgentRollbackPlan;
};

export type VerificationStep = {
  name: string;
  command?: string;
  expected?: string;
  type: string;
};

export type AgentRollbackPlan = {
  description: string;
  command?: string;
};

export type AgentVerification = {
  description: string;
  steps?: VerificationStep[];
};

export type PermissionRule = {
  namespace?: string;
  apiGroups: string[];
  resources: string[];
  resourceNames?: string[];
  verbs: string[];
  justification: string;
};

export type AgentRbac = {
  namespaceScoped?: PermissionRule[];
  clusterScoped?: PermissionRule[];
};

export type RemediationOption = {
  title: string;
  summary?: string;
  diagnosis?: AgentDiagnosis;
  remediationPlan?: AgentRemediationPlan;
  verification?: AgentVerification;
  rbac?: AgentRbac;
  components?: unknown;
};

// Step status types — typed fields on status.steps

export type AnalysisStepStatus = {
  phase?: StepPhase;
  sandbox?: SandboxInfo;
  conditions?: AgenticRunCondition[];
  results?: StepResultRef[];
};

export type ExecutionActionTaken = {
  type: string;
  description: string;
  resource?: { apiVersion: string; kind: string; name: string; namespace?: string };
  outcome: 'Succeeded' | 'Failed';
  output?: string;
  error?: string;
};

export type ExecutionVerification = {
  conditionOutcome: 'Improved' | 'Unchanged' | 'Degraded';
  summary: string;
};

export type ExecutionStepStatus = {
  phase?: StepPhase;
  sandbox?: SandboxInfo;
  conditions?: AgenticRunCondition[];
  results?: StepResultRef[];
};

export type VerificationCheck = {
  name: string;
  source: string;
  value: string;
  result: 'Passed' | 'Failed';
};

export type VerificationStepStatus = {
  phase?: StepPhase;
  sandbox?: SandboxInfo;
  conditions?: AgenticRunCondition[];
  results?: StepResultRef[];
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type AgenticRunStatus = {
  conditions?: AgenticRunCondition[];
  steps?: StepsStatus;
  tokenUsage?: TokenUsage;
};

export type EscalationStepStatus = {
  sandbox?: SandboxInfo;
  conditions?: AgenticRunCondition[];
  results?: StepResultRef[];
};

export type StepsStatus = {
  analysis?: AnalysisStepStatus;
  execution?: ExecutionStepStatus;
  verification?: VerificationStepStatus;
  escalation?: EscalationStepStatus;
};

// Main CRD type

export type LightspeedAgenticRun = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp?: string;
    generation?: number;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    uid?: string;
  };
  spec: {
    request: string;
    targetCluster?: string;
    analysisOutput?: {
      mode?: 'Default' | 'Minimal';
      schema?: unknown;
    };
    tools?: ToolsSpec;
    analysis?: AgenticRunStep;
    execution?: AgenticRunStep;
    verification?: AgenticRunStep;
    revisionFeedback?: string;
    cancelled?: boolean;
  };
  status?: AgenticRunStatus;
};

// Result CR types — separate CRDs that hold step output data

export type ResultCondition = {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: string;
  reason?: string;
  message?: string;
};

export type AnalysisResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    agenticRunName: string;
  };
  status?: {
    conditions?: ResultCondition[];
    options?: RemediationOption[];
    diagnosis?: AgentDiagnosis;
    sandbox?: SandboxInfo;
    failureReason?: string;
  };
};

export type ExecutionResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    agenticRunName: string;
  };
  status?: {
    conditions?: ResultCondition[];
    actionsTaken?: ExecutionActionTaken[];
    verification?: ExecutionVerification;
    sandbox?: SandboxInfo;
    failureReason?: string;
  };
};

export type VerificationResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    agenticRunName: string;
  };
  status?: {
    conditions?: ResultCondition[];
    checks?: VerificationCheck[];
    summary?: string;
    sandbox?: SandboxInfo;
    failureReason?: string;
  };
};

export type EscalationResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    agenticRunName: string;
  };
  status?: {
    conditions?: ResultCondition[];
    summary?: string;
    content?: string;
    sandbox?: SandboxInfo;
    failureReason?: string;
  };
};

// Display helpers

export type PhaseDisplay = {
  color: 'blue' | 'green' | 'grey' | 'orange' | 'red' | 'teal';
  label: string;
};

export const getPhaseDisplay = (phase?: AgenticRunPhase | string): PhaseDisplay => {
  switch (phase) {
    case 'Analyzing':
      return { color: 'blue', label: 'Analyzing' };
    case 'Completed':
      return { color: 'green', label: 'Completed' };
    case 'Denied':
      return { color: 'red', label: 'Denied' };
    case 'EmergencyStopped':
      return { color: 'red', label: 'Emergency stopped' };
    case 'Escalated':
      return { color: 'orange', label: 'Escalated' };
    case 'Escalating':
      return { color: 'orange', label: 'Escalating' };
    case 'Executing':
      return { color: 'teal', label: 'Executing' };
    case 'Failed':
      return { color: 'red', label: 'Failed' };
    case 'Pending':
      return { color: 'grey', label: 'Pending' };
    case 'Proposed':
      return { color: 'blue', label: 'Proposed' };
    case 'Verifying':
      return { color: 'teal', label: 'Verifying' };
    default:
      return { color: 'grey', label: phase || 'Unknown' };
  }
};

// SYNC: must match DerivePhase in lightspeed-agentic-operator/api/v1alpha1/agenticrun_types.go
export const derivePhaseFromConditions = (conditions?: AgenticRunCondition[]): AgenticRunPhase => {
  if (!conditions?.length) {
    return 'Pending';
  }

  const get = (type: string) => conditions.find((c) => c.type === type);

  const emergencyStopped = get('EmergencyStopped');
  if (emergencyStopped?.status === 'True') {
    return 'EmergencyStopped';
  }

  const escalated = get('Escalated');
  if (escalated?.status === 'True') {
    return 'Escalated';
  }

  const denied = get('Denied');
  if (denied?.status === 'True') {
    return 'Denied';
  }

  if (escalated) {
    if (escalated.status === 'Unknown') {
      return 'Escalating';
    }
    return 'Failed';
  }

  const verified = get('Verified');
  if (verified) {
    if (verified.status === 'True') {
      return 'Completed';
    }
    if (verified.status === 'Unknown') {
      return 'Verifying';
    }
    // Verified=False maps to Failed. When the operator escalates on
    // verification failure it sets the Escalated condition, which is checked
    // above and takes precedence over this branch.
    return 'Failed';
  }

  const executed = get('Executed');
  if (executed) {
    if (executed.status === 'True') {
      return 'Verifying';
    }
    if (executed.status === 'Unknown') {
      return 'Executing';
    }
    return 'Failed';
  }

  const analyzed = get('Analyzed');
  if (analyzed) {
    if (analyzed.status === 'True') {
      if (analyzed.reason === 'NoActionRequired') {
        return 'Completed';
      }
      return 'Proposed';
    }
    if (analyzed.status === 'Unknown') {
      return 'Analyzing';
    }
    return 'Failed';
  }

  return 'Pending';
};

export const isNoActionRequired = (conditions?: AgenticRunCondition[]): boolean => {
  const analyzed = conditions?.find((c) => c.type === 'Analyzed');
  return analyzed?.status === 'True' && analyzed.reason === 'NoActionRequired';
};

export const isRunStopping = (conditions?: AgenticRunCondition[]): boolean =>
  conditions?.some((condition) => condition.type === 'Stopping' && condition.status === 'True') ??
  false;

export const isRunStopPending = (run?: LightspeedAgenticRun): boolean =>
  run?.spec?.cancelled === true || isRunStopping(run?.status?.conditions);

export const canStopRun = (run?: LightspeedAgenticRun): boolean => {
  if (!run || isRunStopPending(run)) {
    return false;
  }

  switch (derivePhaseFromConditions(run.status?.conditions)) {
    case 'Analyzing':
    case 'Executing':
    case 'Verifying':
    case 'Escalating':
      return true;
    default:
      return false;
  }
};

const FAILURE_CONDITION_PRECEDENCE = ['Escalated', 'Verified', 'Executed', 'Analyzed'] as const;

// Returns the effective failing condition using the same precedence as phase derivation.
const getEffectiveFailureCondition = (
  conditions?: AgenticRunCondition[],
): AgenticRunCondition | undefined => {
  if (!conditions?.length) {
    return undefined;
  }

  for (const type of FAILURE_CONDITION_PRECEDENCE) {
    const condition = conditions.find((candidate) => candidate.type === type);
    if (condition?.status === 'False') {
      return condition;
    }
  }
  return undefined;
};

// Checks only the effective failure reason; callers gate it on the derived Failed phase.
export const isCancelledByUser = (conditions?: AgenticRunCondition[]): boolean =>
  getEffectiveFailureCondition(conditions)?.reason === 'CancelledByUser';

// Returns a human-readable reason for a Failed run. Callers gate this on the derived phase.
export const deriveFailureReason = (conditions?: AgenticRunCondition[]): string | undefined => {
  const failed = getEffectiveFailureCondition(conditions);
  if (!failed) {
    return undefined;
  }
  if (failed.reason && failed.message) {
    return `${failed.reason}: ${failed.message}`;
  }
  return failed.message ?? failed.reason;
};

export type ApprovalMode = 'Automatic' | 'Manual';

export type SandboxStepName = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

export type ApprovalPolicyStage = {
  name: SandboxStepName;
  approval: ApprovalMode;
};

export type ApprovalPolicySpec = {
  stages?: ApprovalPolicyStage[];
  maxConcurrentAgenticRuns?: number;
};

export type ApprovalPolicyResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    creationTimestamp?: string;
    uid?: string;
    resourceVersion?: string;
  };
  spec: ApprovalPolicySpec;
};

export type ApprovalPolicyK8s = ApprovalPolicyResource & K8sResourceCommon;
export type AgenticRunK8s = LightspeedAgenticRun & K8sResourceCommon;
export type AgenticRunApprovalK8s = LightspeedAgenticRunApproval & K8sResourceCommon;
export type AnalysisResultK8s = AnalysisResultCR & K8sResourceCommon;
export type ExecutionResultK8s = ExecutionResultCR & K8sResourceCommon;
export type VerificationResultK8s = VerificationResultCR & K8sResourceCommon;
export type EscalationResultK8s = EscalationResultCR & K8sResourceCommon;
