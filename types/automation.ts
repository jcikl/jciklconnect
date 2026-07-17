export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  executions: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowExecution {
  id?: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'failed' | 'running' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition';
  triggerData?: Record<string, any>;
  nodeExecutions: WorkflowNodeExecution[];
  executedSteps: WorkflowExecutionStep[];
  error?: {
    message: string;
    stepId?: string;
    stepType?: string;
    stack?: string;
  };
  context?: Record<string, any>;
  createdAt?: string;
}

export interface WorkflowExecutionStep {
  stepId: string;
  stepType: string;
  stepOrder: number;
  status: 'pending' | 'running' | 'completed' | 'success' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  output?: Record<string, any>;
}

export interface WorkflowNodeExecution {
  id?: string;
  nodeId: string;
  nodeType: string;
  status: 'success' | 'failed' | 'running' | 'pending' | 'skipped' | 'completed';
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
}

export type WorkflowNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'delay'
  | 'email'
  | 'notification'
  | 'data_update'
  | 'task_create'
  | 'webhook'
  | 'approval'
  | 'loop'
  | 'end';

export type WorkflowNodeCategory =
  | 'triggers'
  | 'actions'
  | 'logic'
  | 'communication'
  | 'data'
  | 'integrations'
  | 'utilities';

export interface WorkflowNodeInput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
}

export interface WorkflowNodeOutput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  category: WorkflowNodeCategory;
  icon: string;
  configSchema?: Record<string, any>;
  inputs?: WorkflowNodeInput[];
  outputs?: WorkflowNodeOutput[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: WorkflowCondition;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  connections: WorkflowConnection[];
  status?: 'idle' | 'running' | 'completed' | 'error';
  config?: Record<string, any>;
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'webhook' | 'data_change';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: WorkflowTrigger[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  executionCount: number;
  tags?: string[];
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'in' | 'not_in';
  value: any;
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  id: string;
  type: 'send_email' | 'send_notification' | 'update_field' | 'update_member' | 'create_task' | 'award_points' | 'award_badge' | 'trigger_workflow' | 'webhook' | 'send_webhook' | 'log_event';
  config: Record<string, any>;
  enabled?: boolean;
  order?: number;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  logicalOperator?: 'AND' | 'OR';
  enabled: boolean;
  priority: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lastExecuted?: string;
  executionCount?: number;
  tags?: string[];
}

export interface RuleConditionResult {
  conditionId: string;
  result: boolean;
  actualValue: any;
  expectedValue: any;
  operator: string;
}

export interface RuleActionResult {
  actionId: string;
  status: 'success' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration: number;
}

export interface RuleExecution {
  id: string;
  ruleId: string;
  status: 'success' | 'failed' | 'partial';
  executedAt: string;
  triggeredBy: string;
  triggerData: Record<string, any>;
  conditionsEvaluated: RuleConditionResult[];
  actionsExecuted: RuleActionResult[];
  duration: number;
  error?: string;
}
