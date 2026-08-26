export type TriggerEventType =
  | 'version.approved'
  | 'version.rejected'
  | 'shot.status_changed'
  | 'task.status_changed'
  | 'task.assigned'
  | 'delivery.created'
  | 'review.completed'
  | 'render.failed'
  | 'asset.published'
  | 'timelog.threshold_exceeded'
  | 'schedule.cron';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'in_list';

export interface AutomationCondition {
  id: string;
  field: string; // e.g. 'project_code', 'department', 'priority', 'status', 'client_tier'
  operator: ConditionOperator;
  value: string | number | string[];
}

export type ActionType =
  | 'publish_version'
  | 'create_delivery'
  | 'notify_channel'
  | 'update_task_status'
  | 'trigger_webhook'
  | 'log_audit_activity'
  | 'ai_auto_summary'
  | 'assign_person';

export interface AutomationAction {
  id: string;
  type: ActionType;
  name: string;
  params: Record<string, any>;
  continue_on_failure?: boolean;
}

export interface AutomationRunConditionResult {
  field: string;
  expected: any;
  actual: any;
  passed: boolean;
}

export interface AutomationRunActionResult {
  action_id: string;
  action_type: ActionType;
  status: 'success' | 'failed' | 'skipped';
  duration_ms: number;
  message: string;
  output?: Record<string, any>;
}

export interface AutomationRun {
  id: string;
  rule_id: string;
  rule_name: string;
  trigger_event: TriggerEventType;
  triggered_at: string;
  status: 'success' | 'failed' | 'running';
  duration_ms: number;
  context_entity: {
    type: string; // 'version' | 'shot' | 'task' | 'delivery' | 'review'
    id: string;
    code: string;
    project_code: string;
  };
  conditions_evaluated: AutomationRunConditionResult[];
  action_results: AutomationRunActionResult[];
  logs: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_event: TriggerEventType;
  trigger_label: string;
  trigger_config?: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  
  // Execution Stats
  runs_count: number;
  last_run_at?: string;
  last_run_status?: 'success' | 'failed' | 'running';
  
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface AutomationTemplate {
  id: string;
  title: string;
  category: 'production' | 'review' | 'delivery' | 'ai' | 'pipeline';
  description: string;
  trigger_event: TriggerEventType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  icon: string;
  badge: string;
}
