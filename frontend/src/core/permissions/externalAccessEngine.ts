import { User, getUserMembershipType, MembershipType } from '@/types/identity';
import { PermissionEvaluationContext, ResourceVisibility, Scope } from '@/types/identity';
import { getUserProjectMembership } from './rbac';

export interface VisibilityEvaluationResult {
  allowed: boolean;
  reason?: string;
  visibility: ResourceVisibility;
}

export interface ExternalAccessDecision {
  allowed: boolean;
  status: 200 | 403;
  reason?: string;
  membershipType: MembershipType;
  effectiveScope?: Scope;
}

/** Backend emits canonical lowercase statuses; accept legacy Title Case too. */
function isActiveStatus(status: unknown): boolean {
  return typeof status === 'string' && status.toLowerCase() === 'active';
}

/**
 * Extracts all Vendor IDs associated with the user across profile, memberships, and project assignments
 */
export function getUserVendorIds(user: User): string[] {
  const ids = new Set<string>();
  if (user.vendor_id) ids.add(user.vendor_id);
  if ((user as any).vendorId) ids.add((user as any).vendorId);

  if (Array.isArray(user.vendor_memberships)) {
    user.vendor_memberships.forEach((vm) => {
      if (vm.vendor_id && isActiveStatus(vm.status)) ids.add(vm.vendor_id);
    });
  }

  if (Array.isArray(user.project_memberships)) {
    user.project_memberships.forEach((pm) => {
      if (pm.vendor_id && isActiveStatus(pm.status)) ids.add(pm.vendor_id);
    });
  }

  return Array.from(ids);
}

/**
 * Extracts all Client IDs associated with the user across profile, memberships, and project assignments
 */
export function getUserClientIds(user: User): string[] {
  const ids = new Set<string>();
  if (user.client_id) ids.add(user.client_id);
  if ((user as any).clientId) ids.add((user as any).clientId);

  if (Array.isArray(user.client_memberships)) {
    user.client_memberships.forEach((cm) => {
      if (cm.client_id && isActiveStatus(cm.status)) ids.add(cm.client_id);
    });
  }

  if (Array.isArray(user.project_memberships)) {
    user.project_memberships.forEach((pm) => {
      if (pm.client_id && isActiveStatus(pm.status)) ids.add(pm.client_id);
    });
  }

  return Array.from(ids);
}

/**
 * Checks if a user has active project membership or authorized access to a given project
 */
export function isUserAssignedToProject(user: User, projectId: string): boolean {
  if (!user || !projectId) return false;
  if (user.is_active === false) return false;

  // Strict superuser-only (spec §1): role labels grant nothing on their own.
  if (user.is_superuser) {
    return true;
  }

  // Direct project membership check (canonical project-level assignment)
  const projMem = getUserProjectMembership(user, projectId);
  if (projMem && (projMem.status?.toLowerCase() === 'active' || !projMem.status)) {
    return true;
  }

  // Check vendor memberships assigned to project
  if (Array.isArray(user.vendor_memberships)) {
    const hasVendorProj = user.vendor_memberships.some(
      (vm) =>
        (vm.status?.toLowerCase() === 'active' || !vm.status) &&
        Array.isArray(vm.project_ids) &&
        vm.project_ids.includes(projectId)
    );
    if (hasVendorProj) return true;
  }

  // Check client memberships assigned to project
  if (Array.isArray(user.client_memberships)) {
    const hasClientProj = user.client_memberships.some(
      (cm) =>
        (cm.status?.toLowerCase() === 'active' || !cm.status) &&
        Array.isArray(cm.project_ids) &&
        cm.project_ids.includes(projectId)
    );
    if (hasClientProj) return true;
  }

  return false;
}

/**
 * Resolves normalized entity visibility: INTERNAL | VENDOR | CLIENT | PUBLIC
 */
