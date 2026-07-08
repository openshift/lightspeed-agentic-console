// TODO: Auto-generate these types from the CRD OpenAPI schema using
// openapi-typescript against the cluster's /openapi/v3/apis/agentic.openshift.io/v1alpha1
// endpoint, or from the CRD YAML files in lightspeed-operator/config/crd/bases/.
import { K8sModel, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

export const LightspeedProposalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'Proposal',
  plural: 'proposals',
  abbr: 'LSP',
  namespaced: true,
  label: 'Proposal',
  labelPlural: 'Proposals',
};

export const LightspeedProposalGVK = {
  group: LightspeedProposalModel.apiGroup,
  kind: LightspeedProposalModel.kind,
  version: LightspeedProposalModel.apiVersion,
};

export const LightspeedAgentModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'Agent',
  plural: 'agents',
  abbr: 'LSA',
  namespaced: false,
  label: 'Agent',
  labelPlural: 'Agents',
};

export const LightspeedAgentGVK = {
  group: LightspeedAgentModel.apiGroup,
  kind: LightspeedAgentModel.kind,
  version: LightspeedAgentModel.apiVersion,
};

export const LightspeedLLMProviderModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'LLMProvider',
  plural: 'llmproviders',
  abbr: 'LLP',
  namespaced: false,
  label: 'LLM Provider',
  labelPlural: 'LLM Providers',
};

export const LightspeedLLMProviderGVK = {
  group: LightspeedLLMProviderModel.apiGroup,
  kind: LightspeedLLMProviderModel.kind,
  version: LightspeedLLMProviderModel.apiVersion,
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

export const LightspeedProposalApprovalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ProposalApproval',
  plural: 'proposalapprovals',
  abbr: 'LSPA',
  namespaced: true,
  label: 'ProposalApproval',
  labelPlural: 'ProposalApprovals',
};

export const LightspeedProposalApprovalGVK = {
  group: LightspeedProposalApprovalModel.apiGroup,
  kind: LightspeedProposalApprovalModel.kind,
  version: LightspeedProposalApprovalModel.apiVersion,
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

// ProposalApproval types

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
  conditions?: ProposalCondition[];
};

export type ApproverInfo = {
  username?: string;
  uid?: string;
  approvedAt?: string;
};

export type ProposalApprovalSpec = {
  approver?: ApproverInfo;
  stages?: ApprovalStage[];
};

export type ProposalApprovalStatus = {
  stages?: ApprovalStageStatus[];
};

export type LightspeedProposalApproval = {
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
  spec?: ProposalApprovalSpec;
  status?: ProposalApprovalStatus;
};

export type ProposalPhase =
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

export type ProposalCondition = {
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

export type ProposalStep = {
  agent?: string;
  tools?: ToolsSpec;
};

// Agent structured response types (used by step status and StructuredProposal component)

export type AgentDiagnosis = {
  summary: string;
  confidence: 'Low' | 'Medium' | 'High';
  rootCause: string;
};

export type AgentAction = {
  command?: string;
  type: string;
  description: string;
};

export type AgentProposal = {
  description: string;
  actions: AgentAction[];
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
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
  namespaceScoped: PermissionRule[];
  clusterScoped: PermissionRule[];
};

export type RemediationOption = {
  title: string;
  summary?: string;
  diagnosis?: AgentDiagnosis;
  proposal?: AgentProposal;
  verification?: AgentVerification;
  rbac?: AgentRbac;
  components?: unknown;
};

// Step status types — typed fields on status.steps

export type AnalysisStepStatus = {
  phase?: StepPhase;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
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
  retryCount?: number;
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
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
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type ProposalStatus = {
  steps?: StepsStatus;
  conditions?: ProposalCondition[];
};

export type EscalationStepStatus = {
  sandbox?: SandboxInfo;
  conditions?: ProposalCondition[];
  results?: StepResultRef[];
};

export type StepsStatus = {
  analysis?: AnalysisStepStatus;
  execution?: ExecutionStepStatus;
  verification?: VerificationStepStatus;
  escalation?: EscalationStepStatus;
};

// Main CRD type

export type LightspeedProposal = {
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
    targetNamespaces?: string[];
    analysisOutput?: {
      mode?: 'Default' | 'Minimal';
      schema?: unknown;
    };
    tools?: ToolsSpec;
    analysis?: ProposalStep;
    execution?: ProposalStep;
    verification?: ProposalStep;
    revisionFeedback?: string;
  };
  status?: ProposalStatus;
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
    proposalName: string;
  };
  status?: {
    conditions?: ResultCondition[];
    options?: RemediationOption[];
    sandbox?: SandboxInfo;
    failureReason?: string;
  };
};

export type ExecutionResultCR = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    proposalName: string;
    retryIndex?: number;
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
    proposalName: string;
    retryIndex?: number;
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
    proposalName: string;
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
  color: 'grey' | 'blue' | 'teal' | 'orange' | 'purple' | 'green' | 'red' | 'orangered';
  label: string;
};

