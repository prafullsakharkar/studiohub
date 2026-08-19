// Notification Hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationService } from '@/modules/platform/api/NotificationService';
import {
    NotificationTemplate,
    Webhook,
    PageRequest,
    PlatformChannel,
    PlatformEventType,
    PlatformPriority,
} from '@/modules/platform/types';

const notificationService = new NotificationService();

// Query keys
export const notificationQueryKeys = {
    all: ['platform', 'notifications'] as const,
    lists: (params?: PageRequest & { channel?: PlatformChannel; status?: string; priority?: PlatformPriority; type?: PlatformEventType; read?: boolean; archived?: boolean }) =>
        [...notificationQueryKeys.all, 'list', params] as const,
    list: (params?: PageRequest) => [...notificationQueryKeys.all, 'list', params] as const,
    unreadCount: () => [...notificationQueryKeys.all, 'unread-count'] as const,
    detail: (id: string) => [...notificationQueryKeys.all, 'detail', id] as const,
    templates: (params?: PageRequest & { event_type?: PlatformEventType; channel?: PlatformChannel; is_active?: boolean }) =>
        [...notificationQueryKeys.all, 'templates', params] as const,
    template: (id: string) => [...notificationQueryKeys.all, 'templates', id] as const,
    webhooks: (params?: PageRequest & { status?: 'ACTIVE' | 'DISABLED'; event?: string }) =>
        [...notificationQueryKeys.all, 'webhooks', params] as const,
    webhook: (id: string) => [...notificationQueryKeys.all, 'webhooks', id] as const,
    deliveryLogs: (params?: PageRequest & { webhook_id?: string; event_id?: string; status_code?: number }) =>
        [...notificationQueryKeys.all, 'delivery-logs', params] as const,
    deliveryLog: (id: string) => [...notificationQueryKeys.all, 'delivery-logs', id] as const,
    preferences: () => [...notificationQueryKeys.all, 'preferences'] as const,
};

// Hooks
export const useNotifications = (params?: PageRequest & {
    channel?: PlatformChannel;
    status?: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';
    priority?: PlatformPriority;
    type?: PlatformEventType;
    read?: boolean;
    archived?: boolean;
    date_from?: string;
    date_to?: string;
    user?: string;
    organization?: string;
    module?: string;
}) => {
    return useQuery({
        queryKey: notificationQueryKeys.lists(params),
        queryFn: () => notificationService.getNotifications(params),
        // keepPreviousData: true, // Removed - use placeholderData instead for React Query v5
    });
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: notificationQueryKeys.unreadCount(),
        queryFn: () => notificationService.getUnreadCount(),
    });
};

export const useNotification = (id: string) => {
    return useQuery({
        queryKey: notificationQueryKeys.detail(id),
        queryFn: () => notificationService.getNotifications({ id }),
        enabled: !!id,
    });
};

export const useMarkAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.markAsRead(id),
        onSuccess: (_: unknown, id: string) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

export const useMarkAsUnread = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.markAsUnread(id),
        onSuccess: (_: unknown, id: string) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

export const useMarkAllAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => notificationService.markAllAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

export const useArchive = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.archive(id),
        onSuccess: (_: unknown, id: string) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
        },
    });
};

export const useUnarchive = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.unarchive(id),
        onSuccess: (_: unknown, id: string) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
        },
    });
};

export const useDeleteNotification = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.delete(id),
        onSuccess: (_: unknown, id: string) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

export const useBulkMarkRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) => notificationService.bulkMarkRead(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

export const useBulkArchive = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) => notificationService.bulkArchive(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
        },
    });
};

export const useBulkDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) => notificationService.bulkDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount() });
        },
    });
};

// Template hooks
export const useNotificationTemplates = (params?: PageRequest & {
    event_type?: PlatformEventType;
    channel?: PlatformChannel;
    is_active?: boolean;
}) => {
    return useQuery({
        queryKey: notificationQueryKeys.templates(params),
        queryFn: () => notificationService.getTemplates(params),
        // keepPreviousData: true,
    });
};

export const useNotificationTemplate = (id: string) => {
    return useQuery({
        queryKey: notificationQueryKeys.template(id),
        queryFn: () => notificationService.getTemplate(id),
        enabled: !!id,
    });
};

export const useCreateNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof notificationService.createTemplate>[0]) =>
            notificationService.createTemplate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useUpdateNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<NotificationTemplate> }) =>
            notificationService.updateTemplate(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.template(variables.id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useDuplicateNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.duplicateTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useActivateNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.activateTemplate(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.template(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useDeactivateNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.deactivateTemplate(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.template(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useArchiveNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.archiveTemplate(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.template(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useDeleteNotificationTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.templates() });
        },
    });
};

export const useTestNotificationTemplate = () => {
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { recipient_email?: string; variables?: Record<string, string> } }) =>
            notificationService.testTemplate(id, data),
    });
};

// Webhook hooks
export const useWebhooks = (params?: PageRequest & {
    status?: 'ACTIVE' | 'DISABLED';
    event?: string;
}) => {
    return useQuery({
        queryKey: notificationQueryKeys.webhooks(params),
        queryFn: () => notificationService.getWebhooks(params),
        // keepPreviousData: true,
    });
};

export const useWebhook = (id: string) => {
    return useQuery({
        queryKey: notificationQueryKeys.webhook(id),
        queryFn: () => notificationService.getWebhook(id),
        enabled: !!id,
    });
};

export const useCreateWebhook = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof notificationService.createWebhook>[0]) =>
            notificationService.createWebhook(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhooks() });
        },
    });
};

export const useUpdateWebhook = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Webhook> }) =>
            notificationService.updateWebhook(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhook(variables.id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhooks() });
        },
    });
};

export const useDisableWebhook = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.disableWebhook(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhook(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhooks() });
        },
    });
};

export const useEnableWebhook = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.enableWebhook(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhook(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhooks() });
        },
    });
};

export const useDeleteWebhook = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.deleteWebhook(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.webhooks() });
        },
    });
};

export const useTestWebhook = () => {
    return useMutation({
        mutationFn: (id: string) => notificationService.testWebhook(id),
    });
};

export const useRotateWebhookSecret = () => {
    return useMutation({
        mutationFn: (id: string) => notificationService.rotateSecret(id),
    });
};

// Delivery log hooks
export const useDeliveryLogs = (params?: PageRequest & {
    webhook_id?: string;
    event_id?: string;
    status_code?: number;
    date_from?: string;
    date_to?: string;
    recipient?: string;
    event?: string;
}) => {
    return useQuery({
        queryKey: notificationQueryKeys.deliveryLogs(params),
        queryFn: () => notificationService.getDeliveryLogs(params),
        // keepPreviousData: true,
    });
};

export const useDeliveryLog = (id: string) => {
    return useQuery({
        queryKey: notificationQueryKeys.deliveryLog(id),
        queryFn: () => notificationService.getDeliveryLog(id),
        enabled: !!id,
    });
};

export const useRetryDelivery = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationService.retryDelivery(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.deliveryLog(id) });
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.deliveryLogs() });
        },
    });
};

// Preference hooks
export const useNotificationPreferences = () => {
    return useQuery({
        queryKey: notificationQueryKeys.preferences(),
        queryFn: () => notificationService.getPreferences(),
    });
};

export const useUpdateNotificationPreferences = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof notificationService.updatePreferences>[0]) =>
            notificationService.updatePreferences(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.preferences() });
        },
    });
};

export const useResetNotificationPreferences = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => notificationService.resetPreferences(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationQueryKeys.preferences() });
        },
    });
};