export function resolveEntityVisibility(entity: any): ResourceVisibility {
  if (!entity || typeof entity !== 'object') return 'INTERNAL';

  if (entity.visibility) {
    const v = String(entity.visibility).toUpperCase();
    if (v === 'PUBLIC') return 'PUBLIC';
    if (v === 'CLIENT') return 'CLIENT';
    if (v === 'VENDOR') return 'VENDOR';
    if (v === 'INTERNAL') return 'INTERNAL';
  }

  // Infer from boolean flags
  if (entity.is_public === true || entity.isPublic === true) return 'PUBLIC';
  if (entity.client_visible === true || entity.is_client_visible === true || entity.clientVisible === true) {
    return 'CLIENT';
  }
  if (entity.vendor_visible === true || entity.is_vendor_visible === true || entity.vendorVisible === true) {
    return 'VENDOR';
  }

  // Infer from vendor / client ownership attributes
  if (
    entity.vendor_id ||
    entity.vendorId ||
    (Array.isArray(entity.vendor_ids) && entity.vendor_ids.length > 0)
  ) {
    return 'VENDOR';
  }
  if (
    entity.client_id ||
    entity.clientId ||
    (Array.isArray(entity.client_ids) && entity.client_ids.length > 0)
  ) {
    return 'CLIENT';
  }

  // Certain entity types default to INTERNAL
  if (
    entity.type === 'note' &&
    (entity.is_internal === true || entity.category === 'Internal' || entity.category === 'Private')
  ) {
    return 'INTERNAL';
  }

  return 'INTERNAL';
}

/**
 * Evaluates visibility restrictions based on User membership type and entity flags
 */
export function evaluateEntityVisibility(
  user: User | null,
  entity: any,
  context?: PermissionEvaluationContext
): VisibilityEvaluationResult {
  const visibility = resolveEntityVisibility(entity);

  if (!user) {
    return {
      allowed: visibility === 'PUBLIC',
      reason: visibility === 'PUBLIC' ? undefined : 'Unauthenticated access prohibited',
      visibility,
    };
  }

  // Strict superuser-only bypass (spec §1): role labels grant nothing.
  if (user.is_superuser) {
    return { allowed: true, visibility };
  }

  const membershipType = getUserMembershipType(user);

  // PUBLIC is always visible to authenticated users
  if (visibility === 'PUBLIC') {
    return { allowed: true, visibility };
  }

  // 1. CLIENT USERS
  if (membershipType === 'CLIENT') {
    // Clients can NEVER view INTERNAL or VENDOR-only resources
    if (visibility === 'INTERNAL' || visibility === 'VENDOR') {
      return {
        allowed: false,
        reason: 'Client users cannot access internal production resources',
        visibility,
      };
    }

    // Explicit client visible flag check
    const isClientVisible =
      entity.client_visible === true ||
      entity.is_client_visible === true ||
      entity.clientVisible === true ||
      entity.isClientVisible === true ||
      visibility === 'CLIENT';

    if (!isClientVisible) {
      return {
        allowed: false,
        reason: 'Resource is not marked as client-visible',
        visibility,
      };
    }

    // Client ID isolation check: if entity is restricted to a specific client company
    const entityClientId = entity.client_id || entity.clientId;
    const allowedClientIds = entity.allowed_client_ids || entity.allowedClientIds;
    const userClientIds = getUserClientIds(user);

    if (entityClientId && userClientIds.length > 0 && !userClientIds.includes(entityClientId)) {
      return {
        allowed: false,
        reason: 'Client isolation: resource belongs to a different client organization',
        visibility,
      };
    }

    if (Array.isArray(allowedClientIds) && allowedClientIds.length > 0) {
      const isAllowed = userClientIds.some((id) => allowedClientIds.includes(id));
      if (!isAllowed) {
        return {
          allowed: false,
          reason: 'Client isolation: user client organization is not in allowed list',
          visibility,
        };
      }
    }

    return { allowed: true, visibility };
  }

  // 2. VENDOR USERS
  if (membershipType === 'VENDOR') {
    // Vendors cannot view INTERNAL-only or CLIENT-only resources
    if (visibility === 'INTERNAL' || visibility === 'CLIENT') {
      return {
        allowed: false,
        reason: 'Vendor users cannot access internal or client-only production resources',
        visibility,
      };
    }

    // Vendor ID isolation check: Vendor users must NEVER access other vendors' data
    const entityVendorId = entity.vendor_id || entity.vendorId;
    const entityVendorIds = entity.vendor_ids || entity.vendorIds;
    const allowedVendorIds = entity.allowed_vendor_ids || entity.allowedVendorIds;
    const userVendorIds = getUserVendorIds(user);

    if (userVendorIds.length > 0) {
      if (entityVendorId && !userVendorIds.includes(entityVendorId)) {
        return {
          allowed: false,
          reason: 'Vendor isolation: resource belongs to a different external vendor studio',
          visibility,
        };
      }

      if (Array.isArray(entityVendorIds) && entityVendorIds.length > 0) {
        const matches = userVendorIds.some((id) => entityVendorIds.includes(id));
        if (!matches) {
          return {
            allowed: false,
            reason: 'Vendor isolation: resource is not delegated to user vendor studio',
            visibility,
          };
        }
      }

      if (Array.isArray(allowedVendorIds) && allowedVendorIds.length > 0) {
        const matches = userVendorIds.some((id) => allowedVendorIds.includes(id));
        if (!matches) {
          return {
            allowed: false,
            reason: 'Vendor isolation: user vendor studio is not in the allowed vendor list',
            visibility,
          };
        }
      }
    }

    return { allowed: true, visibility };
  }

  // 3. INTERNAL USERS
  return { allowed: true, visibility };
}

