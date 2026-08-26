import { BaseEntity } from '@/types/common';

export type WorkflowNodeType =
  | 'start'
  | 'task'
  | 'approval'
  | 'review'
  | 'publish'
  | 'delivery'
  | 'condition'
  | 'automation'
  | 'end';

export type WorkflowCategory =
  | 'Shot Pipeline'
  | 'Asset Pipeline'
  | 'LookDev Pipeline'
  | 'Editorial Ingest'
  | 'Turnover Delivery'
  | 'Delivery Pipeline'
  | 'Custom DAG';

export interface WorkflowNodeConfig {
  task_type?: string;
  department?: string;
  assigned_role?: string;
  approval_type?: 'supervisor' | 'director' | 'client' | 'lead';
  review_type?: 'screening_room' | 'sync_session' | 'client_review';
  publish_target?: 'usd_layer' | 'hero_asset' | 'plate_ingest' | 'comp_exr';
  delivery_protocol?: 'aspera' | 'signiant' | 's3' | 'internal_san';
  condition_field?: string;
  condition_operator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'all_passed';
  condition_value?: string;
  automation_trigger?: string;
  automation_action?: string;
  automation_target?: string;
  notification_recipients?: string[];
  sla_hours?: number;
  primary_dcc?: string;
  required_inputs?: string[];
  output_artifact?: string;
  auto_trigger_rules?: string[];
  pyblish_checks?: string[];
}

export interface WorkflowNode {
  id: string;
  workflow_id?: string;
  type: WorkflowNodeType;
  title: string;
  description?: string;
  department?: string;
  task_type?: string;
  status_target?: string;
  required_role?: string;
  sla_hours?: number;
  primary_dcc?: string;
  config: WorkflowNodeConfig;
  position: {
    x: number;
    y: number;
  };
  is_valid?: boolean;
  validation_errors?: string[];
}

export type TransitionTriggerEvent =
  | 'status_changed'
  | 'approved'
  | 'rejected'
  | 'qc_passed'
  | 'qc_failed'
  | 'published'
  | 'delivered'
  | 'sla_breached'
  | 'manual'
  | 'condition_true'
  | 'condition_false';

export interface WorkflowTransitionCondition {
  field: string;
  operator: '==' | '!=' | '>=' | '<=' | '>' | '<' | 'in' | 'contains' | 'passed';
  value: any;
  description?: string;
}

export interface WorkflowTransition {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_port?: 'out' | 'true' | 'false' | 'approved' | 'rejected' | 'default';
  target_port?: 'in' | 'default';
  label?: string;
  condition?: WorkflowTransitionCondition;
  trigger_event?: TransitionTriggerEvent;
  is_default?: boolean;
}

export type AutomationTriggerEventType =
  | 'version.approved'
  | 'version.published'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.blocked'
  | 'review.completed'
  | 'qc.passed'
  | 'qc.failed'
  | 'delivery.created'
  | 'delivery.accepted'
  | 'sla.warning';

export type AutomationActionType =
  | 'publish_version'
  | 'notify_producer'
  | 'notify_assignee'
  | 'create_delivery'
  | 'update_project_status'
  | 'update_task_status'
  | 'assign_artist'
  | 'create_review_session'
  | 'dispatch_render_farm'
  | 'trigger_webhook';

export interface AutomationConditionRule {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty';
  value: string;
}

export interface AutomationActionRule {
  id: string;
  type: AutomationActionType;
  label: string;
  order: number;
  parameters: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  workflow_id: string;
  name: string;
  description: string;
  trigger: {
    event: AutomationTriggerEventType;
    entity_type: 'Version' | 'Task' | 'Shot' | 'Asset' | 'Delivery' | 'Review';
    filters?: Record<string, any>;
  };
  conditions: AutomationConditionRule[];
  actions: AutomationActionRule[];
  is_active: boolean;
  required_role: 'Admin' | 'Supervisor' | 'Lead' | 'Artist' | 'Pipeline TD';
  execution_count: number;
  last_triggered_at?: string;
  last_status?: 'success' | 'failed' | 'warning' | 'running';
  created_at: string;
  updated_at: string;
}

export interface AutomationAuditLog {
  id: string;
  rule_id: string;
  rule_name: string;
  workflow_id: string;
  workflow_name: string;
  trigger_event: string;
  entity_type: string;
  entity_id: string;
  entity_code: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  executed_at: string;
  duration_ms: number;
  status: 'success' | 'failed' | 'warning' | 'skipped';
  step_logs: Array<{
    step: string;
    action_type: string;
    status: 'success' | 'failed' | 'warning' | 'skipped' | 'executed' | 'pending';
    message: string;
    duration_ms: number;
    details?: Record<string, any>;
  }>;
  action_logs?: Array<{
    step: string;
    action_type: string;
    status: 'success' | 'failed' | 'warning' | 'skipped' | 'executed' | 'pending';
    message: string;
    duration_ms: number;
    details?: Record<string, any>;
  }>;
}

export interface WorkflowExecutionStats {
  total_runs: number;
  success_rate: number;
  avg_duration_hours: number;
  active_tasks_count: number;
  last_run_status: 'success' | 'warning' | 'failed' | 'idle';
}

export interface Workflow extends BaseEntity {
  id: string;
  code: string;
  name: string;
  project_id: string;
  project_code: string;
  project_name: string;
  department: string;
  category: WorkflowCategory;
  description: string;
  version: string;
  is_active: boolean;
  is_default?: boolean;
  is_archived?: boolean;
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  automation_rules?: AutomationRule[];
  created_by_name: string;
  last_executed_at?: string;
  execution_stats?: WorkflowExecutionStats;
  steps_count?: number;
  automation_triggers_count?: number;
}

export interface WorkflowDryRunStep {
  node_id: string;
  node_title: string;
  node_type: WorkflowNodeType;
  status: 'executed' | 'skipped' | 'failed' | 'pending';
  evaluated_conditions?: Array<{
    expression: string;
    result: boolean;
  }>;
  emitted_actions?: string[];
  duration_ms: number;
  log_message: string;
}

export interface WorkflowDryRunResult {
  workflow_id: string;
  simulation_id: string;
  entity_type: string;
  entity_code: string;
  trigger_event: string;
  executed_at: string;
  overall_status: 'success' | 'failed' | 'warning';
  total_duration_ms: number;
  steps: WorkflowDryRunStep[];
  side_effects: string[];
  audit_entry: AutomationAuditLog;
}
