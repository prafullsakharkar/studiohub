import { apiClient } from '@/api/client/ApiClient';
import {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  Resource,
  ResourceAvailabilityStatus,
  ResourceLeave,
  SchedulingCapacitySummary,
  SchedulingOverbookingAlert,
  StudioHoliday,
} from '@/types/scheduling';

interface Paginated<T> {
  results: T[];
}

function unwrapList<T>(response: T[] | Paginated<T> | undefined | null): T[] {
  if (Array.isArray(response)) return response;
  return response?.results ?? [];
}

const EVENT_TYPE_MAP: Record<string, CalendarEventType> = {
  Meeting: 'meeting',
  Deadline: 'milestone',
  Milestone: 'milestone',
  'Review Session': 'review',
  Holiday: 'holiday',
  Leave: 'leave',
  'Work Block': 'task',
};

function mapEventType(raw: string | undefined): CalendarEventType {
  if (!raw) return 'meeting';
  return EVENT_TYPE_MAP[raw] ?? 'meeting';
}

function mapEvent(raw: any): CalendarEvent {
  return {
    id: raw.id,
    created_at: raw.created_at ?? '',
    updated_at: raw.updated_at ?? '',
    title: raw.title ?? '',
    description: raw.description ?? undefined,
    event_type: mapEventType(raw.event_type),
    start_date: raw.start_time,
    end_date: raw.end_time,
    all_day: raw.is_all_day ?? false,
    status: (raw.status as CalendarEventStatus) ?? 'Scheduled',
    priority: 'Medium',
    project_id: raw.project ?? undefined,
    project_name: raw.project_name ?? undefined,
    location_or_link: raw.location || raw.meeting_url || undefined,
    assignee_ids: [],
    assignee_names: [],
    is_overbooked: false,
    metadata: raw.metadata,
  };
}

function mapResource(raw: any): Resource {
  const type = (raw.resource_type ?? 'Person').toLowerCase();
  return {
    id: raw.id,
    created_at: raw.created_at ?? '',
    updated_at: raw.updated_at ?? '',
    type: type as Resource['type'],
    name: raw.name ?? '',
    code: raw.code ?? '',
    department_id: raw.department ?? undefined,
    department_name: raw.department_name ?? undefined,
    team_id: raw.team ?? undefined,
    team_name: raw.team_name ?? undefined,
    capacity_weekly_hours: raw.capacity_hours_per_week ?? 40,
    capacity_daily_hours: (raw.capacity_hours_per_week ?? 40) / 5,
    assigned_hours_current_week: 0,
    utilization_pct: 0,
    availability_status: (raw.status ?? 'Active') as ResourceAvailabilityStatus,
    active_assignments_count: 0,
    assignments: [],
    leaves: [],
    is_overbooked: false,
  };
}

function mapHoliday(raw: any): StudioHoliday {
  return {
    id: raw.id,
    name: raw.name ?? '',
    date: raw.holiday_date,
    type: 'National Holiday',
    office_id: raw.organization ?? undefined,
    office_name: undefined,
  };
}

function mapLeave(raw: any): ResourceLeave {
  return {
    id: raw.id,
    resource_id: raw.resource ?? '',
    resource_name: raw.resource_name ?? '',
    leave_type: (raw.leave_type as ResourceLeave['leave_type']) ?? 'Annual Leave',
    start_date: raw.start_date,
    end_date: raw.end_date,
    total_days: raw.total_days ?? 1,
    status: (raw.status as ResourceLeave['status']) ?? 'Pending',
    notes: raw.reason || raw.rejection_reason || undefined,
  };
}

export class SchedulingRepository {
  async getEvents(params?: Record<string, any>): Promise<CalendarEvent[]> {
    const response = await apiClient.get<any[] | Paginated<any>>('/api/v1/scheduling/events/', { params });
    return unwrapList(response).map(mapEvent);
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    const raw = await apiClient.get<any>(`/api/v1/scheduling/events/${id}/`);
    return mapEvent(raw);
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const raw = await apiClient.post<any>('/api/v1/scheduling/events/', event);
    return mapEvent(raw);
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const raw = await apiClient.patch<any>(`/api/v1/scheduling/events/${id}/`, updates);
    return mapEvent(raw);
  }

  async deleteEvent(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/scheduling/events/${id}/`);
  }

  async getResources(params?: Record<string, any>): Promise<Resource[]> {
    const response = await apiClient.get<any[] | Paginated<any>>('/api/v1/scheduling/resources/', { params });
    return unwrapList(response).map(mapResource);
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    const raw = await apiClient.patch<any>(`/api/v1/scheduling/resources/${id}/`, updates);
    return mapResource(raw);
  }

  async getCapacitySummary(): Promise<SchedulingCapacitySummary[]> {
    return apiClient.get<SchedulingCapacitySummary[]>('/api/v1/scheduling/capacity/');
  }

  async getOverbookingAlerts(): Promise<SchedulingOverbookingAlert[]> {
    return apiClient.get<SchedulingOverbookingAlert[]>('/api/v1/scheduling/overbooking/');
  }

  async resolveOverbooking(alertId: string, resourceId?: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>('/api/v1/scheduling/resolve-overbooking/', {
      alert_id: alertId,
      resource_id: resourceId,
    });
  }

  async getHolidays(): Promise<StudioHoliday[]> {
    const response = await apiClient.get<any[] | Paginated<any>>('/api/v1/scheduling/holidays/');
    return unwrapList(response).map(mapHoliday);
  }

  async getLeaves(): Promise<ResourceLeave[]> {
    const response = await apiClient.get<any[] | Paginated<any>>('/api/v1/scheduling/leaves/');
    return unwrapList(response).map(mapLeave);
  }

  async createLeave(leave: Partial<ResourceLeave>): Promise<ResourceLeave> {
    const raw = await apiClient.post<any>('/api/v1/scheduling/leaves/', leave);
    return mapLeave(raw);
  }
}

export const schedulingRepository = new SchedulingRepository();