/**
 * Validates external boundaries, role permissions, project assignments, and visibility
 * for any given operation on a resource.
 */
export function evaluateExternalAccess(
  user: User | null,
  action: string,
  resourceType: string,
  entity?: any,
  context?: PermissionEvaluationContext
): ExternalAccessDecision {
  if (!user) {
    return {
      allowed: false,
      status: 403,
      reason: 'User is unauthenticated',
      membershipType: 'INTERNAL',
    };
  }

  const membershipType = getUserMembershipType(user);
  const normResource = resourceType.toLowerCase().trim();
  const normAction = action.toLowerCase().trim();

  // Strict superuser-only override (spec §1): role labels grant nothing.
  if (user.is_superuser) {
    return {
      allowed: true,
      status: 200,
      membershipType,
      effectiveScope: 'GLOBAL',
    };
  }

  // 1. Project Isolation
  const projectId = context?.projectId || entity?.project_id || entity?.projectId;
  if (projectId) {
    const hasProjectAccess = isUserAssignedToProject(user, projectId);
    if (!hasProjectAccess) {
      return {
        allowed: false,
        status: 403,
        reason: `Project isolation violation: user has no membership in project ${projectId}`,
        membershipType,
      };
    }
  }

  // 2. External Visibility Boundaries
  if (entity && Object.keys(entity).length > 0) {
    const visibilityResult = evaluateEntityVisibility(user, entity, context);
    if (!visibilityResult.allowed) {
      return {
        allowed: false,
        status: 403,
        reason: visibilityResult.reason || 'Entity visibility restriction applied',
        membershipType,
      };
    }
  }

  // 3. Role-Specific Boundary Enforcement

  // --- A. CLIENT USERS ---
  if (membershipType === 'CLIENT') {
    // Prohibited resources for clients
    const clientBannedResources = [
      'task',
      'people',
      'department',
      'team',
      'vendor',
      'pipeline',
      'setting',
      'settings',
      'audit',
      'resource',
      'schedule',
    ];
    if (clientBannedResources.includes(normResource)) {
      return {
        allowed: false,
        status: 403,
        reason: `Client users cannot access internal '${normResource}' records`,
        membershipType,
      };
    }

    // Disallow internal notes / production comments
    if (normResource === 'note') {
      if (entity?.is_internal === true || entity?.category === 'Internal' || entity?.category === 'Production') {
        return {
          allowed: false,
          status: 403,
          reason: 'Clients cannot view internal production notes',
          membershipType,
        };
      }
    }

    // Disallow viewing artist rates, vendor rates, contracts
    if (normResource.includes('rate') || normResource.includes('cost') || normResource.includes('salary')) {
      return {
        allowed: false,
        status: 403,
        reason: 'Client users cannot view crew rates or vendor cost records',
        membershipType,
      };
    }

    // Client Viewer: Read-only check
    if (user.role === 'Client Viewer') {
      const allowedViewerActions = ['view', 'read', 'download', 'playback'];
      if (!allowedViewerActions.includes(normAction)) {
        return {
          allowed: false,
          status: 403,
          reason: `Client Viewer is strictly read-only and cannot perform '${normAction}'`,
          membershipType,
        };
      }
    }

    // Client Reviewer: Review mutations allowed, but not project/shot deletion or pipeline alterations
    if (user.role === 'Client Reviewer') {
      const forbiddenReviewerActions = ['delete', 'archive', 'restore', 'create'];
      if (['shot', 'project', 'version'].includes(normResource) && forbiddenReviewerActions.includes(normAction)) {
        return {
          allowed: false,
          status: 403,
          reason: `Client Reviewer cannot ${normAction} ${normResource} records`,
          membershipType,
        };
      }
    }
  }

  // --- B. VENDOR USERS ---
  if (membershipType === 'VENDOR') {
    // Vendor banned internal areas
    const vendorBannedResources = [
      'people',
      'department',
      'client',
      'setting',
      'settings',
      'audit',
    ];
    if (vendorBannedResources.includes(normResource)) {
      return {
        allowed: false,
        status: 403,
        reason: `Vendor users cannot access internal studio '${normResource}' records`,
        membershipType,
      };
    }

    // Disallow internal notes
    if (normResource === 'note') {
      if (entity?.is_internal === true || entity?.category === 'Internal') {
        return {
          allowed: false,
          status: 403,
          reason: 'Vendor users cannot access internal production notes',
          membershipType,
        };
      }
    }

    // Vendor Artist: scope is VENDOR + PROJECT + ASSIGNED
    if (user.role === 'Vendor Artist') {
      if (entity && normResource === 'task') {
        const userId = user.id;
        const isAssigned =
          entity.assignee_id === userId ||
          entity.assigneeId === userId ||
          (entity.assignee_name && entity.assignee_name.toLowerCase() === user.full_name?.toLowerCase());

        const userVendorIds = getUserVendorIds(user);
        const taskVendorId = entity.vendor_id || entity.vendorId;
        const isVendorTask = taskVendorId && userVendorIds.includes(taskVendorId);

        if (!isAssigned && !isVendorTask) {
          return {
            allowed: false,
            status: 403,
            reason: 'Vendor Artist can only access tasks directly assigned to them or their vendor',
            membershipType,
          };
        }
      }
    }

    // Vendor Manager: Can manage vendor users/teams, view deliveries/performance, but NOT studio RBAC or security
    if (user.role === 'Vendor Manager') {
      if (normResource === 'security' || normResource === 'rbac') {
        return {
          allowed: false,
          status: 403,
          reason: 'Vendor Manager cannot manage studio-level RBAC or security settings',
          membershipType,
        };
      }
    }
  }

  // --- C. ARTISTS & CRAFT CONTRIBUTORS ---
  if (membershipType === 'INTERNAL' && user.role) {
    const roleLower = user.role.toLowerCase();

    // Production Admin: Has full production capabilities within scope, but CANNOT administer users, RBAC, billing, security, or platform
    if (
      user.role === 'Production Admin' ||
      user.role === 'production_admin' ||
      roleLower.includes('productionadmin')
    ) {
      const adminBanned = [
        'security',
        'rbac',
        'roles',
        'billing',
        'people',
        'platform',
        'global',
      ];
      if (adminBanned.includes(normResource)) {
        return {
          allowed: false,
          status: 403,
          reason: `Production Admin cannot administer ${normResource} or RBAC`,
          membershipType,
        };
      }
    }

    // Lead Artist: TEAM scope enforcement
    if (user.role === 'Lead Artist') {
      if (
        normResource === 'rbac' ||
        normResource === 'billing' ||
        normResource === 'security'
      ) {
        return {
          allowed: false,
          status: 403,
          reason: `Lead Artist cannot access studio ${normResource} administration`,
          membershipType,
        };
      }
    }

    // Standard Individual Artist (e.g. Artist, Animator, Modeler, Compositor, etc.)
    const isCraftArtist =
      roleLower.includes('artist') ||
      roleLower.includes('animator') ||
      roleLower.includes('modeler') ||
      roleLower.includes('compositor') ||
      roleLower.includes('lighter') ||
      roleLower.includes('roto') ||
      roleLower.includes('paint') ||
      roleLower.includes('tracking') ||
      roleLower.includes('matchmove');

    if (isCraftArtist && user.role !== 'Lead Artist' && user.role !== 'Senior Artist') {
      // Forbidden: RBAC, billing, HR, rates, vendor financial info, client contracts
      const artistBanned = [
        'security',
        'billing',
        'client_contract',
        'vendor_rate',
        'artist_rate',
        'compensation',
      ];
      if (artistBanned.includes(normResource)) {
        return {
          allowed: false,
          status: 403,
          reason: `Artists cannot access confidential ${normResource} data`,
          membershipType,
        };
      }

      // If ASSIGNED scope, cannot mutate or view unassigned tasks outside scope
      if (entity && normResource === 'task' && (normAction === 'update' || normAction === 'complete' || normAction === 'start')) {
        const userId = user.id;
        const isAssigned =
          entity.assignee_id === userId ||
          entity.assigneeId === userId ||
          (entity.assignee_name && entity.assignee_name.toLowerCase() === user.full_name?.toLowerCase());

        if (!isAssigned) {
          return {
            allowed: false,
            status: 403,
            reason: `Artist cannot mutate task '${entity.id}' not assigned to them`,
            membershipType,
          };
        }
      }
    }
  }

  return {
    allowed: true,
    status: 200,
    membershipType,
  };
}

