import { BaseEntity, Department, PriorityLevel, ProductionStatus } from './common';

export type ResourceCategory = 'person' | 'team' | 'department' | 'office' | 'equipment';

export type EquipmentType =
  | 'Workstation'
  | 'GPU Render Node'
  | 'Color Grading Suite'
  | 'Dailies Screening Bay'
  | 'Mocap Stage'
  | '3D Lidar Scanner'
  | 'Virtual Production LED Wall'
  | 'Sound Stage';

export type ResourceAvailabilityStatus =
  | 'Available'
  | 'Assigned'
  | 'Fully Booked'
  | 'Overallocated'
  | 'On Leave'
  | 'Maintenance';

export interface ResourceAssignment {
  id: string;
  resource_id: string;
  resource_name: string;
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
  project_name: string;
  start_date: string;
  end_date: string;
  daily_hours: number;
  total_hours: number;
  role?: string;
  department: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Pending Approval';
}

export interface ResourceLeave {
  id: string;
  resource_id: string;
  resource_name: string;
  leave_type: 'Annual Leave' | 'Sick Leave' | 'Training / Workshop' | 'Sabbatical' | 'Comp Time' | 'Unpaid Leave';
  start_date: string;
  end_date: string;
  total_days: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  notes?: string;
}

export interface StudioHoliday {
  id: string;
  office_id: string;
  office_name: string;
  name: string;
  date: string;
  end_date?: string;
  type: 'National Holiday' | 'Studio Closure' | 'Scheduled Maintenance';
}

export interface EquipmentSpecs {
  gpu?: string;
  cpu?: string;
  ram_gb?: number;
  vram_gb?: number;
  display?: string;
  software?: string[];
  location_room?: string;
  ip_address?: string;
  calibrated_color_profile?: string;
}

export interface Resource extends BaseEntity {
  type: ResourceCategory;
  name: string;
  code: string;
  department_id?: string;
  department_name?: string;
  team_id?: string;
  team_name?: string;
  office_id?: string;
  office_name?: string;
  role?: string;
  avatar_url?: string;
  skills?: string[];
  equipment_type?: EquipmentType;
  equipment_specs?: EquipmentSpecs;
  capacity_weekly_hours: number;
  capacity_daily_hours: number;
  assigned_hours_current_week: number;
  utilization_pct: number;
  availability_status: ResourceAvailabilityStatus;
  active_assignments_count: number;
  current_project_code?: string;
  assignments: ResourceAssignment[];
  leaves: ResourceLeave[];
  is_overbooked: boolean;
  overbooking_reason?: string;
}

export type CalendarEventType =
  | 'project'
  | 'task'
  | 'milestone'
  | 'review'
  | 'delivery'
  | 'meeting'
  | 'leave'
  | 'holiday'
  | 'availability';

export type CalendarEventPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type CalendarEventStatus =
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Pending Review'
  | 'At Risk'
  | 'Overbooked'
  | 'Cancelled';

export interface CalendarEventDependency {
  upstream_event_ids: string[];
  downstream_event_ids: string[];
  is_critical_path?: boolean;
}

export interface OverbookingConflict {
  conflict_type: 'capacity_exceeded' | 'double_booked_person' | 'double_booked_equipment' | 'dependency_violation';
  conflicting_event_ids: string[];
  message: string;
  severity: 'high' | 'medium' | 'critical';
}

export interface CalendarEvent extends BaseEntity {
  title: string;
  event_type: CalendarEventType;
  start_date: string; // ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  end_date: string;   // ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  all_day: boolean;
  status: CalendarEventStatus;
  priority: CalendarEventPriority;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  task_id?: string;
  task_code?: string;
  review_id?: string;
  delivery_id?: string;
  milestone_id?: string;
  department?: string;
  department_id?: string;
  team_id?: string;
  team_name?: string;
  office_id?: string;
  office_name?: string;
  primary_assignee_id?: string;
  primary_assignee_name?: string;
  primary_assignee_avatar?: string;
  assignee_ids: string[];
  assignee_names: string[];
  equipment_ids?: string[];
  equipment_names?: string[];
  location_or_link?: string;
  description?: string;
  color?: string;
  progress_pct?: number;
  dependencies?: CalendarEventDependency;
  is_overbooked?: boolean;
  overbooking_details?: OverbookingConflict;
  metadata?: Record<string, any>;
}

export interface SchedulingCapacitySummary {
  department: string;
  total_resources: number;
  total_capacity_hours: number;
  allocated_hours: number;
  free_hours: number;
  utilization_pct: number;
  overbooked_count: number;
}

export interface SchedulingOverbookingAlert {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: ResourceCategory;
  department?: string;
  date: string;
  scheduled_hours: number;
  max_capacity_hours: number;
  excess_hours: number;
  conflicting_events: Array<{
    id: string;
    title: string;
    project_code?: string;
    event_type: CalendarEventType;
    hours: number;
  }>;
  suggested_resolution?: string;
}
