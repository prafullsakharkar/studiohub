import { create } from 'zustand';
import type { ActivityLogItem, ActivityFilterOptions } from '@/types/audit';
import type { EntityType, EntityId } from '@/types/common';
import { activityService, type ActivityRecordInput } from '@/core/activity/activityService';

interface ActivityState {
  activities: ActivityLogItem[];
  addActivity: (activity: Omit<ActivityLogItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => ActivityLogItem;
  recordActivity: (input: ActivityRecordInput) => ActivityLogItem | null;
  getFilteredActivities: (filters: ActivityFilterOptions) => ActivityLogItem[];
  getActivitiesForEntity: (type: EntityType | string, id: EntityId | string) => ActivityLogItem[];
  getActivitiesForProject: (projectId: string) => ActivityLogItem[];
  exportActivitiesAsJSON: (filteredActivities?: ActivityLogItem[]) => string;
  exportActivitiesAsCSV: (filteredActivities?: ActivityLogItem[]) => string;
  resetActivities: () => void;
  syncFromDatabase: () => void;
}

// REST-only: the real feed comes from /api/v1/activity/ hooks.
const getInitialActivities = (): ActivityLogItem[] => {
  return [];
};

export const useActivityStore = create<ActivityState>()(
  (set, get) => ({
    activities: getInitialActivities(),

    syncFromDatabase: () => {
      // REST-only: no mock database to sync from.
      set({ activities: [] });
    },

    recordActivity: (input: ActivityRecordInput) => {
      const created = activityService.recordActivity(input);
      if (created) {
        set((state) => ({
          activities: [created, ...state.activities.filter((a) => a.id !== created.id)],
        }));
      }
      return created;
    },

    addActivity: (item) => {
      const actor = activityService.resolveCurrentActor(item.actor as any);
      const newLog: ActivityLogItem = {
        action: (item as any).action || 'update',
        actionLabel: (item as any).actionLabel || 'Updated',
        description: (item as any).description || 'Activity recorded',
        entity: (item as any).entity || {
          type: 'project' as any,
          id: 'proj-001',
          name: 'Project',
        },
        ...item,
        id: item.id || `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: item.timestamp || new Date().toISOString(),
        actor: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
          avatarUrl: actor.avatarUrl || actor.avatar,
        },
      };

      set((state) => ({
        activities: [newLog, ...state.activities.filter((a) => a.id !== newLog.id)],
      }));

      return newLog;
    },

    getFilteredActivities: (filters) => {
      const { activities } = get();
      const q = filters.query?.toLowerCase().trim() || '';

      return activities.filter((act) => {
        // Entity type filter
        if (filters.entityType && filters.entityType !== 'all') {
          const type = act.entity?.type || (act as any).resourceType;
          if (type !== filters.entityType) return false;
        }

        // Action type filter
        if (filters.actionType && filters.actionType !== 'all') {
          if (act.action !== filters.actionType) return false;
        }

        // Actor filter
        if (filters.actorId && filters.actorId !== 'all') {
          if (act.actor?.id !== filters.actorId) return false;
        }

        // Timeframe filter
        if (filters.timeframe && filters.timeframe !== 'all') {
          const itemTime = new Date(act.timestamp || (act as any).createdAt || 0).getTime();
          const now = Date.now();
          if (filters.timeframe === 'today') {
            const oneDay = 24 * 60 * 60 * 1000;
            if (now - itemTime > oneDay) return false;
          } else if (filters.timeframe === '7days') {
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (now - itemTime > sevenDays) return false;
          } else if (filters.timeframe === '30days') {
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            if (now - itemTime > thirtyDays) return false;
          }
        }

        // Search query filter
        if (q) {
          const matchesDescription = act.description?.toLowerCase().includes(q) || false;
          const matchesAction =
            act.actionLabel?.toLowerCase().includes(q) || act.action?.toLowerCase().includes(q) || false;
          const matchesEntity =
            act.entity?.name?.toLowerCase().includes(q) ||
            (act.entity?.code && act.entity.code.toLowerCase().includes(q)) ||
            (act.entity?.context && act.entity.context.toLowerCase().includes(q)) ||
            act.entity?.type?.toLowerCase().includes(q) ||
            false;
          const matchesActor =
            act.actor?.name?.toLowerCase().includes(q) ||
            act.actor?.email?.toLowerCase().includes(q) ||
            act.actor?.role?.toLowerCase().includes(q) ||
            false;
          const matchesTags = act.tags?.some((t) => t.toLowerCase().includes(q)) || false;

          if (!matchesDescription && !matchesAction && !matchesEntity && !matchesActor && !matchesTags) {
            return false;
          }
        }

        return true;
      });
    },

    getActivitiesForEntity: (type, id) => {
      const { activities } = get();
      return activities.filter((act) => {
        const actType = act.entity?.type || (act as any).resourceType;
        const actId = act.entity?.id || (act as any).resourceId;
        const actCode = act.entity?.code;
        return actType === type && (actId === id || actCode === id);
      });
    },

    getActivitiesForProject: (projectId) => {
      const { activities } = get();
      return activities.filter((act) => {
        const pId = (act as any).projectId || (act as any).project_id;
        const matchesEntity = act.entity?.type === 'project' && act.entity?.id === projectId;
        const matchesContext = act.entity?.context?.includes(projectId);
        return pId === projectId || matchesEntity || matchesContext;
      });
    },

    exportActivitiesAsJSON: (customList) => {
      const data = customList || get().activities;
      return JSON.stringify(data, null, 2);
    },

    exportActivitiesAsCSV: (customList) => {
      const data = customList || get().activities;
      const headers = [
        'Timestamp',
        'Actor Name',
        'Actor Email',
        'Action',
        'Entity Type',
        'Entity Code',
        'Entity Name',
        'Description',
        'IP Address',
      ];
      const rows = data.map((d) => [
        `"${d.timestamp || (d as any).createdAt || ''}"`,
        `"${d.actor?.name || ''}"`,
        `"${d.actor?.email || ''}"`,
        `"${d.actionLabel || d.action}"`,
        `"${d.entity?.type || (d as any).resourceType || ''}"`,
        `"${d.entity?.code || d.entity?.id || (d as any).resourceId || ''}"`,
        `"${(d.entity?.name || (d as any).resourceName || '').replace(/"/g, '""')}"`,
        `"${(d.description || '').replace(/"/g, '""')}"`,
        `"${d.ipAddress || ''}"`,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    },

    resetActivities: () => {
      set({ activities: [] });
    },
  })
);
