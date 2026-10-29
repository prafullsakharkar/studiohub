import { User } from '@/types/identity';
import { Scope, PermissionEvaluationContext, ProjectMembership, ContextEntity } from '@/types/identity';
import {
  evaluateEntityVisibility,
  getUserVendorIds,
  getUserClientIds,
  filterEntitiesForExternalUser,
  isUserAssignedToProject,
} from './externalAccessEngine';
import { getUserProjectMembership, evaluateUserPermission, isBreakGlass } from './rbac';

/**
 * Normalizes any scope string (uppercase/lowercase) into canonical uppercase Scope
 */
export function normalizeScope(scope?: string | null): Scope {
  if (!scope) return 'PROJECT';
  const upper = scope.toUpperCase().trim().replace(/\s+/g, '_');
  switch (upper) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'ORGANIZATION':
      return 'ORGANIZATION';
    case 'PROJECT':
      return 'PROJECT';
    case 'SHOW':
      return 'SHOW';
    case 'DEPARTMENT':
      return 'DEPARTMENT';
    case 'TEAM':
      return 'TEAM';
    case 'VENDOR':
      return 'VENDOR';
    case 'VENDOR_PROJECT':
    case 'VENDOR_+_PROJECT':
      return 'VENDOR_PROJECT';
    case 'VENDOR_PROJECT_ASSIGNED':
    case 'VENDOR_+_PROJECT_+_ASSIGNED':
      return 'VENDOR_PROJECT_ASSIGNED';
    case 'CLIENT':
      return 'CLIENT';
    case 'CLIENT_PROJECT':
    case 'CLIENT_+_PROJECT':
      return 'CLIENT_PROJECT';
    case 'ASSIGNED':
      return 'ASSIGNED';
    case 'OWN':
      return 'OWN';
    default:
      return 'PROJECT';
  }
}

/**
 * Derives default Scope from standard StudioHub role titles or codes
 */
export function getDefaultScopeForRole(roleNameOrCode?: string): Scope {
  if (!roleNameOrCode) return 'PROJECT';
  const normalized = roleNameOrCode.toLowerCase().replace(/[\s_-]+/g, '');

  // 1. GLOBAL (Platform Admin / Superuser only)
  if (
    normalized.includes('platformadmin') ||
    normalized.includes('superuser')
  ) {
    return 'GLOBAL';
  }

  // 2. ORGANIZATION (Tenant level)
  if (
    normalized.includes('orgowner') ||
    normalized.includes('organizationowner') ||
    normalized.includes('orgadmin') ||
    normalized.includes('organizationadmin') ||
    normalized.includes('orgmanager') ||
    normalized.includes('organizationmanager') ||
    normalized.includes('executiveproducer') ||
    normalized.includes('producer') ||
    normalized.includes('productionmanager')
  ) {
    return 'ORGANIZATION';
  }

  // Production Admin -> PROJECT scope
  if (
    normalized.includes('productionadmin') ||
    normalized.includes('prodadmin')
  ) {
    return 'PROJECT';
  }

  // 3. VENDOR & VENDOR ROLES
  if (normalized.includes('vendorartist')) {
    return 'VENDOR_PROJECT_ASSIGNED';
  }
  if (normalized.includes('vendor')) {
    return 'VENDOR_PROJECT';
  }

  // 4. CLIENT
  if (normalized.includes('client')) {
    return 'CLIENT_PROJECT';
  }

  // 5. DEPARTMENT
  if (
    normalized.includes('leadartist') ||
    normalized.includes('craftlead') ||
    normalized.includes('lead') ||
    normalized.includes('departmentmanager') ||
    normalized.includes('deptmanager') ||
    normalized.includes('sequencesupervisor') ||
    normalized.includes('shotsupervisor') ||
    normalized.includes('assetsupervisor')
  ) {
    return 'DEPARTMENT';
  }

  // 6. TEAM (Team Leads, Team Managers)
  if (
    normalized.includes('teammanager') ||
    normalized.includes('teamlead')
  ) {
    return 'TEAM';
  }

  // 7. ASSIGNED (Individual craft contributors)
  if (
    normalized.includes('artist') ||
    normalized.includes('animator') ||
    normalized.includes('modeler') ||
    normalized.includes('lighter') ||
    normalized.includes('compositor') ||
    normalized.includes('roto') ||
    normalized.includes('paint') ||
    normalized.includes('rigging') ||
    normalized.includes('tracking') ||
    normalized.includes('matchmove')
  ) {
    return 'ASSIGNED';
  }

  // 8. Default for Supervisors & Pipeline TDs -> PROJECT
  return 'PROJECT';
}

