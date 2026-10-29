import { BaseEntity } from './common';

// ---------------------------------------------------------------------------
// from auth.ts
// ---------------------------------------------------------------------------

export type MembershipType = 'INTERNAL' | 'VENDOR' | 'CLIENT' | 'GUEST' | string;
export interface UserVendorMembership {
  id?: string;
  user_id?: string;
  vendor_id: string;
  vendor_name?: string;
  role?: string;
  status?: string;
  [key: string]: any;
}
export interface UserClientMembership {
  id?: string;
  user_id?: string;
  client_id: string;
  client_name?: string;
  role?: string;
  status?: string;
  [key: string]: any;
}
export interface User extends Partial<BaseEntity> {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  avatar_url?: string;
  avatar?: string;
  role?: string;
  roles?: string[] | Role[];
  permissions?: string[];
  department?: string;
  department_id?: string;
  team?: string;
  team_id?: string;
  title?: string;
  phone?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
  project_memberships?: ProjectMembership[];
  vendor_memberships?: UserVendorMembership[];
  client_memberships?: UserClientMembership[];
  vendor_id?: string;
  client_id?: string;
  membership_type?: MembershipType;
  theme_preferences?: UserThemePreferences;
  settings?: Record<string, any>;
  aliases?: string[];
  [key: string]: any;
}
export interface AuthTokens {
  access: string;
  refresh: string;
  token_type?: string;
  expires_in?: number;
}
/** `POST /auth/login/` when the account has MFA: no tokens and no user until the challenge is completed. */
export interface MfaRequiredResponse {
  mfa_required: true;
  challenge: string;
  expires_in: number;
}
/** `POST /auth/mfa/challenge/` body: the challenge plus a TOTP code or a recovery code. */
export interface MfaChallengeInput {
  challenge: string;
  code?: string;
  recovery_code?: string;
  remember_device?: boolean;
}
export type LoginOutcome =
  | { status: 'authenticated'; user: User; mfaEnrollmentRequired: boolean }
  | { status: 'mfa_required'; challenge: string; expiresIn: number };

export interface LoginResponse {
  user: User;
  /** Policy requires MFA but this user has none yet. */
  mfa_enrollment_required?: boolean;
  tokens?: AuthTokens;
  access?: string;
  refresh?: string;
  token?: string;
  [key: string]: any;
}
export interface RefreshResponse {
  access: string;
  refresh?: string;
  [key: string]: any;
}
export function getUserMembershipType(user?: User | null): MembershipType {
  if (!user) return 'INTERNAL';
  if (user.is_superuser || user.is_staff) return 'INTERNAL';
  if (user.client_id || (user as any).clientId || user.membership_type === 'CLIENT' || (typeof user.role === 'string' && user.role.toLowerCase().includes('client'))) {
    return 'CLIENT';
  }
  if (user.vendor_id || (user as any).vendorId || user.membership_type === 'VENDOR' || (typeof user.role === 'string' && user.role.toLowerCase().includes('vendor'))) {
    return 'VENDOR';
  }
  return user.membership_type || 'INTERNAL';
}

// ---------------------------------------------------------------------------
// from rbac.ts
// ---------------------------------------------------------------------------

export type Scope =
  | 'GLOBAL'
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'SHOW'
  | 'DEPARTMENT'
  | 'TEAM'
  | 'VENDOR'
  | 'VENDOR_PROJECT'
  | 'VENDOR_PROJECT_ASSIGNED'
  | 'CLIENT'
  | 'CLIENT_PROJECT'
  | 'ASSIGNED'
  | 'OWN'
  | string;
export type ResourceVisibility = 'INTERNAL' | 'VENDOR' | 'CLIENT' | 'PUBLIC';
export type RoleCategory =
  | 'organization'
  | 'project'
  | 'department'
  | 'vendor'
  | 'client'
  | 'system'
  | string;