export const getPhaseDisplay = (phase?: ProposalPhase | string): PhaseDisplay => {
  switch (phase) {
    case 'Pending':
      return { color: 'grey', label: 'Pending' };
    case 'Analyzing':
      return { color: 'blue', label: 'Analyzing' };
    case 'Proposed':
      return { color: 'teal', label: 'Proposed' };
    case 'Executing':
      return { color: 'purple', label: 'Executing' };
    case 'Verifying':
      return { color: 'orange', label: 'Verifying' };
    case 'Escalating':
      return { color: 'orange', label: 'Escalating' };
    case 'Completed':
      return { color: 'green', label: 'Completed' };
    case 'Failed':
      return { color: 'red', label: 'Failed' };
    case 'Denied':
      return { color: 'red', label: 'Denied' };
    case 'Escalated':
      return { color: 'orangered', label: 'Escalated' };
    case 'EmergencyStopped':
      return { color: 'purple', label: 'Emergency Stopped' };
    default:
      return { color: 'grey', label: phase || 'Unknown' };
  }
};

// SYNC: must match DerivePhase in lightspeed-agentic-operator/api/v1alpha1/proposal_types.go
export const derivePhaseFromConditions = (conditions?: ProposalCondition[]): ProposalPhase => {
  if (!conditions?.length) return 'Pending';

  const get = (type: string) => conditions.find((c) => c.type === type);

  const emergencyStopped = get('EmergencyStopped');
  if (emergencyStopped?.status === 'True') return 'EmergencyStopped';

  const escalated = get('Escalated');
  if (escalated?.status === 'True') return 'Escalated';

  const denied = get('Denied');
  if (denied?.status === 'True') return 'Denied';

  if (escalated) {
    if (escalated.status === 'Unknown') return 'Escalating';
    return 'Failed';
  }

  const verified = get('Verified');
  if (verified) {
    if (verified.status === 'True') return 'Completed';
    if (verified.status === 'Unknown') return 'Verifying';
    switch (verified.reason) {
      case 'RetryingExecution':
        return 'Executing';
      default:
        return 'Failed';
    }
  }

  const executed = get('Executed');
  if (executed) {
    if (executed.status === 'True') return 'Verifying';
    if (executed.status === 'Unknown') return 'Executing';
    return 'Failed';
  }

  const analyzed = get('Analyzed');
  if (analyzed) {
    if (analyzed.status === 'True') return 'Proposed';
    if (analyzed.status === 'Unknown') return 'Analyzing';
    return 'Failed';
  }

  return 'Pending';
};

export const getRiskColor = (risk?: string): 'green' | 'orange' | 'red' | 'grey' => {
  switch (risk) {
    case 'Low':
      return 'green';
    case 'Medium':
      return 'orange';
    case 'High':
    case 'Critical':
      return 'red';
    default:
      return 'grey';
  }
};

export type LLMProviderType =
  | 'Anthropic'
  | 'GoogleCloudVertex'
  | 'OpenAI'
  | 'AzureOpenAI'
  | 'AWSBedrock';

export type SecretRef = {
  name: string;
};

export type AnthropicConfig = {
  credentialsSecret: SecretRef;
  url?: string;
};

export type GoogleCloudVertexConfig = {
  credentialsSecret: SecretRef;
  projectID: string;
  region: string;
  url?: string;
};

export type OpenAIConfig = {
  credentialsSecret: SecretRef;
  url?: string;
};

export type AzureOpenAIConfig = {
  credentialsSecret: SecretRef;
  endpoint: string;
  apiVersion?: string;
  url?: string;
};

export type AWSBedrockConfig = {
  credentialsSecret: SecretRef;
  region: string;
  url?: string;
};

export type LLMProviderSpec = {
  type: LLMProviderType;
  anthropic?: AnthropicConfig;
  googleCloudVertex?: GoogleCloudVertexConfig;
  openAI?: OpenAIConfig;
  azureOpenAI?: AzureOpenAIConfig;
  awsBedrock?: AWSBedrockConfig;
};

export type LLMProviderResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    creationTimestamp?: string;
    uid?: string;
  };
  spec: LLMProviderSpec;
};

export type ApprovalMode = 'Automatic' | 'Manual';

export type SandboxStepName = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

export type ApprovalPolicyStage = {
  name: SandboxStepName;
  approval: ApprovalMode;
};

export type ApprovalPolicySpec = {
  stages?: ApprovalPolicyStage[];
  maxAttempts?: number;
  maxConcurrentProposals?: number;
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

export type AgentTimeouts = {
  analysisSeconds?: number;
  executionSeconds?: number;
  verificationSeconds?: number;
  chatSeconds?: number;
};

export type AgentSpec = {
  llmProvider: { name: string };
  model: string;
  timeouts?: AgentTimeouts;
  maxTurns?: number;
};

export type AgentResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    creationTimestamp?: string;
    uid?: string;
  };
  spec: AgentSpec;
  status?: {
    conditions?: ProposalCondition[];
  };
};

export type LLMProviderK8s = LLMProviderResource & K8sResourceCommon;
export type ApprovalPolicyK8s = ApprovalPolicyResource & K8sResourceCommon;
export type AgentK8s = AgentResource & K8sResourceCommon;
export type ProposalK8s = LightspeedProposal & K8sResourceCommon;
export type ProposalApprovalK8s = LightspeedProposalApproval & K8sResourceCommon;
export type AnalysisResultK8s = AnalysisResultCR & K8sResourceCommon;
export type ExecutionResultK8s = ExecutionResultCR & K8sResourceCommon;
export type VerificationResultK8s = VerificationResultCR & K8sResourceCommon;