/**
 * Data-access layer filtering: Filters an array of entity records authoritatively
 * before returning them to the frontend. Eliminates CSS-only pseudo-hiding.
 */
export function filterEntitiesForExternalUser<T = any>(
  user: User | null,
  entities: T[],
  entityType?: string,
  context?: PermissionEvaluationContext
): T[] {
  if (!user || !Array.isArray(entities)) return [];

  // Strict superuser-only bypass of data-access filtering (spec §1).
  if (user.is_superuser) {
    return entities;
  }

  const membershipType = getUserMembershipType(user);

  return entities.filter((item: any) => {
    // 1. Project boundary
    const itemProjId = item.project_id || item.projectId;
    if (itemProjId && !isUserAssignedToProject(user, itemProjId)) {
      return false;
    }

    // 2. Visibility boundary
    const visResult = evaluateEntityVisibility(user, item, context);
    if (!visResult.allowed) {
      return false;
    }

    // 3. Membership-specific data filtering
    if (membershipType === 'CLIENT') {
      // Clients never receive internal notes or tasks
      if (entityType === 'task' || item.type === 'task') return false;
      if (item.is_internal === true || item.category === 'Internal') return false;
    }

    if (membershipType === 'VENDOR') {
      // Vendors never receive internal notes
      if (item.is_internal === true || item.category === 'Internal') return false;

      // Vendor Artist only sees tasks assigned to them or their vendor
      if (user.role === 'Vendor Artist' && (entityType === 'task' || item.type === 'task')) {
        const userVendorIds = getUserVendorIds(user);
        const taskVendorId = item.vendor_id || item.vendorId;
        const isAssigned = item.assignee_id === user.id || item.assigneeId === user.id;
        const isVendorTask = taskVendorId && userVendorIds.includes(taskVendorId);
        if (!isAssigned && !isVendorTask) return false;
      }
    }

    return true;
  });
}