/**
 * Resolves effective scope from project membership or user roles
 */
export function getEffectiveScope(
  roles?: string | string[],
  explicitScope?: string
): Scope {
  if (explicitScope) {
    return normalizeScope(explicitScope);
  }

  if (Array.isArray(roles) && roles.length > 0) {
    // If multiple roles exist, pick the most permissive scope
    const scopes = roles.map((r) => getDefaultScopeForRole(r));
    const precedence: Scope[] = [
      'GLOBAL',
      'ORGANIZATION',
      'PROJECT',
      'DEPARTMENT',
      'TEAM',
      'VENDOR',
      'CLIENT',
      'ASSIGNED',
      'OWN',
    ];
    for (const p of precedence) {
      if (scopes.includes(p)) return p;
    }
  } else if (typeof roles === 'string') {
    return getDefaultScopeForRole(roles);
  }

  return 'PROJECT';
}

/**
 * Evaluates whether a production entity is within the accessible scope of a user.
 */
export function isEntityInScope(
  user: User | null,
  entity: ContextEntity | any,
  entityType?: string,
  scope?: Scope | string,
  context?: PermissionEvaluationContext
): boolean {
  if (!user) return false;

  // Platform break-glass bypasses entity scoping (strict superuser-only;
  // owners/admins resolve through membership evaluation below).
  if (isBreakGlass(user)) {
    return true;
  }

  // If entity is present, evaluate visibility boundaries first
  if (entity && Object.keys(entity).length > 0) {
    const visResult = evaluateEntityVisibility(user, entity, context);
    if (!visResult.allowed) {
      return false;
    }
  }

  const projId = entity?.project_id || entity?.projectId || context?.projectId;
  const resolvedScope =
    scope ||
    context?.scope ||
    (projId ? getUserProjectMembership(user, projId)?.scope : undefined) ||
    getEffectiveScope(user.role);
  const activeScope = normalizeScope(resolvedScope);

  // 1. GLOBAL Scope: access allowed across whole platform
  if (activeScope === 'GLOBAL') {
    return true;
  }

  // If entity is empty/null, return true (route-level or non-entity checks)
  if (!entity || Object.keys(entity).length === 0) {
    return true;
  }

  // 2. ORGANIZATION Scope: legacy tenant tier — no tenant boundary remains,
  // so the entity is within reach (permission codes still gate the action).
  if (activeScope === 'ORGANIZATION') {
    return true;
  }

  // 3. PROJECT Scope: must belong to the active project
  if (activeScope === 'PROJECT') {
    const projId = entity.project_id || entity.projectId;
    if (projId) {
      if (context?.projectId && projId !== context.projectId) {
        return false;
      }
      if (!isUserAssignedToProject(user, projId)) {
        return false;
      }
    }
    return true;
  }

  // 4. SHOW Scope: must belong to the active project and show
  if (activeScope === 'SHOW') {
    const projId = entity.project_id || entity.projectId;
    if (projId) {
      if (context?.projectId && projId !== context.projectId) {
        return false;
      }
      if (!isUserAssignedToProject(user, projId)) {
        return false;
      }
    }
    const showId = entity.show_id || entity.showId;
    if (showId && context?.showId && showId !== context.showId) {
      return false;
    }
    return true;
  }

  // 4. VENDOR_PROJECT / VENDOR Scope: project assignment + vendor isolation
  if (activeScope === 'VENDOR_PROJECT' || activeScope === 'VENDOR') {
    const projId = entity.project_id || entity.projectId;
    if (projId && !isUserAssignedToProject(user, projId)) {
      return false;
    }

    const userVendorIds = getUserVendorIds(user);
    if (userVendorIds.length > 0) {
      const entityVendorId = entity.vendor_id || entity.vendorId;
      const entityVendorIds = entity.vendor_ids || entity.vendorIds || [];
      const allowedVendorIds = entity.allowed_vendor_ids || entity.allowedVendorIds || [];

      if (entityVendorId && !userVendorIds.includes(entityVendorId)) {
        return false;
      }
      if (entityVendorIds.length > 0 && !userVendorIds.some((id) => entityVendorIds.includes(id))) {
        return false;
      }
      if (allowedVendorIds.length > 0 && !userVendorIds.some((id) => allowedVendorIds.includes(id))) {
        return false;
      }
    }

    return true;
  }

  // 5. VENDOR_PROJECT_ASSIGNED Scope (Vendor Artist)
  if (activeScope === 'VENDOR_PROJECT_ASSIGNED') {
    const projId = entity.project_id || entity.projectId;
    if (projId && !isUserAssignedToProject(user, projId)) {
      return false;
    }

    const userVendorIds = getUserVendorIds(user);
    const entityVendorId = entity.vendor_id || entity.vendorId;
    if (entityVendorId && userVendorIds.length > 0 && !userVendorIds.includes(entityVendorId)) {
      return false;
    }

    // Must be directly assigned or assigned to their vendor
    return isDirectlyAssigned(user, entity) || Boolean(entityVendorId && userVendorIds.includes(entityVendorId));
  }

  // 6. CLIENT_PROJECT / CLIENT Scope: client-visible and project assigned
  if (activeScope === 'CLIENT_PROJECT' || activeScope === 'CLIENT') {
    const projId = entity.project_id || entity.projectId;
    if (projId && !isUserAssignedToProject(user, projId)) {
      return false;
    }

    const isVisible =
      entity.is_client_visible === true ||
      entity.client_visible === true ||
      entity.isClientVisible === true ||
      entity.visibility === 'CLIENT' ||
      entity.visibility === 'PUBLIC' ||
      entity.client_approved === true ||
      entity.clientApproved === true ||
      entity.status === 'Approved' ||
      entity.status === 'Client Review' ||
      entity.status === 'Published' ||
      entity.cut_type === 'Client Conformed' ||
      entity.category === 'Client Deliverable';

    if (!isVisible) return false;

    const userClientIds = getUserClientIds(user);
    const entityClientId = entity.client_id || entity.clientId;
    if (entityClientId && userClientIds.length > 0 && !userClientIds.includes(entityClientId)) {
      return false;
    }

    return true;
  }

  // 7. DEPARTMENT Scope: entity department matches user/membership department
  if (activeScope === 'DEPARTMENT') {
    const userDept = context?.department || user.department;
    const entityDept = entity.department || entity.departmentId || entity.department_id;
    if (!entityDept || !userDept) return true;
    if (
      entityDept.toLowerCase().trim() === userDept.toLowerCase().trim() ||
      userDept.toLowerCase().includes(entityDept.toLowerCase()) ||
      entityDept.toLowerCase().includes(userDept.toLowerCase())
    ) {
      return true;
    }
    // Fallback: direct assignment on entity overrides department mismatch
    return isDirectlyAssigned(user, entity);
  }

  // 8. TEAM Scope: entity assigned team matches user/context team (or lead oversight)
  if (activeScope === 'TEAM') {
    const userTeam = context?.teamId || (user as any).team_id;
    const entityTeam = entity.team_id || entity.teamId || entity.assigned_team_id;
    if (userTeam && entityTeam && entityTeam === userTeam) {
      return true;
    }

    if (hasLeadDepartmentOversight(user, context)) {
      const userDept = context?.department || user.department;
      const entityDept = entity.department || entity.departmentId || entity.department_id;
      if (!entityDept || !userDept || entityDept.toLowerCase().trim() === userDept.toLowerCase().trim()) {
        return true;
      }
    }
    if (!entityTeam && !userTeam) {
      return true;
    }
    return isDirectlyAssigned(user, entity);
  }

  // 9. ASSIGNED Scope: user must be directly assigned or supervisor of the entity
  if (activeScope === 'ASSIGNED') {
    return isDirectlyAssigned(user, entity);
  }

  // 10. OWN Scope: user is the author or creator
  if (activeScope === 'OWN') {
    return isEntityOwner(user, entity);
  }

  return true;
}

