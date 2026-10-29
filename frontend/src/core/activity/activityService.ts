import { queryClient } from '@/providers/QueryProvider';
import { ActivityLogItem, ActivityDiff } from '@/types/audit';
import { EntityType } from '@/types/common';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'archived'
  | 'restored'
  | 'assigned'
  | 'unassigned'
  | 'invited'
  | 'activated'
  | 'suspended'
  | 'removed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'reopened'
  | 'closed'
  | 'published'
  | 'withdrawn'
  | 'status_changed'
  | 'priority_changed'
  | 'commented'
  | 'member_added'
  | 'member_removed'
  | 'role_assigned'
  | 'role_removed'
  | 'logged_time'
  | 'relationship_created'
  | 'relationship_removed';

export type ActivityResourceType =
  | 'project'
  | 'episode'
  | 'sequence'
  | 'shot'
  | 'asset'
  | 'task'
  | 'timelog'
  | 'version'
  | 'review'
  | 'note'
  | 'delivery'
  | 'playlist'
  | 'organization'
  | 'client'
  | 'vendor'
  | 'person'
  | 'department'
  | 'team'
  | 'office'
  | 'role'
  | 'membership'
  | 'media';

export interface ActivityActor {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  avatar?: string;
  department?: string;
}

export interface ActivityRecordInput {
  action: ActivityAction | string;
  actionLabel?: string;
  resourceType: ActivityResourceType | string;
  resourceId: string;
  resourceName?: string;
  resourceCode?: string;
  organizationId?: string | null;
  projectId?: string | null;
  projectName?: string;
  projectCode?: string;
  description?: string;
  diffs?: ActivityDiff[];
  metadata?: Record<string, unknown>;
  actor?: ActivityActor;
  tags?: string[];
  context?: string;
}

// In-memory deduplication cache: `${actorId}:${action}:${resourceType}:${resourceId}:${summary}` -> timestamp
const deduplicationCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 2500;

// REST-only in-memory activity buffer. The real feed comes from /api/v1/activity/ hooks.
const activityMemory: ActivityLogItem[] = [];

const FALLBACK_ACTOR: ActivityActor = {
  id: 'usr-001',
  name: 'Alex Chen',
  email: 'alex.chen@nexusvfx.com',
  role: 'VFX Supervisor',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  department: 'Supervision',
};

export class ActivityService {
  /**
   * Resolves the current actor. REST-only: returns the explicit actor or a
   * static fallback (real identity comes from the auth context / API).
   */
  public resolveCurrentActor(explicitActor?: ActivityActor): ActivityActor {
    if (explicitActor && explicitActor.id && explicitActor.name) {
      return {
        ...explicitActor,
        avatarUrl: explicitActor.avatarUrl || explicitActor.avatar,
      };
    }

    return { ...FALLBACK_ACTOR };
  }

  /**
   * Resolves project scoping from the input. No org dimension: the
   * organization app is gone and the org id is no longer read from
   * localStorage.
   */
  private resolveScoping(input: ActivityRecordInput): { organizationId: string; projectId: string | null } {
    const projectId = input.projectId || null;

    return {
      organizationId: input.organizationId || '',
      projectId: projectId || null,
    };
  }

  /**
   * Generates a human-friendly action label (e.g. "Task Assigned", "Shot Approved").
   */
  private formatActionLabel(action: string, resourceType: string): string {
    const cleanAction = action.replace(/_/g, ' ');
    const titleAction = cleanAction.charAt(0).toUpperCase() + cleanAction.slice(1);
    const titleResource = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

    if (action === 'created') return `Created ${titleResource}`;
    if (action === 'updated') return `Updated ${titleResource}`;
    if (action === 'deleted') return `Deleted ${titleResource}`;
    if (action === 'archived') return `Archived ${titleResource}`;
    if (action === 'restored') return `Restored ${titleResource}`;
    if (action === 'assigned') return `Assigned ${titleResource}`;
    if (action === 'approved') return `Approved ${titleResource}`;
    if (action === 'rejected') return `Rejected ${titleResource}`;
    if (action === 'published') return `Published ${titleResource}`;
    if (action === 'submitted') return `Submitted ${titleResource}`;
    if (action === 'status_changed') return `Status Shifted`;

    return `${titleAction} ${titleResource}`;
  }

