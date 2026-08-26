import { BaseEntity, Department, PriorityLevel, ProductionStatus } from '@/types/common';

export type TaskEntityType = 'Shot' | 'Asset' | 'Sequence' | 'General';

export interface TaskDependency {
  task_id: string;
  task_code: string;
  task_title: string;
  dependency_type: 'blocks' | 'blocked_by';
  status: ProductionStatus;
  department: Department;
}

export interface TaskSchedule {
  start_date: string;
  due_date: string;
  estimated_hours: number;
  logged_hours: number;
  progress_percent: number;
  milestone?: string;
  overrun_risk?: boolean;
}

export interface TaskWorkflow {
  stage_name: string;
  step_name: string;
  step_number: number;
  total_steps: number;
  pipeline_template?: string;
}

export interface Task extends BaseEntity {
  title: string;
  code: string;
  project_id: string;
  project_code: string;
  project_name: string;
  entity_type: TaskEntityType;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  department: Department;
  department_id?: string;
  department_code?: string;
  team_id?: string;
  team_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  assignee_role?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_code?: string;
  workflow?: TaskWorkflow;
  status: ProductionStatus;
  priority: PriorityLevel;
  schedule: TaskSchedule;
  dependencies?: {
    upstream_task_ids: string[];
    downstream_task_ids: string[];
  };
  description: string;
  software: string;
  tags?: string[];
  is_archived?: boolean;
  
  // Legacy / Flat helper fields for compatibility
  due_date?: string;
  estimated_hours?: number;
  logged_hours?: number;
}

export type TimelogCategory =
  | 'Direct Work'
  | 'Revisions'
  | 'Dailies / Meetings'
  | 'Pipeline Debug'
  | 'Simulation Run'
  | 'Lighting Setup'
  | 'LookDev Tuning'
  | 'Plate Prep & Clean';

export type TimelogStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export interface Timelog extends BaseEntity {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
  project_name: string;
  person_id: string;
  person_name: string;
  person_avatar?: string;
  person_role?: string;
  department: Department | string;
  duration_hours: number;
  date: string; // YYYY-MM-DD
  billable: boolean;
  notes: string;
  status: TimelogStatus;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  activity_category: TimelogCategory;
  hourly_rate_usd?: number;
}

export interface ActiveTimerState {
  isRunning: boolean;
  activeTaskId: string | null;
  activeTaskCode: string | null;
  activeTaskTitle: string | null;
  activeProjectId: string | null;
  activeProjectCode: string | null;
  activeProjectName: string | null;
  department?: string;
  startTime: number | null;
  elapsedSeconds: number;
  isBillable: boolean;
  notes: string;
}

export interface TaskFilterParams {
  search?: string;
  project_id?: string;
  entity_type?: TaskEntityType | 'ALL';
  entity_id?: string;
  department?: string | 'ALL';
  team_id?: string | 'ALL';
  assignee_id?: string | 'ALL';
  vendor_id?: string | 'ALL';
  status?: string | 'ALL';
  priority?: string | 'ALL';
  is_archived?: boolean;
  view_mode?: 'table' | 'board' | 'kanban' | 'calendar' | 'timeline';
}
