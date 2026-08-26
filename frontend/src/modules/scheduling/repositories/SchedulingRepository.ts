import { apiClient } from '@/api/client/ApiClient';
import {
  CalendarEvent,
  Resource,
  SchedulingCapacitySummary,
  SchedulingOverbookingAlert,
  StudioHoliday,
  ResourceLeave,
} from '@/types/scheduling';

export class SchedulingRepository {
  async getEvents(params?: Record<string, any>): Promise<CalendarEvent[]> {
    return apiClient.get<CalendarEvent[]>('/api/v1/scheduling/events/', { params });
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    return apiClient.get<CalendarEvent>(`/api/v1/scheduling/events/${id}/`);
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return apiClient.post<CalendarEvent>('/api/v1/scheduling/events/', event);
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return apiClient.patch<CalendarEvent>(`/api/v1/scheduling/events/${id}/`, updates);
  }

  async deleteEvent(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/scheduling/events/${id}/`);
  }

  async getResources(params?: Record<string, any>): Promise<Resource[]> {
    return apiClient.get<Resource[]>('/api/v1/scheduling/resources/', { params });
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    return apiClient.patch<Resource>(`/api/v1/scheduling/resources/${id}/`, updates);
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
    return apiClient.get<StudioHoliday[]>('/api/v1/scheduling/holidays/');
  }

  async getLeaves(): Promise<ResourceLeave[]> {
    return apiClient.get<ResourceLeave[]>('/api/v1/scheduling/leaves/');
  }

  async createLeave(leave: Partial<ResourceLeave>): Promise<ResourceLeave> {
    return apiClient.post<ResourceLeave>('/api/v1/scheduling/leaves/', leave);
  }
}

export const schedulingRepository = new SchedulingRepository();

