export interface ProductionKpis {
  total_active_projects: number;
  total_shots: number;
  approved_shots: number;
  pending_review_shots: number;
  in_progress_shots: number;
  approval_rate_percentage: number;
  active_artists: number;
  storage_usage_tb: number;
  storage_quota_tb: number;
  render_nodes_busy: number;
  render_nodes_total: number;
  average_render_time_mins: number;
}

export interface DepartmentProgress {
  department: string;
  total_tasks: number;
  completed_tasks: number;
  percentage: number;
}