export interface Permission {
  id?: string;
  code: string;
  name?: string;
  description?: string;
  category?: string;
  [key: string]: any;
}
export interface Role extends Partial<BaseEntity> {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  type?: 'system' | 'custom' | string;
  category?: RoleCategory;
  permissions?: string[];
  badge_color?: string;
  is_system_role?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
export interface ProjectMembership {
  id?: string;
  user_id?: string;
  userId?: string;
  project_id: string;
  projectId?: string;
  project_name?: string;
  show_id?: string;
  showId?: string;
  role?: string;
  roles?: string[];
  /** Canonical RBAC role link (N7, backend-backed, null when unmatched). */
  role_id?: string | null;
  scope?: Scope;
  /** Canonical lowercase (active|on_leave|terminated|suspended); legacy Title Case accepted on read. */
  status?: string;
  vendor_id?: string;
  client_id?: string;
  permissions?: string[];
  [key: string]: any;
}
export interface ContextEntity {
  id: string;
  type?: string;
  project_id?: string;
  projectId?: string;
  show_id?: string;
  showId?: string;
  vendor_id?: string;
  client_id?: string;
  assigned_to?: string | string[];
  assignee_id?: string;
  department?: string;
  visibility?: ResourceVisibility | string;
  client_visible?: boolean;
  vendor_visible?: boolean;
  is_public?: boolean;
  created_by?: string;
  user_id?: string;
  [key: string]: any;
}
export interface PermissionEvaluationContext {
  projectId?: string;
  showId?: string;
  resourceId?: string;
  entityType?: string;
  entity?: ContextEntity | any;
  department?: string;
  teamId?: string;
  vendorId?: string;
  clientId?: string;
  action?: string;
  scope?: Scope;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from access.ts
// ---------------------------------------------------------------------------

export type AccessWorkspaceTab =
  | 'overview'
  | 'users'
  | 'groups'
  | 'roles'
  | 'catalog'
  | 'permissions'
  | 'projects'
  | 'simulator'
  | 'audit'
  | string;
export type PermissionDomain =
  | 'Organization'
  | 'People'
  | 'Departments'
  | 'Teams'
  | 'Offices'
  | 'Clients'
  | 'Vendors'
  | 'Projects'
  | 'Editorial'
  | 'Sequences'
  | 'Shots'
  | 'Assets'
  | 'Tasks'
  | 'Timelogs'
  | 'Versions'
  | 'Reviews'
  | 'Notes'
  | 'Deliveries'
  | 'Publishing'
  | 'Workflows'
  | 'Schedule'
  | 'Resources'
  | 'Pipeline'
  | 'Files'
  | 'Media'
  | 'Reports'
  | 'Billing'
  | 'Audit'
  | 'Settings'
  | 'Security'
  | 'Integrations'
  | 'Platform'
  | string;
export type PermissionActionType =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'publish'
  | 'export'
  | 'manage'
  | 'admin'
  | string;
export interface DomainPermissionDefinition {
  id?: string;
  code: string;
  name: string;
  description: string;
  domain: PermissionDomain;
  action?: PermissionActionType;
  actionType?: PermissionActionType;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical' | string;
  isSystemAdminOnly?: boolean;
  [key: string]: any;
}
export interface AccessRoleTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  category: RoleCategory | string;
  permissions?: string[];
  defaultPermissions?: string[];
  isSystem?: boolean;
  suggestedScope?: string;
  color?: string;
  [key: string]: any;
}
export interface AccessGroupItem extends Partial<BaseEntity> {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  roles?: string[];
  memberUserIds?: string[];
  status?: 'Active' | 'Inactive' | string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}
export interface UserEffectiveAccess {
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  department?: string;
  directRoles?: string[];
  groupRoles?: string[];
  effectivePermissions: any[];
  groups: any[];
  projectMemberships?: any[];
  [key: string]: any;
}
export interface SimulationRequest {
  userId: string;
  projectId?: string;
  permissionCode?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  resource?: string;
  [key: string]: any;
}
export interface SimulationResult {
  allowed: boolean;
  grantedBy?: 'SUPERUSER' | 'ROLE_PERMISSION' | 'GROUP_ROLE' | 'PROJECT_OVERRIDE' | 'NONE' | string;
  reasons?: string[];
  reason?: string;
  evaluationSteps?: any[];
  effectiveRoles?: string[];
  evaluatedAt?: string;
  [key: string]: any;
}
export interface AccessAuditEvent extends Partial<BaseEntity> {
  id: string;
  actorUserId?: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  action?: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED' | 'GROUP_CREATED' | 'GROUP_UPDATED' | 'PERMISSIONS_MODIFIED' | 'MEMBERSHIP_CHANGED' | string;
  targetType?: 'ROLE' | 'GROUP' | 'USER_MEMBERSHIP' | 'PERMISSION' | string;
  targetId?: string;
  targetName?: string;
  details?: any;
  timestamp?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from routePermissions.ts
// ---------------------------------------------------------------------------

export type PermissionScope =
  | 'GLOBAL'
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'DEPARTMENT'
  | 'TEAM'
  | 'VENDOR'
  | 'CLIENT'
  | 'ASSIGNED'
  | 'OWN'
  | string;
export interface RoutePermissionMetadata {
  path?: string;
  name?: string;
  pagePermission?: string;
  permissions?: string[];
  requiresProjectMembership?: boolean;
  scope?: PermissionScope;
  allowedRoles?: string[];
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from theme.ts
// ---------------------------------------------------------------------------

export interface AccentColorPreset {
  id: string;
  name: string;
  description: string;
  cyan: string; // Primary accent 1 (e.g. cyan/teal/emerald/violet)
  blue: string; // Primary accent 2 (e.g. blue/sky/indigo/purple)
  previewGradient: string;
}
export interface UserThemePreferences {
  accentCyan: string;
  accentBlue: string;
  presetId?: string;
  borderRadius?: number; // px for cards/buttons
  glowIntensity?: number; // 0 to 100%
  updatedAt?: string;
}
export const DEFAULT_ACCENT_CYAN = '#06b6d4'; // Cyan 500
export const DEFAULT_ACCENT_BLUE = '#3b82f6'; // Blue 500
export const ACCENT_PRESETS: AccentColorPreset[] = [
  {
    id: 'studio-default',
    name: 'Cyber Cyan & Electric Blue (Default)',
    description: 'The standard StudioHub production console signature high-contrast palette.',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    previewGradient: 'from-[#06b6d4] to-[#3b82f6]',
  },
  {
    id: 'neon-teal',
    name: 'Bioluminescent Teal & Ocean Blue',
    description: 'Refreshing ocean tones tuned for long darkroom compositing sessions.',
    cyan: '#14b8a6',
    blue: '#0284c7',
    previewGradient: 'from-[#14b8a6] to-[#0284c7]',
  },
  {
    id: 'deep-indigo',
    name: 'Electric Azure & Deep Indigo',
    description: 'Focused, deep blue gradients suitable for color grading and finishing.',
    cyan: '#38bdf8',
    blue: '#6366f1',
    previewGradient: 'from-[#38bdf8] to-[#6366f1]',
  },
  {
    id: 'emerald-flow',
    name: 'Matrix Mint & Emerald Cyan',
    description: 'Vibrant green-cyan accents reminiscent of terminal HUD pipelines.',
    cyan: '#10b981',
    blue: '#06b6d4',
    previewGradient: 'from-[#10b981] to-[#06b6d4]',
  },
  {
    id: 'violet-cyber',
    name: 'Ultraviolet & Royal Cobalt',
    description: 'Rich purple-cyan cyberpunk aesthetic for high-impact visual design.',
    cyan: '#00f2fe',
    blue: '#4facfe',
    previewGradient: 'from-[#00f2fe] to-[#4facfe]',
  },
  {
    id: 'amber-flare',
    name: 'Solstice Amber & Flare Cyan',
    description: 'Warm contrast dual-tone for editorial and production supervisory review.',
    cyan: '#22d3ee',
    blue: '#f59e0b',
    previewGradient: 'from-[#22d3ee] to-[#f59e0b]',
  },
];

// ---------------------------------------------------------------------------
// from organization.ts (relocated access/permission types, org-free)
// ---------------------------------------------------------------------------

export type PermissionKey = string;
export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'archive'
  | 'delete'
  | 'restore'
  | 'assign'
  | 'unassign'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'ingest'
  | 'export'
  | 'execute'
  | 'comment'
  | 'download'
  | 'playback'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_archive'
  | 'bulk_restore'
  | string;
export interface AccessRole extends BaseEntity {
  name: string;
  code?: string;
  description?: string;
  permissions: string[];
  is_system?: boolean;
  category?: string;
  [key: string]: any;
}
export interface AccessGroup extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  role_id?: string;
  member_ids?: string[];
  [key: string]: any;
}
export interface PermissionDefinition {
  code?: string;
  key?: string;
  name: string;
  category?: string;
  module?: string;
  description?: string;
  risk_level?: string;
  [key: string]: any;
}