  /**
   * Formats a human-readable activity description.
   */
  private formatDescription(
    actor: ActivityActor,
    action: string,
    resourceType: string,
    name: string,
    diffs?: ActivityDiff[]
  ): string {
    const verb = action.replace(/_/g, ' ');
    const subject = `${resourceType} "${name}"`;

    if (diffs && diffs.length > 0) {
      const diffSummary = diffs
        .map((d) => `${d.field}: ${String(d.before ?? (d as any).oldValue ?? 'none')} → ${String(d.after ?? (d as any).newValue ?? 'none')}`)
        .join(', ');
      return `${actor.name} ${verb} ${subject} (${diffSummary})`;
    }

    return `${actor.name} ${verb} ${subject}`;
  }

  /**
   * Main entry point to record a genuine application activity event.
   * Handles deduplication, scoping, in-memory persistence, and store synchronization.
   */
  public recordActivity(input: ActivityRecordInput): ActivityLogItem | null {
    const actor = this.resolveCurrentActor(input.actor);
    const scoping = this.resolveScoping(input);
    const resourceName = input.resourceName || input.resourceCode || input.resourceId;

    // Deduplication check
    const diffSignature = input.diffs ? JSON.stringify(input.diffs) : '';
    const dedupKey = `${actor.id}:${input.action}:${input.resourceType}:${input.resourceId}:${diffSignature}`;
    const now = Date.now();
    const lastSeen = deduplicationCache.get(dedupKey);

    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      // Duplicate event within deduplication window (e.g. from rapid retries or double triggers)
      return null;
    }
    deduplicationCache.set(dedupKey, now);

    // Evict old entries in deduplication cache
    if (deduplicationCache.size > 200) {
      for (const [key, timestamp] of deduplicationCache.entries()) {
        if (now - timestamp > 10000) {
          deduplicationCache.delete(key);
        }
      }
    }

    const isoTimestamp = new Date().toISOString();
    const activityId = `act-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const actionLabel = input.actionLabel || this.formatActionLabel(input.action, input.resourceType);
    const description =
      input.description || this.formatDescription(actor, input.action, input.resourceType, resourceName, input.diffs);

    const tags = input.tags || [
      input.resourceType.charAt(0).toUpperCase() + input.resourceType.slice(1),
      input.action.charAt(0).toUpperCase() + input.action.slice(1),
    ];

    const newActivity: ActivityLogItem = {
      id: activityId,
      timestamp: isoTimestamp,
      action: input.action as any,
      actionLabel,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        avatarUrl: actor.avatarUrl || actor.avatar,
      },
      entity: {
        type: input.resourceType as EntityType,
        id: input.resourceId,
        code: input.resourceCode,
        name: resourceName,
        context: input.context || input.projectCode || input.projectName,
        deepLink: `/${input.resourceType === 'project' ? 'projects' : input.resourceType + 's'}/${input.resourceId}`,
      },
      description,
      diffs: input.diffs,
      tags,
      // Metadata & dual-naming properties for seamless query compatibility
      ...(input.metadata || {}),
      organizationId: scoping.organizationId,
      organization_id: scoping.organizationId,
      projectId: scoping.projectId,
      project_id: scoping.projectId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName,
      createdAt: isoTimestamp,
    };

    // 1. Persist to in-memory buffer (real feed comes from /api/v1/activity/ hooks)
    activityMemory.unshift(newActivity);

    // 2. Invalidate React Query caches for activity feeds
    try {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      if (scoping.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project-activity', scoping.projectId] });
        queryClient.invalidateQueries({ queryKey: ['project-activities', scoping.projectId] });
      }
      if (scoping.organizationId) {
        queryClient.invalidateQueries({ queryKey: ['organization-activity', scoping.organizationId] });
      }
    } catch {
      // QueryClient might not be available in headless context
    }

    return newActivity;
  }

  /**
   * Retrieves activities filtered by scoping rules and search parameters.
   * REST-only: returns [] — the real feed comes from /api/v1/activity/ hooks.
   */
  public getActivities(options?: {
    organizationId?: string | null;
    projectId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    search?: string;
    limit?: number;
  }): ActivityLogItem[] {
    void options;
    return [];
  }
}

export const activityService = new ActivityService();
