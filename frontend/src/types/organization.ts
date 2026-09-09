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
  studio_type: 'Major Studio' | 'Streaming Platform' | 'Indie Producer' | 'Commercial Agency' | 'Game Dev' | string;
  active_projects: string[];
  contract_tier: 'Tier 1 Strategic' | 'Standard Producer' | 'Boutique' | string;
  portal_access: boolean;
  status: 'Active' | 'Pending Contract' | 'Inactive' | 'Archived' | string;
  logo_url: string;
  headquarters: string;
  total_billed_usd: number;
}

export type ClientEntity = Client;

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  timezone: string;
  portal_access: boolean;
  is_primary?: boolean;
}

export interface ClientContract {
  id: string;
  client_id: string;
  contract_number: string;
  title: string;
  type: 'MSA' | 'SOW' | 'NDA' | 'Amendment' | string;
  effective_date: string;
  expiry_date: string;
  value_usd: number;
  status: 'Active' | 'Pending Signature' | 'Expired' | 'Terminated' | string;
  nda_signed: boolean;
  document_url?: string;
}

export interface PurchaseOrder {
  id: string;
  client_id: string;
  po_number: string;
  project_id: string;
  project_code: string;
  project_name: string;
  amount_usd: number;
  invoiced_usd: number;
  remaining_usd: number;
  issue_date: string;
  status: 'Approved' | 'Pending Approval' | 'Exhausted' | 'Closed' | string;
  scope_description: string;
}

export interface ClientDeliverable {
  id: string;
  client_id: string;
  title: string;
  project_code: string;
  package_type: 'Final Master EXR' | 'ProRes 4444 XQ' | 'QuickTime Dailies' | 'OpenUSD Turnaround' | string;
  resolution: string;
  color_space: string;
  frame_count: number;
  file_size_gb: number;
  delivery_date: string;
  status: 'Delivered & Accepted' | 'Pending QC' | 'In Transit' | 'Revisions Requested' | string;
  checksum_md5?: string;
}

export interface ClientReviewSession {
  id: string;
  client_id: string;
  title: string;
  project_code: string;
  playlist_name: string;
  date: string;
  versions_count: number;
  approved_count: number;
  revisions_count: number;
  status: 'Completed' | 'In Progress' | 'Scheduled' | string;
  lead_reviewer: string;
  notes_count: number;
}

export interface ClientInvoice {
  id: string;
  client_id: string;
  invoice_number: string;
  project_code: string;
  issue_date: string;
  due_date: string;
  amount_usd: number;
  paid_usd: number;
  status: 'Paid' | 'Sent / Net 30' | 'Overdue' | 'Draft' | string;
  items_summary: string;
}

export interface ClientActivity {
  id: string;
  client_id: string;
  action: string;
  description: string;
  user_name: string;
  user_avatar?: string;
  timestamp: string;
  category: 'Turnover' | 'Approval' | 'Contract' | 'Portal' | 'Invoice';
}

export interface Vendor extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  contact_name: string;
  email: string;
  specialization: 'Roto & Paint' | 'Matchmove & Tracking' | 'Creature FX & Sim' | 'Environment DMP' | 'Crowd Sim' | 'Stereo Conversion' | string;
  security_tier: 'MPAA Certified Tier 4' | 'CDSA High Security' | 'Standard Studio NDA' | string;
  nda_signed: boolean;
  active_tasks_count: number;
  active_projects: string[];
  rating: number;
  location: string;
  status: 'Approved Partner' | 'Under Security Audit' | 'Inactive' | 'Archived' | string;
  logo_url: string;
  bandwidth_gbps: number;
  bandwidth_link?: string;
}

export type VendorEntity = Vendor;

export interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  timezone: string;
  is_primary?: boolean;
}

export interface VendorUser {
  id: string;
  vendor_id: string;
  name: string;
  email: string;
  role: string;
  specialization: string;
  access_level: 'Full Pipeline' | 'Restricted Portal' | 'FTP Only' | string;
  last_active: string;
  status: 'Active' | 'Revoked' | 'Pending Verification' | string;
  active_tasks_count: number;
  avatar_url?: string;
}

