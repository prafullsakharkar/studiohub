import { useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulingRepository } from '../repositories/SchedulingRepository';
import { CalendarEvent, Resource, ResourceLeave } from '@/types/scheduling';
import { SCHEDULING_QUERY_KEYS } from './useSchedulingQueries';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useSchedulingMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.events() });
  };
  const invalidateResources = () => {
    queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.resources() });
  };
  const invalidateLeaves = () => {
    queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.leaves() });
  };
  const invalidateOverbooking = () => {
    queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.overbooking() });
  };

  const createEventMutation = useMutation({
    mutationFn: (eventData: Partial<CalendarEvent>) =>
      schedulingRepository.createEvent(eventData),
    onSuccess: (created) => {
      invalidateEvents();
      addNotification({
        type: 'success',
        title: 'Event Created',
        message: `"${created.title}" was added to the schedule.`,
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) =>
      schedulingRepository.updateEvent(id, updates),
    onSuccess: (updated) => {
      invalidateEvents();
      addNotification({
        type: 'info',
        title: 'Event Updated',
        message: `"${updated.title}" was updated.`,
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => schedulingRepository.deleteEvent(id),
    onSuccess: () => {
      invalidateEvents();
      addNotification({
        type: 'info',
        title: 'Event Deleted',
        message: 'The calendar event was removed.',
      });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Resource> }) =>
      schedulingRepository.updateResource(id, updates),
    onSuccess: (updated) => {
      invalidateResources();
      addNotification({
        type: 'info',
        title: 'Resource Updated',
        message: `"${updated.name}" was updated.`,
      });
    },
  });

  const resolveOverbookingMutation = useMutation({
    mutationFn: ({ alertId, resourceId }: { alertId: string; resourceId?: string }) =>
      schedulingRepository.resolveOverbooking(alertId, resourceId),
    onSuccess: () => {
      invalidateOverbooking();
      invalidateResources();
      addNotification({
        type: 'success',
        title: 'Conflict Resolved',
        message: 'The overbooking conflict was resolved.',
      });
    },
  });

  const createLeaveMutation = useMutation({
    mutationFn: (leaveData: Partial<ResourceLeave>) =>
      schedulingRepository.createLeave(leaveData),
    onSuccess: () => {
      invalidateLeaves();
      addNotification({
        type: 'success',
        title: 'Leave Submitted',
        message: 'The leave request was submitted for approval.',
      });
    },
  });

  return {
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    updateResource: updateResourceMutation.mutateAsync,
    resolveOverbooking: resolveOverbookingMutation.mutateAsync,
    createLeave: createLeaveMutation.mutateAsync,
    isCreatingEvent: createEventMutation.isPending,
  };
}
