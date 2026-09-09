import { useQuery } from '@tanstack/react-query';
import { schedulingRepository } from '../repositories/SchedulingRepository';

export const SCHEDULING_QUERY_KEYS = {
  all: ['scheduling'] as const,
  events: () => [...SCHEDULING_QUERY_KEYS.all, 'events'] as const,
  resources: () => [...SCHEDULING_QUERY_KEYS.all, 'resources'] as const,
  holidays: () => [...SCHEDULING_QUERY_KEYS.all, 'holidays'] as const,
  leaves: () => [...SCHEDULING_QUERY_KEYS.all, 'leaves'] as const,
  capacity: () => [...SCHEDULING_QUERY_KEYS.all, 'capacity'] as const,
  overbooking: () => [...SCHEDULING_QUERY_KEYS.all, 'overbooking'] as const,
};

export function useSchedulingEvents() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.events(),
    queryFn: () => schedulingRepository.getEvents(),
  });
}

export function useSchedulingResources() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.resources(),
    queryFn: () => schedulingRepository.getResources(),
  });
}

export function useSchedulingHolidays() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.holidays(),
    queryFn: () => schedulingRepository.getHolidays(),
  });
}

export function useSchedulingLeaves() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.leaves(),
    queryFn: () => schedulingRepository.getLeaves(),
  });
}

export function useCapacitySummary() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.capacity(),
    queryFn: () => schedulingRepository.getCapacitySummary(),
  });
}

export function useOverbookingAlerts() {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.overbooking(),
    queryFn: () => schedulingRepository.getOverbookingAlerts(),
  });
}