/**
 * Lead-equivalent oversight grant for TEAM-scope department visibility.
 * Verified against SYSTEM_ROLE_TEMPLATES: `lead_artist` holds `shot.submit`
 * while `senior_artist`, `artist`, every craft-artist template, and
 * `team_manager` do not — so this grant distinguishes department leads from
 * the non-lead artist family with an unchanged allow/deny matrix.
 */
const LEAD_DEPARTMENT_OVERSIGHT_PERMISSION = 'shot.submit';

/**
 * Resolves lead-equivalent department oversight via the canonical permission
 * evaluator (no production role-name literals). Checks the org-level role and
 * each project membership. The evaluation context never carries an entity, so
 * this cannot recurse back into isEntityInScope.
 */
function hasLeadDepartmentOversight(
  user: User,
  context?: PermissionEvaluationContext
): boolean {
  // Global role / direct user grants.
  if (evaluateUserPermission(user, LEAD_DEPARTMENT_OVERSIGHT_PERMISSION, undefined)) {
    return true;
  }

  // Project-membership roles: any membership standing in a lead-equivalent
  // position grants oversight (mirrors the previous membership name check).
  if (Array.isArray(user.project_memberships)) {
    return user.project_memberships.some((pm: any) => {
      const projectId = pm.project_id || pm.projectId;
      if (!projectId) return false;
      return evaluateUserPermission(user, LEAD_DEPARTMENT_OVERSIGHT_PERMISSION, {
        projectId,
      });
    });
  }

  return false;
}

