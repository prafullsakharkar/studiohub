import { EntityType, EntityId, EntityReference } from './crud';

// ==========================================
// 1. GLOBAL SEARCH TYPES
// ==========================================

export type SearchableEntityType =
  | 'organization'
  | 'client'
  | 'vendor'
  | 'person'
  | 'department'
  | 'team'
  | 'office'
  | 'project'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'review'
  | 'delivery'
  | 'media'
  | 'knowledge';

export interface SearchFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  entity_types: SearchFacetOption[];
  projects: SearchFacetOption[];
  organizations: SearchFacetOption[];
  departments: SearchFacetOption[];
  statuses: SearchFacetOption[];
  tags: SearchFacetOption[];
}

export interface SearchFilters {
  query: string;
  entity_types: SearchableEntityType[];
  project_codes: string[];
  organization_ids: string[];
  departments: string[];
  statuses: string[];
  tags: string[];
  date_range?: 'all' | 'today' | '7d' | '30d' | '90d' | 'custom';
  sort_by: 'relevance' | 'date_desc' | 'date_asc' | 'title_asc';
}

export interface SearchResultItem {
  id: string;
  entity_type: SearchableEntityType;
  entity_id: string;
  title: string;
  subtitle?: string;
  description?: string;
  project_code?: string;
  organization_name?: string;
  status?: string;
  tags?: string[];
  author_name?: string;
  thumbnail_url?: string;
  url: string;
  updated_at: string;
  score: number; // Relevance score
  metadata?: Record<string, any>;
  highlights?: {
    field: string;
    snippet: string;
  }[];
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: SearchFilters;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
  user_id: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
  filters_snapshot?: Partial<SearchFilters>;
}

// ==========================================
// 2. KNOWLEDGE HUB TYPES
// ==========================================

export type KnowledgeCategory =
  | 'pipeline'
  | 'sop'
  | 'production_notes'
  | 'project_knowledge'
  | 'client_guidelines'
  | 'troubleshooting'
  | 'reference';

export interface KnowledgeEntityRelationship {
  id: string;
  target_entity_type: SearchableEntityType;
  target_entity_id: string;
  target_entity_title: string;
  target_entity_code?: string;
  relationship_type: 'applies_to' | 'referenced_by' | 'governed_by' | 'documentation_for';
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  category: KnowledgeCategory;
  department_name?: string;
  project_code?: string;
  tags: string[];
  author_name: string;
  author_role: string;
  author_avatar?: string;
  version: string;
  is_pinned?: boolean;
  is_verified?: boolean;
  views_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  linked_entities: KnowledgeEntityRelationship[];
}

// ==========================================
// 3. AI WORKSPACE & INTELLIGENCE TYPES
// ==========================================

export type AICapability =
  | 'production_assistant'
  | 'search_assistant'
  | 'project_summary'
  | 'shot_summary'
  | 'task_recommendations'
  | 'risk_detection'
  | 'schedule_analysis'
  | 'review_summary'
  | 'knowledge_qa'
  | 'natural_language_search';

export interface AIRiskItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'schedule' | 'budget' | 'artist_capacity' | 'technical' | 'delivery' | 'review_blocker';
  title: string;
  description: string;
  project_code: string;
  impacted_entity_type: SearchableEntityType;
  impacted_entity_id: string;
  impacted_entity_name: string;
  detected_at: string;
  suggested_action: string;
  confidence_score: number; // 0.0 to 1.0
  auto_mitigation_available: boolean;
}

export interface AITaskRecommendation {
  task_id: string;
  task_title: string;
  project_code: string;
  current_assignee_id?: string;
  current_assignee_name?: string;
  recommended_assignee_id: string;
  recommended_assignee_name: string;
  reason: string;
  workload_delta_hours: number;
  fit_score: number; // 0.0 to 1.0
  estimated_speedup_days: number;
}

export interface AIProjectSummary {
  project_code: string;
  project_name: string;
  generated_at: string;
  health_score: number; // 0 - 100
  status: 'on_track' | 'at_risk' | 'critical' | 'ahead_of_schedule';
  headline: string;
  executive_brief: string;
  key_metrics: {
    shots_completed: number;
    shots_total: number;
    completion_percentage: number;
    days_to_final_delivery: number;
    budget_burn_rate_pct: number;
    open_critical_notes: number;
  };
  department_breakdown: {
    department: string;
    progress_pct: number;
    bottleneck_detected: boolean;
    velocity_trend: 'accelerating' | 'stable' | 'decelerating';
  }[];
  critical_risks: string[];
  recommended_actions: string[];
}

export interface AIShotSummary {
  shot_code: string;
  project_code: string;
  generated_at: string;
  status: string;
  frame_range: string;
  supervisor_intent: string;
  pipeline_stage: string;
  active_tasks_count: number;
  versions_history_count: number;
  latest_review_feedback: string;
  blocker_analysis: string;
  turnaround_forecast_days: number;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  capability_used?: AICapability;
  context_entities?: {
    type: SearchableEntityType;
    id: string;
    name: string;
  }[];
  suggested_followups?: string[];
  citations?: {
    doc_id: string;
    title: string;
    snippet: string;
  }[];
  structured_data?: any;
}

export interface AIPermissionContext {
  active_organization_id: string;
  active_organization_name: string;
  active_project_code: string;
  user_role: string;
  restricted_entities_count: number;
  is_isolated: boolean;
}

// ==========================================
// 4. ANALYTICS & KPI FRAMEWORK TYPES
// ==========================================

export type AnalyticsDomain =
  | 'projects'
  | 'production'
  | 'tasks'
  | 'artists'
  | 'teams'
  | 'departments'
  | 'vendors'
  | 'clients'
  | 'resources'
  | 'delivery'
  | 'review';

export type MetricTrend = 'up' | 'down' | 'neutral';

export interface KPIMetric {
  id: string;
  label: string;
  value: string | number;
  target?: string | number;
  delta_percentage?: number;
  trend?: MetricTrend;
  trend_label?: string;
  unit?: string;
  status?: 'optimal' | 'warning' | 'critical' | 'neutral';
  info_tooltip?: string;
}

export interface ChartDataPoint {
  label: string;
  [key: string]: string | number;
}

export type WidgetChartType =
  | 'area'
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'donut'
  | 'pie'
  | 'radar'
  | 'gauge'
  | 'table';

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  subtitle?: string;
  domain: AnalyticsDomain;
  chart_type: WidgetChartType;
  span?: 'col-1' | 'col-2' | 'col-3' | 'col-4' | 'full';
  height?: number;
  data: any[];
  data_keys?: {
    name: string;
    color: string;
    label?: string;
  }[];
  kpi_summary?: KPIMetric;
  description?: string;
}

export interface AnalyticsDashboard {
  id: string;
  domain: AnalyticsDomain;
  title: string;
  subtitle: string;
  kpis: KPIMetric[];
  widgets: DashboardWidgetConfig[];
}
