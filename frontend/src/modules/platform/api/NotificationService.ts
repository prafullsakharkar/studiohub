// Notification API Services
import { ApiClient } from '@/api/client/ApiClient';
import {
    Notification,
    NotificationTemplate,
    Webhook,
    DeliveryLog,
    PaginatedResponse,
    PageRequest,
    PlatformChannel,
    PlatformEventType,
    PlatformPriority,
} from '@/modules/platform/types';

export class NotificationService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    // Notification Center
    async getNotifications(params?: PageRequest & {
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
    }): Promise<PaginatedResponse<Notification>> {
        const response = await this.apiClient.get<PaginatedResponse<Notification>>('/platform/notifications/', { params });
        return response;
    }

    async getUnreadCount(): Promise<{ count: number }> {
        const response = await this.apiClient.get<{ count: number }>('/platform/notifications/unread-count/');
        return response;
    }

    async markAsRead(id: string): Promise<Notification> {
        const response = await this.apiClient.post<Notification>(`/platform/notifications/${id}/mark-read/`);
        return response;
    }

    async markAsUnread(id: string): Promise<Notification> {
        const response = await this.apiClient.post<Notification>(`/platform/notifications/${id}/mark-unread/`);
        return response;
    }

    async markAllAsRead(): Promise<{ success: boolean; count: number }> {
        const response = await this.apiClient.post<{ success: boolean; count: number }>('/platform/notifications/mark-all-read/');
        return response;
    }

    async archive(id: string): Promise<Notification> {
        const response = await this.apiClient.post<Notification>(`/platform/notifications/${id}/archive/`);
        return response;
    }

    async unarchive(id: string): Promise<Notification> {
        const response = await this.apiClient.post<Notification>(`/platform/notifications/${id}/unarchive/`);
        return response;
    }

    async delete(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/notifications/${id}/`);
    }

    async bulkMarkRead(ids: string[]): Promise<{ success: boolean; count: number }> {
        const response = await this.apiClient.post<{ success: boolean; count: number }>('/platform/notifications/bulk-mark-read/', { ids });
        return response;
    }

    async bulkArchive(ids: string[]): Promise<{ success: boolean; count: number }> {
        const response = await this.apiClient.post<{ success: boolean; count: number }>('/platform/notifications/bulk-archive/', { ids });
        return response;
    }

    async bulkDelete(ids: string[]): Promise<{ success: boolean; count: number }> {
        const response = await this.apiClient.post<{ success: boolean; count: number }>('/platform/notifications/bulk-delete/', { ids });
        return response;
    }

    // Notification Templates
    async getTemplates(params?: PageRequest & {
        event_type?: PlatformEventType;
        channel?: PlatformChannel;
        is_active?: boolean;
    }): Promise<PaginatedResponse<NotificationTemplate>> {
        const response = await this.apiClient.get<PaginatedResponse<NotificationTemplate>>('/platform/notification-templates/', { params });
        return response;
    }

    async getTemplate(id: string): Promise<NotificationTemplate> {
        const response = await this.apiClient.get<NotificationTemplate>(`/platform/notification-templates/${id}/`);
        return response;
    }

    async createTemplate(data: {
        name: string;
        description?: string;
        event_type: PlatformEventType;
        channel: PlatformChannel;
        subject: string;
        body: string;
        variables?: string[];
        is_active?: boolean;
        is_default?: boolean;
    }): Promise<NotificationTemplate> {
        const response = await this.apiClient.post<NotificationTemplate>('/platform/notification-templates/', data);
        return response;
    }

    async updateTemplate(id: string, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
        const response = await this.apiClient.patch<NotificationTemplate>(`/platform/notification-templates/${id}/`, data);
        return response;
    }

    async duplicateTemplate(id: string): Promise<NotificationTemplate> {
        const response = await this.apiClient.post<NotificationTemplate>(`/platform/notification-templates/${id}/duplicate/`);
        return response;
    }

    async activateTemplate(id: string): Promise<NotificationTemplate> {
        const response = await this.apiClient.post<NotificationTemplate>(`/platform/notification-templates/${id}/activate/`);
        return response;
    }

    async deactivateTemplate(id: string): Promise<NotificationTemplate> {
        const response = await this.apiClient.post<NotificationTemplate>(`/platform/notification-templates/${id}/deactivate/`);
        return response;
    }

    async archiveTemplate(id: string): Promise<NotificationTemplate> {
        const response = await this.apiClient.post<NotificationTemplate>(`/platform/notification-templates/${id}/archive/`);
        return response;
    }

    async deleteTemplate(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/notification-templates/${id}/`);
    }

    async testTemplate(id: string, data: {
        recipient_email?: string;
        variables?: Record<string, string>;
    }): Promise<{ success: boolean; message: string }> {
        const response = await this.apiClient.post<{ success: boolean; message: string }>(
            `/platform/notification-templates/${id}/test/`,
            data
        );
        return response;
    }

    // Webhooks
    async getWebhooks(params?: PageRequest & {
        status?: 'ACTIVE' | 'DISABLED';
        event?: string;
    }): Promise<PaginatedResponse<Webhook>> {
        const response = await this.apiClient.get<PaginatedResponse<Webhook>>('/platform/webhooks/', { params });
        return response;
    }

    async getWebhook(id: string): Promise<Webhook> {
        const response = await this.apiClient.get<Webhook>(`/platform/webhooks/${id}/`);
        return response;
    }

    async createWebhook(data: {
        name: string;
        endpoint_url: string;
        events: string[];
        secret?: string;
        headers?: Record<string, string>;
        retry_policy?: {
            max_retries: number;
            initial_delay: number;
            max_delay: number;
            backoff_multiplier: number;
        };
        timeout?: number;
        status?: 'ACTIVE' | 'DISABLED';
    }): Promise<Webhook> {
        const response = await this.apiClient.post<Webhook>('/platform/webhooks/', data);
        return response;
    }

    async updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook> {
        const response = await this.apiClient.patch<Webhook>(`/platform/webhooks/${id}/`, data);
        return response;
    }

    async disableWebhook(id: string): Promise<Webhook> {
        const response = await this.apiClient.post<Webhook>(`/platform/webhooks/${id}/disable/`);
        return response;
    }

    async enableWebhook(id: string): Promise<Webhook> {
        const response = await this.apiClient.post<Webhook>(`/platform/webhooks/${id}/enable/`);
        return response;
    }

    async deleteWebhook(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/webhooks/${id}/`);
    }

    async testWebhook(id: string): Promise<{ success: boolean; message: string; delivery_id?: string }> {
        const response = await this.apiClient.post<{ success: boolean; message: string; delivery_id?: string }>(
            `/platform/webhooks/${id}/test/`
        );
        return response;
    }

    async rotateSecret(id: string): Promise<{ success: boolean; new_secret: string }> {
        const response = await this.apiClient.post<{ success: boolean; new_secret: string }>(
            `/platform/webhooks/${id}/rotate-secret/`
        );
        return response;
    }

    // Delivery Logs
    async getDeliveryLogs(params?: PageRequest & {
        webhook_id?: string;
        event_id?: string;
        status_code?: number;
        date_from?: string;
        date_to?: string;
        recipient?: string;
        event?: string;
    }): Promise<PaginatedResponse<DeliveryLog>> {
        const response = await this.apiClient.get<PaginatedResponse<DeliveryLog>>('/platform/delivery-logs/', { params });
        return response;
    }

    async getDeliveryLog(id: string): Promise<DeliveryLog> {
        const response = await this.apiClient.get<DeliveryLog>(`/platform/delivery-logs/${id}/`);
        return response;
    }

    async retryDelivery(id: string): Promise<{ success: boolean; delivery_id?: string }> {
        const response = await this.apiClient.post<{ success: boolean; delivery_id?: string }>(
            `/platform/delivery-logs/${id}/retry/`
        );
        return response;
    }

    // Notification Preferences
    async getPreferences(): Promise<{
        email_notifications: boolean;
        in_app_notifications: boolean;
        push_notifications: boolean;
        webhook_preferences: boolean;
        digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
        quiet_hours: {
            enabled: boolean;
            start: string;
            end: string;
        };
        categories: Record<string, boolean>;
        module_preferences: Record<string, Record<string, boolean>>;
    }> {
        const response = await this.apiClient.get<{
            email_notifications: boolean;
            in_app_notifications: boolean;
            push_notifications: boolean;
            webhook_preferences: boolean;
            digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
            quiet_hours: {
                enabled: boolean;
                start: string;
                end: string;
            };
            categories: Record<string, boolean>;
            module_preferences: Record<string, Record<string, boolean>>;
        }>('/platform/notification-preferences/');
        return response;
    }

    async updatePreferences(data: {
        email_notifications?: boolean;
        in_app_notifications?: boolean;
        push_notifications?: boolean;
        webhook_preferences?: boolean;
        digest_frequency?: 'INSTANT' | 'DAILY' | 'WEEKLY';
        quiet_hours?: {
            enabled: boolean;
            start: string;
            end: string;
        };
        categories?: Record<string, boolean>;
        module_preferences?: Record<string, Record<string, boolean>>;
    }): Promise<{
        email_notifications: boolean;
        in_app_notifications: boolean;
        push_notifications: boolean;
        webhook_preferences: boolean;
        digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
        quiet_hours: {
            enabled: boolean;
            start: string;
            end: string;
        };
        categories: Record<string, boolean>;
        module_preferences: Record<string, Record<string, boolean>>;
    }> {
        const response = await this.apiClient.patch<{
            email_notifications: boolean;
            in_app_notifications: boolean;
            push_notifications: boolean;
            webhook_preferences: boolean;
            digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
            quiet_hours: {
                enabled: boolean;
                start: string;
                end: string;
            };
            categories: Record<string, boolean>;
            module_preferences: Record<string, Record<string, boolean>>;
        }>('/platform/notification-preferences/', data);
        return response;
    }

    async resetPreferences(): Promise<{
        email_notifications: boolean;
        in_app_notifications: boolean;
        push_notifications: boolean;
        webhook_preferences: boolean;
        digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
        quiet_hours: {
            enabled: boolean;
            start: string;
            end: string;
        };
        categories: Record<string, boolean>;
        module_preferences: Record<string, Record<string, boolean>>;
    }> {
        const response = await this.apiClient.post<{
            email_notifications: boolean;
            in_app_notifications: boolean;
            push_notifications: boolean;
            webhook_preferences: boolean;
            digest_frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
            quiet_hours: {
                enabled: boolean;
                start: string;
                end: string;
            };
            categories: Record<string, boolean>;
            module_preferences: Record<string, Record<string, boolean>>;
        }>('/platform/notification-preferences/reset/');
        return response;
    }
}
