import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActivityLogItem, ActivityFilterOptions } from '@/types/enterprise';
import { mockActivityLogs } from '@/mocks/db/audit/activityEvents';
import { EntityType, EntityId } from '@/types/crud';

interface ActivityState {
  activities: ActivityLogItem[];
  addActivity: (activity: Omit<ActivityLogItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => ActivityLogItem;
  getFilteredActivities: (filters: ActivityFilterOptions) => ActivityLogItem[];
  getActivitiesForEntity: (type: EntityType, id: EntityId) => ActivityLogItem[];
  exportActivitiesAsJSON: (filteredActivities?: ActivityLogItem[]) => string;
  exportActivitiesAsCSV: (filteredActivities?: ActivityLogItem[]) => string;
  resetActivities: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: mockActivityLogs,

      addActivity: (item) => {
        const newLog: ActivityLogItem = {
          ...item,
          id: item.id || `act-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: item.timestamp || new Date().toISOString(),
        };

        set((state) => ({
          activities: [newLog, ...state.activities],
        }));

        return newLog;
      },

      getFilteredActivities: (filters) => {
        const { activities } = get();
        const q = filters.query?.toLowerCase().trim() || '';

        return activities.filter((act) => {
          // Entity type filter
          if (filters.entityType && filters.entityType !== 'all') {
            if (act.entity.type !== filters.entityType) return false;
          }

          // Action type filter
          if (filters.actionType && filters.actionType !== 'all') {
            if (act.action !== filters.actionType) return false;
          }

          // Actor filter
          if (filters.actorId && filters.actorId !== 'all') {
            if (act.actor.id !== filters.actorId) return false;
          }

          // Timeframe filter
          if (filters.timeframe && filters.timeframe !== 'all') {
            const itemTime = new Date(act.timestamp).getTime();
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
            const matchesDescription = act.description.toLowerCase().includes(q);
            const matchesAction = act.actionLabel.toLowerCase().includes(q) || act.action.toLowerCase().includes(q);
            const matchesEntity =
              act.entity.name.toLowerCase().includes(q) ||
              (act.entity.code && act.entity.code.toLowerCase().includes(q)) ||
              (act.entity.context && act.entity.context.toLowerCase().includes(q)) ||
              act.entity.type.toLowerCase().includes(q);
            const matchesActor =
              act.actor.name.toLowerCase().includes(q) ||
              act.actor.email.toLowerCase().includes(q) ||
              act.actor.role.toLowerCase().includes(q);
            const matchesTags = act.tags?.some((t) => t.toLowerCase().includes(q));

            if (!matchesDescription && !matchesAction && !matchesEntity && !matchesActor && !matchesTags) {
              return false;
            }
          }

          return true;
        });
      },

      getActivitiesForEntity: (type, id) => {
        const { activities } = get();
        return activities.filter(
          (act) => act.entity.type === type && (act.entity.id === id || act.entity.code === id)
        );
      },

      exportActivitiesAsJSON: (customList) => {
        const data = customList || get().activities;
        return JSON.stringify(data, null, 2);
      },

      exportActivitiesAsCSV: (customList) => {
        const data = customList || get().activities;
        const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Entity Type', 'Entity Code', 'Entity Name', 'Description', 'IP Address'];
        const rows = data.map((d) => [
          `"${d.timestamp}"`,
          `"${d.actor.name}"`,
          `"${d.actor.email}"`,
          `"${d.actionLabel}"`,
          `"${d.entity.type}"`,
          `"${d.entity.code || d.entity.id}"`,
          `"${d.entity.name.replace(/"/g, '""')}"`,
          `"${d.description.replace(/"/g, '""')}"`,
          `"${d.ipAddress || ''}"`,
        ]);
        return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      },

      resetActivities: () => set({ activities: mockActivityLogs }),
    }),
    {
      name: 'studiohub-activity-log-v1',
    }
  )
);
