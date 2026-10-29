import { BaseEntity } from './common';

export type StatusEntityType = 'Shot' | 'Asset' | 'Task' | 'Sequence' | 'Review' | 'Version' | string;

export interface Software extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  publisher?: string;
  category?: string;
  description?: string;
  website?: string;
  status?: string;
  is_system?: boolean;
  metadata?: Record<string, any>;
  version_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface SoftwareVersion extends Partial<BaseEntity> {
  id: string;
  software_id: string;
  version_string?: string;
  version?: string;
  release_date?: string;
  is_lts?: boolean;
  status?: string;
  download_url?: string;
  changelog?: string;
  compatibility?: Record<string, any>;
  [key: string]: any;
}

export interface MasterStatus extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  entity_type: StatusEntityType;
  category?: string;
  color?: string;
  order: number;
  description?: string;
  is_default?: boolean;
  is_final?: boolean;
  is_system?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface MasterTaskType extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  department?: string;
  color?: string;
  description?: string;
  default_duration_days?: number;
  status?: string;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface MasterAssetType extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  status?: string;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface MasterShotType extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface MasterReviewType extends Partial<BaseEntity> {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface MasterFileType extends Partial<BaseEntity> {
  id: string;
  name: string;
  code?: string;
  extension?: string;
  mime_type?: string;
  category?: string;
  status?: string;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface PlatformOverviewStats {
  global_software_count?: number;
  global_version_count?: number;
  global_status_count?: number;
  global_task_type_count?: number;
  global_asset_type_count?: number;
  global_shot_type_count?: number;
  global_review_type_count?: number;
  global_file_type_count?: number;
  system_health?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from organization.ts (relocated studio directory entities, org-free)
// ---------------------------------------------------------------------------

export interface FacilityWorkHours {
  days?: string[];
  start_time?: string;
  end_time?: string;
  timezone?: string;
  [key: string]: any;
}
export interface OfficeEntity extends BaseEntity {
  name: string;
  code: string;
  city: string;
  country: string;
  timezone: string;
  address?: string;
  is_headquarters?: boolean;
  head_count?: number;
  work_hours?: FacilityWorkHours;
  [key: string]: any;
}
export type Office = OfficeEntity;
export interface DepartmentEntity extends BaseEntity {
  name: string;
  code: string;
  head_name?: string;
  head_id?: string;
  member_count?: number;
  active_tasks_count?: number;
  description?: string;
  [key: string]: any;
}
export interface TeamEntity extends BaseEntity {
  department_id?: string;
  name: string;
  code?: string;
  lead_name?: string;
  lead_id?: string;
  member_count?: number;
  [key: string]: any;
}
export type Team = TeamEntity;
export interface Position {
  id: string;
  title: string;
  department?: string;
  [key: string]: any;
}
export interface Person extends BaseEntity {
  /** Linked auth identity as the API sends it: the user's id, null when unlinked. */
  user?: string | null;
  /** @deprecated legacy name; the API field is `user` (see docs/sync/02-gap-analysis.md). */
  user_id?: string;
  full_name: string;
  display_name?: string;
  email: string;
  role: string;
  role_id?: string;
  seniority?: string;
  department_id?: string;
  department_name?: string;
  team_id?: string;
  team_name?: string;
  office_id?: string;
  office_name?: string;
  avatar_url?: string;
  timezone?: string;
  skills?: string[];
  availability_status?: 'Available' | 'On Project' | 'On Leave' | 'Unavailable' | string;
  active_tasks?: number;
  logged_hours?: number;
  is_active?: boolean;
  [key: string]: any;
}
export interface Client extends BaseEntity {
  name: string;
  code: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  studio_type?: string;
  active_projects?: string[];
  contract_tier?: string;
  portal_access?: boolean;
  status?: string;
  logo_url?: string;
  headquarters?: string;
  total_billed_usd?: number;
  [key: string]: any;
}
export interface ClientContact {
  id: string;
  client: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  portal_access?: boolean;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
export interface VendorContact {
  id: string;
  vendor: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
export interface ClientContract {
  id: string;
  client: string;
  contract_number: string;
  title: string;
  type?: string;
  effective_date?: string | null;
  expiry_date?: string | null;
  value_usd?: number;
  status?: string;
  nda_signed?: boolean;
  document_url?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
export interface VendorContract {
  id: string;
  vendor: string;
  contract_number: string;
  title: string;
  type?: string;
  effective_date?: string | null;
  expiry_date?: string | null;
  value_usd?: number;
  status?: string;
  document_url?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
export interface Vendor extends BaseEntity {
  name: string;
  code: string;
  contact_name?: string;
  email?: string;
  specialization?: string;
  security_tier?: string;
  nda_signed?: boolean;
  active_tasks_count?: number;
  active_projects?: string[];
  rating?: number;
  location?: string;
  status?: string;
  logo_url?: string;
  bandwidth_gbps?: number;
  [key: string]: any;
}
export interface StudioBilling {
  tier?: string;
  billing_cycle?: 'Monthly' | 'Annual' | string;
  subscription_status?: 'Active' | 'Delinquent' | 'Trial' | string;
  payment_method?: string;
  next_billing_date?: string;
  invoices_count?: number;
  [key: string]: any;
}