/**
 * Helper to check if a user is directly assigned to an entity
 */
function isDirectlyAssigned(user: User, entity: any): boolean {
  const userId = user.id;
  const userFullName = (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`).trim().toLowerCase();

  // Tasks
  if (
    entity.assignee_id === userId ||
    entity.assigneeId === userId ||
    (entity.assignee_name && entity.assignee_name.toLowerCase().trim() === userFullName)
  ) {
    return true;
  }

  // Shots & Assets
  if (
    entity.assigned_artist_id === userId ||
    entity.assignedArtistId === userId ||
    (entity.assigned_artist_name && entity.assigned_artist_name.toLowerCase().trim() === userFullName) ||
    (entity.lead_artist && entity.lead_artist.toLowerCase().trim() === userFullName) ||
    entity.supervisor_id === userId ||
    entity.supervisorId === userId
  ) {
    return true;
  }

  // Versions
  if (
    entity.artist_id === userId ||
    entity.artistId === userId ||
    (entity.artist_name && entity.artist_name.toLowerCase().trim() === userFullName) ||
    entity.uploaded_by_id === userId ||
    entity.uploadedById === userId
  ) {
    return true;
  }

  // Reviews
  if (
    entity.reviewer_id === userId ||
    entity.reviewerId === userId ||
    entity.lead_reviewer_id === userId ||
    entity.leadReviewerId === userId ||
    (entity.lead_reviewer_name && entity.lead_reviewer_name.toLowerCase().trim() === userFullName) ||
    (Array.isArray(entity.reviewer_ids) && entity.reviewer_ids.includes(userId)) ||
    (Array.isArray(entity.attendees) && entity.attendees.some((a: any) => a.id === userId || a.email === user.email))
  ) {
    return true;
  }

  // Notes
  if (
    entity.author_id === userId ||
    entity.authorId === userId ||
    (entity.author_name && entity.author_name.toLowerCase().trim() === userFullName) ||
    entity.recipient_id === userId ||
    entity.recipientId === userId ||
    (Array.isArray(entity.mentions) && entity.mentions.includes(userId))
  ) {
    return true;
  }

  // Sequences
  if (
    (entity.lead_artist && entity.lead_artist.toLowerCase().trim() === userFullName) ||
    entity.supervisor_id === userId ||
    entity.supervisorId === userId
  ) {
    return true;
  }

  // Creator check fallback
  return isEntityOwner(user, entity);
}

/**
 * Helper to check if a user is the creator / author of an entity
 */
function isEntityOwner(user: User, entity: any): boolean {
  const userId = user.id;
  const userFullName = (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`).trim().toLowerCase();

  return Boolean(
    entity.created_by === userId ||
    entity.createdById === userId ||
    entity.author_id === userId ||
    entity.authorId === userId ||
    entity.user_id === userId ||
    entity.userId === userId ||
    (entity.created_by_name && entity.created_by_name.toLowerCase().trim() === userFullName) ||
    (entity.author_name && entity.author_name.toLowerCase().trim() === userFullName)
  );
}

/**
 * Filters an array of entities based on user scope and context.
 * Applies authoritative external data-access layer filtering first, followed by scope verification.
 */
export function filterEntitiesByScope<T = any>(
  user: User | null,
  entities: T[],
  entityType?: string,
  context?: PermissionEvaluationContext
): T[] {
  if (!user || !Array.isArray(entities)) return [];
  if (isBreakGlass(user)) {
    return entities;
  }

  const externalFiltered = filterEntitiesForExternalUser(user, entities, entityType, context);

  return externalFiltered.filter((item) =>
    isEntityInScope(user, item, entityType, context?.scope, context)
  );
}
