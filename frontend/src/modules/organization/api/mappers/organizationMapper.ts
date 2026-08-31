import {
  Office,
  Organization,
  OrganizationSettings,
  OrganizationTier,
  ProductionReport,
  StudioStatus,
  Team,
} from '@/types/organization';

export type RawOrganization = {
  id: string;
  uuid?: string;
  name?: string;
  slug?: string;
  code?: string;
  organization_type?: string;
  status?: string;
  logo?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  [key: string]: unknown;
};

const DEFAULT_SETTINGS: OrganizationSettings = {
  default_fps: 24,
  default_color_space: 'ACEScg',
  default_resolution: '4096x2160 (4K DCI)',
  allow_guest_reviewers: true,
  enable_two_factor: true,
  sso_enforced: false,
  render_farm_region: 'us-east-1',
  usd_schema_version: '2026',
};

function normalizeTier(type?: string): OrganizationTier {
  switch ((type || '').toLowerCase()) {
    case 'enterprise':
    case 'enterprise_vanguard':
    case 'vanguard':
      return 'Enterprise Vanguard';
    case 'global':
    case 'global_multi_site':
    case 'multi_site':
      return 'Global Multi-Site';
    case 'indie':
      return 'Indie';
    default:
      return 'Studio Pro';
  }
}

function normalizeStatus(status?: string): StudioStatus {
  const s = (status || 'active').toLowerCase();
  if (s === 'onboarding') return 'Onboarding';
  if (s === 'suspended') return 'Suspended';
  if (s === 'archived') return 'Archived';
  return 'Active';
}

/**
 * Map the backend Organization payload (which is intentionally lean) into the
 * rich frontend `Organization` shape, filling derived/sensible defaults so that
 * shared components never read undefined fields.
 */
export function toOrganization(raw: RawOrganization): Organization {
  const headquarters = [raw.name, raw.country].filter(Boolean).join(', ') || 'Global';
  const code = (raw.code || raw.name || 'STUDIO').toUpperCase();

  return {
    id: raw.id || raw.uuid || code,
    name: raw.name || code,
    slug: raw.slug || code.toLowerCase(),
    code,
    tier: normalizeTier(raw.organization_type as string | undefined),
    logo_url: typeof raw.logo === 'string' && raw.logo ? raw.logo : '',
    banner_url: undefined,
    headquarters,
    offices_count: 0,
    active_projects_count: 0,
    crew_count: 0,
    storage_quota_tb: 0,
    storage_used_tb: 0,
    status: normalizeStatus(raw.status as string | undefined),
    primary_contact_email: (raw.email as string | undefined) || '',
    primary_contact_name: '',
    settings: { ...DEFAULT_SETTINGS },
    created_at: (raw.created_at as string) || new Date().toISOString(),
    updated_at: (raw.updated_at as string) || new Date().toISOString(),
  };
}

export function normalizeOrganizations(list: RawOrganization[]): Organization[] {
  return Array.isArray(list) ? list.map(toOrganization) : [];
}

export type RawReport = {
  id: string;
  title?: string;
  project_code?: string;
  generated_at?: string;
  status?: string;
  [key: string]: unknown;
};

export function toProductionReport(raw: RawReport): ProductionReport {
  const status = (raw.status || 'Ready').toLowerCase();
  let normalized: ProductionReport['status'] = 'Complete';
  if (status.startsWith('generat')) normalized = 'Generating';
  else if (status.startsWith('schedul')) normalized = 'Scheduled';

  return {
    id: raw.id || String(raw.title || 'report'),
    title: raw.title || 'Production Report',
    project_code: raw.project_code || 'N/A',
    category: 'Milestone Tracking',
    generated_at: (raw.generated_at as string) || new Date().toISOString(),
    generated_by: 'System',
    status: normalized,
    summary_metrics: {},
    download_url: '',
  };
}

export function normalizeReports(list: RawReport[]): ProductionReport[] {
  return Array.isArray(list) ? list.map(toProductionReport) : [];
}

export type RawTeam = {
  id?: string;
  uuid?: string;
  code?: string;
  name?: string;
  department?: string;
  department_id?: string;
  department_name?: string;
  lead?: string;
  lead_id?: string;
  lead_name?: string;
  lead_avatar?: string;
  member_count?: number;
  current_project_code?: string;
  focus_discipline?: string;
  utilization_percentage?: number;
  description?: string;
  [key: string]: unknown;
};

export function toTeam(raw: RawTeam): Team {
  const id = raw.id || raw.uuid || raw.code || `team-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    organization_id: (raw.organization_id as string) || '',
    department_id: raw.department_id || raw.department || '',
    department_name: raw.department_name || '',
    name: raw.name || id,
    code: raw.code || id,
    lead_id: raw.lead_id || raw.lead || '',
    lead_name: raw.lead_name || '',
    lead_avatar: raw.lead_avatar || '',
    member_count: raw.member_count ?? 0,
    member_ids: raw.member_ids as string[] | undefined,
    current_project_id: raw.current_project_id as string | undefined,
    current_project_code: raw.current_project_code || '',
    assigned_projects: raw.assigned_projects as string[] | undefined,
    focus_discipline: raw.focus_discipline || '',
    capacity_utilization: raw.capacity_utilization as number | undefined,
    capacity_hours_weekly: raw.capacity_hours_weekly as number | undefined,
    utilization_percentage: raw.utilization_percentage,
    description: raw.description,
    created_at: (raw.created_at as string) || new Date().toISOString(),
    updated_at: (raw.updated_at as string) || new Date().toISOString(),
  };
}

export function normalizeTeams(list: RawTeam[]): Team[] {
  return Array.isArray(list) ? list.map(toTeam) : [];
}

export type RawOffice = {
  id?: string;
  uuid?: string;
  code?: string;
  name?: string;
  city?: string;
  country?: string;
  address?: string;
  timezone?: string;
  manager?: string;
  manager_id?: string;
  manager_name?: string;
  status?: string;
  is_active?: boolean;
  [key: string]: unknown;
};

export function toOffice(raw: RawOffice): Office {
  const id = raw.id || raw.uuid || raw.code || `office-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    organization_id: (raw.organization_id as string) || '',
    name: raw.name || id,
    code: raw.code || id,
    city: raw.city || '',
    country: raw.country || '',
    address: raw.address || '',
    timezone: raw.timezone || 'UTC',
    capacity: raw.capacity as number | undefined,
    current_occupancy: raw.current_occupancy as number | undefined,
    headcount: raw.headcount as number | undefined,
    workstations_count: raw.workstations_count as number | undefined,
    render_nodes_count: raw.render_nodes_count as number | undefined,
    manager_id: raw.manager_id || raw.manager || '',
    manager_name: raw.manager_name || '',
    network_speed_gbps: raw.network_speed_gbps as number | undefined,
    color_space: raw.color_space as string | undefined,
    status: raw.status || 'Operational',
    is_active: raw.is_active ?? true,
    working_hours: raw.working_hours as string | undefined,
    holidays: raw.holidays as Office['holidays'],
    resources: raw.resources as string[] | undefined,
    assigned_projects: raw.assigned_projects as string[] | undefined,
    created_at: (raw.created_at as string) || new Date().toISOString(),
    updated_at: (raw.updated_at as string) || new Date().toISOString(),
  };
}

export function normalizeOffices(list: RawOffice[]): Office[] {
  return Array.isArray(list) ? list.map(toOffice) : [];
}