export interface VendorDepartment {
  id: string;
  vendor_id: string;
  name: string;
  code: string;
  lead_name: string;
  artist_count: number;
  active_tasks_count: number;
  software: string[];
}

export interface VendorTeam {
  id: string;
  vendor_id: string;
  name: string;
  code: string;
  lead_name: string;
  member_count: number;
  current_project_code: string;
  focus_discipline: string;
}

export interface VendorContract {
  id: string;
  vendor_id: string;
  contract_number: string;
  title: string;
  type: 'MSA' | 'SOW' | 'Rate Sheet' | 'Security SLA' | string;
  effective_date: string;
  expiry_date: string;
  total_value_usd: number;
  nda_signed: boolean;
  security_tier: string;
  status: 'Active' | 'Pending Renewal' | 'Expired' | string;
}

export interface VendorDelivery {
  id: string;
  vendor_id: string;
  delivery_code: string;
  project_code: string;
  shot_code: string;
  package_type: 'Roto Mattes' | 'Matchmove Camera & Geo' | 'Creature Sim Cache' | 'Clean Plate EXR' | string;
  version: string;
  frame_range: string;
  submitted_at: string;
  qc_status: 'QC Passed' | 'QC Warning' | 'QC Rejected' | 'In Automated QC' | string;
  frame_drops_detected: number;
  notes: string;
}

export interface VendorPerformance {
  vendor_id: string;
  on_time_delivery_rate: number;
  qc_first_pass_rate: number;
  avg_turnaround_hours: number;
  total_shots_completed: number;
  rating: number;
  sla_compliance_rate: number;
}

export interface VendorActivity {
  id: string;
  vendor_id: string;
  action: string;
  description: string;
  user_name: string;
  timestamp: string;
  category: 'Delivery' | 'QC' | 'Assignment' | 'Security' | 'Contract';
}

export interface Person extends BaseEntity {
  organization_id: string;
  full_name: string;
  email: string;
  role: 'VFX Supervisor' | 'VFX Producer' | 'Lead Artist' | 'Senior Artist' | 'Mid Artist' | 'Junior Artist' | 'Pipeline TD' | 'Production Coordinator' | string;
  department_id: string;
  department_name: string;
  team_id?: string;
  team_name?: string;
  office_id: string;
  office_name: string;
  avatar_url: string;
  skills: string[];
  seniority: 'Principal' | 'Lead' | 'Senior' | 'Mid' | 'Junior' | string;
  availability_status: 'Available' | 'Assigned 100%' | 'Overallocated' | 'On Leave' | string;
  active_tasks: number;
  logged_hours: number;
  phone?: string;
  timezone: string;
  status?: 'Active' | 'Inactive' | 'Suspended' | string;
  assigned_projects?: string[];
  security_clearance?: string;
  contract_type?: 'Full-Time Staff' | 'Long-Term Contract' | 'Freelance Key Artist' | string;
}

export type PersonEntity = Person;

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

export type Department = DepartmentEntity;

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
  current_project_id?: string;
  current_project_code: string;
  assigned_projects?: string[];
  focus_discipline: string;
  capacity_utilization?: number;
  capacity_hours_weekly?: number;
  utilization_percentage?: number;
  description?: string;
}

export type TeamEntity = Team;

export interface HolidaySchedule {
  name: string;
  date: string;
  type: 'National' | 'Studio Holiday' | 'Maintenance Closure' | string;
}

export interface Office extends BaseEntity {
  organization_id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  address: string;
  timezone: string;
  capacity?: number;
  current_occupancy?: number;
  headcount?: number;
  workstations_count?: number;
  render_nodes_count?: number;
  manager_id: string;
  manager_name: string;
  network_speed_gbps?: number;
  color_space?: string;
  status?: 'Operational' | 'Remote Hub' | 'Maintenance' | string;
  is_active?: boolean;
  working_hours?: string;
  holidays?: HolidaySchedule[];
  resources?: string[];
  assigned_projects?: string[];
}

export type OfficeEntity = Office;

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
