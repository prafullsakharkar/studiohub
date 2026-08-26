import { useState, useEffect, useCallback, useMemo } from 'react';
import { schedulingRepository } from '../repositories/SchedulingRepository';
import {
  CalendarEvent,
  CalendarEventType,
  Resource,
  ResourceCategory,
  SchedulingCapacitySummary,
  SchedulingOverbookingAlert,
  StudioHoliday,
  ResourceLeave,
} from '@/types/scheduling';

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

export function useScheduling() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [capacitySummaries, setCapacitySummaries] = useState<SchedulingCapacitySummary[]>([]);
  const [overbookingAlerts, setOverbookingAlerts] = useState<SchedulingOverbookingAlert[]>([]);
  const [holidays, setHolidays] = useState<StudioHoliday[]>([]);
  const [leaves, setLeaves] = useState<ResourceLeave[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [evts, resList, caps, ovb, hols, lvs] = await Promise.all([
        schedulingRepository.getEvents(),
        schedulingRepository.getResources(),
        schedulingRepository.getCapacitySummary(),
        schedulingRepository.getOverbookingAlerts(),
        schedulingRepository.getHolidays(),
        schedulingRepository.getLeaves(),
      ]);
      setEvents(evts);
      setResources(resList);
      setCapacitySummaries(caps);
      setOverbookingAlerts(ovb);
      setHolidays(hols);
      setLeaves(lvs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Event Mutations
  const createEvent = useCallback(async (eventData: Partial<CalendarEvent>) => {
    try {
      const created = await schedulingRepository.createEvent(eventData);
      setEvents((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to create event');
    }
  }, []);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    try {
      const updated = await schedulingRepository.updateEvent(id, updates);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to update event');
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await schedulingRepository.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to delete event');
    }
  }, []);

  const updateResource = useCallback(async (id: string, updates: Partial<Resource>) => {
    try {
      const updated = await schedulingRepository.updateResource(id, updates);
      setResources((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to update resource');
    }
  }, []);

  const resolveOverbooking = useCallback(async (alertId: string, resourceId?: string) => {
    try {
      await schedulingRepository.resolveOverbooking(alertId, resourceId);
      setOverbookingAlerts((prev) => prev.filter((a) => a.id !== alertId));
      if (resourceId) {
        setResources((prev) =>
          prev.map((r) => (r.id === resourceId ? { ...r, is_overbooked: false, overbooking_reason: undefined, utilization_pct: Math.min(100, r.utilization_pct), availability_status: 'Assigned' } : r))
        );
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to resolve overbooking conflict');
    }
  }, []);

  const createLeave = useCallback(async (leaveData: Partial<ResourceLeave>) => {
    try {
      const created = await schedulingRepository.createLeave(leaveData);
      setLeaves((prev) => [created, ...prev]);
      return created;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to submit leave request');
    }
  }, []);

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
    reload: loadData,
    createEvent,
    updateEvent,
    deleteEvent,
    updateResource,
    resolveOverbooking,
    createLeave,
  };
}
