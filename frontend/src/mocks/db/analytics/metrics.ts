import type { ProductionKpis, DepartmentProgress } from "@/types/analytics";

export type { ProductionKpis, DepartmentProgress };

export const mockProductionKpis: ProductionKpis = {
  total_active_projects: 4,
  total_shots: 854,
  approved_shots: 383,
  pending_review_shots: 112,
  in_progress_shots: 236,
  approval_rate_percentage: 44.8,
  active_artists: 82,
  storage_usage_tb: 168.4,
  storage_quota_tb: 250,
  render_nodes_busy: 94,
  render_nodes_total: 128,
  average_render_time_mins: 42.6,
};

export const mockDepartmentProgress: DepartmentProgress[] = [
  { department: 'Concept Art', total_tasks: 45, completed_tasks: 42, percentage: 93.3 },
  { department: '3D Modeling', total_tasks: 120, completed_tasks: 88, percentage: 73.3 },
  { department: 'Rigging', total_tasks: 60, completed_tasks: 38, percentage: 63.3 },
  { department: 'Animation', total_tasks: 240, completed_tasks: 125, percentage: 52.1 },
  { department: 'FX (Houdini)', total_tasks: 180, completed_tasks: 72, percentage: 40.0 },
  { department: 'Lighting', total_tasks: 190, completed_tasks: 65, percentage: 34.2 },
  { department: 'Compositing', total_tasks: 240, completed_tasks: 58, percentage: 24.1 },
];
