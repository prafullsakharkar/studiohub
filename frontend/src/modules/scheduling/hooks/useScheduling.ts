import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSchedulingEvents,
  useSchedulingResources,
  useSchedulingHolidays,
  useSchedulingLeaves,
  useCapacitySummary,
  useOverbookingAlerts,
  SCHEDULING_QUERY_KEYS,
} from './useSchedulingQueries';
import { useSchedulingMutations } from './useSchedulingMutations';
import { CalendarEvent, Resource, ResourceLeave } from '@/types/scheduling';

export interface SchedulingFilterState {
  search: string;
  projectCode: string;
  eventType: string;
  department: string;
  officeId: string;
  assigneeId: string;
  resourceType: string;
  showOverbookedOnly: boolean;
}

/**
 * Aggregator hook preserving the legacy useScheduling contract, now backed
 * by TanStack Query. Prefer the granular hooks for new code.
 */
export function useScheduling() {
  const queryClient = useQueryClient();
  const eventsQuery = useSchedulingEvents();
  const resourcesQuery = useSchedulingResources();
  const capacityQuery = useCapacitySummary();
  const overbookingQuery = useOverbookingAlerts();
  const holidaysQuery = useSchedulingHolidays();
  const leavesQuery = useSchedulingLeaves();
  const mutations = useSchedulingMutations();

  const events = eventsQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];
  const capacitySummaries = capacityQuery.data ?? [];
  const overbookingAlerts = overbookingQuery.data ?? [];
  const holidays = holidaysQuery.data ?? [];
  const leaves = leavesQuery.data ?? [];

  const loading =
    eventsQuery.isLoading ||
    resourcesQuery.isLoading ||
    capacityQuery.isLoading ||
    overbookingQuery.isLoading ||
    holidaysQuery.isLoading ||
    leavesQuery.isLoading;

  const firstError = [
    eventsQuery.error,
    resourcesQuery.error,
    capacityQuery.error,
    overbookingQuery.error,
    holidaysQuery.error,
    leavesQuery.error,
  ].find((err) => err instanceof Error);
  const error = firstError instanceof Error ? firstError.message : null;

  // Selected date for calendar navigation (Default: 2026-08-26)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 26)); // August 26, 2026

  // Active filters
  const [filters, setFilters] = useState<SchedulingFilterState>({
    search: '',
    projectCode: 'ALL',
    eventType: 'ALL',
    department: 'ALL',
    officeId: 'ALL',
    assigneeId: 'ALL',
    resourceType: 'ALL',
    showOverbookedOnly: false,
  });

  const reload = () =>
    queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.all });

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filters.projectCode !== 'ALL' && e.project_code !== filters.projectCode) {
        return false;
      }
      if (filters.eventType !== 'ALL' && e.event_type !== filters.eventType) {
        return false;
      }
      if (filters.department !== 'ALL' && e.department?.toLowerCase() !== filters.department.toLowerCase()) {
        return false;
      }
      if (filters.officeId !== 'ALL' && e.office_id !== filters.officeId && e.office_id !== 'off-all') {
        return false;
      }
      if (filters.assigneeId !== 'ALL') {
        const matchesAssignee = e.assignee_ids.includes(filters.assigneeId) || e.primary_assignee_id === filters.assigneeId;
        if (!matchesAssignee) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.project_code?.toLowerCase().includes(q) ||
          e.task_code?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [events, filters]);

  // Filtered Resources
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (filters.resourceType !== 'ALL' && r.type !== filters.resourceType) {
        return false;
      }
      if (filters.department !== 'ALL' && r.department_name?.toLowerCase() !== filters.department.toLowerCase()) {
        return false;
      }
      if (filters.officeId !== 'ALL' && r.office_id !== filters.officeId) {
        return false;
      }
      if (filters.showOverbookedOnly && !r.is_overbooked) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.role?.toLowerCase().includes(q) ||
          r.skills?.some((s) => s.toLowerCase().includes(q)) ||
          r.equipment_specs?.gpu?.toLowerCase().includes(q) ||
          r.equipment_specs?.display?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [resources, filters]);

  return {
    events,
    filteredEvents,
    resources,
    filteredResources,
    capacitySummaries,
    overbookingAlerts,
    holidays,
    leaves,
    loading,
    error,
    currentDate,
    setCurrentDate,
    filters,
    setFilters,
    reload,
    createEvent: (eventData: Partial<CalendarEvent>) =>
      mutations.createEvent(eventData),
    updateEvent: (id: string, updates: Partial<CalendarEvent>) =>
      mutations.updateEvent({ id, updates }),
    deleteEvent: (id: string) => mutations.deleteEvent(id),
    updateResource: (id: string, updates: Partial<Resource>) =>
      mutations.updateResource({ id, updates }),
    resolveOverbooking: async (alertId: string, resourceId?: string): Promise<void> => {
      await mutations.resolveOverbooking({ alertId, resourceId });
    },
    createLeave: (leaveData: Partial<ResourceLeave>) =>
      mutations.createLeave(leaveData),
  };
}
