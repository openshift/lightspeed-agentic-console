import { AgentAction, AgenticRunPhase, AgentRbac } from './agenticrun';

export type { AgenticRunPhase } from './agenticrun';

export const TERMINAL_PHASES: AgenticRunPhase[] = [
  'Completed',
  'Failed',
  'Denied',
  'EmergencyStopped',
  'Escalated',
];

export interface RootCauseView {
  cause: string;
  detail: string;
}

export interface VerificationStepView {
  name: string;
  command?: string;
  expected?: string;
  type?: string;
}

export interface RemediationOptionView {
  index: number;
  title: string;
  description: string;
  reversibility?: string;
  estimatedImpact?: string;
  actions?: AgentAction[];
  rollbackDescription?: string;
  rollbackCommand?: string;
  verificationDescription?: string;
  verificationSteps?: VerificationStepView[];
  cause: string;
  detail: string;
  rbac?: AgentRbac;
}

export interface TimelineEvent {
  label: string;
  description?: string;
  timestamp?: string;
  variant: 'success' | 'info' | 'pending' | 'warning' | 'danger' | 'default';
  isCurrent?: boolean;
}

export interface ExecutionActionView {
  type: string;
  description: string;
  outcome: string;
  output?: string;
  error?: string;
}

export interface SandboxView {
  podName: string;
  namespace: string;
}

export interface VerificationCheckView {
  name: string;
  result: string;
  source: string;
  value: string;
}

export interface VerificationView {
  summary?: string;
  checks: VerificationCheckView[];
  failureReason?: string;
  verificationSandbox?: SandboxView;
  verificationStartedAt?: string;
}

export interface ExecutionRecordView {
  approvedAt?: string;
  approverUsername?: string;
  selectedOption?: string;
}

export interface ExecutionView {
  originalRootCause: string;
  remediationDelta: string;
  outcome: string;
  actions: ExecutionActionView[];
  executionRecord?: ExecutionRecordView;
  executionSandbox?: SandboxView;
  executionStartedAt?: string;
}

export interface EscalationView {
  summary?: string;
  content?: string;
  failureReason?: string;
  escalationSandbox?: SandboxView;
  escalationStartedAt?: string;
}

export interface AgenticRunView {
  phase: AgenticRunPhase;
  stopping?: boolean;
  stopPending?: boolean;
  sandboxShutdownPending?: boolean;
  request: string;
  source?: string;
  advisory?: boolean;
  noActionRequired?: boolean;
  targetCluster?: string;
  failureReason?: string;
  rootCause?: RootCauseView;
  analysisCreatedAt?: string;
  analysisStartedAt?: string;
  analysisSandbox?: SandboxView;
  executionStartedAt?: string;
  executionSandbox?: SandboxView;
  verificationStartedAt?: string;
  verificationSandbox?: SandboxView;
  escalationStartedAt?: string;
  escalationSandbox?: SandboxView;
  executedOptionIndex?: number;
  options: RemediationOptionView[];
  execution?: ExecutionView;
  verification?: VerificationView;
  escalation?: EscalationView;
  timeline: TimelineEvent[];
}
