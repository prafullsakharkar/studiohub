import { BaseEntity } from './common';

export type OrganizationTier = 'Enterprise Vanguard' | 'Studio Pro' | 'Global Multi-Site' | 'Indie';
export type StudioStatus = 'Active' | 'Onboarding' | 'Suspended' | 'Archived';

export interface OrganizationSettings {
  default_fps: number;
  default_color_space: string;
  default_resolution: string;
  allow_guest_reviewers: boolean;
  enable_two_factor: boolean;
  sso_enforced: boolean;
  render_farm_region: string;
  usd_schema_version: string;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  code: string;
  tier: OrganizationTier;
  logo_url: string;
  banner_url?: string;
  headquarters: string;
  offices_count: number;
  active_projects_count: number;
  crew_count: number;
  storage_quota_tb: number;
  storage_used_tb: number;
  status: StudioStatus;
  primary_contact_email: string;
  primary_contact_name: string;
  settings: OrganizationSettings;
}

export interface Client extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  contact_name: string;
  email: string;
  phone: string;
  studio_type: 'Major Studio' | 'Streaming Platform' | 'Indie Producer' | 'Commercial Agency' | 'Game Dev';
  active_projects: string[];
  contract_tier: 'Tier 1 Strategic' | 'Standard Producer' | 'Boutique';
  portal_access: boolean;
  status: 'Active' | 'Pending Contract' | 'Inactive';
  logo_url: string;
  headquarters: string;
  total_billed_usd: number;
}

export interface Vendor extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  contact_name: string;
  email: string;
  specialization: 'Roto & Paint' | 'Matchmove & Tracking' | 'Creature FX & Sim' | 'Environment DMP' | 'Crowd Sim' | 'Stereo Conversion';
  security_tier: 'MPAA Certified Tier 4' | 'CDSA High Security' | 'Standard Studio NDA';
  nda_signed: boolean;
  active_tasks_count: number;
  active_projects: string[];
  rating: number;
  location: string;
  status: 'Approved Partner' | 'Under Security Audit' | 'Inactive';
  logo_url: string;
  bandwidth_gbps: number;
}

export interface Person extends BaseEntity {
  organization_id: string;
  full_name: string;
  email: string;
  role: 'VFX Supervisor' | 'VFX Producer' | 'Lead Artist' | 'Senior Artist' | 'Mid Artist' | 'Junior Artist' | 'Pipeline TD' | 'Production Coordinator';
  department_id: string;
  department_name: string;
  team_id?: string;
  team_name?: string;
  office_id: string;
  office_name: string;
  avatar_url: string;
  skills: string[];
  seniority: 'Principal' | 'Lead' | 'Senior' | 'Mid' | 'Junior';
  availability_status: 'Available' | 'Assigned 100%' | 'Overallocated' | 'On Leave';
  active_tasks: number;
  logged_hours: number;
  phone?: string;
  timezone: string;
  status?: 'Active' | 'Inactive' | 'Suspended';
  assigned_projects?: string[];
  security_clearance?: string;
}

export interface DepartmentEntity extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  head_id: string;
  head_name: string;
  head_avatar: string;
  member_count: number;
  active_tasks_count: number;
  color: string;
  description: string;
  software_stack: string[];
  capacity_hours_weekly?: number;
  utilization_percentage?: number;
  assigned_projects?: string[];
}

export interface Team extends BaseEntity {
  organization_id: string;
  department_id: string;
  department_name: string;
  name: string;
  code: string;
  lead_id: string;
  lead_name: string;
  lead_avatar: string;
  member_count: number;
  member_ids?: string[];
  current_project_id: string;
  current_project_code: string;
  assigned_projects?: string[];
  focus_discipline: string;
  capacity_utilization?: number;
}

export interface HolidaySchedule {
  name: string;
  date: string;
  type: 'National' | 'Studio Holiday' | 'Maintenance Closure';
}

export interface Office extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  address: string;
  timezone: string;
  capacity: number;
  current_occupancy: number;
  manager_id: string;
  manager_name: string;
  network_speed_gbps: number;
  color_space: string;
  status: 'Operational' | 'Remote Hub' | 'Maintenance';
  working_hours?: string;
  holidays?: HolidaySchedule[];
  resources?: string[];
  assigned_projects?: string[];
}

export interface PublishedVersion extends BaseEntity {
  organization_id: string;
  project_id: string;
  project_code: string;
  entity_type: 'Shot' | 'Asset';
  entity_id: string;
  entity_code: string;
  version_number: string;
  department: string;
  published_by_name: string;
  published_by_avatar: string;
  file_path: string;
  usd_stage_path?: string;
  frame_range: string;
  file_size_mb: number;
  status: 'Approved' | 'Pending Review' | 'WIP' | 'Superceded';
  thumbnail_url: string;
  notes: string;
}

export interface StudioNotification extends BaseEntity {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  timestamp: string;
  read: boolean;
  category: 'Dailies' | 'Render Farm' | 'Task Assignment' | 'Milestone' | 'Security';
  link?: string;
}

export interface StudioBilling {
  tier: OrganizationTier;
  monthly_base_fee_usd: number;
  farm_credits_total: number;
  farm_credits_used: number;
  farm_credits_remaining: number;
  storage_quota_tb: number;
  storage_used_tb: number;
  active_seats_count: number;
  max_seats_count: number;
  next_billing_date: string;
  invoice_currency: string;
  payment_method: string;
}

export interface ProductionReport {
  id: string;
  title: string;
  project_code: string;
  category: 'Milestone Tracking' | 'Bids vs Actuals' | 'Client Turnarounds' | 'Farm Utilization' | 'Vendor Deliverables';
  generated_at: string;
  generated_by: string;
  status: 'Complete' | 'Generating' | 'Scheduled';
  summary_metrics: Record<string, string | number>;
  download_url: string;
}
